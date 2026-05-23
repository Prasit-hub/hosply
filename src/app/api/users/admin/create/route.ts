import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as bcrypt from 'bcrypt';
import { encrypt, decrypt } from '@/common/utils/crypto';

export async function POST(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'Admin') {
    return NextResponse.json({ message: 'Only Administrators are allowed to manage users' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { username, password, firstName, lastName, professionalId, roleId } = body;
    if (!username || !password || !firstName || !lastName || !roleId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ message: 'Username is already taken' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        firstName: encrypt(firstName),
        lastName: encrypt(lastName),
        professionalId: professionalId || null,
        roleId,
      },
      include: { role: true },
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        firstName: decrypt(newUser.firstName),
        lastName: decrypt(newUser.lastName),
        professionalId: newUser.professionalId,
        role: newUser.role.name,
        isActive: newUser.isActive,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to create user' }, { status: 500 });
  }
}
