import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { storageService } from '@/services/storage.service';

export async function POST(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = (formData.get('photo') || formData.get('file')) as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No photo provided' }, { status: 400 });
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid image format. Supported formats: JPEG, PNG, WEBP, GIF.' },
        { status: 400 }
      );
    }

    // Limit to 10KB
    if (file.size > 10 * 1024) {
      return NextResponse.json(
        { message: 'File too large. Maximum photo size is 10KB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const avatarUrl = await storageService.saveUserPhoto(
      {
        originalname: file.name,
        mimetype: file.type,
        size: file.size,
        buffer,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      message: 'Profile photo updated successfully',
      avatarUrl,
    });
  } catch (error: any) {
    console.error('[User Photo Upload] Error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to update profile photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await storageService.deleteUserPhoto(user.id);
    return NextResponse.json({
      success: true,
      message: 'Profile photo deleted successfully',
    });
  } catch (error: any) {
    console.error('[User Photo Delete] Error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to remove profile photo' },
      { status: 500 }
    );
  }
}
