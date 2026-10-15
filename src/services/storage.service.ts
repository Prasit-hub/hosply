import { prisma } from '../lib/db';
import { auditService } from './audit.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { put, del } from '@vercel/blob';

export interface UploadedFileDto {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class StorageService {
  private readonly uploadDir = process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'uploads');
  private readonly activeTokens = new Map<string, { userId: string; attachmentId: string; expiresAt: Date }>();
  private blobServiceClient: BlobServiceClient | null = null;
  private containerName: string = '';
  private connectionString: string = '';

  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'hosply-attachments';
    
    if (this.connectionString) {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        containerClient.createIfNotExists().catch((err: any) => {
          console.error('[Storage] Failed to initialize Azure Container:', err.message);
        });
      } catch (e: any) {
        console.warn('[Storage] Azure initialization skipped:', e.message);
      }
    }

    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
      const avatarDir = path.join(this.uploadDir, 'avatars');
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
      }
    } catch (fsErr: any) {
      // On Vercel / serverless platforms, root directory may be read-only
      console.warn('[Storage] Local uploads directory creation skipped (read-only filesystem):', fsErr.message);
    }
  }

  public get hasVercelBlob(): boolean {
    return !!(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim());
  }

  /**
   * Saves a user profile photo using @vercel/blob (or disk fallback)
   * and updates user.avatarUrl in the database.
   */
  async saveUserPhoto(file: UploadedFileDto, userId: string): Promise<string> {
    if (file.size > 10 * 1024) {
      throw new Error('User profile photo must not exceed 10KB');
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const pathname = `avatars/user-${userId}-${Date.now()}${cleanExt}`;
    let avatarUrl: string;

    if (this.hasVercelBlob) {
      try {
        let blob;
        let isPrivate = false;
        try {
          blob = await put(pathname, file.buffer, {
            access: 'public',
            contentType: file.mimetype || 'image/jpeg',
          });
        } catch (err: any) {
          if (err.message && (err.message.includes('private access') || err.message.includes('private store'))) {
            blob = await put(pathname, file.buffer, {
              access: 'private',
              contentType: file.mimetype || 'image/jpeg',
            });
            isPrivate = true;
          } else {
            throw err;
          }
        }

        // If the store is private, browser <img> tags cannot access the private Vercel URL directly (returns 403 Forbidden).
        // Therefore, we cache locally as /api/uploads/avatars/... while keeping the photo safely backed up in Vercel Blob.
        if (isPrivate) {
          // In private stores, browsers cannot directly load the private URL without credentials.
          // Since user photos are strictly <= 10KB, base64 Data URL renders instantly and works on Vercel without local disk dependency.
          this.saveLocalUserPhoto(file.buffer, pathname);
          avatarUrl = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
        } else {
          avatarUrl = blob.url;
        }
        console.log(`[StorageService] Photo uploaded to Vercel Blob: ${blob.url} (avatarUrl set)`);
      } catch (err: any) {
        console.error('[StorageService] Vercel Blob photo upload failed, falling back to local/data storage:', err.message);
        avatarUrl = this.saveLocalUserPhoto(file.buffer, pathname);
      }
    } else {
      avatarUrl = this.saveLocalUserPhoto(file.buffer, pathname);
    }

    // Update in database
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return avatarUrl;
  }

  /**
   * Deletes a user profile photo from Vercel Blob / local storage
   * and clears user.avatarUrl in the database.
   */
  async deleteUserPhoto(userId: string): Promise<void> {
    const user = (await prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (user?.avatarUrl) {
      if (this.hasVercelBlob && (user.avatarUrl.includes('vercel-storage.com') || user.avatarUrl.includes('blob.vercel'))) {
        try {
          await del(user.avatarUrl);
          console.log(`[StorageService] Deleted avatar from Vercel Blob: ${user.avatarUrl}`);
        } catch (err: any) {
          console.warn('[StorageService] Could not delete from Vercel Blob:', err.message);
        }
      } else if (user.avatarUrl.startsWith('/api/uploads/avatars/')) {
        const filename = path.basename(user.avatarUrl);
        const filePath = path.join(this.uploadDir, 'avatars', filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // ignore
          }
        }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null } as any,
    });
  }

  private saveLocalUserPhoto(buffer: Buffer, relativePathname: string): string {
    const filename = path.basename(relativePathname);
    try {
      const avatarDir = path.join(this.uploadDir, 'avatars');
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
      }
      const filePath = path.join(avatarDir, filename);
      fs.writeFileSync(filePath, buffer);
      return `/api/uploads/avatars/${filename}`;
    } catch (e: any) {
      // In serverless read-only environments where local write fails, return base64 data URI (<= 10KB photo)
      const base64 = buffer.toString('base64');
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
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

    // 1. If stored in Vercel Blob (starts with http:// or https://)
    if (attachment.storageKey.startsWith('http://') || attachment.storageKey.startsWith('https://')) {
      const headers: Record<string, string> = {};
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
      }
      const res = await fetch(attachment.storageKey, { headers });
      if (!res.ok) {
        throw new Error(`Failed to download attachment from Vercel Blob: ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      };
    }

    // 2. Azure Storage Blob
    if (this.connectionString && this.blobServiceClient) {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(attachment.storageKey);
      const encryptedBuffer = await blobClient.downloadToBuffer();
      
      return {
        buffer: encryptedBuffer,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      };
    }

    // 3. Local disk fallback
    const filePath = path.join(this.uploadDir, attachment.storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error('Physical file not found on disk');
    }

    const encryptedBuffer = fs.readFileSync(filePath);

    return {
      buffer: encryptedBuffer,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
    };
  }

  async saveUploadedFile(file: UploadedFileDto, roomId: string, senderId: string): Promise<any> {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Attachment exceeds maximum 10MB limit');
    }

    const filename = crypto.randomUUID() + path.extname(file.originalname);
    const bufferToSave = file.buffer;
    let storageKey = filename;

    // 1. Try Vercel Blob first
    if (this.hasVercelBlob) {
      try {
        const pathname = `attachments/${roomId}/${filename}`;
        let blob;
        try {
          blob = await put(pathname, bufferToSave, {
            access: 'public',
            contentType: 'application/octet-stream',
          });
        } catch (err: any) {
          if (err.message && (err.message.includes('private access') || err.message.includes('private store'))) {
            blob = await put(pathname, bufferToSave, {
              access: 'private',
              contentType: 'application/octet-stream',
            });
          } else {
            throw err;
          }
        }
        storageKey = blob.url;
        console.log(`[StorageService] Chat attachment uploaded to Vercel Blob: ${blob.url}`);
      } catch (blobErr: any) {
        console.error('[StorageService] Vercel Blob attachment upload failed:', blobErr.message);
        if (process.env.VERCEL) {
          throw new Error(`Vercel Blob upload failed: ${blobErr.message}`);
        }
        try {
          const filePath = path.join(this.uploadDir, filename);
          fs.writeFileSync(filePath, bufferToSave);
          storageKey = filename;
        } catch (fsErr: any) {
          throw new Error(`Upload failed: ${blobErr.message}`);
        }
      }
    } else if (this.connectionString && this.blobServiceClient) {
      // 2. Azure Storage Blob
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      await blockBlobClient.upload(bufferToSave, bufferToSave.length, {
        blobHTTPHeaders: { blobContentType: 'application/octet-stream' }
      });
      storageKey = filename;
    } else {
      // 3. Local disk fallback
      if (process.env.VERCEL) {
        throw new Error('BLOB_READ_WRITE_TOKEN is missing in Vercel project environment variables. Please add BLOB_READ_WRITE_TOKEN in your Vercel Project Settings > Environment Variables.');
      }
      const filePath = path.join(this.uploadDir, filename);
      fs.writeFileSync(filePath, bufferToSave);
      storageKey = filename;
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

  /**
   * Physically removes an attachment file from Vercel Blob, Azure, or local disk
   */
  async deletePhysicalFile(storageKey: string): Promise<void> {
    if (!storageKey) return;
    try {
      if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
        if (this.hasVercelBlob || storageKey.includes('vercel-storage.com') || storageKey.includes('blob.vercel')) {
          await del(storageKey);
          console.log(`[StorageService] Deleted attachment from Vercel Blob: ${storageKey}`);
        }
      } else if (this.connectionString && this.blobServiceClient) {
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        await containerClient.deleteBlob(storageKey);
        console.log(`[StorageService] Deleted attachment from Azure: ${storageKey}`);
      } else {
        const filePath = path.join(this.uploadDir, storageKey);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[StorageService] Deleted local attachment file: ${filePath}`);
        }
      }
    } catch (err: any) {
      console.warn(`[StorageService] Failed to delete physical file (${storageKey}):`, err.message);
    }
  }
}

export const storageService = new StorageService();
export default storageService;
