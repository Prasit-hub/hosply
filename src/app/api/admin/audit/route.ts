import { NextResponse } from 'next/server';
import { verifyJwtAndGetUser } from '@/lib/auth';
import { auditService } from '@/services/audit.service';

export async function GET(req: Request) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'Admin') {
    return NextResponse.json({ message: 'Only Administrators can view audit logs' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page');
  const limit = searchParams.get('limit');
  const search = searchParams.get('search') || '';

  const pageNum = page ? parseInt(page, 10) : 1;
  const limitNum = limit ? parseInt(limit, 10) : 50;

  try {
    const result = await auditService.getLogs(pageNum, limitNum, search);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
