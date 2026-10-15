import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { prisma } from './lib/db';
import { chatService } from './services/chat.service';
import { decrypt } from './common/utils/crypto';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const rawPort = process.env.PORT;
const port = parseInt((rawPort && rawPort !== 'undefined' && rawPort !== 'null') ? rawPort : '3006', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rawJwtSecret = process.env.JWT_SECRET;
const JWT_SECRET = (rawJwtSecret && rawJwtSecret !== 'undefined' && rawJwtSecret !== 'null')
  ? rawJwtSecret
  : '761d04cd-6464-4cb8-a9c7-865827c4a691';

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*', // In production, restrict to hospital domain
    },
  });

  (global as any).io = io;
  (process as any).io = io;
  const onlineUserSockets = new Map<string, Set<string>>();
  (global as any).onlineUserSockets = onlineUserSockets;
  (process as any).onlineUserSockets = onlineUserSockets;

  // Authentication Middleware for Socket.IO
  io.use(async (socket: Socket, nextFn) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      let token: string | null = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (typeof socket.handshake.query.token === 'string') {
        token = socket.handshake.query.token;
      }

      if (!token) {
        return nextFn(new Error('Authentication token missing'));
      }

      const payload = jwt.verify(token, JWT_SECRET) as any;
      
      // Fetch full active user from DB
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        return nextFn(new Error('User is suspended or does not exist'));
      }

      socket.data.user = {
        id: user.id,
        username: user.username,
        firstName: decrypt(user.firstName),
        lastName: decrypt(user.lastName),
        role: user.role.name,
      };

      console.log(`[Socket] Authenticated: ${user.username} (${socket.id})`);
      nextFn();
    } catch (error) {
      console.warn(`[Socket] Connection rejected: Unauthenticated (${socket.id})`);
      nextFn(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user;
    
    if (user) {
      if (!onlineUserSockets.has(user.id)) {
        onlineUserSockets.set(user.id, new Set());
      }
      const userSockets = onlineUserSockets.get(user.id)!;
      const isFirstConnection = userSockets.size === 0;
      userSockets.add(socket.id);

      socket.join(`user_${user.id}`);
      console.log(`[Socket] User ${user.username} joined personal room: user_${user.id}`);

      // Auto-join all rooms the user is currently a member of
      try {
        const memberships = await prisma.roomMember.findMany({
          where: { userId: user.id },
          select: { roomId: true },
        });
        memberships.forEach((m) => {
          socket.join(`room_${m.roomId}`);
          console.log(`[Socket] Auto-joined Room: room_${m.roomId} for user ${user.username}`);
        });
      } catch (err) {
        console.error('[Socket] Failed to auto-join rooms on connection:', err);
      }

      // Broadcast online status if first socket connection for this user
      if (isFirstConnection) {
        io.emit('userPresence', {
          userId: user.id,
          username: user.username,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      }

      // Send the complete active online user list to the connected client
      const currentOnlineIds = Array.from(onlineUserSockets.keys()).filter(
        (id) => (onlineUserSockets.get(id)?.size || 0) > 0
      );
      socket.emit('onlineUsersList', {
        userIds: currentOnlineIds,
      });
    }

    socket.on('joinRoom', async (data: { roomId: string }) => {
      if (!user) return;
      socket.join(`room_${data.roomId}`);
      console.log(`[Socket] User ${user.username} joined room: room_${data.roomId}`);
      
      try {
        const now = new Date();
        const updated = await prisma.roomMember.updateMany({
          where: { roomId: data.roomId, userId: user.id },
          data: { lastReadAt: now },
        });

        // Broadcast active status
        io.to(`room_${data.roomId}`).emit('userStatusChange', {
          userId: user.id,
          status: 'online',
        });

        // Broadcast read status if member exists
        if (updated.count > 0) {
          io.to(`room_${data.roomId}`).emit('userReadRoom', {
            userId: user.id,
            roomId: data.roomId,
            lastReadAt: now.toISOString(),
          });
        }
      } catch (err) {
        console.error('[Socket] Failed to update/broadcast lastReadAt on joinRoom:', err);
      }
    });

    socket.on('readRoom', async (data: { roomId: string }) => {
      if (!user) return;
      try {
        const now = new Date();
        const updated = await prisma.roomMember.updateMany({
          where: { roomId: data.roomId, userId: user.id },
          data: { lastReadAt: now },
        });

        if (updated.count > 0) {
          io.to(`room_${data.roomId}`).emit('userReadRoom', {
            userId: user.id,
            roomId: data.roomId,
            lastReadAt: now.toISOString(),
          });
        }
      } catch (err) {
        console.error('[Socket] Failed to update/broadcast lastReadAt on readRoom:', err);
      }
    });

    socket.on('leaveRoom', (data: { roomId: string }) => {
      socket.leave(`room_${data.roomId}`);
      console.log(`[Socket] User left room: room_${data.roomId}`);
    });

    socket.on('sendMessage', async (data: { roomId: string; content: string; classification?: string; messageId?: string }) => {
      if (!user) return;

      try {
        const ip = socket.handshake.address;
        const message = await chatService.sendMessage(
          data.roomId,
          user.id,
          data.content,
          data.classification || 'INTERNAL',
          ip,
          data.messageId
        );

        // Broadcast the decrypted message to the socket room
        io.to(`room_${data.roomId}`).emit('newMessage', message);
      } catch (err: any) {
        socket.emit('error', {
          message: err.message || 'Failed to send message',
        });
      }
    });

    socket.on('unsendMessage', async (data: { messageId: string; roomId: string }) => {
      if (!user) return;
      try {
        const ip = socket.handshake.address;
        const result = await chatService.unsendMessage(data.messageId, user.id, user.role, ip);
        io.to(`room_${data.roomId}`).emit('messageUnsent', {
          messageId: result.messageId,
          roomId: result.roomId,
          deletedAt: result.deletedAt,
        });
      } catch (err: any) {
        socket.emit('error', {
          message: err.message || 'Failed to unsend message',
        });
      }
    });

    socket.on('clearRoom', async (data: { roomId: string; purgeAll?: boolean }) => {
      if (!user) return;
      try {
        const ip = socket.handshake.address;
        const result = await chatService.clearRoomHistory(data.roomId, user.id, data.purgeAll, user.role, ip);
        if (result.purgedAll) {
          io.to(`room_${data.roomId}`).emit('roomPurged', {
            roomId: data.roomId,
            clearedAt: result.clearedAt,
          });
        } else {
          socket.emit('roomCleared', {
            roomId: data.roomId,
            clearedAt: result.clearedAt,
          });
        }
      } catch (err: any) {
        socket.emit('error', {
          message: err.message || 'Failed to clear chat history',
        });
      }
    });

    socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
      if (!user) return;

      socket.to(`room_${data.roomId}`).emit('userTyping', {
        roomId: data.roomId,
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isTyping: data.isTyping,
      });
    });

    socket.on('userLogout', () => {
      if (user) {
        onlineUserSockets.delete(user.id);
        io.emit('userPresence', {
          userId: user.id,
          username: user.username,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
        console.log(`[Socket] User explicitly logged out: ${user.username}`);
      }
    });

    socket.on('disconnect', () => {
      if (user) {
        console.log(`[Socket] Client disconnected: ${user.username} (${socket.id})`);
        const userSockets = onlineUserSockets.get(user.id);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUserSockets.delete(user.id);
            io.emit('userPresence', {
              userId: user.id,
              username: user.username,
              status: 'offline',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
