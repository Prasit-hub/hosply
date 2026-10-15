import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    let purgeAll = false;
    try {
      const body = await req.json();
      purgeAll = !!body?.purgeAll;
    } catch {
      // body empty or not json
    }

    const result = await chatService.clearRoomHistory(roomId, user.id, purgeAll, user.role);

    const io = (global as any).io;
    if (io) {
      if (result.purgedAll) {
        io.to(`room_${roomId}`).emit('roomPurged', {
          roomId,
          clearedAt: result.clearedAt,
        });
      } else {
        io.to(`user_${user.id}`).emit('roomCleared', {
          roomId,
          clearedAt: result.clearedAt,
        });
      }
    }

    return NextResponse.json({
      message: result.purgedAll
        ? 'All room messages purged successfully'
        : 'Chat history cleared successfully',
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to clear chat history' }, { status: 500 });
  }
}
