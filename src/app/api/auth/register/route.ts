import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, firstName, lastName, professionalId } = body;

    if (!username || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (Username, Password, First Name, Last Name)' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรตามมาตรฐานความปลอดภัย' },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';

    const result = await authService.register(
      { username, password, firstName, lastName, professionalId },
      ip,
      ua
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Register API Error]:', error);
    const message = error.message || 'Registration failed';
    const status = message.includes('already taken') ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}
