import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { chatService } from '@/services/chat.service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit');
  const cursor = searchParams.get('cursor') || undefined;
  const limitNum = limit ? parseInt(limit, 10) : 50;

  try {
    const messages = await chatService.getRoomMessages(roomId, user.id, limitNum, cursor);
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const body = await req.json();
    const { content, classification } = body;
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    
    const message = await chatService.sendMessage(roomId, user.id, content, classification, ip);
    return NextResponse.json(message);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to send message' }, { status: 500 });
  }
}
