import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';
import { realtimeService } from '@/services/realtime.service';

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

    if (result.purgedAll) {
      await realtimeService.triggerRoomPurged(roomId);
    } else {
      await realtimeService.triggerRoomCleared(roomId, user.id);
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
