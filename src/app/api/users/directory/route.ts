import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decrypt } from '@/common/utils/crypto';

export async function GET(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    const onlineUserSockets = ((process as any).onlineUserSockets || (global as any).onlineUserSockets) as Map<string, Set<string>> | undefined;

    const result = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      firstName: decrypt(u.firstName),
      lastName: decrypt(u.lastName),
      role: u.role?.name || u.role || 'Staff',
      avatarUrl: u.avatarUrl || null,
      isOnline: Boolean(onlineUserSockets?.has(u.id) && (onlineUserSockets.get(u.id)?.size || 0) > 0),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch directory' }, { status: 500 });
  }
}
