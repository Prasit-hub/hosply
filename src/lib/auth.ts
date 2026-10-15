import * as jwt from 'jsonwebtoken';
import { prisma } from './db';
import { decrypt } from '@/common/utils/crypto';

const rawJwtSecret = process.env.JWT_SECRET;
const JWT_SECRET = (rawJwtSecret && rawJwtSecret !== 'undefined' && rawJwtSecret !== 'null')
  ? rawJwtSecret
  : '761d04cd-6464-4cb8-a9c7-865827c4a691';

export interface AuthenticatedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
}

export async function verifyJwtAndGetUser(req: Request): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      console.warn('[Auth] JWT verification failed:', err.message);
      return null;
    }
    
    // Verify user is active in DB
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    
    if (!user || !user.isActive) {
      console.warn('[Auth] User not found or inactive for token sub:', payload.sub);
      return null;
    }
    
    return {
      id: user.id,
      username: user.username,
      firstName: decrypt(user.firstName),
      lastName: decrypt(user.lastName),
      role: user.role.name,
      avatarUrl: (user as any).avatarUrl || null,
    };
  } catch (error: any) {
    console.error('[Auth] verifyJwtAndGetUser unexpected error:', error.message);
    return null;
  }
}
