import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { realtimeService } from '@/services/realtime.service';

export async function POST(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const pusher = realtimeService.getPusher();
  if (!pusher) {
    return NextResponse.json({ message: 'Pusher is not configured on server' }, { status: 400 });
  }

  try {
    let socketId = '';
    let channelName = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      socketId = body.socket_id;
      channelName = body.channel_name;
    } else {
      const formData = await req.formData();
      socketId = formData.get('socket_id') as string;
      channelName = formData.get('channel_name') as string;
    }

    if (!socketId || !channelName) {
      return NextResponse.json({ message: 'socket_id and channel_name are required' }, { status: 400 });
    }

    // Prepare presence channel data
    const userRoleObj = (user as any).role;
    const roleName = userRoleObj ? (typeof userRoleObj === 'object' && userRoleObj.name ? userRoleObj.name : String(userRoleObj)) : 'Staff';
    const presenceData = {
      user_id: user.id,
      user_info: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: roleName,
        avatarUrl: (user as any).avatarUrl || null,
      },
    };

    const authResponse = pusher.authorizeChannel(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error: any) {
    console.error('[Pusher Auth] Authorization failed:', error);
    return NextResponse.json({ message: error.message || 'Authorization failed' }, { status: 500 });
  }
}
