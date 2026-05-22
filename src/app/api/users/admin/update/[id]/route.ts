import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as bcrypt from 'bcrypt';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'Admin') {
    return NextResponse.json({ message: 'Only Administrators are allowed to manage users' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { username, password, firstName, lastName, professionalId, roleId, isActive } = body;
    
    // Verify user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 400 });
    }

    // Verify unique username if changed
    if (username && username !== existingUser.username) {
      const exists = await prisma.user.findUnique({ where: { username } });
      if (exists) {
        return NextResponse.json({ message: 'Username is already taken' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (username) updateData.username = username;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (professionalId !== undefined) updateData.professionalId = professionalId || null;
    if (roleId) updateData.roleId = roleId;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        professionalId: updatedUser.professionalId,
        role: updatedUser.role.name,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to update user' }, { status: 500 });
  }
}
