import { prisma } from '../lib/db';
import { encrypt, decrypt } from '../common/utils/crypto';
import { dlpService } from './dlp.service';
import { auditService } from './audit.service';
import { storageService } from './storage.service';

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
                    avatarUrl: true,
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

    return Promise.all(
      memberships.map(async (m) => {
        const unreadCount = await prisma.message.count({
          where: {
            roomId: m.roomId,
            createdAt: { gt: m.lastReadAt },
            senderId: { not: userId },
          },
        });

        // Setup default room name for Direct Messages (DM) using other participant's name
        let roomName = m.room.name;
        if (m.room.type === 'DIRECT') {
          const otherMember = m.room.members.find(rm => rm.userId !== userId);
          if (otherMember) {
            roomName = `${decrypt(otherMember.user.firstName)} ${decrypt(otherMember.user.lastName)} (${otherMember.user.role.name})`;
          }
        }

        const decryptedMembers = m.room.members.map(rm => ({
          ...rm,
          user: {
            ...rm.user,
            firstName: decrypt(rm.user.firstName),
            lastName: decrypt(rm.user.lastName),
            avatarUrl: rm.user.avatarUrl || null,
          }
        }));

        return {
          ...m.room,
          name: roomName,
          members: decryptedMembers,
          lastReadAt: m.lastReadAt,
          roleInRoom: m.role,
          unreadCount,
        };
      })
    );
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

    const where: any = { roomId };
    if (membership.clearedAt) {
      where.createdAt = { gt: membership.clearedAt };
    }
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
            avatarUrl: true,
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

    const mappedMessages = (messages as any[])
      .filter((msg: any) => {
        // If message has deletedAt, only include it if it was individually unsent
        if (msg.deletedAt) {
          try {
            const dec = decrypt(msg.content);
            return dec === '[This message was unsent]';
          } catch {
            return false;
          }
        }
        return true;
      })
      .map(msg => {
        let content = '';

        if (msg.deletedAt) {
          content = '[This message was unsent]';
        } else if (msg.classification === 'CONFIDENTIAL' && !hasConfidentialAccess) {
          content = '[CONFIDENTIAL CLINICAL RECORD - Access Restricted]';
        } else if (msg.classification === 'RESTRICTED' && !hasRestrictedAccess) {
          content = '[RESTRICTED HIGH-SECURITY PHI - Elevated Permission Required]';
        } else {
          content = decrypt(msg.content);
        }

        return {
          ...msg,
          content,
          attachments: msg.deletedAt ? [] : msg.attachments,
          sender: {
            ...msg.sender,
            firstName: decrypt(msg.sender.firstName),
            lastName: decrypt(msg.sender.lastName),
            role: msg.sender.role.name,
            avatarUrl: msg.sender.avatarUrl || null,
          },
        };
      });

    return mappedMessages.reverse();
  }

  async clearRoomHistory(roomId: string, userId: string, purgeAll = false, userRole?: string, ipAddress?: string) {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      throw new Error('You are not a member of this chat room');
    }

    if (purgeAll) {
      const isAdmin =
        userRole?.toLowerCase() === 'admin' ||
        userRole?.toLowerCase() === 'system_admin' ||
        membership.role === 'ADMIN';

      if (!isAdmin) {
        throw new Error('Only room admins or system administrators can purge room messages for all members');
      }

      const now = new Date();

      // Find attachments in this room to clean up physical storage
      const messagesWithAttachments = await prisma.message.findMany({
        where: { roomId, deletedAt: null },
        include: { attachments: true },
      });

      for (const msg of messagesWithAttachments) {
        if (msg.attachments && msg.attachments.length > 0) {
          for (const att of msg.attachments) {
            if (att.storageKey) {
              await storageService.deletePhysicalFile(att.storageKey);
            }
          }
        }
      }

      const updated = await prisma.message.updateMany({
        where: { roomId, deletedAt: null },
        data: { deletedAt: now },
      });

      await auditService.log({
        userId,
        action: 'ROOM_HISTORY_PURGED',
        entity: 'ChatRoom',
        entityId: roomId,
        details: {
          purgedMessageCount: updated.count,
          purgedAt: now.toISOString(),
        },
        ipAddress,
      });

      return {
        success: true,
        purgedAll: true,
        purgedCount: updated.count,
        clearedAt: now,
      };
    }

    // Default: Clear chat history locally for this user
    const updatedMember = await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { clearedAt: new Date() },
    });

    await auditService.log({
      userId,
      action: 'ROOM_HISTORY_CLEARED_LOCAL',
      entity: 'ChatRoom',
      entityId: roomId,
      details: {
        clearedAt: updatedMember.clearedAt,
      },
      ipAddress,
    });

    return {
      success: true,
      purgedAll: false,
      clearedAt: updatedMember.clearedAt,
    };
  }

  async unsendMessage(messageId: string, userId: string, userRole?: string, ipAddress?: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        attachments: true,
        room: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.deletedAt) {
      throw new Error('Message has already been unsent');
    }

    const roomMembership = message.room.members.find((m: any) => m.userId === userId);
    const isRoomAdmin = roomMembership?.role === 'ADMIN';
    const isSender = message.senderId === userId;
    const isSystemAdmin =
      userRole?.toLowerCase() === 'admin' ||
      userRole?.toLowerCase() === 'system_admin' ||
      userRole?.toLowerCase() === 'administrator';

    if (!isSender && !isSystemAdmin && !isRoomAdmin) {
      throw new Error('Unauthorized: You can only unsend your own messages');
    }

    const now = new Date();
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: now,
        content: encrypt('[This message was unsent]'),
      },
    });

    // Clean up physical attachments if any
    if (message.attachments && message.attachments.length > 0) {
      for (const att of message.attachments) {
        if (att.storageKey) {
          try {
            await storageService.deletePhysicalFile(att.storageKey);
          } catch (e: any) {
            console.warn('[ChatService] Failed to delete attachment physical file:', e.message);
          }
        }
      }
    }

    // HIPAA/PDPA Audit logging
    await auditService.log({
      userId,
      action: 'MESSAGE_UNSENT',
      entity: 'Message',
      entityId: messageId,
      details: {
        roomId: message.roomId,
        wasSender: isSender,
        isAdmin: isSystemAdmin || isRoomAdmin,
        hadAttachments: (message.attachments?.length || 0) > 0,
      },
      ipAddress,
    });

    return {
      messageId: message.id,
      roomId: message.roomId,
      deletedAt: updated.deletedAt,
    };
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

      if (existingRoom) {
        return this.getFullDecryptedRoom(existingRoom.id, creatorId);
      }
    }

    // Create Transaction
    const room = await prisma.$transaction(async (tx) => {
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

      const created = await tx.chatRoom.create({
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
              roomId: created.id,
              userId: id,
              role: id === creatorId ? 'ADMIN' : 'MEMBER',
              lastReadAt: id === creatorId ? new Date() : new Date(0),
            },
          })
        )
      );

      return created;
    });

    return this.getFullDecryptedRoom(room.id, creatorId);
  }

  async getFullDecryptedRoom(roomId: string, viewerUserId: string) {
    const fullRoom = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        patientContext: true,
      },
    });

    if (!fullRoom) throw new Error('Room not found');

    let roomName = fullRoom.name;
    if (fullRoom.type === 'DIRECT') {
      const otherMember = fullRoom.members.find(rm => rm.userId !== viewerUserId);
      if (otherMember) {
        roomName = `${decrypt(otherMember.user.firstName)} ${decrypt(otherMember.user.lastName)} (${otherMember.user.role.name})`;
      }
    }

    const decryptedMembers = fullRoom.members.map(rm => ({
      ...rm,
      user: {
        ...rm.user,
        firstName: decrypt(rm.user.firstName),
        lastName: decrypt(rm.user.lastName),
        avatarUrl: rm.user.avatarUrl || null,
      },
    }));

    return {
      ...fullRoom,
      name: roomName,
      members: decryptedMembers,
    };
  }

  async sendMessage(roomId: string, senderId: string, content: string, classification = 'INTERNAL', ipAddress?: string, messageId?: string) {
    // 1. Check membership
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } },
    });
    if (!membership) {
      throw new Error('You are not a member of this chat room');
    }

    // 1.1 Verify room is active (inactive rooms allow only Admin messages)
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { isActive: true, name: true },
    });
    if (room && !room.isActive) {
      const senderUser = await prisma.user.findUnique({
        where: { id: senderId },
        include: { role: true },
      });
      const isSystemAdmin = senderUser?.role?.name?.toLowerCase() === 'admin';
      if (!isSystemAdmin) {
        throw new Error('กลุ่มแชตนี้ถูกปิดการใช้งาน (Inactive) โดยผู้ดูแลระบบ สมาชิกทั่วไปไม่สามารถส่งข้อความได้');
      }
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
              avatarUrl: true,
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
              avatarUrl: true,
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
      sender: {
        ...message.sender,
        firstName: decrypt(message.sender.firstName),
        lastName: decrypt(message.sender.lastName),
        role: message.sender.role.name,
        avatarUrl: message.sender.avatarUrl || null,
      },
    };
  }

  async addRoomMembers(roomId: string, memberIds: string[], inviterId: string) {
    // 1. Verify that the inviter is a member of the room OR has Admin role
    const isInviterMember = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: inviterId } },
    });

    const inviterUser = await prisma.user.findUnique({
      where: { id: inviterId },
      include: { role: true },
    });
    const isSystemAdmin = inviterUser?.role?.name?.toLowerCase() === 'admin';

    if (!isInviterMember && !isSystemAdmin) {
      throw new Error('You are not authorized to invite members to this chat room');
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
            lastReadAt: new Date(0),
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
      addedMembers: existingUsers.filter(u => toAddIds.includes(u.id)).map(u => ({
        ...u,
        firstName: decrypt(u.firstName),
        lastName: decrypt(u.lastName),
      })),
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

  async removeRoomMember(roomId: string, targetUserId: string, operatorId: string) {
    // 1. Check if room exists
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    if (!room) {
      throw new Error('Chat room not found');
    }

    // 2. Check operator permissions: must be System Admin or Room Admin
    const operatorUser = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { role: true },
    });
    const isSystemAdmin = operatorUser?.role?.name?.toLowerCase() === 'admin';

    const operatorMembership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: operatorId } },
    });
    const isRoomAdmin = operatorMembership?.role === 'ADMIN';

    if (!isSystemAdmin && !isRoomAdmin) {
      throw new Error('Only administrators or room owners are authorized to remove members');
    }

    // 3. Verify target user is in the room
    const targetMembership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      include: { user: true },
    });
    if (!targetMembership) {
      throw new Error('User is not a member of this chat room');
    }

    // 4. Delete room membership
    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    // 5. Log audit trail
    await auditService.log({
      userId: operatorId,
      action: 'ROOM_MEMBER_REMOVED',
      entity: 'ChatRoom',
      entityId: roomId,
      details: {
        removedUserId: targetUserId,
        removedUsername: targetMembership.user.username,
        operatorId,
      },
    });

    return {
      message: 'Member successfully removed from room',
      removedUserId: targetUserId,
      targetUsername: targetMembership.user.username,
    };
  }

  async updateRoomStatus(roomId: string, isActive: boolean, operatorId: string) {
    // 1. Verify operator is system Admin
    const operatorUser = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { role: true },
    });
    const isSystemAdmin = operatorUser?.role?.name?.toLowerCase() === 'admin';

    const operatorMembership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: operatorId } },
    });
    const isRoomAdmin = operatorMembership?.role === 'ADMIN';

    if (!isSystemAdmin && !isRoomAdmin) {
      throw new Error('Only administrators are authorized to change group chat status');
    }

    const updatedRoom = await prisma.chatRoom.update({
      where: { id: roomId },
      data: { isActive },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Log audit trail
    await auditService.log({
      userId: operatorId,
      action: isActive ? 'ROOM_ACTIVATED' : 'ROOM_DEACTIVATED',
      entity: 'ChatRoom',
      entityId: roomId,
      details: {
        isActive,
        roomName: updatedRoom.name,
      },
    });

    return {
      ...updatedRoom,
      members: updatedRoom.members.map(rm => ({
        ...rm,
        user: {
          ...rm.user,
          firstName: decrypt(rm.user.firstName),
          lastName: decrypt(rm.user.lastName),
        },
      })),
    };
  }

  async getAllRoomsForAdmin(operatorId: string) {
    // Verify system admin
    const operatorUser = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { role: true },
    });
    if (operatorUser?.role?.name?.toLowerCase() !== 'admin') {
      throw new Error('Only system administrators can access full group directory');
    }

    const rooms = await prisma.chatRoom.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        patientContext: true,
        _count: {
          select: { messages: true, members: true },
        },
      },
    });

    return rooms.map(r => ({
      ...r,
      members: r.members.map(rm => ({
        ...rm,
        user: {
          ...rm.user,
          firstName: decrypt(rm.user.firstName),
          lastName: decrypt(rm.user.lastName),
        },
      })),
    }));
  }
}

export const chatService = new ChatService();
export default chatService;
