import { prisma } from '../lib/db';
import { auditService } from './audit.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';

export interface UploadedFileDto {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class StorageService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly activeTokens = new Map<string, { userId: string; attachmentId: string; expiresAt: Date }>();
  private blobServiceClient: BlobServiceClient | null = null;
  private containerName: string = '';
  private connectionString: string = '';

  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'hosply-attachments';
    
    if (this.connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      containerClient.createIfNotExists().catch((err: any) => {
        console.error('[Storage] Failed to initialize Azure Container:', err.message);
      });
    } else {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    }
  }

  /**
   * Encrypts a binary file buffer on-the-fly using AES-256-CBC
   * Prepends the 16-byte initialization vector (IV) to the start of the payload.
   */
  private encryptFile(buffer: Buffer): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY || 'b495b76a3b357ecdd22e9f8837b7948f8a3bc83a42dc4cadd16b44c35ca6f92e';
    const keyBuffer = crypto.createHash('sha256').update(rawKey).digest();
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    
    // Prepend 16-byte IV to the encrypted content
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypts an encrypted binary file payload on-the-fly using AES-256-CBC
   * Extracts the first 16-bytes as the IV, and decodes the rest back to the original file.
   */
  private decryptFile(encryptedBuffer: Buffer): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY || 'b495b76a3b357ecdd22e9f8837b7948f8a3bc83a42dc4cadd16b44c35ca6f92e';
    const keyBuffer = crypto.createHash('sha256').update(rawKey).digest();
    
    const iv = encryptedBuffer.subarray(0, 16);
    const ciphertext = encryptedBuffer.subarray(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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

    if (this.connectionString && this.blobServiceClient) {
      // Download encrypted bytes from Azure Storage Blob directly into RAM Buffer
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(attachment.storageKey);
      const encryptedBuffer = await blobClient.downloadToBuffer();
      
      return {
        buffer: encryptedBuffer,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      };
    } else {
      // Local disk fallback
      const filePath = path.join(this.uploadDir, attachment.storageKey);
      if (!fs.existsSync(filePath)) {
        throw new Error('Physical file not found on disk');
      }

      // Read encrypted file from disk
      const encryptedBuffer = fs.readFileSync(filePath);

      return {
        buffer: encryptedBuffer,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      };
    }
  }

  async saveUploadedFile(file: UploadedFileDto, roomId: string, senderId: string): Promise<any> {
    const storageKey = crypto.randomUUID() + path.extname(file.originalname);
    
    // In Model B (Client-side E2EE), the buffer is already encrypted by the browser
    const bufferToSave = file.buffer;

    if (this.connectionString && this.blobServiceClient) {
      // Upload encrypted payload to Azure Storage Blob
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(storageKey);
      await blockBlobClient.upload(bufferToSave, bufferToSave.length, {
        // Set content type to unreadable generic stream so cloud inspectors cannot read metadata
        blobHTTPHeaders: { blobContentType: 'application/octet-stream' }
      });
    } else {
      // Local disk fallback
      const filePath = path.join(this.uploadDir, storageKey);
      fs.writeFileSync(filePath, bufferToSave);
    }

    // Link the attachment metadata in the database
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
