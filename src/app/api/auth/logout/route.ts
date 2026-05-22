import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { refreshToken } = body;
    if (!refreshToken) {
      return NextResponse.json({ success: true });
    }
    const result = await authService.logout(refreshToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false });
  }
}
