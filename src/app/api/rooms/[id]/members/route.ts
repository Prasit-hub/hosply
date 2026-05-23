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
    const body = await req.json();
    const { memberIds } = body;
    if (!memberIds || !Array.isArray(memberIds)) {
      return NextResponse.json({ message: 'memberIds array is required' }, { status: 400 });
    }
    const result = await chatService.addRoomMembers(roomId, memberIds, user.id);
    
    // Broadcast real-time signal to all newly invited members
    const io = (global as any).io;
    if (io && result.addedMembers) {
      result.addedMembers.forEach((member: any) => {
        io.to(`user_${member.id}`).emit('roomJoined', { roomId, type: 'invite', message: result.message });
      });
      // Also notify existing room members that members were updated
      io.to(`room_${roomId}`).emit('roomMembersUpdated', { roomId, addedMembers: result.addedMembers });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to add members' }, { status: 500 });
  }
}
