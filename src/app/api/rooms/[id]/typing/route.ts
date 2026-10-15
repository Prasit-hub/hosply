import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { realtimeService } from '@/services/realtime.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const body = await req.json();
    const { isTyping } = body;

    const typingData = {
      roomId,
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      isTyping: !!isTyping,
    };

    await realtimeService.triggerTyping(roomId, typingData);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Typing update failed' }, { status: 500 });
  }
}
