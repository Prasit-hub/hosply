import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'Admin') {
    return NextResponse.json({ message: 'Only Administrators can view roles' }, { status: 403 });
  }

  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    
    const otherIndex = roles.findIndex(r => r.name === 'Other');
    if (otherIndex > -1) {
      const [otherRole] = roles.splice(otherIndex, 1);
      roles.push(otherRole);
    }

    return NextResponse.json(roles);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch roles' }, { status: 500 });
  }
}
