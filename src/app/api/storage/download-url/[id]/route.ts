import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { storageService } from '@/services/storage.service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: attachmentId } = await params;
  const ip = req.headers.get('x-forwarded-for') || 'unknown';

  try {
    const url = await storageService.getSecureDownloadUrl(attachmentId, user.id, ip);
    return NextResponse.json({ url });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to generate download URL' }, { status: 500 });
  }
}
