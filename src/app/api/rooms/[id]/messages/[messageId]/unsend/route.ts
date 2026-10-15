import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId, messageId } = await params;

  try {
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;
    const result = await chatService.unsendMessage(
      messageId,
      user.id,
      user.role,
      ipAddress
    );

    const io = (global as any).io;
    if (io) {
      io.to(`room_${roomId}`).emit('messageUnsent', {
        messageId: result.messageId,
        roomId: result.roomId,
        deletedAt: result.deletedAt,
      });
    }

    return NextResponse.json({
      message: 'Message unsent successfully',
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Failed to unsend message' },
      { status: 500 }
    );
  }
}
