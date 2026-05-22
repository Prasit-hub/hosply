import { prisma } from '../lib/db';

export interface AuditLogDto {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(dto: AuditLogDto) {
    try {
      const logEntry = await prisma.auditLog.create({
        data: {
          userId: dto.userId || null,
          action: dto.action,
          entity: dto.entity,
          entityId: dto.entityId || null,
          details: JSON.stringify(dto.details),
          ipAddress: dto.ipAddress || 'unknown',
          userAgent: dto.userAgent || 'unknown',
        },
      });
      console.log(`[Audit Log] Written: ${dto.action} on ${dto.entity} (Log ID: ${logEntry.id})`);
      return logEntry;
    } catch (error) {
      console.error('[Audit Log Error] Failed to write audit log to database', error);
    }
  }

  async getLogs(page = 1, limit = 50, search = '') {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entity: { contains: search } },
        { details: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              role: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}

export const auditService = new AuditService();
export default auditService;
