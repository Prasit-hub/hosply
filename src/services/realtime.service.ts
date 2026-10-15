import Pusher from 'pusher';

export class RealtimeService {
  private pusherInstance: Pusher | null = null;

  constructor() {
    this.initPusher();
  }

  private initPusher() {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'ap1';

    if (appId && key && secret) {
      this.pusherInstance = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      });
      console.log(`[RealtimeService] Pusher Channels initialized (Cluster: ${cluster})`);
    } else {
      console.log('[RealtimeService] Pusher credentials not set; running in Socket.IO / Polling mode');
    }
  }

  private getSocketIo() {
    return (process as any).io || (global as any).io || null;
  }

  async triggerMessage(roomId: string, message: any, memberIds?: string[]) {
    // 1. Socket.io (for local Node.js server)
    const io = this.getSocketIo();
    if (io) {
      io.to(`room_${roomId}`).emit('newMessage', message);
      if (memberIds && memberIds.length > 0) {
        memberIds.forEach((mId) => {
          io.to(`user_${mId}`).emit('newMessage', message);
        });
      }
    }

    // 2. Pusher Channels (for Vercel Serverless)
    if (this.pusherInstance) {
      try {
        await this.pusherInstance.trigger(`presence-room-${roomId}`, 'newMessage', message);
        if (memberIds && memberIds.length > 0) {
          await Promise.all(
            memberIds.map((mId) =>
              this.pusherInstance?.trigger(`private-user-${mId}`, 'newMessage', message)
            )
          );
        }
      } catch (err) {
        console.warn('[RealtimeService] Pusher triggerMessage error:', err);
      }
    }
  }

  async triggerUnsend(roomId: string, messageId: string, deletedAt?: string | Date) {
    const payload = {
      messageId,
      roomId,
      deletedAt: typeof deletedAt === 'object' ? deletedAt.toISOString() : deletedAt || new Date().toISOString(),
    };

    const io = this.getSocketIo();
    if (io) {
      io.to(`room_${roomId}`).emit('messageUnsent', payload);
    }

    if (this.pusherInstance) {
      try {
        await this.pusherInstance.trigger(`presence-room-${roomId}`, 'messageUnsent', payload);
      } catch (err) {
        console.warn('[RealtimeService] Pusher triggerUnsend error:', err);
      }
    }
  }

  async triggerTyping(roomId: string, typingData: any) {
    const io = this.getSocketIo();
    if (io) {
      io.to(`room_${roomId}`).emit('userTyping', typingData);
    }

    if (this.pusherInstance) {
      try {
        await this.pusherInstance.trigger(`presence-room-${roomId}`, 'userTyping', typingData);
      } catch (err) {
        console.warn('[RealtimeService] Pusher triggerTyping error:', err);
      }
    }
  }

  async triggerRoomCleared(roomId: string, userId?: string) {
    const io = this.getSocketIo();
    if (io) {
      if (userId) {
        io.to(`user_${userId}`).emit('roomCleared', { roomId });
      } else {
        io.to(`room_${roomId}`).emit('roomCleared', { roomId });
      }
    }

    if (this.pusherInstance) {
      try {
        if (userId) {
          await this.pusherInstance.trigger(`private-user-${userId}`, 'roomCleared', { roomId });
        } else {
          await this.pusherInstance.trigger(`presence-room-${roomId}`, 'roomCleared', { roomId });
        }
      } catch (err) {
        console.warn('[RealtimeService] Pusher triggerRoomCleared error:', err);
      }
    }
  }

  async triggerRoomPurged(roomId: string) {
    const io = this.getSocketIo();
    if (io) {
      io.to(`room_${roomId}`).emit('roomPurged', { roomId });
    }

    if (this.pusherInstance) {
      try {
        await this.pusherInstance.trigger(`presence-room-${roomId}`, 'roomPurged', { roomId });
      } catch (err) {
        console.warn('[RealtimeService] Pusher triggerRoomPurged error:', err);
      }
    }
  }

  async triggerRoomJoined(memberId: string, roomData: any) {
    const io = this.getSocketIo();
    if (io) {
      io.to(`user_${memberId}`).emit('roomJoined', roomData);
    }

    if (this.pusherInstance) {
      try {
        await this.pusherInstance.trigger(`private-user-${memberId}`, 'roomJoined', roomData);
      } catch (err) {
        console.warn('[RealtimeService] Pusher triggerRoomJoined error:', err);
      }
    }
  }

  getPusher() {
    return this.pusherInstance;
  }
}

export const realtimeService = new RealtimeService();
