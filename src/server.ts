import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { prisma } from './lib/db';
import { chatService } from './services/chat.service';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const rawPort = process.env.PORT;
const port = parseInt((rawPort && rawPort !== 'undefined' && rawPort !== 'null') ? rawPort : '3006', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rawJwtSecret = process.env.JWT_SECRET;
const JWT_SECRET = (rawJwtSecret && rawJwtSecret !== 'undefined' && rawJwtSecret !== 'null')
  ? rawJwtSecret
  : 'hosply_super_secret_jwt_key_2026_clinical_collaboration';

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
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
      };

      console.log(`[Socket] Authenticated: ${user.username} (${socket.id})`);
      nextFn();
    } catch (error) {
      console.warn(`[Socket] Connection rejected: Unauthenticated (${socket.id})`);
      nextFn(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    socket.on('joinRoom', async (data: { roomId: string }) => {
      if (!user) return;
      socket.join(`room_${data.roomId}`);
      console.log(`[Socket] User ${user.username} joined room: room_${data.roomId}`);
      
      try {
        const now = new Date();
        await prisma.roomMember.update({
          where: { roomId_userId: { roomId: data.roomId, userId: user.id } },
          data: { lastReadAt: now },
        });

        // Broadcast active status
        io.to(`room_${data.roomId}`).emit('userStatusChange', {
          userId: user.id,
          status: 'online',
        });

        // Broadcast read status
        io.to(`room_${data.roomId}`).emit('userReadRoom', {
          userId: user.id,
          roomId: data.roomId,
          lastReadAt: now.toISOString(),
        });
      } catch (err) {
        console.error('[Socket] Failed to update/broadcast lastReadAt on joinRoom:', err);
      }
    });

    socket.on('readRoom', async (data: { roomId: string }) => {
      if (!user) return;
      try {
        const now = new Date();
        await prisma.roomMember.update({
          where: { roomId_userId: { roomId: data.roomId, userId: user.id } },
          data: { lastReadAt: now },
        });

        io.to(`room_${data.roomId}`).emit('userReadRoom', {
          userId: user.id,
          roomId: data.roomId,
          lastReadAt: now.toISOString(),
        });
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

    socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
      if (!user) return;

      socket.to(`room_${data.roomId}`).emit('userTyping', {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      if (user) {
        console.log(`[Socket] Client disconnected: ${user.username} (${socket.id})`);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
