import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

// Standard initialization
const prisma = new PrismaClient();

async function clean() {
  console.log('[DevOps] Starting database cleanup and seed reset...');
  
  try {
    // 1. Delete dependent transactional clinical records in foreign key order
    await prisma.auditLog.deleteMany({});
    console.log('✓ Cleared Audit Logs');

    await prisma.device.deleteMany({});
    console.log('✓ Cleared Registered Devices');

    await prisma.session.deleteMany({});
    console.log('✓ Cleared Active Sessions');

    await prisma.attachment.deleteMany({});
    console.log('✓ Cleared Message Attachments');

    await prisma.message.deleteMany({});
    console.log('✓ Cleared Chat Room Messages');

    await prisma.roomMember.deleteMany({});
    console.log('✓ Cleared Room Membership Links');

    await prisma.chatRoom.deleteMany({});
    console.log('✓ Cleared All Group & Direct Chat Rooms');

    await prisma.patientContext.deleteMany({});
    console.log('✓ Cleared Patient Contexts');

    // 2. Delete all clinical users
    await prisma.user.deleteMany({});
    console.log('✓ Cleared All Users');

    console.log('[DevOps] Database cleanup completed successfully!');
  } catch (error) {
    console.error('[DevOps] Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
