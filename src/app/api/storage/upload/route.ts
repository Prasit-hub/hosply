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
    const file = formData.get('file') as File | null;
    const roomId = formData.get('roomId') as string | null;
    
    const originalName = (formData.get('originalName') as string) || file?.name;
    const originalType = (formData.get('originalType') as string) || file?.type;
    const originalSize = formData.get('originalSize') ? parseInt(formData.get('originalSize') as string, 10) : file?.size;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }
    if (!roomId) {
      return NextResponse.json({ message: 'Target roomId must be specified' }, { status: 400 });
    }

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: 'Security Policy: File exceeds maximum 10MB size limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await storageService.saveUploadedFile(
      {
        originalname: originalName!,
        mimetype: originalType!,
        size: originalSize!,
        buffer,
      },
      roomId,
      user.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to upload file' }, { status: 500 });
  }
}
