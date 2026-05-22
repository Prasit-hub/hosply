import { prisma } from '../lib/db';
import { encrypt, decrypt } from '../common/utils/crypto';
import { dlpService } from './dlp.service';
import { auditService } from './audit.service';

export class ChatService {
  async getUserRooms(userId: string) {
    const memberships = await prisma.roomMember.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    role: { select: { name: true } },
                  },
                },
              },
            },
            patientContext: true,
          },
        },
      },
    });

    return memberships.map(m => {
      // Setup default room name for Direct Messages (DM) using other participant's name
      let roomName = m.room.name;
      if (m.room.type === 'DIRECT') {
        const otherMember = m.room.members.find(rm => rm.userId !== userId);
        if (otherMember) {
          roomName = `${otherMember.user.firstName} ${otherMember.user.lastName} (${otherMember.user.role.name})`;
        }
      }
      return {
        ...m.room,
        name: roomName,
        lastReadAt: m.lastReadAt,
        roleInRoom: m.role,
      };
    });
  }

  async getRoomMessages(roomId: string, userId: string, limit = 50, cursor?: string) {
    // Check membership
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { user: { include: { role: { include: { permissions: true } } } } },
    });

    if (!membership) {
      throw new Error('You are not a member of this chat room');
    }

    // Update lastReadAt for the reader in this room
    try {
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { lastReadAt: new Date() },
      });
    } catch (err) {
      console.error('[ChatService] Failed to update lastReadAt in getRoomMessages:', err);
    }

    const where: any = { roomId, deletedAt: null };
    if (cursor) {
      where.id = { lt: cursor };
    }

    const messages = await prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: { select: { name: true } },
          },
        },
        attachments: true,
      },
    });

    // Decrypt messages & Check classifications
    const userPermissions = membership.user.role.permissions.map(p => p.action);
    const hasConfidentialAccess = userPermissions.includes('READ_CONFIDENTIAL');
    const hasRestrictedAccess = userPermissions.includes('READ_RESTRICTED');

    const mappedMessages = messages.map(msg => {
      let content = '';

      if (msg.classification === 'CONFIDENTIAL' && !hasConfidentialAccess) {
        content = '[CONFIDENTIAL CLINICAL RECORD - Access Restricted]';
      } else if (msg.classification === 'RESTRICTED' && !hasRestrictedAccess) {
        content = '[RESTRICTED HIGH-SECURITY PHI - Elevated Permission Required]';
      } else {
        content = decrypt(msg.content);
      }

      return {
        ...msg,
        content,
      };
    });

    return mappedMessages.reverse();
  }

  async createRoom(dto: { name?: string; type: string; memberIds: string[]; patientHn?: string }, creatorId: string) {
    if (dto.type === 'DIRECT') {
      if (dto.memberIds.length !== 1) {
        throw new Error('Direct message must have exactly 1 other participant');
      }
      const otherId = dto.memberIds[0];
      
      // Check if existing DM room exists
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: creatorId } } },
            { members: { some: { userId: otherId } } },
          ],
        },
      });

      if (existingRoom) return existingRoom;
    }

    // Create Transaction
    return prisma.$transaction(async (tx) => {
      let patientContextId: string | undefined;

      if (dto.type === 'PATIENT_CONTEXT' && dto.patientHn) {
        const patient = await tx.patientContext.create({
          data: {
            hn: dto.patientHn,
            nameHash: encrypt(`Patient_${dto.patientHn}`), // In production, dynamic encryption with salt
            status: 'ACTIVE',
          },
        });
        patientContextId = patient.id;
      }

      const room = await tx.chatRoom.create({
        data: {
          name: dto.name || null,
          type: dto.type,
          patientContextId: patientContextId || null,
        },
      });

      // Add all members
      const allMemberIds = Array.from(new Set([creatorId, ...dto.memberIds]));

      // Verify that all member IDs exist in the database
      const existingUsersCount = await tx.user.count({
        where: {
          id: { in: allMemberIds },
        },
      });

      if (existingUsersCount !== allMemberIds.length) {
        throw new Error('One or more selected members do not exist in the hospital directory');
      }

      await Promise.all(
        allMemberIds.map(id =>
          tx.roomMember.create({
            data: {
              roomId: room.id,
              userId: id,
              role: id === creatorId ? 'ADMIN' : 'MEMBER',
            },
          })
        )
      );

      return room;
    });
  }

  async sendMessage(roomId: string, senderId: string, content: string, classification = 'INTERNAL', ipAddress?: string, messageId?: string) {
    // 1. Check membership
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } },
    });
    if (!membership) {
      throw new Error('You are not a member of this chat room');
    }

    // 2. DLP Content scan
    const dlpResult = dlpService.analyze(content);
    if (dlpResult.flagged) {
      // Log critical security audit event
      await auditService.log({
        userId: senderId,
        action: 'DLP_TRIGGERED_BLOCK',
        entity: 'Message',
        details: {
          roomId,
          reason: dlpResult.reason,
          matchedText: dlpResult.matchedText,
          contentPreview: content.substring(0, 10) + '...',
        },
        ipAddress,
      });

      // If clinical/ID data is blocked, prevent sending
      if (dlpResult.reason?.includes('ID') || dlpResult.reason?.includes('Laboratory')) {
        throw new Error(`Security Block: Your message contains protected information (${dlpResult.reason}). Transmission aborted.`);
      }
    }

    // 3. Encrypt content
    const encryptedContent = encrypt(content);

    // 4. Save/Update in DB
    let message;
    if (messageId) {
      // Verify message exists, belongs to room & user
      const existing = await prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!existing) {
        throw new Error('Message to attach file to was not found');
      }
      if (existing.roomId !== roomId || existing.senderId !== senderId) {
        throw new Error('Unauthorized to update this message payload');
      }

      message = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: encryptedContent,
          classification,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              role: { select: { name: true } },
            },
          },
          attachments: true,
        },
      });
    } else {
      message = await prisma.message.create({
        data: {
          roomId,
          senderId,
          content: encryptedContent,
          classification,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              role: { select: { name: true } },
            },
          },
          attachments: true,
        },
      });
    }

    // 5. Decrypt for local broadcast return
    return {
      ...message,
      content,
    };
  }

  async addRoomMembers(roomId: string, memberIds: string[], inviterId: string) {
    // 1. Verify that the inviter is a member of the room
    const isInviterMember = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: inviterId } },
    });
    if (!isInviterMember) {
      throw new Error('You are not a member of this chat room');
    }

    // 2. Verify all new member IDs exist
    const uniqueIds = Array.from(new Set(memberIds));
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    if (existingUsers.length !== uniqueIds.length) {
      throw new Error('One or more invited members do not exist in the directory');
    }

    // 3. Filter out users who are already members of the room
    const currentMembers = await prisma.roomMember.findMany({
      where: { roomId, userId: { in: uniqueIds } },
      select: { userId: true },
    });
    const currentMemberIds = currentMembers.map(m => m.userId);
    const toAddIds = uniqueIds.filter(id => !currentMemberIds.includes(id));

    if (toAddIds.length === 0) {
      return { message: 'All users are already members of this room', addedCount: 0 };
    }

    // 4. Add new members in transaction
    await Promise.all(
      toAddIds.map(id =>
        prisma.roomMember.create({
          data: {
            roomId,
            userId: id,
            role: 'MEMBER',
          },
        })
      )
    );

    // 5. Log audit trail
    await auditService.log({
      userId: inviterId,
      action: 'ROOM_MEMBERS_INVITED',
      entity: 'ChatRoom',
      entityId: roomId,
      details: {
        invitedUserIds: toAddIds,
        invitedCount: toAddIds.length,
      },
    });

    return {
      message: `Successfully added ${toAddIds.length} new members to the group`,
      addedCount: toAddIds.length,
      addedMembers: existingUsers.filter(u => toAddIds.includes(u.id)),
    };
  }

  async leaveRoom(roomId: string, userId: string) {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new Error('You are not a member of this chat room');
    }

    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    await auditService.log({
      userId,
      action: 'ROOM_LEFT',
      entity: 'ChatRoom',
      entityId: roomId,
      details: {
        roomId,
        reason: 'User opted to leave',
      },
    });

    return { message: 'Successfully left the room' };
  }
}

export const chatService = new ChatService();
export default chatService;
