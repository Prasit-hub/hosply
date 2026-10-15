import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';
import { prisma } from '@/lib/db';
import { decrypt } from '@/common/utils/crypto';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        patientContext: true,
      },
    });

    if (!room) {
      return NextResponse.json({ message: 'Room not found' }, { status: 404 });
    }

    const isMember = room.members.some((m: any) => m.userId === user.id);
    const isSystemAdmin = user.role?.toLowerCase() === 'admin';

    if (!isMember && !isSystemAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ...room,
      members: room.members.map((m: any) => ({
        ...m,
        user: {
          ...m.user,
          firstName: decrypt(m.user.firstName),
          lastName: decrypt(m.user.lastName),
        },
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch room' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const body = await req.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ message: 'isActive boolean is required' }, { status: 400 });
    }

    const updatedRoom = await chatService.updateRoomStatus(roomId, isActive, user.id);

    // Real-time broadcast
    const io = (global as any).io;
    if (io) {
      io.to(`room_${roomId}`).emit('roomStatusUpdated', {
        roomId,
        isActive: updatedRoom.isActive,
        roomName: updatedRoom.name,
        operatorUsername: user.username,
      });
      io.emit('roomListUpdated', {
        roomId,
        isActive: updatedRoom.isActive,
      });
    }

    return NextResponse.json(updatedRoom);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to update room' }, { status: 500 });
  }
}
