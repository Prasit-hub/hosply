import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { prisma } from '../lib/db';
import { encrypt, decrypt } from '../common/utils/crypto';

export class AuthService {
  private readonly jwtSecret = (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'undefined' && process.env.JWT_SECRET !== 'null')
    ? process.env.JWT_SECRET
    : '761d04cd-6464-4cb8-a9c7-865827c4a691';
  private readonly jwtRefreshSecret = (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET !== 'undefined' && process.env.JWT_REFRESH_SECRET !== 'null')
    ? process.env.JWT_REFRESH_SECRET
    : 'f1285f04-c39e-4949-a4f4-ba811a49d0f5';

  constructor() {
    // Seed initial roles and users asynchronously in background
    this.seedInitialRolesAndUsers().catch(err => {
      console.error('Failed to seed initial clinical data:', err);
    });
  }

  // Seed default clinical/admin roles and one doctor & admin user for demonstration
  async seedInitialRolesAndUsers() {
    try {
      // 1. Seed permissions
      let pReadConf = await prisma.permission.findFirst({ where: { action: 'READ_CONFIDENTIAL' } });
      if (!pReadConf) {
        pReadConf = await prisma.permission.create({ data: { action: 'READ_CONFIDENTIAL', description: 'Read confidential clinical notes' } });
      }

      let pReadRestr = await prisma.permission.findFirst({ where: { action: 'READ_RESTRICTED' } });
      if (!pReadRestr) {
        pReadRestr = await prisma.permission.create({ data: { action: 'READ_RESTRICTED', description: 'Read restricted/protected record logs' } });
      }

      let pExportAudit = await prisma.permission.findFirst({ where: { action: 'EXPORT_AUDIT' } });
      if (!pExportAudit) {
        pExportAudit = await prisma.permission.create({ data: { action: 'EXPORT_AUDIT', description: 'Read and export audit reports' } });
      }

      // 2. Seed roles
      let doctorRole = await prisma.role.findFirst({ where: { name: 'Doctor' } });
      if (!doctorRole) {
        doctorRole = await prisma.role.create({ data: { name: 'Doctor', description: 'Clinical Doctors' } });
      }

      let nurseRole = await prisma.role.findFirst({ where: { name: 'Nurse' } });
      if (!nurseRole) {
        nurseRole = await prisma.role.create({ data: { name: 'Nurse', description: 'Clinical Nurses' } });
      }

      let adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
      if (!adminRole) {
        adminRole = await prisma.role.create({
          data: {
            name: 'Admin',
            description: 'System Administrators',
            permissions: { connect: [{ id: pReadConf.id }, { id: pReadRestr.id }, { id: pExportAudit.id }] },
          },
        });
      }

      let pharmacistRole = await prisma.role.findFirst({ where: { name: 'Pharmacist' } });
      if (!pharmacistRole) {
        pharmacistRole = await prisma.role.create({ data: { name: 'Pharmacist', description: 'Pharmacy Staff' } });
      }

      let labRole = await prisma.role.findFirst({ where: { name: 'Lab Staff' } });
      if (!labRole) {
        labRole = await prisma.role.create({ data: { name: 'Lab Staff', description: 'Laboratory Staff' } });
      }

      let radiologyRole = await prisma.role.findFirst({ where: { name: 'Radiology Staff' } });
      if (!radiologyRole) {
        radiologyRole = await prisma.role.create({ data: { name: 'Radiology Staff', description: 'Radiology Team' } });
      }

      let staffRole = await prisma.role.findFirst({ where: { name: 'Staff' } });
      if (!staffRole) {
        staffRole = await prisma.role.create({ data: { name: 'Staff', description: 'General Support & Operations Staff' } });
      }

      // 3. Seed users
      const adminPasswordHash = await bcrypt.hash('password123', 10);

      const usersToSeed = [
        { username: 'admin1', firstName: 'System', lastName: 'Admin', roleId: adminRole.id, professionalId: undefined as string | undefined },
      ];

      for (const u of usersToSeed) {
        const hash = adminPasswordHash;
        const exists = await prisma.user.findUnique({ where: { username: u.username } });
        if (!exists) {
          await prisma.user.create({
            data: {
              username: u.username,
              passwordHash: hash,
              firstName: encrypt(u.firstName),
              lastName: encrypt(u.lastName),
              professionalId: u.professionalId,
              roleId: u.roleId,
            },
          });
        } else {
          // Sync password if user already exists
          await prisma.user.update({
            where: { id: exists.id },
            data: { passwordHash: hash },
          });
        }
      }

      console.log('[Auth Service] Initial roles and users checked/seeded successfully.');
    } catch (err) {
      console.error('[Auth Service] Failed to seed initial clinical data:', err);
    }
  }

  async login(username: string, pass: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid username or password');
    }

    const payload = { username: user.username, sub: user.id, role: user.role.name };
    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '15m' });
    
    // Rotation pattern: Generate refresh token and save session
    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, { expiresIn: '7d' });

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: decrypt(user.firstName),
        lastName: decrypt(user.lastName),
        role: user.role.name,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;

      const session = await prisma.session.findUnique({
        where: { refreshToken },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new Error('Session expired or invalid');
      }

      // Rotate token: Delete old session, generate new token
      await prisma.session.delete({ where: { id: session.id } });

      const newPayload = { username: payload.username, sub: payload.sub, role: payload.role };
      const newAccessToken = jwt.sign(newPayload, this.jwtSecret, { expiresIn: '15m' });
      const newRefreshToken = jwt.sign(newPayload, this.jwtRefreshSecret, { expiresIn: '7d' });

      await prisma.session.create({
        data: {
          userId: payload.sub,
          refreshToken: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      throw new Error('Invalid token');
    }
  }

  async logout(refreshToken: string) {
    try {
      await prisma.session.deleteMany({
        where: { refreshToken },
      });
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}

export const authService = new AuthService();
export default authService;
