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
    await chatService.clearRoomHistory(roomId, user.id);
    return NextResponse.json({ message: 'Chat history cleared successfully' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to clear chat history' }, { status: 500 });
  }
}
