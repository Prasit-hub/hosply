import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';

export async function GET(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role?.toLowerCase() !== 'admin') {
    return NextResponse.json({ message: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const rooms = await chatService.getAllRoomsForAdmin(user.id);
    return NextResponse.json({ rooms });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch rooms' }, { status: 500 });
  }
}
