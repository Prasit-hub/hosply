import { NextResponse } from 'next/server';
import { storageService } from '@/services/storage.service';
import * as fs from 'fs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: attachmentId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const inline = searchParams.get('inline');

  if (!token) {
    return NextResponse.json({ message: 'Security token is required' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown';

  try {
    const fileData = await storageService.verifyAndGetFile(attachmentId, token, ip);
    const fileBuffer = fs.readFileSync(fileData.filePath);

    const headers = new Headers();
    headers.set('Content-Type', fileData.fileType);
    
    if (inline === 'true') {
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileData.fileName)}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileData.fileName)}"`);
    }

    return new Response(fileBuffer, { headers });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to download file' }, { status: 403 });
  }
}
