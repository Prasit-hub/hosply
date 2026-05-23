import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decrypt } from '@/common/utils/crypto';

export async function GET(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'Admin') {
    return NextResponse.json({ message: 'Only Administrators are allowed to manage users' }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        professionalId: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const result = users.map(u => ({
      id: u.id,
      username: u.username,
      firstName: decrypt(u.firstName),
      lastName: decrypt(u.lastName),
      professionalId: u.professionalId,
      isActive: u.isActive,
      roleId: u.role.id,
      role: u.role.name,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch admin user list' }, { status: 500 });
  }
}
