import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';
import { verifyJwtAndGetUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await verifyJwtAndGetUser(req);
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body;
    const ip = req.headers.get('x-forwarded-for') || undefined;
    const ua = req.headers.get('user-agent') || undefined;

    const result = await authService.logout(
      refreshToken || undefined,
      user?.id,
      user?.username,
      ip,
      ua
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false });
  }
}
