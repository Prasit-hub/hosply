import { prisma } from '../lib/db';
import { auditService } from './audit.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadedFileDto {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class StorageService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly activeTokens = new Map<string, { userId: string; attachmentId: string; expiresAt: Date }>();

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // Pre-signed download url simulation
  async getSecureDownloadUrl(attachmentId: string, userId: string, ipAddress?: string): Promise<string> {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            room: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Check room membership
    const isMember = attachment.message.room.members.some(m => m.userId === userId);
    if (!isMember) {
      throw new Error('Unauthorized: You are not a member of the room containing this file');
    }

    // Audit the file download access request
    await auditService.log({
      userId,
      action: 'FILE_DOWNLOAD_REQUEST',
      entity: 'Attachment',
      entityId: attachmentId,
      details: {
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        roomId: attachment.message.roomId,
      },
      ipAddress,
    });

    // Generate short-lived (5 minutes) secure download token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    this.activeTokens.set(token, { userId, attachmentId, expiresAt });

    return `/api/storage/download/${attachmentId}?token=${token}`;
  }

  async verifyAndGetFile(attachmentId: string, token: string, ipAddress?: string) {
    const active = this.activeTokens.get(token);
    if (!active || active.attachmentId !== attachmentId || active.expiresAt < new Date()) {
      throw new Error('Invalid or expired secure signed URL token');
    }

    // Clean up used token
    this.activeTokens.delete(token);

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new Error('File metadata not found');
    }

    const filePath = path.join(this.uploadDir, attachment.storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error('Physical file not found on disk');
    }

    // Write persistent audit entry for actual file transmission
    await auditService.log({
      userId: active.userId,
      action: 'FILE_DOWNLOADED',
      entity: 'Attachment',
      entityId: attachmentId,
      details: {
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
      },
      ipAddress,
    });

    return {
      filePath,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
    };
  }

  // Simulate receiving files (in prod, direct upload to MinIO)
  async saveUploadedFile(file: UploadedFileDto, roomId: string, senderId: string): Promise<any> {
    const storageKey = crypto.randomUUID() + path.extname(file.originalname);
    const filePath = path.join(this.uploadDir, storageKey);

    // Save to uploads folder
    fs.writeFileSync(filePath, file.buffer);

    // Create empty content message to hold attachment and link the attachment using nested writes
    // This avoids interactive transactions which can cause SQLite locks and timeouts
    const message = await prisma.message.create({
      data: {
        roomId,
        senderId,
        content: '', // Empty text
        classification: 'INTERNAL',
        attachments: {
          create: {
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            storageKey,
          }
        }
      },
      include: {
        attachments: true
      }
    });

    return {
      messageId: message.id,
      attachment: message.attachments[0],
    };
  }
}

export const storageService = new StorageService();
export default storageService;
