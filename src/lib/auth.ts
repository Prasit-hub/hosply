import * as jwt from 'jsonwebtoken';
import { prisma } from './db';
import { decrypt } from '@/common/utils/crypto';

const rawJwtSecret = process.env.JWT_SECRET;
const JWT_SECRET = (rawJwtSecret && rawJwtSecret !== 'undefined' && rawJwtSecret !== 'null')
  ? rawJwtSecret
  : 'hosply_super_secret_jwt_key_2026_clinical_collaboration';

export interface AuthenticatedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

export async function verifyJwtAndGetUser(req: Request): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user is active in DB
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    
    if (!user || !user.isActive) {
      return null;
    }
    
    return {
      id: user.id,
      username: user.username,
      firstName: decrypt(user.firstName),
      lastName: decrypt(user.lastName),
      role: user.role.name,
    };
  } catch (error) {
    return null;
  }
}
