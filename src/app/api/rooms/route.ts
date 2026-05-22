import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';

export async function GET(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rooms = await chatService.getUserRooms(user.id);
    return NextResponse.json(rooms);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, type, memberIds, patientHn } = body;
    const room = await chatService.createRoom({ name, type, memberIds, patientHn }, user.id);
    return NextResponse.json(room);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to create room' }, { status: 500 });
  }
}
