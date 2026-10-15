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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body.userId;
    } catch {
      const url = new URL(req.url);
      targetUserId = url.searchParams.get('userId');
    }

    if (!targetUserId) {
      return NextResponse.json({ message: 'userId is required to remove member' }, { status: 400 });
    }

    const result = await chatService.removeRoomMember(roomId, targetUserId, user.id);

    // Broadcast real-time signal
    const io = (global as any).io;
    if (io) {
      // Notify the removed user
      io.to(`user_${targetUserId}`).emit('roomRemoved', { roomId, message: 'คุณถูกเชิญออกจากกลุ่มแชตนี้โดยผู้ดูแลระบบ' });
      // Notify remaining room members
      io.to(`room_${roomId}`).emit('roomMemberRemoved', { roomId, removedUserId: targetUserId });
      io.emit('roomMembersUpdated', { roomId, removedUserId: targetUserId });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to remove member' }, { status: 500 });
  }
}
