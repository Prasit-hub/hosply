import { prisma } from '../lib/db';
import { decrypt } from '../common/utils/crypto';

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
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        {
          user: {
            username: { contains: search, mode: 'insensitive' },
          },
        },
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

    const mappedItems = items.map((item: any) => {
      let user = null;
      if (item.user) {
        user = {
          id: item.user.id,
          username: item.user.username,
          firstName: decrypt(item.user.firstName),
          lastName: decrypt(item.user.lastName),
          role: item.user.role?.name || 'Staff',
        };
      } else {
        // Fallback: extract username if present in audit details JSON
        try {
          const parsed = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
          if (parsed?.username || parsed?.performedBy) {
            user = {
              id: '',
              username: parsed.username || parsed.performedBy,
              firstName: '',
              lastName: '',
              role: parsed.role || 'Staff',
            };
          }
        } catch {
          // ignore parsing error
        }
      }

      return {
        ...item,
        user,
      };
    });

    return {
      items: mappedItems,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}

export const auditService = new AuditService();
export default auditService;
