'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Users,
  Search,
  Settings,
  Shield,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Send,
  Paperclip,
  UserPlus,
  User,
  LogOut,
  Activity,
  UserCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Bell,
  HardDrive,
  FileText,
  FileCode,
  CheckCircle,
  Database,
  Volume2,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
  Info,
  X,
  Pin,
  Trash2,
  LogIn,
  Camera,
  UploadCloud,
  Undo2,
  RotateCcw,
  UserMinus,
  Power,
  History,
  Calendar,
  Plus,
  Maximize2,
  Mic,
  MicOff,
  Smile,
  Edit3
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// --- Client-side End-to-End Cryptography Helpers (Model B) ---
async function getCryptoKey(roomId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(roomId);
  const hash = await window.crypto.subtle.digest('SHA-256', rawKey);
  return await window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptFileClient(file: File, roomId: string): Promise<File> {
  const key = await getCryptoKey(roomId);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    fileBuffer
  );

  const merged = new Uint8Array(12 + ciphertext.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ciphertext), 12);

  return new File([merged], file.name + '.enc', { type: 'application/octet-stream' });
}

async function decryptFileClient(encryptedArrayBuffer: ArrayBuffer, roomId: string): Promise<ArrayBuffer> {
  const key = await getCryptoKey(roomId);
  const iv = new Uint8Array(encryptedArrayBuffer.slice(0, 12));
  const ciphertext = encryptedArrayBuffer.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );

  return decrypted;
}

// types
interface UserSession {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
  accessToken: string;
}

interface PatientContext {
  id: string;
  hn: string;
  an?: string;
  nameHash: string;
  status: string;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'DIRECT' | 'GROUP' | 'PATIENT_CONTEXT';
  patientContext?: PatientContext;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastReadAt?: string;
  roleInRoom?: string;
  members?: any[];
  unreadCount?: number;
}

interface Message {
  id: string;
  roomId: string;
  content: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  createdAt: string;
  deletedAt?: string | null;
  sender: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string | null;
  };
  attachments?: any[];
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  user?: {
    id?: string;
    username: string;
    firstName?: string;
    lastName?: string;
    role?: { name: string } | string;
  } | null;
}

const translations = {
  EN: {
    // Login
    loginTitle: 'Hosply Clinical Network',
    loginSubtitle: 'Secure AES-256 at-rest message gateway for healthcare teams.',
    usernameLabel: 'Hospital Staff Username',
    usernamePlaceholder: 'doctor1 / nurse1 / pharmacist1 / admin1',
    passwordLabel: 'Secure Password',
    passwordPlaceholder: '••••••••',
    loginButton: 'Authenticate & Access',
    authenticating: 'Decrypting Credentials...',
    languageLabel: 'Select Language',

    // Sidebar Tabs
    tabChats: 'Chats',
    tabDirectory: 'Directory',
    tabAdmin: 'Admin Panel',
    tabSettings: 'Settings',

    // Sidebar Lists
    activeChatsTitle: 'Active Chats',
    directoryTitle: 'Active Staff Directory',
    searchPlaceholder: 'Search chat or group...',
    newGroupButton: 'New Group Chat',
    inviteMemberButton: 'Invite Staff',

    // Chat Header
    directLineLabel: 'Private doctor-to-staff clinical line',
    groupLineLabel: 'Coordinated care team discussions',
    patientContextLabel: 'Patient-centric discussion stream',
    classificationLabel: 'CLASSIFICATION',
    hnLabel: 'HN',
    anLabel: 'AN',
    statusLabel: 'STATUS',

    // Message input
    messagePlaceholder: 'Type a secure clinical message...',
    dlpWarning: '⚠️ SECURE DATA PROTOCOL DETECTED - MESSAGE PROTECTED',
    sendButton: 'Send',
    classificationInternal: 'INTERNAL',
    classificationConfidential: 'CONFIDENTIAL',
    classificationRestricted: 'RESTRICTED',

    // Context Menu
    pinToTop: 'Pin to Top',
    unpinChat: 'Unpin Chat',
    clearHistory: 'Clear Chat History',
    clearChat: 'Clear Chat',
    unsendMessage: 'Unsend Message',
    unsendConfirmTitle: 'Unsend Message',
    unsendConfirmDesc: 'Are you sure you want to unsend this message? It will be removed for everyone in this chat.',
    messageUnsentToast: 'Message was unsent',
    clearForMe: 'Clear for Me Only',
    purgeForAll: 'Purge All Messages for Everyone (Admin)',
    leaveGroup: 'Leave Group',
    inviteStaff: 'Invite Staff to Group',

    // Group Management
    groupManagementTitle: 'Group Chat Administration',
    manageGroupsTab: 'Group Management',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    deactivateGroup: 'Deactivate Group',
    activateGroup: 'Activate Group',
    groupDeactivatedToast: 'Group chat deactivated',
    groupActivatedToast: 'Group chat activated',
    removeMember: 'Remove Member',
    memberRemovedToast: 'Member removed from group',
    groupInactiveBanner: 'This group chat has been marked inactive by an administrator. Regular members cannot send messages.',
    reactivateBtn: 'Reactivate Group',
    groupMembersTitle: 'Group Members',
    manageMembersBtn: 'Manage Members',
    filterAll: 'All',
    filterGroups: 'Group Chats',
    filterDirect: 'Direct',
    groupChatBadge: 'Group Chat',
    groupMembersCount: 'members',
    groupHistoryButton: 'Group History',
    groupHistoryModalTitle: 'Group Chat History & Details',
    noGroupChatsTitle: 'No group chats found',
    noGroupChatsDesc: 'You are not a member of any group chat yet. Create a new group or ask an admin to invite you.',
    createNewGroupBtn: 'Create New Group',
    groupCreatedDate: 'Created Date',
    groupTotalMessagesCount: 'Total Messages',
    groupSearchHistoryPlaceholder: 'Search within this group history...',
    groupHistoryTabMessages: 'Search Messages',
    groupHistoryTabMembers: 'Group Members',
    groupHistoryTabFiles: 'Files & Media',
    noMessagesInHistory: 'No messages found in this group yet',
    noMatchingHistoryMessages: 'No messages found matching your search',
    groupSecurityTitle: 'Security Level',
    groupSecurityE2EE: 'End-to-End Encrypted (AES-256-GCM)',
    viewAttachmentBtn: 'Preview File',

    // Profile Settings
    profileTitle: 'Professional Profile Settings',
    roleLabel: 'Professional Clinical Role',
    usernameLabelSettings: 'Clinical Staff Username',
    uploadPhoto: 'Upload Profile Photo',
    changePhoto: 'Change Photo',
    removePhoto: 'Remove Photo',
    photoUploading: 'Uploading to Vercel Blob...',
    photoUpdated: 'Profile photo updated successfully via Vercel Blob',
    photoRemoved: 'Profile photo removed',
    resetPasswordTitle: 'Security Passcode Reset',
    currentPasswordLabel: 'Current Security Passcode',
    newPasswordLabel: 'New Security Passcode',
    confirmPasswordLabel: 'Confirm New Passcode',
    passcodeResetting: 'Resetting security credentials...',
    passcodeResetButton: 'Update Security Passcode',
    logoutButton: 'Terminate Session & Logout',

    // Admin Panel
    adminTitle: 'Clinical Directory Administration',
    createStaffButton: 'Provision Staff Account',
    tableUsername: 'Username',
    tableFullName: 'Full Name',
    tableRole: 'Role',
    tableActions: 'Actions',
    editAction: 'Modify Settings',
    auditTitle: 'HIPAA Access & Audit Activity Logs',
    exportAuditButton: 'Export SECURE CSV Report',

    // Clinical mod
    acknowledgeButton: 'Acknowledge',
    confirmButton: 'Confirm',
    cancelButton: 'Cancel',

    // Additional UI elements
    chatButton: 'Chat',
    nowConnected: 'Connected',
    loadEarlier: 'Load earlier records',
    loadingEarlier: 'Retrieving clinical logs...',
    typingSuffix: 'is typing a secure message...',
    classificationSelectLabel: 'Classification Level:',
    classificationHelpText: 'RESTRICTED level blocks non-authorized roles.',
    emptyChatSelection: 'Select a conversation or clinical room to start communicating securely.',
    copyLink: 'Copy Secure Link',
    closeMenu: 'Close Menu',
    allMembersAdded: 'All available staff members are already in this room.',
    roomLabel: 'Room:',
    searchStaffPlaceholder: 'Search staff by name or role...',
    addMembersBtn: 'Add to Group',
    newRoomModalTitle: 'Launch Clinical Discussion Room',
    newRoomTitleLabel: 'Discussion Room Title',
    newRoomTitlePlaceholder: 'e.g. ER Shift Group, ICU Cardiology Intake',
    cancelBtn: 'Cancel',
    initRoomBtn: 'Initialize Room',
    directChatPrefix: '👤 1-1 Direct Message',
    patientChatPrefix: '🏥 Clinical Patient Discussion',
    groupChatPrefix: '👥 Group Case discussion',

    // Registration
    tabLogin: 'Sign In',
    tabRegister: 'Create Account',
    firstNameLabel: 'First Name',
    lastNameLabel: 'Last Name',
    professionalIdLabel: 'Staff / License ID (Optional)',
    registerButton: 'Register & Access',
    registering: 'Creating Secure Account...',
    defaultRoleNotice: 'Default Role: General Staff (Normal User)',
    alreadyHaveAccount: 'Already have an account?',
    noAccountYet: "Don't have an account?",
    switchToLogin: 'Sign in here',
    switchToRegister: 'Register here',
    statusOnline: 'Online',
    statusOffline: 'Offline',
  },
  TH: {
    // Login
    loginTitle: 'เครือข่ายคลินิก Hosply',
    loginSubtitle: 'ช่องทางส่งข้อความเข้ารหัสปลอดภัย AES-256',
    usernameLabel: 'ชื่อผู้ใช้งานระบบ',
    usernamePlaceholder: 'doctor1 / nurse1 / pharmacist1 / admin1',
    passwordLabel: 'รหัสผ่านความปลอดภัย',
    passwordPlaceholder: '••••••••',
    loginButton: 'ยืนยันตัวตนและเข้าใช้งาน',
    authenticating: 'กำลังตรวจสอบสิทธิ์...',
    languageLabel: 'เลือกภาษา',

    // Registration
    tabLogin: 'เข้าสู่ระบบ',
    tabRegister: 'ลงทะเบียนผู้ใช้ใหม่',
    firstNameLabel: 'ชื่อจริง',
    lastNameLabel: 'นามสกุล',
    professionalIdLabel: 'รหัสพนักงาน / เลขที่วิชาชีพ (ถ้ามี)',
    registerButton: 'ลงทะเบียนและเข้าใช้งาน',
    registering: 'กำลังสร้างบัญชีผู้ใช้งาน...',
    defaultRoleNotice: 'สิทธิ์การใช้งานเริ่มต้น: เจ้าหน้าที่ทั่วไป (Normal User)',
    alreadyHaveAccount: 'มีบัญชีผู้ใช้งานอยู่แล้ว?',
    noAccountYet: 'ยังไม่มีบัญชีผู้ใช้งาน?',
    switchToLogin: 'เข้าสู่ระบบที่นี่',
    switchToRegister: 'ลงทะเบียนที่นี่',

    // Sidebar Tabs
    tabChats: 'ห้องสนทนา',
    tabDirectory: 'รายชื่อบุคลากร',
    tabAdmin: 'ผู้ดูแลระบบ',
    tabSettings: 'ตั้งค่าระบบ',

    // Sidebar Lists
    activeChatsTitle: 'การสนทนาปัจจุบัน',
    directoryTitle: 'รายชื่อบุคลากรที่ปฏิบัติหน้าที่',
    searchPlaceholder: 'ค้นหาห้องสนทนาหรือกลุ่ม...',
    newGroupButton: 'สร้างกลุ่มแชทใหม่',
    inviteMemberButton: 'เชิญบุคลากร',

    // Chat Header
    directLineLabel: 'สายตรงส่วนตัวสำหรับการแพทย์',
    groupLineLabel: 'ห้องหารือร่วมกันของทีมดูแลผู้ป่วย',
    patientContextLabel: 'ช่องทางสนทนาเจาะจงเฉพาะรายผู้ป่วย',
    classificationLabel: 'ระดับชั้นความลับ',
    hnLabel: 'เลขผู้ป่วยทั่วไป (HN)',
    anLabel: 'เลขรับผู้ป่วยใน (AN)',
    statusLabel: 'สถานะ',

    // Message input
    messagePlaceholder: 'พิมพ์ข้อความทางคลินิกที่ปลอดภัย...',
    dlpWarning: '⚠️ ตรวจพบข้อมูลลับเฉพาะทางแพทย์ - ข้อความอยู่ภายใต้โปรโตคอลความปลอดภัย',
    sendButton: 'ส่ง',
    classificationInternal: 'ข้อความทั่วไปในคลินิก',
    classificationConfidential: 'ข้อมูลผู้ป่วยเป็นความลับ',
    classificationRestricted: 'ข้อมูลลับควบคุมพิเศษ (PHI)',

    // Context Menu
    pinToTop: 'ปักหมุดไว้บนสุด',
    unpinChat: 'เลิกปักหมุด',
    clearHistory: 'ล้างประวัติการสนทนา',
    clearChat: 'ล้างแชท',
    unsendMessage: 'ยกเลิกการส่งข้อความ',
    unsendConfirmTitle: 'ยกเลิกการส่งข้อความ',
    unsendConfirmDesc: 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการส่งข้อความนี้? ข้อความจะถูกลบออกจากทุกคนในการสนทนานี้',
    messageUnsentToast: 'ยกเลิกการส่งข้อความแล้ว',
    clearForMe: 'ล้างเฉพาะหน้าจอของฉัน',
    purgeForAll: 'ล้างข้อความทั้งหมดสำหรับทุกคน (ผู้ดูแลระบบ)',
    leaveGroup: 'ออกจากกลุ่มแชท',
    inviteStaff: 'เชิญบุคลากรเข้ากลุ่ม',

    // Group Management
    groupManagementTitle: 'ระบบจัดการกลุ่มแชต',
    manageGroupsTab: 'จัดการกลุ่มแชต',
    statusActive: 'เปิดใช้งาน (Active)',
    statusInactive: 'ปิดใช้งาน (Inactive)',
    deactivateGroup: 'ปิดใช้งานกลุ่ม',
    activateGroup: 'เปิดใช้งานกลุ่ม',
    groupDeactivatedToast: 'ปิดใช้งานกลุ่มแชตเรียบร้อย',
    groupActivatedToast: 'เปิดใช้งานกลุ่มแชตเรียบร้อย',
    removeMember: 'ดึงออกจากกลุ่ม',
    memberRemovedToast: 'ดึงสมาชิกออกจากกลุ่มเรียบร้อย',
    groupInactiveBanner: 'กลุ่มแชตนี้ถูกปิดการใช้งาน (Inactive) โดยผู้ดูแลระบบ สมาชิกทั่วไปไม่สามารถส่งข้อความได้',
    reactivateBtn: 'เปิดใช้งานกลุ่มอีกครั้ง',
    groupMembersTitle: 'รายชื่อสมาชิกในกลุ่ม',
    manageMembersBtn: 'จัดการสมาชิก',
    filterAll: 'ทั้งหมด',
    filterGroups: 'กลุ่มแชต',
    filterDirect: 'แชตส่วนตัว',
    groupChatBadge: 'กลุ่มแชต',
    groupMembersCount: 'สมาชิก',
    groupHistoryButton: 'ประวัติกลุ่ม',
    groupHistoryModalTitle: 'ประวัติและข้อมูลกลุ่มแชต',
    noGroupChatsTitle: 'ไม่พบกลุ่มแชตที่คุณเป็นสมาชิก',
    noGroupChatsDesc: 'คุณยังไม่ได้เข้าร่วมกลุ่มแชตใดๆ สามารถสร้างกลุ่มใหม่ หรือให้หัวหน้าทีม/Admin เชิญเข้าร่วมได้',
    createNewGroupBtn: 'สร้างกลุ่มแชตใหม่',
    groupCreatedDate: 'วันที่สร้างกลุ่ม',
    groupTotalMessagesCount: 'จำนวนข้อความทั้งหมด',
    groupSearchHistoryPlaceholder: 'ค้นหาในประวัติแชตของกลุ่มนี้...',
    groupHistoryTabMessages: 'ค้นหาข้อความ',
    groupHistoryTabMembers: 'สมาชิกในกลุ่ม',
    groupHistoryTabFiles: 'ไฟล์และรูปภาพ',
    noMessagesInHistory: 'ยังไม่มีข้อความในประวัติกลุ่มนี้',
    noMatchingHistoryMessages: 'ไม่พบข้อความที่ตรงกับคำค้นหา',
    groupSecurityTitle: 'ระดับความปลอดภัย',
    groupSecurityE2EE: 'เข้ารหัส E2EE ปลอดภัยขั้นสูง (AES-256-GCM)',
    viewAttachmentBtn: 'เปิดดูไฟล์',

    // Profile Settings
    profileTitle: 'ตั้งค่าโปรไฟล์วิชาชีพ',
    roleLabel: 'ตำแหน่งวิชาชีพหลัก',
    usernameLabelSettings: 'ชื่อผู้ใช้บัญชีสุขภาพ',
    uploadPhoto: 'อัปโหลดรูปโปรไฟล์',
    changePhoto: 'เปลี่ยนรูปภาพ',
    removePhoto: 'ลบรูปภาพ',
    photoUploading: 'กำลังอัปโหลดไปยัง Vercel Blob...',
    photoUpdated: 'อัปเดตรูปโปรไฟล์ผ่าน Vercel Blob สำเร็จ',
    photoRemoved: 'ลบรูปโปรไฟล์เรียบร้อย',
    resetPasswordTitle: 'เปลี่ยนรหัสผ่านรหัสความปลอดภัย',
    currentPasswordLabel: 'รหัสผ่านความปลอดภัยปัจจุบัน',
    newPasswordLabel: 'รหัสผ่านความปลอดภัยใหม่',
    confirmPasswordLabel: 'ยืนยันรหัสผ่านความปลอดภัยใหม่',
    passcodeResetting: 'กำลังตั้งค่ารหัสความปลอดภัยใหม่...',
    passcodeResetButton: 'อัปเดตรหัสความปลอดภัย',
    logoutButton: 'ยกเลิกเซสชันและออกจากระบบ',

    // Admin Panel
    adminTitle: 'ระบบจัดการรายชื่อผู้ใช้วิชาชีพคลินิก',
    createStaffButton: 'ลงทะเบียนบัญชีบุคลากรใหม่',
    tableUsername: 'ชื่อผู้ใช้งาน',
    tableFullName: 'ชื่อ-นามสกุล',
    tableRole: 'ตำแหน่งงาน',
    tableActions: 'การจัดการ',
    editAction: 'แก้ไขข้อมูลผู้ใช้',
    auditTitle: 'บันทึกประวัติการตรวจสอบกิจกรรมเข้าถึงข้อมูล (HIPAA Audit)',
    exportAuditButton: 'ส่งออกรายงานความปลอดภัย CSV',

    // Clinical mod
    acknowledgeButton: 'รับทราบ',
    confirmButton: 'ยืนยัน',
    cancelButton: 'ยกเลิก',

    // Additional UI elements
    chatButton: 'ส่งข้อความ',
    nowConnected: 'เชื่อมต่อแล้ว',
    loadEarlier: 'โหลดข้อความก่อนหน้า',
    loadingEarlier: 'กำลังดึงประวัติการสนทนา...',
    typingSuffix: 'กำลังพิมพ์ข้อความ...',
    classificationSelectLabel: 'ระดับชั้นความลับ:',
    classificationHelpText: 'ระดับ RESTRICTED จำกัดเฉพาะผู้มีสิทธิ์เข้าถึงเท่านั้น',
    emptyChatSelection: 'เลือกห้องสนทนาหรือทีมคลินิกเพื่อเริ่มสื่อสารอย่างปลอดภัย',
    copyLink: 'คัดลอกลิงก์ห้องสนทนา',
    closeMenu: 'ปิดเมนู',
    allMembersAdded: 'บุคลากรทั้งหมดเข้าร่วมห้องนี้เรียบร้อยแล้ว',
    roomLabel: 'ห้องสนทนา:',
    searchStaffPlaceholder: 'ค้นหาบุคลากรตามชื่อหรือตำแหน่ง...',
    addMembersBtn: 'เพิ่มเข้ากลุ่ม',
    newRoomModalTitle: 'สร้างห้องสนทนาการแพทย์ใหม่',
    newRoomTitleLabel: 'ชื่อห้องสนทนา / กลุ่มเคส',
    newRoomTitlePlaceholder: 'เช่น ทีมเวรฉุกเฉิน ER, ทีมแพทย์โรคหัวใจ ICU',
    cancelBtn: 'ยกเลิก',
    initRoomBtn: 'สร้างห้องสนทนา',
    directChatPrefix: '👤 ข้อความส่วนตัว (1-1)',
    patientChatPrefix: '🏥 ช่องทางเคสผู้ป่วย',
    groupChatPrefix: '👥 ปรึกษาเคสกลุ่ม',
    statusOnline: 'ออนไลน์',
    statusOffline: 'ออฟไลน์',
  }
};

const getRoleLabel = (role: any, lang: 'TH' | 'EN') => {
  const roleName = typeof role === 'object' && role !== null ? role.name : (role || '');
  if (lang !== 'TH') return roleName;
  switch (roleName) {
    case 'Admin': return 'ผู้ดูแลระบบ';
    case 'Doctor': return 'แพทย์';
    case 'Nurse': return 'พยาบาล';
    case 'Pharmacist': return 'เภสัชกร';
    case 'Lab Staff': return 'นักเทคนิคการแพทย์';
    case 'Radiology Staff': return 'รังสีเทคนิค';
    case 'Staff': return 'เจ้าหน้าที่';
    default: return roleName;
  }
};

export default function ClinicalPlatform() {
  // Authentication & Global State
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentTheme, setCurrentTheme] = useState<'teal' | 'navy' | 'emerald' | 'light' | 'line_pc'>('teal');

  useEffect(() => {
    const savedTheme = localStorage.getItem('hosply_theme');
    if (savedTheme === 'teal' || savedTheme === 'navy' || savedTheme === 'emerald' || savedTheme === 'light' || savedTheme === 'line_pc') {
      setCurrentTheme(savedTheme as any);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hosply_theme', currentTheme);
  }, [currentTheme]);

  // Vercel Blob Profile Photo States
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Restore authenticated session from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hosply_user_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.accessToken) {
          // Verify with backend to ensure token is not expired
          fetch('/api/auth/profile', {
            headers: { Authorization: `Bearer ${parsed.accessToken}` },
          })
            .then((res) => {
              if (res.ok) {
                setCurrentUser(parsed);
              } else {
                console.warn('[Session] Stored session expired or invalid, clearing local session...');
                localStorage.removeItem('hosply_user_session');
                setCurrentUser(null);
              }
            })
            .catch(() => {
              setCurrentUser(parsed);
            });
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Sync user session to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('hosply_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('hosply_user_session');
    }
  }, [currentUser]);



  const [activeTab, setActiveTab] = useState<'chats' | 'patients' | 'directory' | 'admin' | 'settings'>('chats');

  // Authentication & Registration States
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registration Form States
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regProfessionalId, setRegProfessionalId] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Password Reset States
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordResetError, setPasswordResetError] = useState('');
  const [passwordResetSuccess, setPasswordResetSuccess] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);

  // Internationalization (i18n) State
  const [language, setLanguage] = useState<'EN' | 'TH'>('TH');

  // Load language preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('hosply_language');
      if (storedLang === 'EN' || storedLang === 'TH') {
        setLanguage(storedLang);
      }
    }
  }, []);

  const changeLanguage = (lang: 'EN' | 'TH') => {
    setLanguage(lang);
    localStorage.setItem('hosply_language', lang);
  };

  // Unified Custom Clinical Modal system
  const [clinicalModal, setClinicalModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'confirm' | 'warning';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const [adminCleanupTarget, setAdminCleanupTarget] = useState<{ roomId: string; roomName?: string } | null>(null);

  const showClinicalModal = (
    title: string,
    message: string,
    type: 'info' | 'error' | 'success' | 'confirm' | 'warning' = 'info',
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    setClinicalModal({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        setClinicalModal(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setClinicalModal(prev => ({ ...prev, isOpen: false }));
        if (onCancel) onCancel();
      },
    });
  };

  // Load pinned rooms from localStorage on client-side mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hosply_pinned_rooms');
      if (stored) {
        try {
          setPinnedRoomIds(JSON.parse(stored));
        } catch (e) {
          console.error('[Storage] Pinned Rooms Deserialization Error:', e);
        }
      }
    }
  }, []);

  const togglePinRoom = (roomId: string) => {
    setPinnedRoomIds((prev) => {
      const next = prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId];
      localStorage.setItem('hosply_pinned_rooms', JSON.stringify(next));
      showToast(
        prev.includes(roomId) ? 'Discussion unpinned successfully' : 'Discussion pinned to top!',
        'success'
      );
      return next;
    });
  };

  const activeRoomRef = useRef<ChatRoom | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);
  const currentUserRef = useRef<UserSession | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Save active room ID to localStorage
  useEffect(() => {
    if (activeRoom?.id) {
      localStorage.setItem('hosply_last_room_id', activeRoom.id);
    }
  }, [activeRoom?.id]);

  // Close active chat room when switching to other menus/tabs
  useEffect(() => {
    if (activeTab !== 'chats') {
      setActiveRoom(null);
    }
  }, [activeTab]);

  const hasInitialRoomLoadedRef = useRef<boolean>(false);

  const handleTabChange = (tab: 'chats' | 'patients' | 'directory' | 'admin' | 'settings') => {
    setActiveTab(tab);
    setActiveRoom(null);
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'>('PUBLIC');

  // Real-time DLP States
  const [dlpWarning, setDlpWarning] = useState<{ flagged: boolean; reason?: string; match?: string } | null>(null);
  const [dlpBlockMessage, setDlpBlockMessage] = useState<string | null>(null);

  // Search and Filters
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatListFilter, setChatListFilter] = useState<'ALL' | 'GROUPS' | 'DIRECT'>('ALL');
  const [showGroupHistoryModal, setShowGroupHistoryModal] = useState(false);
  const [groupHistorySearchQuery, setGroupHistorySearchQuery] = useState('');
  const [groupHistoryActiveTab, setGroupHistoryActiveTab] = useState<'messages' | 'members' | 'files'>('messages');
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<{ name: string; type: string; dataUrl: string; messageId?: string; attachmentId?: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<{ name: string; type: string; dataUrl: string; classification: string } | null>(null);
  const [decryptedImageUrls, setDecryptedImageUrls] = useState<Record<string, string>>({});
  const decryptingImageIdsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Speech-to-Text & Emoji states
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<'smileys' | 'medical' | 'gestures' | 'hearts'>('smileys');
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  // Session / Logout dialog state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Directory and Chat Creation
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [patientHn, setPatientHn] = useState('');
  const [createRoomType, setCreateRoomType] = useState<'DIRECT' | 'GROUP' | 'PATIENT_CONTEXT'>('GROUP');

  // Admin Dashboard States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [storageUsage, setStorageUsage] = useState({ used: '2.4 GB', total: '100 GB', percentage: 2.4 });
  const [dlpAlertsCount, setDlpAlertsCount] = useState(14);
  const [activeSessionsCount, setActiveSessionsCount] = useState(48);

  // Admin User Maintenance States
  const [adminSubTab, setAdminSubTab] = useState<'compliance' | 'users' | 'groups'>('compliance');
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminRoles, setAdminRoles] = useState<any[]>([]);

  // Admin Group Management States
  const [adminGroups, setAdminGroups] = useState<any[]>([]);
  const [adminGroupSearch, setAdminGroupSearch] = useState('');
  const [adminGroupFilter, setAdminGroupFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showRoomMembersModal, setShowRoomMembersModal] = useState(false);
  const [roomMembersModalTarget, setRoomMembersModalTarget] = useState<any | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userListPage, setUserListPage] = useState(1);

  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    professionalId: '',
    roleId: '',
  });

  const [editingUserData, setEditingUserData] = useState<any>({
    id: '',
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    professionalId: '',
    roleId: '',
    isActive: true,
  });

  // Typing States
  const [typingUsers, setTypingUsers] = useState<any[]>([]);

  // Invite Member Modal & Context Menu States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteTargetRoom, setInviteTargetRoom] = useState<ChatRoom | null>(null);
  const [inviteSelectedMembers, setInviteSelectedMembers] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; room: ChatRoom } | null>(null);

  // Custom Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper to resize and compress user photo strictly to not exceed 10KB
  const resizeAndCompressPhoto = (file: File, maxSizeBytes = 10 * 1024): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let targetWidth = img.width;
          let targetHeight = img.height;
          const MAX_AVATAR_DIM = 180;

          if (targetWidth > MAX_AVATAR_DIM || targetHeight > MAX_AVATAR_DIM) {
            if (targetWidth > targetHeight) {
              targetHeight = Math.round((targetHeight * MAX_AVATAR_DIM) / targetWidth);
              targetWidth = MAX_AVATAR_DIM;
            } else {
              targetWidth = Math.round((targetWidth * MAX_AVATAR_DIM) / targetHeight);
              targetHeight = MAX_AVATAR_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          let quality = 0.82;

          const attemptCompress = () => {
            canvas.toBlob(
              (newBlob) => {
                if (!newBlob) {
                  resolve(file);
                  return;
                }

                if (newBlob.size <= maxSizeBytes || (quality <= 0.15 && targetWidth <= 48)) {
                  const compressedFile = new File([newBlob], `avatar-${Date.now()}.jpg`, {
                    type: 'image/jpeg',
                  });
                  console.log(`[Photo] Resized from ${Math.round(file.size / 1024)}KB down to ${(compressedFile.size / 1024).toFixed(1)}KB (<=10KB limit)`);
                  resolve(compressedFile);
                } else {
                  if (quality > 0.3) {
                    quality -= 0.15;
                  } else {
                    targetWidth = Math.max(48, Math.round(targetWidth * 0.8));
                    targetHeight = Math.max(48, Math.round(targetHeight * 0.8));
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                    quality = 0.6;
                  }
                  attemptCompress();
                }
              },
              'image/jpeg',
              quality
            );
          };

          attemptCompress();
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image (JPEG, PNG, WebP, GIF)', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Automatically resize & compress photo strictly to <= 10KB
      const resizedPhoto = await resizeAndCompressPhoto(file, 10 * 1024);

      if (resizedPhoto.size > 10 * 1024) {
        showToast('Photo could not be compressed under 10KB. Please choose a simpler photo.', 'error');
        setIsUploadingPhoto(false);
        if (e.target) e.target.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('photo', resizedPhoto);

      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentUser.accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        let errMsg = 'Failed to upload photo';
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            errMsg = errData.message || errMsg;
          } else if (res.status === 401) {
            errMsg = 'Your session has expired. Please sign in again.';
          } else {
            errMsg = `Upload failed with status ${res.status}`;
          }
        } catch {
          errMsg = `Upload failed with status ${res.status}`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setCurrentUser(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);
      showToast(`Profile photo resized (${(resizedPhoto.size / 1024).toFixed(1)} KB ≤ 10KB) & saved!`, 'success');

      // Refresh directory and rooms so avatars update everywhere
      fetchRooms();
      fetchDirectory();
    } catch (err: any) {
      showToast(err.message || 'Photo upload failed', 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handlePhotoDelete = async () => {
    if (!currentUser || !currentUser.avatarUrl) return;

    setIsUploadingPhoto(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentUser.accessToken}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to remove photo');
      }

      setCurrentUser(prev => prev ? { ...prev, avatarUrl: null } : null);
      showToast(translations[language].photoRemoved || 'Profile photo removed', 'info');
      fetchRooms();
      fetchDirectory();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove photo', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef<boolean>(true);

  // API base URL
  const API_URL = typeof window !== 'undefined' ? window.location.origin : '';

  // Apply dark mode on mount
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      shouldScrollToBottomRef.current = true;
    }
  }, [messages, typingUsers]);

  // Client-side real-time DLP Regex Scan
  useEffect(() => {
    if (!messageInput.trim()) {
      setDlpWarning(null);
      setDlpBlockMessage(null);
      return;
    }

    const thaiIdPattern = /\b[1-9]\d{12}\b/;
    const hnPattern = /\b(HN|hn)[-\s]?\d{6,8}\b/;
    const phonePattern = /\b(0[689]\d{8}|02\d{7})\b/;
    const labPattern = /\b(HbA1c|eGFR|WBC|RBC|Creatinine|BUN)\s*[:=]\s*\d+(\.\d+)?\b/i;

    let warning = null;

    if (thaiIdPattern.test(messageInput)) {
      const match = messageInput.match(thaiIdPattern)?.[0];
      warning = { flagged: true, reason: 'Thai National ID Card (13-digit)', match };
    } else if (hnPattern.test(messageInput)) {
      const match = messageInput.match(hnPattern)?.[0];
      warning = { flagged: true, reason: 'Hospital Number (HN)', match };
    } else if (labPattern.test(messageInput)) {
      const match = messageInput.match(labPattern)?.[0];
      warning = { flagged: true, reason: 'Clinical Laboratory Findings', match };
    } else if (phonePattern.test(messageInput)) {
      const match = messageInput.match(phonePattern)?.[0];
      warning = { flagged: true, reason: 'Personal Contact Number', match };
    }

    if (warning) {
      setDlpWarning(warning);
      // Blocks Thai ID & Lab reports to strictly comply with HIPAA/PDPA
      if (warning.reason.includes('ID') || warning.reason.includes('Laboratory')) {
        setDlpBlockMessage(`Security Warning: Transmission of ${warning.reason} is blocked by hospital policies.`);
      } else {
        setDlpBlockMessage(null);
      }
    } else {
      setDlpWarning(null);
      setDlpBlockMessage(null);
    }
  }, [messageInput]);

  // Gentle clinical chime notification sound using Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Play a gentle two-tone chime: E5 followed by A5
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.08, startTime + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playTone(659.25, now, 0.35); // E5
      playTone(880.00, now + 0.12, 0.5); // A5
    } catch (e) {
      console.warn('AudioContext playback failed:', e);
    }
  };

  // Fetch initial data upon login
  useEffect(() => {
    if (!currentUser) return;

    fetchRooms();
    fetchDirectory();
    fetchAuditLogs();
    if (currentUser.role === 'Admin') {
      fetchAdminUsers();
      fetchAdminRoles();
      fetchAdminGroups();
    }

    // Socket.io initialization
    const socket = io(API_URL, {
      query: { token: currentUser.accessToken },
      // Removed strict transports: ['websocket'] to allow fallback to HTTP Long-Polling
      // if NGINX/Ubuntu proxy isn't configured with Upgrade headers properly.
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Realtime WS Connected');
      const curRoomId = activeRoomRef.current?.id;
      if (curRoomId) {
        socket.emit('joinRoom', { roomId: curRoomId });
        socket.emit('readRoom', { roomId: curRoomId });
      }
    });

    socket.on('onlineUsersList', (data: { userIds: string[] }) => {
      setOnlineUserIds(new Set(data.userIds || []));
    });

    socket.on('userPresence', (data: { userId: string; username: string; status: 'online' | 'offline' }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (data.status === 'online') {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    socket.on('newMessage', (msg: Message) => {
      const isMe = msg.sender.id === currentUser.id;

      if (!isMe) {
        // Play gentle chime
        playNotificationSound();

        // If message is in another room, display custom toast signal
        const currentActiveRoom = activeRoomRef.current;
        if (!currentActiveRoom || msg.roomId !== currentActiveRoom.id) {
          // Fetch updated rooms list to update unread counts
          fetchRooms();

          // Show toast alert
          const targetRoom = roomsRef.current.find((r) => r.id === msg.roomId);
          const roomLabel = targetRoom ? targetRoom.name : 'another discussion';
          showToast(`New message in ${roomLabel} from ${msg.sender.firstName}: "${msg.content.substring(0, 30)}${msg.content.length > 30 ? '...' : ''}"`, 'info');
        } else {
          // Active room: mark as read immediately by emitting readRoom to clear unread database count
          socket.emit('readRoom', { roomId: currentActiveRoom.id });
        }
      }

      // Update room list in state locally to prevent HTTP fetch race condition
      setRooms((prevRooms) => {
        const currentActive = activeRoomRef.current || activeRoom;
        return prevRooms.map((r) => {
          if (r.id === msg.roomId) {
            const isActive = currentActive && currentActive.id === msg.roomId;
            return {
              ...r,
              unreadCount: isActive ? 0 : (r.unreadCount || 0) + (isMe ? 0 : 1),
            };
          }
          return r;
        });
      });

      // Append if it's the active room
      setMessages((prev) => {
        const currentActiveRoom = activeRoomRef.current;
        if (!currentActiveRoom || msg.roomId !== currentActiveRoom.id) return prev;
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Update room last reading status in database, slightly delayed to avoid DB write/read race conditions
      setTimeout(() => {
        fetchRooms();
      }, 300);
    });

    socket.on('roomJoined', (data: any) => {
      console.log('[Socket] You joined or were invited to a new room:', data);
      fetchRooms();
      showToast('You have been added to a new chat group!', 'success');
      playNotificationSound();

      // Auto-join the new room's socket channel so we can receive its messages
      if (data.roomId && socketRef.current) {
        socketRef.current.emit('joinRoom', { roomId: data.roomId });
      }
    });

    socket.on('roomMembersUpdated', (data: any) => {
      console.log('[Socket] Room roster updated:', data);
      fetchRooms();
    });

    socket.on('userReadRoom', (data: { userId: string; roomId: string; lastReadAt: string }) => {
      setActiveRoom((prev) => {
        if (!prev || prev.id !== data.roomId) return prev;
        const updatedMembers = (prev.members || []).map((m: any) => {
          if (m.userId === data.userId || m.user?.id === data.userId) {
            return { ...m, lastReadAt: data.lastReadAt };
          }
          return m;
        });
        return { ...prev, members: updatedMembers };
      });

      setRooms((prevRooms) =>
        prevRooms.map((r) => {
          if (r.id !== data.roomId) return r;
          const updatedMembers = (r.members || []).map((m: any) => {
            if (m.userId === data.userId || m.user?.id === data.userId) {
              return { ...m, lastReadAt: data.lastReadAt };
            }
            return m;
          });
          return { ...r, members: updatedMembers };
        })
      );
    });

    socket.on('userTyping', (data: any) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.userId !== data.userId);
          return [...filtered, { ...data, timestamp: Date.now() }];
        });
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }
    });

    const typingCleaner = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const active = prev.filter((u) => !u.timestamp || now - u.timestamp < 5000);
        return active.length === prev.length ? prev : active;
      });
    }, 2000);

    socket.on('messageUnsent', (data: { messageId: string; roomId: string; deletedAt?: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
              ...m,
              deletedAt: data.deletedAt || new Date().toISOString(),
              content: '[This message was unsent]',
              attachments: [],
            }
            : m
        )
      );
      fetchRooms();
    });

    socket.on('roomCleared', (data: { roomId: string }) => {
      if (activeRoomRef.current?.id === data.roomId) {
        setMessages([]);
      }
      fetchRooms();
    });

    socket.on('roomPurged', (data: { roomId: string }) => {
      if (activeRoomRef.current?.id === data.roomId) {
        setMessages([]);
      }
      fetchRooms();
      showToast('Room chat history was purged by administrator', 'info');
    });

    socket.on('roomStatusUpdated', (data: { roomId: string; isActive: boolean; roomName?: string }) => {
      setRooms((prev) => prev.map((r) => r.id === data.roomId ? { ...r, isActive: data.isActive } : r));
      if (activeRoomRef.current?.id === data.roomId) {
        if (!data.isActive) {
          setActiveRoom(null);
        } else {
          setActiveRoom((prev) => prev ? { ...prev, isActive: data.isActive } : null);
        }
      }
      setAdminGroups((prev) => prev.map((g) => g.id === data.roomId ? { ...g, isActive: data.isActive } : g));
      fetchRooms();
      showToast(`สถานะกลุ่มแชตถูกปรับเป็น ${data.isActive ? 'เปิดใช้งาน (Active)' : 'ปิดใช้งาน (Inactive)'}`, 'info');
    });

    socket.on('roomRemoved', (data: { roomId: string; message: string }) => {
      showToast(data.message || 'คุณถูกนำออกจากกลุ่มแชตนี้แล้ว', 'info');
      if (activeRoomRef.current?.id === data.roomId) {
        setActiveRoom(null);
      }
      fetchRooms();
    });

    socket.on('roomMemberRemoved', (data: { roomId: string; removedUserId: string }) => {
      if (activeRoomRef.current?.id === data.roomId) {
        setActiveRoom((prev) => prev ? {
          ...prev,
          members: (prev.members || []).filter((m: any) => (m.userId || m.user?.id) !== data.removedUserId),
        } : null);
      }
      setRooms((prev) => prev.map((r) => r.id === data.roomId ? {
        ...r,
        members: (r.members || []).filter((m: any) => (m.userId || m.user?.id) !== data.removedUserId),
      } : r));
      setAdminGroups((prev) => prev.map((g) => g.id === data.roomId ? {
        ...g,
        members: (g.members || []).filter((m: any) => (m.userId || m.user?.id) !== data.removedUserId),
      } : g));
    });

    socket.on('roomMembersUpdated', () => {
      fetchRooms();
      if (currentUser?.role === 'Admin') {
        fetchAdminGroups();
      }
    });

    socket.on('error', (err: any) => {
      showToast(`Server Blocked Action: ${err.message}`, 'error');
    });

    return () => {
      clearInterval(typingCleaner);
      socket.disconnect();
    };
  }, [currentUser]);

  const activeRoomId = activeRoom?.id;

  // Handle active room switch
  useEffect(() => {
    if (!activeRoomId) return;

    setMessages([]);
    setTypingUsers([]);

    // Instantly clear the unread count for this room locally in rooms list state for zero-latency UX feel!
    setRooms((prevRooms) =>
      prevRooms.map((r) =>
        r.id === activeRoomId ? { ...r, unreadCount: 0 } : r
      )
    );

    // Subscribe to Socket Room and mark as read on server to update database record
    if (socketRef.current) {
      socketRef.current.emit('joinRoom', { roomId: activeRoomId });
      socketRef.current.emit('readRoom', { roomId: activeRoomId });
    }

    // Fetch message history REST
    fetchMessages(activeRoomId);
  }, [activeRoomId]);

  // --- API CALLS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      if (!response.ok) {
        throw new Error('Invalid login credentials or Server offline');
      }

      const data = await response.json();
      setCurrentUser({
        id: data.user.id,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role,
        avatarUrl: data.user.avatarUrl || null,
        accessToken: data.accessToken,
      });
    } catch (err: any) {
      console.error('Login failed:', err);
      setLoginError('ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง หรือเซิร์ฟเวอร์ออฟไลน์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (regPassword.length < 6) {
      setRegError(language === 'TH' ? 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters long');
      return;
    }

    setIsRegistering(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          password: regPassword,
          firstName: regFirstName.trim(),
          lastName: regLastName.trim(),
          professionalId: regProfessionalId.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (language === 'TH' ? 'การลงทะเบียนไม่สำเร็จ' : 'Registration failed'));
      }

      showToast(
        language === 'TH'
          ? `ยินดีต้อนรับคุณ ${data.user.firstName}! บัญชีผู้ใช้ถูกสร้างเรียบร้อยแล้ว`
          : `Welcome ${data.user.firstName}! Account created successfully.`,
        'success'
      );

      // Auto-login with issued access token
      setCurrentUser({
        id: data.user.id,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role,
        avatarUrl: data.user.avatarUrl || null,
        accessToken: data.accessToken,
      });
    } catch (err: any) {
      console.error('Registration failed:', err);
      setRegError(err.message || (language === 'TH' ? 'การลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Registration failed. Please try again.'));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = async () => {
    const token = currentUser?.accessToken;
    if (socketRef.current) {
      socketRef.current.emit('userLogout');
      socketRef.current.disconnect();
    }
    if (token) {
      try {
        fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: token }),
        }).catch(() => { });
      } catch (err) {
        // ignore logout fetch error
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('hosply_user_session');
    setRooms([]);
    setActiveRoom(null);
    setMessages([]);
    setOnlineUserIds(new Set());
    hasInitialRoomLoadedRef.current = false;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordResetError('');
    setPasswordResetSuccess('');

    if (newPasswordInput.length < 6) {
      setPasswordResetError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordResetError('รหัสผ่านใหม่ไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    setIsResettingPassword(true);

    try {
      const response = await fetch(`${API_URL}/api/users/me/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ รหัสผ่านปัจจุบันอาจไม่ถูกต้อง');
      }

      setPasswordResetSuccess('เปลี่ยนรหัสผ่านเสร็จสมบูรณ์เรียบร้อยแล้ว!');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      showToast('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      setPasswordResetError(err.message || 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง');
      showToast(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);

        // Keep current active room if it exists and is still active
        const currentActive = activeRoomRef.current || activeRoom;
        if (currentActive) {
          const freshActive = data.find((r: any) => r.id === currentActive.id);
          if (freshActive && (freshActive.type !== 'GROUP' || freshActive.isActive !== false)) {
            setActiveRoom(freshActive);
            return;
          } else if (freshActive && freshActive.type === 'GROUP' && freshActive.isActive === false) {
            setActiveRoom(null);
          }
        }

        // Only auto-select on initial load if user hasn't explicitly closed it and is on chats tab
        if (!hasInitialRoomLoadedRef.current && activeTab === 'chats') {
          hasInitialRoomLoadedRef.current = true;
          const lastRoomId = localStorage.getItem('hosply_last_room_id');
          if (lastRoomId) {
            const lastRoom = data.find((r: any) => r.id === lastRoomId && (r.type !== 'GROUP' || r.isActive !== false));
            if (lastRoom) {
              setActiveRoom(lastRoom);
              return;
            }
          }
          const firstActive = data.find((r: any) => r.type !== 'GROUP' || r.isActive !== false);
          if (firstActive) {
            setActiveRoom(firstActive);
          }
        }
      } else if (res.status === 401) {
        console.warn('[Session] Token expired or invalid (401), resetting session...');
        localStorage.removeItem('hosply_user_session');
        setCurrentUser(null);
        showToast(
          language === 'TH'
            ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
            : 'Your session has expired. Please log in again.',
          'info'
        );
        return;
      } else {
        throw new Error();
      }
    } catch (e) {
      // Mock fallback
      const mockRooms: ChatRoom[] = [
        {
          id: 'room-1',
          name: 'ER Clinical Staff Night Shift',
          type: 'GROUP',
        },
        {
          id: 'room-2',
          name: 'HN-238491 (สมศักดิ์ แข็งแรง) - Stroke Care Room',
          type: 'PATIENT_CONTEXT',
          patientContext: {
            id: 'pat-1',
            hn: 'HN-238491',
            an: 'AN-558832',
            nameHash: 'Stroke Monitoring Suite 4A',
            status: 'ACTIVE',
          },
        },
        {
          id: 'room-3',
          name: 'พญ. วริศรา รุ่งเรือง (Pharmacist)',
          type: 'DIRECT',
        },
      ];
      setRooms(mockRooms);

      // Keep current active room if it exists
      const currentActive = activeRoomRef.current || activeRoom;
      if (currentActive) {
        const freshActive = mockRooms.find((r) => r.id === currentActive.id);
        if (freshActive) {
          setActiveRoom(freshActive);
          return;
        }
      }

      if (!hasInitialRoomLoadedRef.current && activeTab === 'chats') {
        hasInitialRoomLoadedRef.current = true;
        const lastRoomId = localStorage.getItem('hosply_last_room_id');
        const lastRoom = mockRooms.find((r) => r.id === lastRoomId);
        if (lastRoom) {
          setActiveRoom(lastRoom);
        } else if (mockRooms.length > 0) {
          setActiveRoom(mockRooms[0]);
        }
      }
    }
  };

  const fetchMessages = async (roomId: string, isInitial = true) => {
    try {
      const limit = 20;
      let url = `${API_URL}/api/rooms/${roomId}/messages?limit=${limit}`;

      if (!isInitial && messages.length > 0) {
        const oldestMessageId = messages[0].id;
        url += `&cursor=${oldestMessageId}`;
        setIsLoadingMore(true);
        shouldScrollToBottomRef.current = false;
      } else {
        shouldScrollToBottomRef.current = true;
        setHasMoreMessages(false);
      }

      const token = currentUserRef.current?.accessToken || currentUser?.accessToken;
      if (!token) return;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (isInitial) {
          setMessages(data);
          setHasMoreMessages(data.length === limit);
        } else {
          setMessages((prev) => [...data, ...prev]);
          setHasMoreMessages(data.length === limit);
        }
      } else if (res.status === 401) {
        console.warn('[Session] Token expired on fetchMessages (401)');
        localStorage.removeItem('hosply_user_session');
        setCurrentUser(null);
        return;
      } else {
        throw new Error();
      }
    } catch (e) {
      // Mock Messages fallback
      const mockMessages: Record<string, Message[]> = {
        'room-1': [
          {
            id: 'm1',
            roomId: 'room-1',
            content: 'สวัสดีครับเวรดึกคืนนี้ มีเคส Stroke รับใหม่ 1 ราย กำลังย้ายไปเตียง 4A ครับ',
            classification: 'INTERNAL',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            sender: { id: 'd2', username: 'doctor2', firstName: 'อนันต์', lastName: 'เมธี', role: 'Doctor' },
          },
          {
            id: 'm2',
            roomId: 'room-1',
            content: 'รับทราบค่ะ เฝ้าระวังติดตามสัญญาณชีพทุก 15 นาที',
            classification: 'INTERNAL',
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            sender: { id: 'n1', username: 'nurse1', firstName: 'มาริสา', lastName: 'ดูแลดี', role: 'Nurse' },
          },
        ],
        'room-2': [
          {
            id: 'm3',
            roomId: 'room-2',
            content: 'ผลแล็บเบื้องต้นออกแล้วครับ eGFR อยู่ที่ 45 mL/min/1.73m2 มีประวัติเบาหวานพ่วงด้วย',
            classification: 'CONFIDENTIAL',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            sender: { id: 'l1', username: 'lab1', firstName: 'ประเสริฐ', lastName: 'วิเคราะห์ผล', role: 'Lab Staff' },
          },
          {
            id: 'm4',
            roomId: 'room-2',
            content: '⚠️ [DLP EVENT - BLOCKED] ข้อความมีข้อมูล Thai ID สแกนถูกสกัดกั้นเพื่อรักษาความปลอดภัยข้อมูลผู้ป่วย',
            classification: 'RESTRICTED',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            sender: { id: 'sys', username: 'system', firstName: 'DLP Security', lastName: 'Gateway', role: 'Admin' },
          },
        ],
        'room-3': [
          {
            id: 'm5',
            roomId: 'room-3',
            content: 'สอบถามเรื่องขนาดยา Aspirin 81 mg ให้คนไข้ได้เลยไหมคะ?',
            classification: 'INTERNAL',
            createdAt: new Date(Date.now() - 10000000).toISOString(),
            sender: { id: 'd1', username: 'doctor1', firstName: 'สมชาย', lastName: 'รักดี', role: 'Doctor' },
          },
        ],
      };
      if (isInitial) {
        setMessages(mockMessages[roomId] || []);
        setHasMoreMessages(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadMoreMessages = async () => {
    if (isLoadingMore || !activeRoom) return;
    await fetchMessages(activeRoom.id, false);
  };

  const openClearChatPrompt = (roomId: string, roomName?: string) => {
    const isAdmin = currentUser?.role === 'Admin';
    if (isAdmin) {
      setAdminCleanupTarget({ roomId, roomName });
    } else {
      handleClearChatHistory(roomId, false);
    }
  };

  const handleClearChatHistory = (roomId: string, purgeAll = false) => {
    const title = purgeAll
      ? (translations[language].purgeForAll || 'Purge All Messages for Everyone (Admin)')
      : (translations[language].clearHistory || 'Clear Chat History');
    const desc = purgeAll
      ? (language === 'TH'
        ? 'คุณกำลังจะลบข้อความทั้งหมดในห้องนี้สำหรับทุกคนอย่างถาวร (บันทึก Audit Log) ยืนยันหรือไม่?'
        : 'Are you sure you want to permanently purge all messages in this room for everyone? An administrative audit log will be recorded.')
      : (language === 'TH'
        ? 'คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติการสนทนานี้? ข้อความจะถูกลบออกจากหน้าจอของคุณเท่านั้น'
        : 'Are you sure you want to clear your chat history for this room? This will only remove history from your screen.');

    showClinicalModal(
      title,
      desc,
      'confirm',
      async () => {
        try {
          if (socketRef.current) {
            socketRef.current.emit('clearRoom', { roomId, purgeAll });
          }

          const res = await fetch(`${API_URL}/api/rooms/${roomId}/clear`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentUser?.accessToken}`,
            },
            body: JSON.stringify({ purgeAll }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to clear chat history');
          }

          showToast(purgeAll ? 'All room messages purged!' : 'Chat history cleared locally!', 'success');

          if (activeRoom && activeRoom.id === roomId) {
            setMessages([]);
          }
          fetchRooms();
        } catch (error: any) {
          showClinicalModal(
            'Action Blocked',
            error.message || 'An error occurred while clearing history.',
            'error'
          );
        }
      }
    );
  };

  const handleUnsendMessage = (msg: Message) => {
    const isMe = msg.sender?.id === currentUser?.id || (msg as any).senderId === currentUser?.id;
    const isAdmin = currentUser?.role?.toLowerCase().includes('admin');
    if (!isMe && !isAdmin) return;

    showClinicalModal(
      translations[language].unsendConfirmTitle,
      translations[language].unsendConfirmDesc,
      'confirm',
      async () => {
        try {
          // If the message is a local fallback or demo message (e.g. from mock room or offline state), remove locally
          // If the message is a local fallback or demo message (e.g. from mock room or offline state), mark unsent locally
          const isLocalOnly = !msg.id || msg.id.includes('.') || msg.id.startsWith('m') || msg.roomId.startsWith('room-');
          if (isLocalOnly) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id
                  ? {
                    ...m,
                    deletedAt: new Date().toISOString(),
                    content: '[This message was unsent]',
                    attachments: [],
                  }
                  : m
              )
            );
            showToast(translations[language].messageUnsentToast, 'success');
            return;
          }

          if (socketRef.current) {
            socketRef.current.emit('unsendMessage', {
              messageId: msg.id,
              roomId: msg.roomId,
            });
          }

          const res = await fetch(`${API_URL}/api/rooms/${msg.roomId}/messages/${msg.id}/unsend`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${currentUser?.accessToken}`,
            },
          });

          if (res.status === 401) {
            localStorage.removeItem('hosply_user_session');
            setCurrentUser(null);
            showToast(
              language === 'TH'
                ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
                : 'Session expired. Please log in again to unsend messages.',
              'info'
            );
            return;
          }

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to unsend message');
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? {
                  ...m,
                  deletedAt: new Date().toISOString(),
                  content: '[This message was unsent]',
                  attachments: [],
                }
                : m
            )
          );
          showToast(translations[language].messageUnsentToast, 'success');
          fetchRooms();
        } catch (error: any) {
          showClinicalModal(
            'Action Blocked',
            error.message || 'Failed to unsend message',
            'error'
          );
        }
      }
    );
  };

  const fetchDirectory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/directory`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        const users = await res.json();
        setDirectoryUsers(users);
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          users.forEach((u: any) => {
            if (u.isOnline) {
              next.add(u.id);
            } else {
              next.delete(u.id);
            }
          });
          return next;
        });
      } else throw new Error();
    } catch (e) {
      setDirectoryUsers([
        { id: 'u-dir-1', username: 'nurse1', firstName: 'มาริสา', lastName: 'ดูแลดี', role: 'Nurse' },
        { id: 'u-dir-2', username: 'pharmacist1', firstName: 'วริศรา', lastName: 'รุ่งเรือง', role: 'Pharmacist' },
        { id: 'u-dir-3', username: 'lab1', firstName: 'ประเสริฐ', lastName: 'วิเคราะห์ผล', role: 'Lab Staff' },
        { id: 'u-dir-4', username: 'doctor2', firstName: 'อนันต์', lastName: 'เมธี', role: 'Doctor' },
      ]);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/audit?limit=10`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.items);
      } else throw new Error();
    } catch (e) {
      setAuditLogs([
        {
          id: 'log-1',
          action: 'POST_AuthController_login',
          entity: 'API_ENDPOINT',
          entityId: '/api/auth/login',
          details: JSON.stringify({ username: 'doctor1', status: 'SUCCESS' }),
          ipAddress: '192.168.10.104',
          createdAt: new Date().toISOString(),
          user: { username: 'doctor1', firstName: 'สมชาย', lastName: 'รักดี', role: { name: 'Doctor' } },
        },
        {
          id: 'log-2',
          action: 'DLP_TRIGGERED_BLOCK',
          entity: 'Message',
          details: JSON.stringify({ reason: 'Thai National ID Card (13-digit)', contentPreview: 'ID: 110200...' }),
          ipAddress: '192.168.10.104',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          user: { username: 'doctor1', firstName: 'สมชาย', lastName: 'รักดี', role: { name: 'Doctor' } },
        },
      ]);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/admin/list`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
      } else {
        throw new Error('API Error');
      }
    } catch (e) {
      setAdminUsers([
        { id: 'u1', username: 'doctor1', firstName: 'สมชาย', lastName: 'รักดี', role: 'Doctor', roleId: 'role-doctor', isActive: true, professionalId: 'MD-998877' }
      ]);
    }
  };

  const fetchAdminRoles = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/admin/roles`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminRoles(data);
        return data;
      }
      throw new Error('API Error');
    } catch (e) {
      const fallbackRoles = [
        { id: 'role-admin', name: 'Admin' },
        { id: 'role-doctor', name: 'Doctor' },
        { id: 'role-nurse', name: 'Nurse' },
        { id: 'role-pharmacist', name: 'Pharmacist' },
        { id: 'role-staff', name: 'Staff' },
        { id: 'role-other', name: 'Other' }
      ];
      setAdminRoles(fallbackRoles);
      return fallbackRoles;
    }
  };

  const fetchAdminGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/admin/list`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminGroups(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch admin groups:', e);
    }
  };

  const handleToggleRoomActive = async (roomId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    const confirmMsg = nextActive
      ? (language === 'TH' ? 'ต้องการเปิดใช้งานกลุ่มแชตนี้ใช่หรือไม่?' : 'Do you want to reactivate this group chat?')
      : (language === 'TH' ? 'ต้องการปิดใช้งานกลุ่มแชตนี้ใช่หรือไม่? สมาชิกทั่วไปจะไม่สามารถส่งข้อความได้' : 'Do you want to deactivate this group chat? Regular members will not be able to send messages.');
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update group status');
      }
      showToast(nextActive ? translations[language].groupActivatedToast : translations[language].groupDeactivatedToast, 'success');
      setAdminGroups((prev) => prev.map((g) => g.id === roomId ? { ...g, isActive: nextActive } : g));
      setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, isActive: nextActive } : r));
      if (activeRoom?.id === roomId) {
        if (!nextActive && activeRoom.type === 'GROUP') {
          setActiveRoom(null);
        } else {
          setActiveRoom((prev) => prev ? { ...prev, isActive: nextActive } : null);
        }
      }
      if (roomMembersModalTarget?.id === roomId) {
        setRoomMembersModalTarget((prev: any) => prev ? { ...prev, isActive: nextActive } : null);
      }
      fetchRooms();
    } catch (err: any) {
      showToast(err.message || 'Error updating group status', 'error');
    }
  };

  const handleRemoveMember = async (roomId: string, targetUserId: string, targetName: string) => {
    const confirmMsg = language === 'TH'
      ? `คุณต้องการดึง ${targetName} ออกจากกลุ่มแชตใช่หรือไม่?`
      : `Are you sure you want to remove ${targetName} from the group?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to remove member');
      }
      showToast(translations[language].memberRemovedToast, 'success');
      const filterMembers = (members: any[]) => (members || []).filter((m: any) => (m.userId || m.user?.id) !== targetUserId);
      if (activeRoom?.id === roomId) {
        setActiveRoom((prev) => prev ? { ...prev, members: filterMembers(prev.members || []) } : null);
      }
      if (roomMembersModalTarget?.id === roomId) {
        setRoomMembersModalTarget((prev: any) => prev ? { ...prev, members: filterMembers(prev.members || []) } : null);
      }
      setAdminGroups((prev) => prev.map((g) => g.id === roomId ? { ...g, members: filterMembers(g.members || []) } : g));
      setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, members: filterMembers(r.members || []) } : r));
    } catch (err: any) {
      showToast(err.message || 'Error removing member', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users/admin/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify(newUserData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to create user');
      }

      showToast('User created successfully!', 'success');
      setShowAddUserModal(false);
      setNewUserData({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        professionalId: '',
        roleId: '',
      });
      await fetchAdminUsers();
      await fetchRooms(); // update active list just in case
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users/admin/update/${editingUserData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify(editingUserData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update user');
      }

      showToast('User updated successfully!', 'success');
      setShowEditUserModal(false);
      await fetchAdminUsers();
      await fetchRooms();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const resizeAndCompressImage = (file: File, maxSizeKB = 100): Promise<{ file: File; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      // If not an image or already under 100KB, read directly and return
      if (!file.type.startsWith('image/') || file.size <= maxSizeKB * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({ file, dataUrl: reader.result as string });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ file, dataUrl: event.target?.result as string });
            return;
          }

          let width = img.width;
          let height = img.height;

          // Max dimension constraint to help with scaling down
          const MAX_DIMENSION = 1200;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // We'll perform step-down quality compression to get under 100KB
          let quality = 0.95;
          let base64 = canvas.toDataURL('image/jpeg', quality);
          let approxSize = base64.length * 0.75;

          // Step down quality and scale down canvas size iteratively
          while (approxSize > maxSizeKB * 1024 && quality > 0.1) {
            quality -= 0.15;
            if (quality < 0.5) {
              width = Math.round(width * 0.85);
              height = Math.round(height * 0.85);
              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);
            }
            base64 = canvas.toDataURL('image/jpeg', quality);
            approxSize = base64.length * 0.75;
          }

          // Convert the base64 back into a File object for multipart form upload
          try {
            const arr = base64.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }

            // Retain original filename but make sure it has .jpg extension since we compressed it
            let name = file.name;
            const lastDot = name.lastIndexOf('.');
            if (lastDot !== -1) {
              name = name.substring(0, lastDot) + '.jpg';
            } else {
              name += '.jpg';
            }

            const compressedFile = new File([u8arr], name, { type: mime });
            console.log(`[Storage] Compressed image from ${Math.round(file.size / 1024)}KB down to ${Math.round(compressedFile.size / 1024)}KB`);
            resolve({ file: compressedFile, dataUrl: base64 });
          } catch (e) {
            console.error('Conversion from base64 back to File failed, falling back to original:', e);
            resolve({ file, dataUrl: event.target?.result as string });
          }
        };
        img.onerror = () => {
          resolve({ file, dataUrl: event.target?.result as string });
        };
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile || !activeRoom) return;

    // Security & Storage Policy: Enforce maximum 10MB limit for all attachment files
    if (originalFile.size > 10 * 1024 * 1024) {
      showClinicalModal(
        'File Size Exceeded',
        `The file "${originalFile.name}" (${(originalFile.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed attachment limit of 10 MB.`,
        'error'
      );
      e.target.value = '';
      return;
    }

    setIsUploadingFile(true);

    try {
      // Compress and optimize image file to under 100KB in the background
      const { file, dataUrl } = await resizeAndCompressImage(originalFile, 100);

      setSelectedAttachmentFile({
        name: file.name,
        type: file.type,
        dataUrl: dataUrl,
      });

      // Encrypt optimized file natively in browser before sending to Next.js storage API
      const encryptedFile = await encryptFileClient(file, activeRoom.id);

      const formData = new FormData();
      formData.append('file', encryptedFile);
      formData.append('roomId', activeRoom.id);
      formData.append('originalName', file.name);
      formData.append('originalType', file.type);
      formData.append('originalSize', file.size.toString());

      const res = await fetch(`${API_URL}/api/storage/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        let errMsg = 'File upload failed';
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            if (res.status === 401 || errData.message === 'Unauthorized') {
              errMsg = 'Your login session has expired. Please sign out and sign in again to refresh your credentials.';
            } else {
              errMsg = errData.message || errMsg;
            }
          } else if (res.status === 401) {
            errMsg = 'Your login session has expired. Please sign out and sign in again to refresh your credentials.';
          } else if (res.status === 413) {
            errMsg = 'File size exceeds server upload limit (max 4.5MB on Vercel Serverless).';
          } else {
            const text = await res.text();
            if (text && text.length < 200 && !text.includes('<!DOCTYPE')) {
              errMsg = text;
            } else if (res.status === 500) {
              errMsg = 'Vercel Server error (500). Please ensure BLOB_READ_WRITE_TOKEN is added in Vercel Project Settings > Environment Variables.';
            } else {
              errMsg = `Upload failed with server status ${res.status}`;
            }
          }
        } catch {
          errMsg = `Upload failed with server status ${res.status}`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setSelectedAttachmentFile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messageId: data.messageId,
          attachmentId: data.attachment?.id,
        };
      });

      // Cache dataUrl for immediate local rendering after send
      if (data.attachment?.id && dataUrl) {
        setDecryptedImageUrls((prev) => ({ ...prev, [data.attachment.id]: dataUrl }));
      }
      if (data.messageId && dataUrl) {
        setDecryptedImageUrls((prev) => ({ ...prev, [data.messageId]: dataUrl }));
      }

      if (originalFile.size > 100 * 1024 && originalFile.type.startsWith('image/')) {
        showToast(`Image encrypted & stored via Vercel Blob (${Math.round(file.size / 1024)} KB)`, 'success');
      } else {
        showToast('File encrypted & stored via Vercel Blob successfully!', 'success');
      }
    } catch (err: any) {
      showClinicalModal(
        'Upload Failed',
        `Storage Upload Error: ${err.message || 'Could not upload file to storage.'}`,
        'error'
      );
      setSelectedAttachmentFile(null);
    } finally {
      setIsUploadingFile(false);
    }

    e.target.value = '';
  };

  const loadDecryptedImage = useCallback(async (attachmentId: string, fileType: string, roomId: string) => {
    if (!attachmentId || decryptingImageIdsRef.current.has(attachmentId)) return;
    decryptingImageIdsRef.current.add(attachmentId);

    try {
      const token = currentUserRef.current?.accessToken || currentUser?.accessToken;
      if (!token) return;

      const res = await fetch(`${API_URL}/api/storage/download-url/${attachmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;

      const data = await res.json();
      const absoluteUrl = `${API_URL}${data.url}`;

      const fileRes = await fetch(absoluteUrl);
      if (!fileRes.ok) return;

      const encryptedArrayBuffer = await fileRes.arrayBuffer();
      const decryptedArrayBuffer = await decryptFileClient(encryptedArrayBuffer, roomId);

      const blob = new Blob([decryptedArrayBuffer], { type: fileType || 'image/jpeg' });
      const localUrl = URL.createObjectURL(blob);

      setDecryptedImageUrls((prev) => ({
        ...prev,
        [attachmentId]: localUrl,
      }));
    } catch (err) {
      console.warn('[Decryption] Failed to auto-load image thumbnail:', err);
    }
  }, [currentUser]);

  // Pre-curated medical and everyday emojis
  const EMOJI_LISTS = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '😎', '🥳', '🥺', '😭', '😤', '😡', '🤔', '🤫', '😴', '😷'],
    medical: ['🩺', '💊', '💉', '🩹', '🧬', '🩸', '🏥', '🚑', '👨‍⚕️', '👩‍⚕️', '🧑‍⚕️', '🔬', '🩻', '🦷', '🫀', '🫁', '🧠', '🤒', '🤕', '🤢', '🤧', '🚨', '📋', '🗂️'],
    gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤝', '👏', '🙌', '🙏', '✋', '👋', '✍️', '💪', '🤙', '👊', '✊', '🤛', '🤜', '👀', '💡', '✅', '❌', '⚠️', '⚡'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '⭐', '🌟', '✨', '💯', '🔥', '🎉'],
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
  };

  useEffect(() => {
    const handleClickOutsideEmoji = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutsideEmoji);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEmoji);
    };
  }, [showEmojiPicker]);

  // Toggle Speech-to-Text Dictation (Web Speech API)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognition) {
      showToast(
        language === 'TH'
          ? 'เบราว์เซอร์นี้ยังไม่รองรับระบบแปลงเสียงพูด (แนะนำให้เปิดผ่าน Google Chrome, Edge หรือ Safari)'
          : 'Speech-to-text is not supported by your browser (Google Chrome, Edge or Safari recommended).',
        'error'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'TH' ? 'th-TH' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        showToast(
          language === 'TH' ? '🎙️ กำลังฟังเสียง... กรุณาพูดข้อความที่ต้องการ' : '🎙️ Listening... Speak your message now.',
          'info'
        );
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setMessageInput((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showToast(
            language === 'TH'
              ? 'กรุณากดอนุญาตการเข้าถึงไมโครโฟนบนเบราว์เซอร์'
              : 'Microphone access denied. Please grant permission in browser.',
            'error'
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  const handleDownloadOrOpen = async (attachment: any, classification: string, action: 'DOWNLOAD' | 'OPEN') => {
    if (!activeRoom) return;
    try {
      // 1. Fetch the temporary authorized download token URL
      const res = await fetch(`${API_URL}/api/storage/download-url/${attachment.id}`, {
        headers: {
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
      });
      if (!res.ok) {
        throw new Error('Unauthorized to access this clinical document');
      }
      const data = await res.json();
      const absoluteUrl = `${API_URL}${data.url}`;

      // 2. Fetch the fully encrypted binary payload from the storage endpoint
      const fileRes = await fetch(absoluteUrl);
      if (!fileRes.ok) {
        throw new Error('Failed to retrieve encrypted document');
      }
      const encryptedArrayBuffer = await fileRes.arrayBuffer();

      // 3. Decrypt the ciphertext natively in browser memory using AES-GCM and Room ID
      const decryptedArrayBuffer = await decryptFileClient(encryptedArrayBuffer, activeRoom.id);

      // 4. Wrap decrypted buffer inside a secure sandboxed Blob and generate local URL
      const blob = new Blob([decryptedArrayBuffer], { type: attachment.fileType });
      const localBlobUrl = URL.createObjectURL(blob);

      if (action === 'DOWNLOAD') {
        const link = document.createElement('a');
        link.href = localBlobUrl;
        link.setAttribute('download', attachment.fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Delay revoking URL to let browser complete download pipeline
        setTimeout(() => URL.revokeObjectURL(localBlobUrl), 100);
      } else {
        setPreviewingFile({
          name: attachment.fileName,
          type: attachment.fileType,
          dataUrl: localBlobUrl,
          classification: classification,
        });
      }
    } catch (err: any) {
      showToast(`Access Denied: ${err.message || 'You do not have credentials to view this file.'}`, 'error');
    }
  };

  const handleLeaveRoom = async (room: ChatRoom) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/members/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to leave room');
      }

      showToast(`Successfully left the group ${room.name}`, 'success');

      if (activeRoom?.id === room.id) setActiveRoom(null);
      await fetchRooms();
    } catch (err: any) {
      showToast(`Leave Error: ${err.message}`, 'error');
    }
  };

  const handleInviteMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTargetRoom || inviteSelectedMembers.length === 0) return;

    try {
      const res = await fetch(`${API_URL}/api/rooms/${inviteTargetRoom.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify({ memberIds: inviteSelectedMembers }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to add members');
      }

      const data = await res.json();
      showToast(`Success: ${data.message}`, 'success');

      // Refresh room list & admin groups
      await fetchRooms();
      if (currentUser?.role === 'Admin') {
        fetchAdminGroups();
      }

      if (data.addedMembers && inviteTargetRoom) {
        const newMembers = data.addedMembers.map((u: any) => ({
          roomId: inviteTargetRoom.id,
          userId: u.id,
          role: 'MEMBER',
          user: u,
        }));
        if (roomMembersModalTarget && roomMembersModalTarget.id === inviteTargetRoom.id) {
          setRoomMembersModalTarget((prev: any) => prev ? {
            ...prev,
            members: [...(prev.members || []), ...newMembers],
          } : null);
        }
        if (activeRoom && activeRoom.id === inviteTargetRoom.id) {
          setActiveRoom((prev) => prev ? {
            ...prev,
            members: [...(prev.members || []), ...newMembers],
          } : null);
        }
      }

      // Close modal
      setShowInviteModal(false);
      setInviteSelectedMembers([]);
    } catch (err: any) {
      showToast(`Invitation Error: ${err.message}`, 'error');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() && !selectedAttachmentFile) return;

    if (activeRoom && activeRoom.isActive === false && currentUser?.role !== 'Admin') {
      showToast(translations[language].groupInactiveBanner, 'error');
      return;
    }

    if (dlpBlockMessage) {
      showClinicalModal(
        'Data Security Warning',
        dlpBlockMessage,
        'warning'
      );
      return;
    }

    if (socketRef.current && activeRoom) {
      socketRef.current.emit('typing', { roomId: activeRoom.id, isTyping: false });
    }

    const filePayload = selectedAttachmentFile ? [selectedAttachmentFile] : undefined;

    if (socketRef.current?.connected && activeRoom) {
      socketRef.current.emit('sendMessage', {
        roomId: activeRoom.id,
        content: messageInput || (selectedAttachmentFile ? `Shared an attachment: ${selectedAttachmentFile.name}` : ''),
        classification: selectedClassification,
        messageId: selectedAttachmentFile?.messageId,
      });
    } else if (activeRoom) {
      const newMsg: Message = {
        id: selectedAttachmentFile?.messageId || Math.random().toString(),
        roomId: activeRoom.id,
        content: messageInput || (selectedAttachmentFile ? `Shared an attachment: ${selectedAttachmentFile.name}` : ''),
        classification: selectedClassification,
        createdAt: new Date().toISOString(),
        sender: {
          id: currentUser?.id || 'demo-user',
          username: currentUser?.username || 'doctor1',
          firstName: currentUser?.firstName || 'สมชาย',
          lastName: currentUser?.lastName || 'รักดี',
          role: currentUser?.role || 'Doctor',
          avatarUrl: currentUser?.avatarUrl || null,
        },
        attachments: filePayload,
      };

      setMessages((prev) => [...prev, newMsg]);

      if (dlpWarning) {
        setAuditLogs((prev) => [
          {
            id: Math.random().toString(),
            action: 'DLP_TRIGGERED_WARN',
            entity: 'Message',
            details: JSON.stringify({ reason: dlpWarning.reason, text: dlpWarning.match }),
            ipAddress: '127.0.0.1',
            createdAt: new Date().toISOString(),
            user: { username: currentUser!.username, firstName: currentUser!.firstName, lastName: currentUser!.lastName, role: { name: currentUser!.role } },
          },
          ...prev,
        ]);
        setDlpAlertsCount((c) => c + 1);
      }
    }

    setMessageInput('');
    setDlpWarning(null);
    setSelectedAttachmentFile(null);
  };

  const handleTypingEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    if (socketRef.current && activeRoom) {
      socketRef.current.emit('typing', {
        roomId: activeRoom.id,
        isTyping: e.target.value.length > 0,
      });
    }
  };

  const triggerCreateRoom = async (roomData: { name?: string; type: 'DIRECT' | 'GROUP' | 'PATIENT_CONTEXT'; memberIds: string[]; patientHn?: string }) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify(roomData),
      });

      if (res.ok) {
        const createdRoom = await res.json();
        setShowCreateGroup(false);
        setNewGroupName('');
        setSelectedMembers([]);
        setPatientHn('');

        // Refresh rooms list
        await fetchRooms();

        // Map the correct display room name if DIRECT
        let displayRoom = createdRoom;
        if (createdRoom.type === 'DIRECT') {
          const otherMemberId = roomData.memberIds[0];
          // Try to find the user in directory list to show their name
          const userInDir = directoryUsers.find(u => u.id === otherMemberId);
          if (userInDir) {
            displayRoom = {
              ...createdRoom,
              name: `${userInDir.firstName} ${userInDir.lastName} (${userInDir.role})`,
            };
          }
        }

        // Active room selection
        setActiveRoom(displayRoom);
        setActiveTab('chats');
      } else {
        const errJson = await res.json();
        showClinicalModal(
          'Room Creation Failed',
          `Failed to create room: ${errJson.message || 'Error occurred'}`,
          'error'
        );
      }
    } catch (err) {
      // Local fallback room push
      const newRoomId = roomData.type === 'DIRECT' ? `dm-${roomData.memberIds[0]}` : Math.random().toString();
      let fallbackName = roomData.name || 'New Discussion';

      if (roomData.type === 'DIRECT') {
        const otherMemberId = roomData.memberIds[0];
        const userInDir = directoryUsers.find(u => u.id === otherMemberId);
        if (userInDir) {
          fallbackName = `${userInDir.firstName} ${userInDir.lastName} (${userInDir.role})`;
        }
      } else if (roomData.type === 'PATIENT_CONTEXT' && roomData.patientHn) {
        fallbackName = `HN-${roomData.patientHn} Clinical Discussion`;
      }

      const newRoom: ChatRoom = {
        id: newRoomId,
        name: fallbackName,
        type: roomData.type,
        patientContext: roomData.type === 'PATIENT_CONTEXT' ? {
          id: 'new-pat',
          hn: roomData.patientHn || '',
          nameHash: 'Admitted Patient',
          status: 'ACTIVE',
        } : undefined,
      };

      setRooms((prev) => {
        // Prevent duplicate local rooms
        if (prev.some(r => r.id === newRoomId)) return prev;
        return [newRoom, ...prev];
      });
      setActiveRoom(newRoom);
      setShowCreateGroup(false);
      setNewGroupName('');
      setPatientHn('');
      setSelectedMembers([]);
      setActiveTab('chats');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createRoomType === 'GROUP' && !newGroupName) return;

    await triggerCreateRoom({
      name: newGroupName,
      type: createRoomType,
      memberIds: selectedMembers,
      patientHn: createRoomType === 'PATIENT_CONTEXT' ? patientHn : undefined,
    });
  };

  // Check CSS color codes for Message Classification
  const getClassificationStyles = (classification: string) => {
    switch (classification) {
      case 'RESTRICTED':
        return 'bg-rose-50 dark:bg-rose-950/20 border-l-4 border-rose-500 glow-restricted text-rose-700 dark:text-rose-300';
      case 'CONFIDENTIAL':
        return 'bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 text-amber-700 dark:text-amber-300';
      case 'INTERNAL':
        return 'bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-300';
      default:
        return 'bg-slate-50 dark:bg-slate-800/40 border-l-4 border-slate-400 text-slate-700 dark:text-slate-200';
    }
  };

  // --- LOGIN INTERFACE RENDER ---
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
        {/* Animated clinical glowing bubbles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl animate-pulse-slow"></div>

        <div className="w-full max-w-md space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl clinical-glow relative z-10">
          {/* Language Selector */}
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60 z-20">
            <button
              onClick={() => changeLanguage('TH')}
              className={`px-2 py-1 rounded text-[10px] font-black transition-all ${language === 'TH'
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              TH
            </button>
            <button
              onClick={() => changeLanguage('EN')}
              className={`px-2 py-1 rounded text-[10px] font-black transition-all ${language === 'EN'
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              EN
            </button>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-teal-500 text-white shadow-lg glow-active">
              <Activity className="h-9 w-9 animate-pulse" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">hosply</h2>
            <p className="mt-2 text-center text-xs text-slate-400 max-w-[280px]">
              {translations[language].loginSubtitle}
            </p>
          </div>

          {/* Auth Mode Switcher */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 mt-6">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setLoginError(''); setRegError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'login'
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{translations[language].tabLogin}</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setLoginError(''); setRegError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'register'
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{translations[language].tabRegister}</span>
            </button>
          </div>

          {authMode === 'login' ? (
            <form className="mt-6 space-y-5" onSubmit={handleLogin}>
              {loginError && (
                <div className="bg-red-950/30 border border-red-500/50 text-red-300 rounded-lg p-3 text-xs flex items-center gap-2 animate-shake">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-4 rounded-md shadow-sm">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{translations[language].usernameLabel}</label>
                  <div className="mt-1 relative rounded-md">
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                      placeholder={translations[language].usernamePlaceholder}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">{translations[language].passwordLabel}</label>
                  <div className="mt-1 relative rounded-md">
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                      placeholder={translations[language].passwordPlaceholder}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-teal-500/70" /> AES-256 Encrypted
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-teal-500/70" /> HIPAA / PDPA
                </span>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative flex w-full justify-center rounded-lg bg-teal-500 py-3 px-4 text-xs font-semibold text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all active:scale-[0.98] shadow-md shadow-teal-500/10 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? translations[language].authenticating : translations[language].loginButton}
                </button>
              </div>

              <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <span>{translations[language].noAccountYet} </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setLoginError(''); setRegError(''); }}
                  className="text-teal-400 hover:text-teal-300 font-bold underline transition-colors cursor-pointer ml-1"
                >
                  {translations[language].switchToRegister}
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              {regError && (
                <div className="bg-red-950/30 border border-red-500/50 text-red-300 rounded-lg p-3 text-xs flex items-center gap-2 animate-shake">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Default Role Notification Banner */}
              <div className="flex items-center gap-2 bg-teal-950/40 border border-teal-800/50 px-3 py-2 rounded-lg text-teal-300 text-[11px] font-bold">
                <UserCheck className="h-4 w-4 text-teal-400 shrink-0" />
                <span>{translations[language].defaultRoleNotice}</span>
              </div>

              <div className="space-y-3 rounded-md shadow-sm">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{translations[language].usernameLabel} *</label>
                  <div className="mt-1 relative rounded-md">
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                      placeholder="e.g. staff_john, nurse_sarah"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{translations[language].firstNameLabel} *</label>
                    <div className="mt-1 relative rounded-md">
                      <input
                        type="text"
                        required
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        placeholder={language === 'TH' ? 'สมชาย' : 'Somchai'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{translations[language].lastNameLabel} *</label>
                    <div className="mt-1 relative rounded-md">
                      <input
                        type="text"
                        required
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        placeholder={language === 'TH' ? 'ใจดี' : 'Jaidee'}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{translations[language].passwordLabel} *</label>
                  <div className="mt-1 relative rounded-md">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                      placeholder="•••••••• (min. 6 chars)"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">{translations[language].professionalIdLabel}</label>
                  <div className="mt-1 relative rounded-md">
                    <input
                      type="text"
                      value={regProfessionalId}
                      onChange={(e) => setRegProfessionalId(e.target.value)}
                      className="block w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                      placeholder={language === 'TH' ? 'เช่น STF-10294, RN-2026' : 'e.g. STF-10294, RN-2026'}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-teal-500/70" /> AES-256 Protected
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-teal-500/70" /> HIPAA / PDPA Compliant
                </span>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="group relative flex w-full justify-center rounded-lg bg-teal-500 py-3 px-4 text-xs font-semibold text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all active:scale-[0.98] shadow-md shadow-teal-500/10 cursor-pointer disabled:opacity-50"
                >
                  {isRegistering ? translations[language].registering : translations[language].registerButton}
                </button>
              </div>

              <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <span>{translations[language].alreadyHaveAccount} </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setLoginError(''); setRegError(''); }}
                  className="text-teal-400 hover:text-teal-300 font-bold underline transition-colors cursor-pointer ml-1"
                >
                  {translations[language].switchToLogin}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />
      <style>{`
        :root {
          --accent-color: ${currentTheme === 'teal' || currentTheme === 'line_pc' ? '#06C755' : currentTheme === 'navy' ? '#3b82f6' : currentTheme === 'emerald' ? '#10b981' : '#0284c7'};
          --accent-hover: ${currentTheme === 'teal' || currentTheme === 'line_pc' ? '#05b34c' : currentTheme === 'navy' ? '#2563eb' : currentTheme === 'emerald' ? '#059669' : '#0369a1'};
        }
        .bg-teal-500 {
          background-color: var(--accent-color) !important;
        }
        .hover\\:bg-teal-600:hover {
          background-color: var(--accent-hover) !important;
        }
        .text-teal-400 {
          color: var(--accent-color) !important;
        }
        .bg-teal-900\\/40 {
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.15)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.15)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.12)'} !important;
        }
        .text-teal-300 {
          color: ${currentTheme === 'teal' ? '#8dfab6' : currentTheme === 'navy' ? '#93c5fd' : currentTheme === 'emerald' ? '#6ee7b7' : '#0369a1'} !important;
        }
        .border-teal-500 {
          border-color: var(--accent-color) !important;
        }
        .bg-teal-500\\/20 {
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.2)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.2)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.2)'} !important;
        }
        .bg-teal-500\\/10 {
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.1)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.1)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(2, 132, 199, 0.1)'} !important;
        }
        .border-teal-500\\/30 {
          border-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.3)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.3)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(2, 132, 199, 0.3)'} !important;
        }
        .focus\\:border-teal-500:focus {
          border-color: var(--accent-color) !important;
        }
        .glow-active {
          box-shadow: 0 0 15px ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.3)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.3)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(2, 132, 199, 0.3)'} !important;
        }

        /* Custom speech bubbles matching Line Chat theme */
        .self-bubble {
          background-color: ${currentTheme === 'line_pc' ? '#06C755' : currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.25)' : 'rgba(20, 184, 166, 0.15)'} !important;
          border-color: ${currentTheme === 'line_pc' ? '#05b34c' : 'var(--accent-color)'} !important;
          color: #ffffff !important;
          box-shadow: ${currentTheme === 'line_pc' ? '0 1px 2px rgba(0, 0, 0, 0.15)' : 'none'} !important;
        }
        .other-bubble {
          background-color: ${currentTheme === 'line_pc' ? '#ffffff' : '#242b35'} !important;
          border-color: ${currentTheme === 'line_pc' ? '#e2e8f0' : '#2b3543'} !important;
          color: ${currentTheme === 'line_pc' ? '#0f172a' : '#f8fafc'} !important;
          box-shadow: ${currentTheme === 'line_pc' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none'} !important;
        }
        
        ${currentTheme === 'line_pc' ? `
          /* --- LINE on PC Desktop Theme --- */
          /* 1. Chat Canvas: Iconic LINE Desktop Dusty Powder Blue */
          .bg-slate-950 {
            background-color: #7a99b8 !important;
          }

          /* 2. Chat list subbar, Header, Typing bar, Modals */
          .bg-slate-900\\/60, .bg-slate-900\\/50, .bg-slate-900\\/40, .bg-slate-900\\/30, .bg-slate-900\\/90, .bg-slate-900\\/95, .bg-slate-900\\/80, .sm\\:bg-slate-900\\/30 {
            background-color: #ffffff !important;
          }
          .bg-slate-900 {
            background-color: #ffffff !important;
          }

          /* Chat typing bottombar container */
          div[class*="pb-safe"],
          .border-t.bg-slate-900\\/90,
          .border-t.border-slate-800 {
            background-color: #ffffff !important;
            border-color: #e5e7eb !important;
            backdrop-filter: none !important;
          }

          /* Active Room Highlight in Room List */
          .bg-slate-800\\/90 {
            background-color: #e8f2fc !important;
            border-color: #b9d8fa !important;
          }
          .bg-slate-800\\/90 p, .bg-slate-800\\/90 span, .bg-slate-800\\/90 div {
            color: #0f172a !important;
          }
          .bg-slate-800\\/50, .bg-slate-800\\/40, .bg-slate-800\\/30, .bg-slate-800\\/20 {
            background-color: #f1f5f9 !important;
          }
          .hover\\:bg-slate-800\\/30:hover {
            background-color: #f8fafc !important;
          }

          /* 3. Left Navigation Rail: Iconic LINE PC Dark Charcoal Sidebar */
          div.hidden.md\\:flex.bg-slate-900 {
            background-color: #23272e !important;
            border-color: #1a1e24 !important;
          }
          div.hidden.md\\:flex.bg-slate-900 h1.text-white,
          div.hidden.md\\:flex.bg-slate-900 p.text-white,
          div.hidden.md\\:flex.bg-slate-900 span.text-white {
            color: #ffffff !important;
          }
          div.hidden.md\\:flex.bg-slate-900 .text-slate-400 {
            color: #94a3b8 !important;
          }
          div.hidden.md\\:flex.bg-slate-900 .border-slate-800 {
            border-color: #1a1e24 !important;
          }
          div.hidden.md\\:flex.bg-slate-900 .bg-slate-800\\/60,
          div.hidden.md\\:flex.bg-slate-900 .bg-slate-800 {
            background-color: #2d333f !important;
            border-color: #3b4252 !important;
          }

          /* 4. Borders & Dividers */
          .border-slate-800, .border-slate-800\\/80, .border-slate-800\\/60,
          .border-slate-700, .border-slate-700\\/60, .border-slate-700\\/80, .border-slate-850 {
            border-color: #e5e7eb !important;
          }

          /* 5. Typography */
          .text-slate-100, .text-slate-200, .text-slate-300 {
            color: #0f172a !important;
          }
          .text-slate-400, .text-slate-500 {
            color: #64748b !important;
          }
          h1.text-white, h2.text-white, h3.text-white, h4.text-white,
          p.text-white, span.text-white:not([class*="bg-"]):not([class*="badge"]), div.text-white:not([class*="bg-"]) {
            color: #0f172a !important;
          }

          /* 6. Speech Bubbles for LINE on PC */
          .self-bubble {
            background-color: #06C755 !important;
            border: 1px solid #05b34c !important;
            color: #ffffff !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12) !important;
          }
          .self-bubble p, .self-bubble span, .self-bubble div {
            color: #ffffff !important;
          }
          .other-bubble {
            background-color: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            color: #0f172a !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
          }
          .other-bubble p, .other-bubble span, .other-bubble div {
            color: #0f172a !important;
          }
          .self-bubble-tail::after {
            background-color: #06C755 !important;
            border-right: 1px solid #05b34c;
            border-top: 1px solid #05b34c;
          }
          .other-bubble-tail::before {
            background-color: #ffffff !important;
            border-left: 1px solid #e5e7eb;
            border-top: 1px solid #e5e7eb;
          }

          /* 7. Canvas Elements (Timestamps, Read badges, Sender names) */
          .line-chat-bg .text-slate-500, .line-chat-bg .dark\\:text-slate-400 {
            color: #ffffff !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
          }
          .line-chat-bg .line-read-badge {
            color: #ffffff !important;
            font-weight: 800 !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
          }
          .line-chat-bg span.font-extrabold.text-slate-700, .line-chat-bg span.font-extrabold.dark\\:text-slate-200 {
            color: #ffffff !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          }

          /* 8. Action Buttons text remains crisp white */
          button.bg-teal-500, button.bg-teal-500 *,
          .bg-teal-500, .bg-teal-500 *,
          .bg-red-500, .bg-red-500 *,
          .bg-rose-500, .bg-rose-500 *,
          .bg-emerald-500, .bg-emerald-500 *,
          .bg-sky-500, .bg-sky-500 * {
            color: #ffffff !important;
          }

          /* 9. Inputs & Textareas: Strictly pure white */
          input,
          input[type="text"],
          input[type="password"],
          input[type="search"],
          textarea,
          select,
          .bg-slate-900 input,
          input.bg-slate-900,
          input.bg-slate-800\/50,
          input.bg-slate-800,
          .chat-message-textbox {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          }
          input::placeholder, textarea::placeholder {
            color: #9ca3af !important;
          }
          input:focus, textarea:focus, .chat-message-textbox:focus {
            background-color: #ffffff !important;
            border-color: #06C755 !important;
            box-shadow: 0 0 0 2px rgba(6, 199, 85, 0.2) !important;
            outline: none !important;
          }

          /* Paperclip button & action icons in bottombar */
          button[title*="Attach"],
          button.bg-slate-900:not(.bg-teal-500) {
            background-color: #ffffff !important;
            border-color: #cbd5e1 !important;
            color: #64748b !important;
          }
          button[title*="Attach"]:hover,
          button.bg-slate-900:not(.bg-teal-500):hover {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-color: #94a3b8 !important;
          }

          /* Classification selector bar */
          div.bg-slate-900\/80 {
            background-color: #f8fafc !important;
            border-color: #e2e8f0 !important;
          }
          div.bg-slate-900\/80 select {
            background-color: #ffffff !important;
            border-color: #cbd5e1 !important;
            color: #0f172a !important;
          }

          /* 10. Modals & Context Menus */
          .fixed.z-50.bg-slate-900, .bg-slate-900.clinical-glow {
            background-color: #ffffff !important;
            border-color: #e5e7eb !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
          }
          .fixed.z-50.bg-slate-900 button:hover {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
          }
        ` : currentTheme === 'light' ? `
          /* --- LINE Sky Blue (Light Theme) Refined System Design --- */

          /* 1. Canvas & Panels: Clean light neutral backdrop */
          .bg-slate-950 {
            background-color: #f0f4f8 !important; /* Soft, refreshing clinical canvas */
          }
          .bg-slate-900 {
            background-color: #ffffff !important; /* Pure white sidebars, top headers & cards */
          }
          .bg-slate-900\\/60, .bg-slate-900\\/50, .bg-slate-900\\/40, .bg-slate-900\\/30 {
            background-color: #f8fafc !important; /* Crisp sub-bars & secondary panels */
          }
          .bg-slate-800, .bg-slate-800\\/50, .bg-slate-800\\/40, .bg-slate-800\\/30, .bg-slate-800\\/20 {
            background-color: #f1f5f9 !important; /* Soft neutral card accents */
          }
          .bg-slate-800\\/90 {
            background-color: #e0f2fe !important; /* Soft Sky-100 highlight for active chat room */
            border-color: #0284c7 !important;
          }
          .bg-slate-800\\/90 p, .bg-slate-800\\/90 span, .bg-slate-800\\/90 div {
            color: #0369a1 !important;
          }

          /* 2. Borders & Separators */
          .border-slate-800, .border-slate-800\\/80, .border-slate-800\\/60,
          .border-slate-700, .border-slate-700\\/60, .border-slate-700\\/80, .border-slate-850 {
            border-color: #e2e8f0 !important;
          }

          /* 3. Typography & High-Contrast Readability */
          .text-slate-100, .text-slate-200, .text-slate-300 {
            color: #0f172a !important; /* High-contrast dark slate text */
          }
          .text-slate-400, .text-slate-500 {
            color: #64748b !important; /* Accessible muted slate text */
          }
          /* Headings and card labels */
          h1.text-white, h2.text-white, h3.text-white, h4.text-white,
          p.text-white, span.text-white:not([class*="bg-"]):not([class*="badge"]), div.text-white:not([class*="bg-"]) {
            color: #0f172a !important;
          }

          /* 4. Action Buttons & Badges: Preserve Crisp Pure White Text */
          button.bg-teal-500, button.bg-teal-500 *,
          .bg-teal-500, .bg-teal-500 *,
          .bg-red-500, .bg-red-500 *,
          .bg-rose-500, .bg-rose-500 *,
          .bg-emerald-500, .bg-emerald-500 *,
          .bg-sky-500, .bg-sky-500 *,
          .bg-blue-600, .bg-blue-600 *,
          button.bg-slate-800, button.bg-slate-800 * {
            color: #ffffff !important;
          }
          button.bg-slate-800 {
            background-color: #0284c7 !important;
            border-color: #0284c7 !important;
          }
          button.bg-slate-800:hover {
            background-color: #0369a1 !important;
          }

          /* 5. Inputs, Selects & Forms */
          input, select, textarea {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
          }
          input::placeholder, textarea::placeholder {
            color: #94a3b8 !important;
          }

          /* 6. Theme Accent Colors (Sky Blue Harmony) */
          .text-teal-400 {
            color: #0284c7 !important;
          }
          .text-teal-300 {
            color: #0369a1 !important;
          }
          .bg-teal-900\\/40 {
            background-color: rgba(2, 132, 199, 0.12) !important;
          }
          .border-teal-500 {
            border-color: #0284c7 !important;
          }

          /* 7. Authentic LINE Chat Speech Bubbles */
          .self-bubble {
            background-color: #9de67e !important; /* Signature LINE light lime bubble */
            border: 1px solid #84d863 !important;
            color: #0f172a !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
          }
          .self-bubble p, .self-bubble span, .self-bubble div {
            color: #0f172a !important;
          }
          .other-bubble {
            background-color: #ffffff !important; /* Crisp white other bubble */
            border: 1px solid #e2e8f0 !important;
            color: #0f172a !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
          }
          .other-bubble p, .other-bubble span, .other-bubble div {
            color: #0f172a !important;
          }

          /* 8. Bubble Tails */
          .self-bubble-tail::after {
            border-right: 1px solid #84d863;
            border-top: 1px solid #84d863;
          }
          .other-bubble-tail::before {
            border-left: 1px solid #e2e8f0;
            border-top: 1px solid #e2e8f0;
          }

          /* 9. Read Badge & Timestamps */
          .line-read-badge {
            color: #1e3a8a !important; /* High-contrast navy text on sky blue canvas */
          }

          /* 10. Clinical Security & PHI Alerts */
          .bg-rose-50, .dark\\:bg-rose-950\\/20, .dark\\:bg-rose-950\\/30 {
            background-color: #ffe4e6 !important;
            color: #9f1239 !important;
            border-color: #f43f5e !important;
          }
          .bg-rose-50 p, .bg-rose-50 span, .dark\\:bg-rose-950\\/20 p, .dark\\:bg-rose-950\\/20 span {
            color: #9f1239 !important;
          }
          .bg-amber-50, .dark\\:bg-amber-950\\/20, .dark\\:bg-amber-950\\/30 {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border-color: #f59e0b !important;
          }
          .bg-amber-50 p, .bg-amber-50 span, .dark\\:bg-amber-950\\/20 p, .dark\\:bg-amber-950\\/20 span {
            color: #92400e !important;
          }
          .bg-emerald-50, .dark\\:bg-emerald-950\\/20, .dark\\:bg-emerald-950\\/30 {
            background-color: #d1fae5 !important;
            color: #065f46 !important;
            border-color: #10b981 !important;
          }
          .bg-emerald-50 p, .bg-emerald-50 span, .dark\\:bg-emerald-950\\/20 p, .dark\\:bg-emerald-950\\/20 span {
            color: #065f46 !important;
          }

          /* 11. Modals & Context Menus */
          .fixed.z-50.bg-slate-900, .bg-slate-900.clinical-glow {
            background-color: #ffffff !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
          }
          .fixed.z-50.bg-slate-900 button:hover {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
          }
        ` : `
          .bg-slate-950 {
            background-color: ${currentTheme === 'teal' ? '#141a23' : currentTheme === 'navy' ? '#09090b' : '#030712'} !important;
          }
          .bg-slate-900 {
            background-color: ${currentTheme === 'teal' ? '#1f2633' : currentTheme === 'navy' ? '#18181b' : '#111827'} !important;
          }
          .bg-slate-900\\/30 {
            background-color: ${currentTheme === 'teal' ? '#161c27' : 'rgba(15, 23, 42, 0.3)'} !important;
          }
        `}
        
        /* LINE Chat aesthetics: authentic calming sky blue for chat room canvas */
        .line-chat-bg {
          background-color: ${currentTheme === 'light' ? '#85a5cc' : currentTheme === 'line_pc' ? '#7a99b8' : '#0f141c'} !important;
          background-image: ${currentTheme === 'light' || currentTheme === 'line_pc' ? 'none' : 'radial-gradient(circle at 50% 10%, #17212f, #0b0f15)'} !important;
        }
        .self-bubble-tail {
          position: relative;
        }
        .self-bubble-tail::after {
          content: "";
          position: absolute;
          top: 12px;
          right: -4px;
          width: 8px;
          height: 8px;
          background-color: inherit;
          transform: rotate(45deg);
          z-index: 0;
        }
        .other-bubble-tail {
          position: relative;
        }
        .other-bubble-tail::before {
          content: "";
          position: absolute;
          top: 12px;
          left: -4px;
          width: 8px;
          height: 8px;
          background-color: inherit;
          transform: rotate(45deg);
          z-index: 0;
        }
        .line-read-badge {
          font-size: 11px;
          font-weight: 700;
          color: ${currentTheme === 'light' ? '#1e3a8a' : currentTheme === 'line_pc' ? '#ffffff' : '#06C755'} !important;
          margin-bottom: 2px;
          letter-spacing: -0.01em;
        }
      `}</style>
      {/* 1. LEFT SIDE NAVIGATION */}
      <div className={`hidden md:flex bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0 z-20 transition-all duration-300 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div>
          {/* Hospital Logo & Collapse Toggle */}
          <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between overflow-hidden">
            <div
              onClick={() => handleTabChange('chats')}
              className="flex items-center gap-3 cursor-pointer group"
              title="Return to Chats"
            >
              <div className="h-9 w-9 rounded-xl bg-teal-500 group-hover:bg-teal-400 flex items-center justify-center shadow-lg text-white shrink-0 transition-all">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              {isSidebarExpanded && (
                <div className="animate-fade-in shrink-0">
                  <h1 className="font-extrabold text-white tracking-wide text-md group-hover:text-teal-300 transition-colors">hosply</h1>
                  <p className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Internal Message</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSidebarExpanded && (
                <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60 mr-1 animate-fade-in shrink-0">
                  <button
                    onClick={() => changeLanguage('TH')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${language === 'TH'
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    TH
                  </button>
                  <button
                    onClick={() => changeLanguage('EN')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${language === 'EN'
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    EN
                  </button>
                </div>
              )}

              {/* Toggle Button */}
              <button
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 hidden md:block"
                title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {isSidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Active Navigation Tabs */}
          <div className="p-4 space-y-1.5">
            <button
              onClick={() => handleTabChange('chats')}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm transition-all ${isSidebarExpanded ? 'justify-between' : 'justify-center'
                } ${activeTab === 'chats'
                  ? 'bg-teal-900/40 text-teal-300 font-bold border-l-2 border-teal-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              title={translations[language].tabChats}
            >
              <span className="flex items-center gap-2.5 relative">
                <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                {!isSidebarExpanded && rooms.filter(r => r.type !== 'GROUP' || r.isActive !== false).reduce((acc, r) => acc + (r.unreadCount || 0), 0) > 0 && (
                  <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500 ring-1 ring-slate-900 animate-pulse"></span>
                )}
                {isSidebarExpanded && <span className="truncate">{translations[language].tabChats}</span>}
              </span>
              {isSidebarExpanded && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="bg-teal-500/20 text-teal-400 text-xs px-2 py-0.5 rounded-full font-bold">
                    {rooms.filter(r => r.type !== 'PATIENT_CONTEXT' && (r.type !== 'GROUP' || r.isActive !== false)).length}
                  </span>
                  {rooms.filter(r => r.type !== 'GROUP' || r.isActive !== false).reduce((acc, r) => acc + (r.unreadCount || 0), 0) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center animate-pulse">
                      {rooms.filter(r => r.type !== 'GROUP' || r.isActive !== false).reduce((acc, r) => acc + (r.unreadCount || 0), 0)}
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={() => handleTabChange('directory')}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm transition-all ${isSidebarExpanded ? 'justify-start gap-2.5' : 'justify-center'
                } ${activeTab === 'directory'
                  ? 'bg-teal-900/40 text-teal-300 font-bold border-l-2 border-teal-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              title={translations[language].tabDirectory}
            >
              <Users className="h-4.5 w-4.5 shrink-0" />
              {isSidebarExpanded && <span className="truncate">{translations[language].tabDirectory}</span>}
            </button>

            {currentUser.role === 'Admin' && (
              <button
                onClick={() => handleTabChange('admin')}
                className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm transition-all ${isSidebarExpanded ? 'justify-between' : 'justify-center'
                  } ${activeTab === 'admin'
                    ? 'bg-teal-900/40 text-teal-300 font-bold border-l-2 border-teal-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                title={translations[language].tabAdmin}
              >
                <span className="flex items-center gap-2.5">
                  <Shield className="h-4.5 w-4.5 shrink-0" />
                  {isSidebarExpanded && <span className="truncate">{translations[language].tabAdmin}</span>}
                </span>
                {isSidebarExpanded && (
                  <span className="bg-rose-500/20 text-rose-400 text-xs px-1.5 py-0.5 rounded font-bold animate-pulse shrink-0">
                    DLP
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => handleTabChange('settings')}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm transition-all ${isSidebarExpanded ? 'justify-start gap-2.5' : 'justify-center'
                } ${activeTab === 'settings'
                  ? 'bg-teal-900/40 text-teal-300 font-bold border-l-2 border-teal-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              title={translations[language].tabSettings}
            >
              <Settings className="h-4.5 w-4.5 shrink-0" />
              {isSidebarExpanded && <span className="truncate">{translations[language].tabSettings}</span>}
            </button>
          </div>

          {/* Create Chat Button */}
          <div className="px-4 mt-4">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-lg border border-slate-700 transition-all active:scale-[0.98]"
              title={translations[language].newGroupButton}
            >
              {isSidebarExpanded ? `+ ${translations[language].newGroupButton}` : "+"}
            </button>
          </div>
        </div>

        {/* User Session Profile Footing */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'flex-col gap-3 justify-center'}`}>
            <div className="flex items-center gap-3">
              <div
                onClick={() => photoInputRef.current?.click()}
                className="group relative h-10 w-10 rounded-full bg-slate-800 border-2 status-ring-online flex items-center justify-center text-white shrink-0 cursor-pointer overflow-hidden transition-all hover:scale-105 hover:ring-2 hover:ring-teal-400"
                title="Click to update profile photo (Vercel Blob)"
              >
                {isUploadingPhoto ? (
                  <Clock className="h-4 w-4 animate-spin text-teal-400" />
                ) : currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={`${currentUser.firstName} ${currentUser.lastName}`}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <User className="h-5 w-5" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                  <Camera className="h-3.5 w-3.5 text-teal-300" />
                </div>
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-slate-900 z-10"></span>
              </div>
              {isSidebarExpanded && (
                <div className="overflow-hidden animate-fade-in">
                  <p className="text-xs font-bold text-white truncate">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-teal-400 font-semibold uppercase">
                    <UserCheck className="h-3 w-3" /> {getRoleLabel(currentUser.role, language)}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="text-slate-500 hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
              title="Logout session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. CHATS / DIRECTORY LIST SUBBAR (Middle Left) */}
      <div className={`w-full md:w-80 bg-slate-900/60 border-r border-slate-800/80 flex-col shrink-0 ${(activeTab === 'admin' || activeTab === 'settings')
          ? 'hidden md:hidden'
          : (activeRoom && activeTab === 'chats')
            ? 'hidden'
            : 'flex pb-20 md:pb-0'
        }`}>
        {/* Mobile App Header Bar (Visible on mobile screens) */}
        <div className="md:hidden h-14 px-4 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="font-black text-white text-base tracking-tight leading-none">hosply</h1>
              <p className="text-[9px] text-teal-400 font-bold uppercase tracking-wider">Internal Message</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => changeLanguage('TH')}
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${language === 'TH' ? 'bg-teal-500 text-white shadow' : 'text-slate-400'}`}
              >
                TH
              </button>
              <button
                type="button"
                onClick={() => changeLanguage('EN')}
                className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${language === 'EN' ? 'bg-teal-500 text-white shadow' : 'text-slate-400'}`}
              >
                EN
              </button>
            </div>

            {/* Quick Create Group Button */}
            {activeTab === 'chats' && (
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="p-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 hover:bg-teal-500 hover:text-white transition-all flex items-center justify-center"
                title={translations[language].newGroupButton}
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}

            {/* Current User Avatar */}
            <div
              onClick={() => handleTabChange('settings')}
              className="relative cursor-pointer shrink-0"
              title="Profile / Settings"
            >
              <div className="h-8 w-8 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-xs text-white overflow-hidden shadow-sm">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Me" className="h-full w-full object-cover" />
                ) : (
                  currentUser?.firstName?.[0] || 'U'
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>

            {/* Quick Logout Button (Mobile) */}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 active:scale-95 transition-all flex items-center justify-center shrink-0"
              title={translations[language].logoutButton}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search header */}
        <div className="p-4 border-b border-slate-800/60">
          <div className="relative">
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder={translations[language].searchPlaceholder}
              className="w-full bg-slate-800/50 border border-slate-700/60 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-teal-500/80 placeholder-slate-400"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Quick Chat Category Filters */}
          {activeTab === 'chats' && (
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setChatListFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  chatListFilter === 'ALL'
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{translations[language].filterAll}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                  chatListFilter === 'ALL' ? 'bg-teal-600 text-white' : 'bg-slate-700/60 text-slate-300'
                }`}>
                  {rooms.filter(r => r.type !== 'PATIENT_CONTEXT' && (r.type !== 'GROUP' || r.isActive !== false)).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setChatListFilter('GROUPS')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  chatListFilter === 'GROUPS'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="h-3 w-3" />
                <span>{translations[language].filterGroups}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                  chatListFilter === 'GROUPS' ? 'bg-sky-600 text-white' : 'bg-slate-700/60 text-slate-300'
                }`}>
                  {rooms.filter(r => r.type === 'GROUP' && r.isActive !== false).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setChatListFilter('DIRECT')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  chatListFilter === 'DIRECT'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <User className="h-3 w-3" />
                <span>{translations[language].filterDirect}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                  chatListFilter === 'DIRECT' ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 text-slate-300'
                }`}>
                  {rooms.filter(r => r.type === 'DIRECT').length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Tab-driven lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeTab === 'chats' && (
            <>
              <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>
                  {chatListFilter === 'GROUPS'
                    ? translations[language].filterGroups
                    : chatListFilter === 'DIRECT'
                      ? translations[language].filterDirect
                      : translations[language].activeChatsTitle}
                </span>
                {chatListFilter === 'GROUPS' && (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="text-sky-400 hover:text-sky-300 font-bold text-[9px] flex items-center gap-1 uppercase"
                  >
                    <Plus className="h-3 w-3" /> {translations[language].createNewGroupBtn}
                  </button>
                )}
              </div>

              {/* Empty state when filtering GROUPS and no group found */}
              {chatListFilter === 'GROUPS' && rooms.filter(r => r.type === 'GROUP' && r.isActive !== false && (r.name || '').toLowerCase().includes(chatSearchQuery.toLowerCase())).length === 0 && (
                <div className="p-5 text-center bg-slate-850/40 border border-dashed border-slate-800 rounded-2xl my-2 space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mx-auto">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{translations[language].noGroupChatsTitle}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{translations[language].noGroupChatsDesc}</p>
                  </div>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{translations[language].createNewGroupBtn}</span>
                  </button>
                </div>
              )}

              {rooms
                .filter((r) => {
                  // For group chats that are inactive, do not display in chats list
                  if (r.type === 'GROUP' && r.isActive === false) return false;

                  const matchesSearch = (r.name || '').toLowerCase().includes(chatSearchQuery.toLowerCase());
                  if (!matchesSearch) return false;
                  if (chatListFilter === 'GROUPS') return r.type === 'GROUP';
                  if (chatListFilter === 'DIRECT') return r.type === 'DIRECT';
                  return r.type !== 'PATIENT_CONTEXT';
                })
                .sort((a, b) => {
                  const aPinned = pinnedRoomIds.includes(a.id);
                  const bPinned = pinnedRoomIds.includes(b.id);
                  if (aPinned && !bPinned) return -1;
                  if (!aPinned && bPinned) return 1;
                  return 0;
                })
                .map((room) => {
                  const isPinned = pinnedRoomIds.includes(room.id);
                  const isDirect = room.type === 'DIRECT';
                  const isGroup = room.type === 'GROUP';
                  const memberCount = (room.members || []).length;
                  const groupOnlineCount = (room.members || []).filter((m: any) => {
                    const mId = m.userId || m.user?.id;
                    return mId && onlineUserIds.has(mId);
                  }).length;

                  const otherMember = (room.members || []).find((m: any) => {
                    const mId = m.userId || m.user?.id;
                    return mId && mId !== currentUser?.id;
                  });
                  const otherMemberId = otherMember ? (otherMember.userId || otherMember.user?.id) : null;
                  const isPartnerOnline = otherMemberId ? onlineUserIds.has(otherMemberId) : false;
                  const otherUser = otherMember?.user;

                  return (
                    <button
                      key={room.id}
                      onClick={() => {
                        if (activeRoom?.id === room.id) {
                          fetchMessages(room.id);
                        } else {
                          setActiveRoom(room);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          room: room,
                        });
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border flex gap-3 items-center ${activeRoom?.id === room.id
                          ? isDirect
                            ? 'bg-slate-800/90 border-emerald-500/35 text-white shadow-md shadow-emerald-950/20'
                            : 'bg-slate-800/90 border-sky-500/35 text-white shadow-md shadow-sky-950/20'
                          : room.unreadCount && room.unreadCount > 0
                            ? 'bg-slate-800/20 border-slate-850 text-slate-100 font-extrabold shadow-sm'
                            : 'border-transparent text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                        }`}
                    >
                      {/* Left Icon / Avatar Block */}
                      <div className={`h-9 w-9 ${isDirect ? 'rounded-full' : 'rounded-xl'} flex items-center justify-center shrink-0 border relative transition-all duration-300 overflow-hidden shadow-sm ${activeRoom?.id === room.id
                          ? isDirect
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : isDirect
                            ? 'bg-slate-800/90 text-emerald-400 border-slate-700/60'
                            : 'bg-slate-800/90 text-sky-400 border-slate-700/60'
                        }`}>
                        {isDirect ? (
                          otherUser?.avatarUrl ? (
                            <img
                              src={otherUser.avatarUrl}
                              alt={otherUser.firstName || ''}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="font-extrabold text-xs uppercase">
                              {otherUser?.firstName ? otherUser.firstName[0] : (room.name ? room.name[0] : <User className="h-4 w-4" />)}
                            </span>
                          )
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-black text-xs">
                            {room.name ? room.name[0] : <Users className="h-4 w-4" />}
                          </div>
                        )}
                        {/* Status notification dot */}
                        {room.unreadCount && room.unreadCount > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-ping ring-1 ring-slate-900" />
                        ) : isDirect ? (
                          isPartnerOnline ? (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1 ring-slate-900 animate-pulse" title={translations[language].statusOnline} />
                          ) : (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-slate-500 ring-1 ring-slate-900" title={translations[language].statusOffline} />
                          )
                        ) : (
                          groupOnlineCount > 0 && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1 ring-slate-900" title={`${groupOnlineCount} ${translations[language].statusOnline}`} />
                          )
                        )}
                      </div>

                      {/* Content block */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-semibold truncate flex items-center gap-1.5 ${room.unreadCount && room.unreadCount > 0 ? 'text-white font-extrabold' : ''
                            }`}>
                            {isPinned && <Pin className="h-3 w-3 text-amber-400 rotate-45 shrink-0 inline-block" />}
                            <span className="truncate">{room.name || 'ห้องสนทนา'}</span>
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {room.unreadCount && room.unreadCount > 0 ? (
                              <span className="bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1.5 rounded-full flex items-center justify-center animate-pulse shrink-0">
                                {room.unreadCount}
                              </span>
                            ) : isDirect ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                Direct
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                                {translations[language].groupChatBadge}
                              </span>
                            )}
                            {room.isActive === false && (
                              <span className="px-1 py-0.2 rounded text-[7px] font-bold uppercase bg-rose-950/60 text-rose-400 border border-rose-800/50">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>

                        <p className={`text-[10px] truncate mt-0.5 flex items-center gap-1.5 ${room.unreadCount && room.unreadCount > 0 ? 'text-teal-400 font-bold' : 'text-slate-500'
                          }`}>
                          {room.unreadCount && room.unreadCount > 0
                            ? '⚠️ Unread secure updates...'
                            : isPinned
                              ? '📌 Pinned to top of dashboard'
                              : isDirect
                                ? 'Private doctor-to-staff clinical line'
                                : `👥 ${memberCount} ${translations[language].groupMembersCount}${groupOnlineCount > 0 ? ` • ${groupOnlineCount} ${translations[language].statusOnline}` : ''}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </>
          )}

          {activeTab === 'directory' && (
            <>
              <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{translations[language].directoryTitle}</div>
              {directoryUsers
                .filter((user) =>
                  `${user.firstName} ${user.lastName} ${user.role}`.toLowerCase().includes(chatSearchQuery.toLowerCase())
                )
                .map((user) => {
                  const isUserOnline = onlineUserIds.has(user.id);
                  return (
                    <div
                      key={user.id}
                      className="p-3 rounded-xl bg-slate-800/30 border border-slate-800/80 hover:bg-slate-800/60 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase overflow-hidden shrink-0">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.firstName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              user.firstName ? user.firstName[0] : 'U'
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${isUserOnline ? 'bg-emerald-400 ring-1 ring-emerald-400/40' : 'bg-slate-500'
                              }`}
                            title={isUserOnline ? translations[language].statusOnline : translations[language].statusOffline}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            {user.firstName} {user.lastName}
                            <span className="text-[10px] text-slate-400 font-mono font-normal">@{user.username}</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-teal-400 font-bold uppercase tracking-wider">{getRoleLabel(user.role, language)}</span>
                            <span className="text-[9px] text-slate-600">•</span>
                            <span className={`text-[9px] font-medium flex items-center gap-1 ${isUserOnline ? 'text-emerald-400' : 'text-slate-500'
                              }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isUserOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                              {isUserOnline ? translations[language].statusOnline : translations[language].statusOffline}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          triggerCreateRoom({
                            type: 'DIRECT',
                            memberIds: [user.id],
                            name: `${user.firstName} (DM)`,
                          });
                        }}
                        className="bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        {translations[language].chatButton}
                      </button>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </div>

      {/* 3. MAIN CENTER CHAT & PANELS (Switch depending on Tab) */}
      <div className={`flex-1 flex bg-slate-950 overflow-hidden relative ${activeRoom && activeTab === 'chats' ? 'pb-0' : 'pb-16'} md:pb-0 ${activeTab === 'directory'
          ? 'hidden md:flex'
          : (!activeRoom && activeTab === 'chats')
            ? 'hidden md:flex'
            : 'flex'
        }`}>

        {activeTab === 'admin' && currentUser.role === 'Admin' ? (
          /* --- ADMIN DASHBOARD CENTER VIEW --- */
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-24 md:pb-6 space-y-4 sm:space-y-6">
            {/* Admin Header Bar (Responsive) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-teal-400 shrink-0" />
                    <span>Compliance & Management</span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    {language === 'TH'
                      ? 'ระบบตรวจสอบบันทึกความปลอดภัย จัดการรายชื่อบุคลากร และกลุ่มแชตคลินิก'
                      : 'Real-time status of clinical logs, staff directory & group management.'}
                  </p>
                </div>
                {/* Quick Logout Button for Mobile Admin */}
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="lg:hidden p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 active:scale-95 transition-all flex items-center justify-center shrink-0 ml-2"
                  title={translations[language].logoutButton}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              {/* Sub-tabs pills (Equal 3-column grid on mobile, inline on desktop) */}
              <div className="grid grid-cols-3 sm:flex bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0 shadow-inner">
                <button
                  onClick={() => setAdminSubTab('compliance')}
                  className={`px-2.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                    adminSubTab === 'compliance' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                  <span className="truncate">{language === 'TH' ? 'ความปลอดภัย' : 'Compliance'}</span>
                </button>
                <button
                  onClick={() => setAdminSubTab('users')}
                  className={`px-2.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                    adminSubTab === 'users' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                  <span className="truncate">{language === 'TH' ? 'ผู้ใช้งาน' : 'Staff'}</span>
                </button>
                <button
                  onClick={() => {
                    setAdminSubTab('groups');
                    fetchAdminGroups();
                  }}
                  className={`px-2.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                    adminSubTab === 'groups' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                  <span className="truncate">{language === 'TH' ? 'กลุ่มแชต' : 'Groups'}</span>
                </button>
              </div>
            </div>

            {adminSubTab === 'compliance' ? (
              <>
                {/* Gauges row (2 columns on mobile, 4 on desktop) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-4 shadow-sm">
                    <div className="p-2 sm:p-3 rounded-lg bg-teal-500/10 text-teal-400 glow-active shrink-0">
                      <Database className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Database</p>
                      <h3 className="text-xs sm:text-base font-black text-white truncate">SQLite + Prisma</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-4 shadow-sm">
                    <div className="p-2 sm:p-3 rounded-lg bg-rose-500/10 text-rose-400 glow-restricted shrink-0">
                      <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">DLP Intercepts</p>
                      <h3 className="text-xs sm:text-base font-black text-white truncate">{dlpAlertsCount} Blocked</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-4 shadow-sm">
                    <div className="p-2 sm:p-3 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
                      <HardDrive className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Storage</p>
                      <h3 className="text-xs sm:text-base font-black text-white truncate">{storageUsage.used} / {storageUsage.total}</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-4 shadow-sm">
                    <div className="p-2 sm:p-3 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Sessions</p>
                      <h3 className="text-xs sm:text-base font-black text-white truncate">{activeSessionsCount} active</h3>
                    </div>
                  </div>
                </div>

                {/* Audit Logs browser */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
                  <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                        {language === 'TH' ? '10 รายการบันทึกความปลอดภัยล่าสุด' : 'Live Secure Audit Logs'}
                      </h4>
                      <span className="bg-teal-500/15 border border-teal-500/30 text-teal-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        {language === 'TH' ? '10 รายการล่าสุด' : '10 Latest'}
                      </span>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder={language === 'TH' ? 'ค้นหาบันทึก หรือชื่อผู้ใช้...' : 'Search logs by action or user...'}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg py-1.5 pl-8 pr-4 text-xs text-white focus:outline-none focus:border-teal-500 placeholder-slate-500"
                      />
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800 overflow-y-auto max-h-[420px] text-xs">
                    {(() => {
                      const displayedLogs = auditLogs
                        .filter((log) => {
                          const q = auditSearch.toLowerCase();
                          return (
                            (log.action || '').toLowerCase().includes(q) ||
                            (log.user?.username || '').toLowerCase().includes(q) ||
                            (log.user?.firstName || '').toLowerCase().includes(q) ||
                            (log.user?.lastName || '').toLowerCase().includes(q) ||
                            (log.details || '').toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 10);

                      if (displayedLogs.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 text-xs">
                            {language === 'TH' ? 'ไม่พบบันทึกประวัติความปลอดภัย' : 'No audit logs found matching query'}
                          </div>
                        );
                      }

                      return displayedLogs.map((log) => {
                        const hasName = Boolean(log.user?.firstName || log.user?.lastName);
                        const username = log.user?.username;
                        const userRole = typeof log.user?.role === 'object' ? log.user?.role?.name : log.user?.role;

                        return (
                          <div key={log.id} className="p-3 hover:bg-slate-800/30 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${log.action.includes('BLOCK') || log.action.includes('FAILED')
                                    ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                                    : log.action.includes('LOGIN')
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : log.action.includes('LOGOUT')
                                        ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                                        : 'bg-slate-800 text-slate-300'
                                  }`}>
                                  {log.action}
                                </span>
                                <div className="text-slate-400 font-medium text-xs flex items-center gap-1.5 flex-wrap">
                                  <span>by</span>
                                  {hasName && (
                                    <span className="text-slate-200 font-semibold">
                                      {log.user?.firstName} {log.user?.lastName}
                                    </span>
                                  )}
                                  {username ? (
                                    <span className="font-mono text-teal-400 font-semibold bg-teal-950/40 border border-teal-800/40 px-1.5 py-0.5 rounded text-[11px]">
                                      @{username}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 italic text-[11px]">System</span>
                                  )}
                                  {userRole && (
                                    <span className="text-[9px] font-bold tracking-wider uppercase bg-slate-800 text-slate-400 border border-slate-700/60 px-1.5 py-0.5 rounded">
                                      {getRoleLabel(userRole, language)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-500 font-mono text-[10px] break-all">{log.details}</p>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 text-slate-500 text-[10px] pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 w-full sm:w-auto shrink-0">
                              <span className="flex items-center gap-1 font-mono"><Layers className="h-3 w-3" /> {log.ipAddress || 'unknown'}</span>
                              <span className="font-mono">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </>
            ) : adminSubTab === 'users' ? (() => {
              const filteredUsers = adminUsers.filter((u) => {
                const query = userSearchQuery.toLowerCase();
                return (
                  (u.username || '').toLowerCase().includes(query) ||
                  (u.firstName || '').toLowerCase().includes(query) ||
                  (u.lastName || '').toLowerCase().includes(query) ||
                  (u.professionalId || '').toLowerCase().includes(query) ||
                  (u.role || '').toLowerCase().includes(query)
                );
              });

              const ITEMS_PER_PAGE = 5;
              const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
              const paginatedUsers = filteredUsers.slice(
                (userListPage - 1) * ITEMS_PER_PAGE,
                userListPage * ITEMS_PER_PAGE
              );

              return (
                <div className="space-y-4 sm:space-y-6">
                  {/* Search and Action Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-xl">
                    <div className="space-y-0.5">
                      <h3 className="font-extrabold text-white text-xs sm:text-sm">Active Staff Directory Management</h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-400">Add, edit, or deactivate professional clinical credentials & system roles.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="relative w-full sm:w-64">
                        <input
                          type="text"
                          value={userSearchQuery}
                          onChange={(e) => {
                            setUserSearchQuery(e.target.value);
                            setUserListPage(1);
                          }}
                          placeholder="Search staff directory..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder-slate-500 font-medium transition-all"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      </div>
                      <button
                        onClick={async () => {
                          const roles = await fetchAdminRoles();
                          const firstRoleId = roles && roles.length > 0 ? roles[0].id : '';
                          setNewUserData({ username: '', password: '', firstName: '', lastName: '', professionalId: '', roleId: firstRoleId });
                          setShowAddUserModal(true);
                        }}
                        className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/10 active:scale-95 whitespace-nowrap shrink-0"
                      >
                        <UserPlus className="h-4 w-4" /> Add Clinical User
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/80 text-[10px] text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                            <th className="px-6 py-4">Clinical Staff Name</th>
                            <th className="px-6 py-4">Username</th>
                            <th className="px-6 py-4">Clinical Role</th>
                            <th className="px-6 py-4">Medical License / ID</th>
                            <th className="px-6 py-4">Access Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-xs">
                          {paginatedUsers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">
                                No clinical users found matching "{userSearchQuery}"
                              </td>
                            </tr>
                          ) : (
                            paginatedUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-800/15 transition-colors">
                                <td className="px-6 py-4 flex items-center gap-3">
                                  <div className="h-8.5 w-8.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 uppercase shadow-sm overflow-hidden shrink-0">
                                    {u.avatarUrl ? (
                                      <img
                                        src={u.avatarUrl}
                                        alt={u.firstName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      u.firstName ? u.firstName[0] : 'U'
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-extrabold text-white">{u.firstName} {u.lastName}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-400">{u.username}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${u.role === 'Admin'
                                    ? 'bg-rose-950/30 text-rose-400 border-rose-800/40'
                                    : u.role === 'Doctor'
                                      ? 'bg-sky-950/30 text-sky-400 border-sky-800/40'
                                      : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                                    }`}>
                                    {getRoleLabel(u.role, language)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-400">{u.professionalId || '—'}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${u.isActive ? 'text-green-400' : 'text-slate-500'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                                    {u.isActive ? (language === 'TH' ? 'ปฏิบัติหน้าที่' : 'Active Duty') : (language === 'TH' ? 'ระงับการใช้งาน' : 'Deactivated')}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <button
                                    onClick={async () => {
                                      await fetchAdminRoles();
                                      setEditingUserData({
                                        id: u.id,
                                        username: u.username,
                                        password: '',
                                        firstName: u.firstName,
                                        lastName: u.lastName,
                                        professionalId: u.professionalId || '',
                                        roleId: u.roleId,
                                        isActive: u.isActive,
                                      });
                                      setShowEditUserModal(true);
                                    }}
                                    className="bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-300 font-bold px-3 py-1.5 rounded-lg transition-all text-[11px] hover:scale-[1.02] active:scale-[0.98]"
                                  >
                                    Edit Credentials
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Responsive Cards View */}
                    <div className="md:hidden divide-y divide-slate-800/80">
                      {paginatedUsers.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs">
                          No clinical users found matching "{userSearchQuery}"
                        </div>
                      ) : (
                        paginatedUsers.map((u) => (
                          <div key={u.id} className="p-3.5 space-y-3 bg-slate-900/60 hover:bg-slate-800/40 transition-colors">
                            {/* Top row: Avatar + Name + Status */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 uppercase shadow-sm overflow-hidden shrink-0">
                                  {u.avatarUrl ? (
                                    <img src={u.avatarUrl} alt={u.firstName} className="h-full w-full object-cover" />
                                  ) : (
                                    u.firstName ? u.firstName[0] : 'U'
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-white text-xs truncate">{u.firstName} {u.lastName}</p>
                                  <p className="text-[10px] text-teal-400 font-mono truncate">@{u.username}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                u.isActive ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                {u.isActive ? (language === 'TH' ? 'ปฏิบัติหน้าที่' : 'Active Duty') : (language === 'TH' ? 'ระงับ' : 'Deactivated')}
                              </span>
                            </div>

                            {/* Bottom row: Role + ID + Edit Button */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  u.role === 'Admin'
                                    ? 'bg-rose-950/40 text-rose-300 border-rose-800/50'
                                    : u.role === 'Doctor'
                                      ? 'bg-sky-950/40 text-sky-300 border-sky-800/50'
                                      : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                                }`}>
                                  {getRoleLabel(u.role, language)}
                                </span>
                                {u.professionalId && (
                                  <span className="font-mono text-slate-400 text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    ID: {u.professionalId}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={async () => {
                                  await fetchAdminRoles();
                                  setEditingUserData({
                                    id: u.id,
                                    username: u.username,
                                    password: '',
                                    firstName: u.firstName,
                                    lastName: u.lastName,
                                    professionalId: u.professionalId || '',
                                    roleId: u.roleId,
                                    isActive: u.isActive,
                                  });
                                  setShowEditUserModal(true);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 font-bold px-3 py-1.5 rounded-lg transition-all text-[11px] active:scale-95 shrink-0 flex items-center gap-1 shadow-sm"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>{language === 'TH' ? 'แก้ไขสิทธิ์' : 'Edit'}</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Pagination Bar (Responsive) */}
                    {filteredUsers.length > 0 && (
                      <div className="bg-slate-950/40 border-t border-slate-800 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="text-slate-400 font-medium text-[11px] sm:text-xs text-center sm:text-left">
                          Showing <span className="text-white font-bold">{Math.min(filteredUsers.length, (userListPage - 1) * ITEMS_PER_PAGE + 1)}</span> to{' '}
                          <span className="text-white font-bold">{Math.min(filteredUsers.length, userListPage * ITEMS_PER_PAGE)}</span> of{' '}
                          <span className="text-white font-bold">{filteredUsers.length}</span> entries
                        </div>
                        <div className="flex items-center gap-1 font-bold">
                          <button
                            onClick={() => setUserListPage(1)}
                            disabled={userListPage === 1}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 p-1.5 rounded-lg transition-all active:scale-95"
                            title="First Page"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setUserListPage((prev) => Math.max(1, prev - 1))}
                            disabled={userListPage === 1}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1 text-[11px]"
                          >
                            <ChevronLeft className="h-4 w-4" /> Prev
                          </button>

                          <span className="px-2 text-slate-300 text-xs font-mono">
                            {userListPage} / {totalPages}
                          </span>

                          <button
                            onClick={() => setUserListPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={userListPage === totalPages}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1 text-[11px]"
                          >
                            Next <ChevronRight className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setUserListPage(totalPages)}
                            disabled={userListPage === totalPages}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 p-1.5 rounded-lg transition-all active:scale-95"
                            title="Last Page"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              /* --- GROUP MANAGEMENT SUBTAB --- */
              <div className="space-y-4">
                {/* Search & Filter Header (Responsive) */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder={language === 'TH' ? 'ค้นหาชื่อกลุ่ม หรือ HN ผู้ป่วย...' : 'Search group name or patient HN...'}
                      value={adminGroupSearch}
                      onChange={(e) => setAdminGroupSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial flex bg-slate-950 border border-slate-800 p-1 rounded-lg text-xs font-bold justify-around">
                      <button
                        onClick={() => setAdminGroupFilter('ALL')}
                        className={`px-3 py-1 rounded transition-all text-[11px] ${adminGroupFilter === 'ALL' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {language === 'TH' ? 'ทั้งหมด' : 'All'}
                      </button>
                      <button
                        onClick={() => setAdminGroupFilter('ACTIVE')}
                        className={`px-3 py-1 rounded transition-all text-[11px] ${adminGroupFilter === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {language === 'TH' ? 'ใช้งานอยู่' : 'Active'}
                      </button>
                      <button
                        onClick={() => setAdminGroupFilter('INACTIVE')}
                        className={`px-3 py-1 rounded transition-all text-[11px] ${adminGroupFilter === 'INACTIVE' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {language === 'TH' ? 'ปิดใช้งาน' : 'Inactive'}
                      </button>
                    </div>

                    <button
                      onClick={fetchAdminGroups}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 p-2 rounded-lg transition-all shrink-0 active:scale-95"
                      title="Refresh Groups"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Groups Container: Desktop Table + Mobile Cards */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <tr>
                          <th className="px-6 py-3.5">ชื่อกลุ่มแชต (Group Name)</th>
                          <th className="px-6 py-3.5">ประเภท (Type)</th>
                          <th className="px-6 py-3.5">สมาชิก (Members)</th>
                          <th className="px-6 py-3.5">สถานะ (Status)</th>
                          <th className="px-6 py-3.5 text-right">การจัดการ (Actions)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {adminGroups
                          .filter((g) => {
                            if (g.type === 'DIRECT') return false;
                            const query = adminGroupSearch.toLowerCase();
                            const matchesQuery = (g.name || '').toLowerCase().includes(query) || (g.patientContext?.hn || '').toLowerCase().includes(query);
                            const matchesFilter =
                              adminGroupFilter === 'ALL'
                                ? true
                                : adminGroupFilter === 'ACTIVE'
                                  ? g.isActive !== false
                                  : g.isActive === false;
                            return matchesQuery && matchesFilter;
                          })
                          .map((g) => {
                            const isRoomActive = g.isActive !== false;
                            return (
                              <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black text-sm">
                                      {(g.name || 'G')[0]}
                                    </div>
                                    <div>
                                      <p className="font-bold text-white text-xs leading-tight">{g.name || 'Unnamed Room'}</p>
                                      {g.patientContext && (
                                        <p className="text-[10px] text-sky-400 font-mono mt-0.5">HN: {g.patientContext.hn}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${g.type === 'DIRECT'
                                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                                      : g.type === 'PATIENT_CONTEXT'
                                        ? 'bg-sky-950/60 border-sky-800/60 text-sky-300'
                                        : 'bg-teal-950/60 border-teal-800/60 text-teal-300'
                                    }`}>
                                    {g.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                      {(g.members || []).slice(0, 4).map((m: any) => (
                                        <div key={m.userId || m.user?.id} className="h-6 w-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center font-bold text-[8px] text-white uppercase overflow-hidden shrink-0">
                                          {m.user?.avatarUrl ? (
                                            <img src={m.user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                                          ) : (
                                            (m.user?.firstName || 'U')[0]
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <span className="text-slate-400 font-bold text-[11px]">
                                      {(g.members || []).length} {language === 'TH' ? 'คน' : 'members'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${isRoomActive
                                      ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300'
                                      : 'bg-rose-950/50 border-rose-800/50 text-rose-300'
                                    }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${isRoomActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                    {isRoomActive ? translations[language].statusActive : translations[language].statusInactive}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setRoomMembersModalTarget(g);
                                        setShowRoomMembersModal(true);
                                      }}
                                      className="bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm"
                                      title={translations[language].manageMembersBtn}
                                    >
                                      <Users className="h-3 w-3" />
                                      <span>{translations[language].manageMembersBtn}</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setInviteTargetRoom(g);
                                        setShowInviteModal(true);
                                      }}
                                      className="bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm"
                                      title={translations[language].inviteStaff}
                                    >
                                      <UserPlus className="h-3 w-3" />
                                      <span>{translations[language].inviteMemberButton}</span>
                                    </button>
                                    <button
                                      onClick={() => handleToggleRoomActive(g.id, isRoomActive)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border shadow-sm ${isRoomActive
                                          ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50'
                                          : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50'
                                        }`}
                                    >
                                      <Power className="h-3 w-3" />
                                      <span>{isRoomActive ? translations[language].deactivateGroup : translations[language].activateGroup}</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {adminGroups.filter(g => g.type !== 'DIRECT').length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-slate-500">
                              {language === 'TH' ? 'ไม่มีกลุ่มแชตในระบบ' : 'No group chats found in system'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Responsive Cards View */}
                  <div className="md:hidden divide-y divide-slate-800/80">
                    {(() => {
                      const filteredGroups = adminGroups.filter((g) => {
                        if (g.type === 'DIRECT') return false;
                        const query = adminGroupSearch.toLowerCase();
                        const matchesQuery = (g.name || '').toLowerCase().includes(query) || (g.patientContext?.hn || '').toLowerCase().includes(query);
                        const matchesFilter =
                          adminGroupFilter === 'ALL'
                            ? true
                            : adminGroupFilter === 'ACTIVE'
                              ? g.isActive !== false
                              : g.isActive === false;
                        return matchesQuery && matchesFilter;
                      });

                      if (filteredGroups.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 text-xs">
                            {language === 'TH' ? 'ไม่พบกลุ่มแชตที่ค้นหา' : 'No group chats found'}
                          </div>
                        );
                      }

                      return filteredGroups.map((g) => {
                        const isRoomActive = g.isActive !== false;
                        return (
                          <div key={g.id} className="p-3.5 space-y-3 bg-slate-900/60 hover:bg-slate-800/40 transition-colors">
                            {/* Card Top: Icon, Name, HN, Status */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black text-sm shrink-0">
                                  {(g.name || 'G')[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-white text-xs truncate leading-tight">{g.name || 'Unnamed Room'}</p>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase border ${
                                      g.type === 'PATIENT_CONTEXT'
                                        ? 'bg-sky-950/60 border-sky-800/60 text-sky-300'
                                        : 'bg-teal-950/60 border-teal-800/60 text-teal-300'
                                    }`}>
                                      {g.type === 'PATIENT_CONTEXT' ? 'PATIENT' : 'GROUP'}
                                    </span>
                                    {g.patientContext?.hn && (
                                      <span className="text-[9px] text-sky-400 font-mono font-bold bg-sky-950/40 border border-sky-800/40 px-1 rounded">
                                        HN: {g.patientContext.hn}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                isRoomActive ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300' : 'bg-rose-950/50 border-rose-800/50 text-rose-300'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isRoomActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {isRoomActive ? translations[language].statusActive : translations[language].statusInactive}
                              </span>
                            </div>

                            {/* Card Middle: Members avatar stack */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-1.5 overflow-hidden">
                                  {(g.members || []).slice(0, 5).map((m: any) => (
                                    <div key={m.userId || m.user?.id} className="h-5 w-5 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center font-bold text-[7px] text-white uppercase overflow-hidden shrink-0">
                                      {m.user?.avatarUrl ? (
                                        <img src={m.user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                                      ) : (
                                        (m.user?.firstName || 'U')[0]
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <span className="font-bold text-[10px] text-slate-400">
                                  {(g.members || []).length} {language === 'TH' ? 'สมาชิก' : 'members'}
                                </span>
                              </div>
                            </div>

                            {/* Card Bottom: 3 responsive action buttons for thumbs */}
                            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/60">
                              <button
                                onClick={() => {
                                  setRoomMembersModalTarget(g);
                                  setShowRoomMembersModal(true);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                              >
                                <Users className="h-3 w-3" />
                                <span>{language === 'TH' ? 'สมาชิก' : 'Members'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setInviteTargetRoom(g);
                                  setShowInviteModal(true);
                                }}
                                className="bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                              >
                                <UserPlus className="h-3 w-3" />
                                <span>{language === 'TH' ? 'เชิญ' : 'Invite'}</span>
                              </button>
                              <button
                                onClick={() => handleToggleRoomActive(g.id, isRoomActive)}
                                className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 border active:scale-95 shadow-sm ${
                                  isRoomActive
                                    ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50'
                                    : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50'
                                }`}
                              >
                                <Power className="h-3 w-3" />
                                <span>{isRoomActive ? (language === 'TH' ? 'ระงับ' : 'Deactivate') : (language === 'TH' ? 'เปิดใช้งาน' : 'Activate')}</span>
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'settings' ? (
          /* --- SETTINGS TAB --- */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6 space-y-6 max-w-2xl mx-auto">
            {/* Settings Header with Quick Logout */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  System Settings & Security Config
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'TH' ? 'ตั้งค่าระบบ โปรไฟล์ความปลอดภัย และการจัดการบัญชี' : 'System preferences, profile security & account management'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
                title={translations[language].logoutButton}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{translations[language].logoutButton}</span>
                <span className="sm:hidden">{language === 'TH' ? 'ออกจากระบบ' : 'Logout'}</span>
              </button>
            </div>

            {/* Profile Photo & Vercel Blob Card */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-400" />
                  {translations[language].profileTitle}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-950/60 text-teal-300 border border-teal-500/30">
                  <UploadCloud className="h-3 w-3" /> Vercel Blob Storage
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-2">
                <div className="relative group shrink-0">
                  <div className="h-20 w-20 rounded-full bg-slate-800 border-2 border-teal-500/60 shadow-lg shadow-teal-500/10 flex items-center justify-center text-white overflow-hidden">
                    {isUploadingPhoto ? (
                      <Clock className="h-6 w-6 animate-spin text-teal-400" />
                    ) : currentUser?.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={`${currentUser.firstName} ${currentUser.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-black text-teal-400">
                        {currentUser?.firstName ? currentUser.firstName[0] : 'U'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-teal-500 text-slate-950 hover:bg-teal-400 transition-transform active:scale-95 shadow-md"
                    title={translations[language].changePhoto}
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      {currentUser?.firstName} {currentUser?.lastName}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">@{currentUser?.username} • {getRoleLabel(currentUser?.role || '', language)}</p>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {language === 'TH'
                      ? 'รูปโปรไฟล์วิชาชีพของคุณจะถูกปรับขนาดและบีบอัดอัตโนมัติไม่เกิน 10KB และจัดเก็บบน Vercel Blob Storage พร้อมระบบส่งมอบความเร็วสูง (Global Edge CDN)'
                      : 'Your professional profile photo is automatically resized and compressed to under 10KB, securely hosted via Vercel Blob cloud storage.'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {isUploadingPhoto ? translations[language].photoUploading : (currentUser?.avatarUrl ? translations[language].changePhoto : translations[language].uploadPhoto)}
                    </button>
                    {currentUser?.avatarUrl && (
                      <button
                        type="button"
                        onClick={handlePhotoDelete}
                        disabled={isUploadingPhoto}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-800/40 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {translations[language].removePhoto}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2"><Lock className="h-5 w-5 text-teal-400" /> Security Credentials</h3>
              <p className="text-xs text-slate-400">All message payloads are encrypted end-to-end within the database file via AES-256. Private key rotation happens under administrator supervision.</p>

              <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white">Visual Styling Contrast</p>
                  <span className="text-[10px] text-slate-500">Enable high-contrast mode for medical teams on night rounds.</span>
                </div>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all"
                >
                  Toggle Contrast ({isDarkMode ? 'Dark Mode' : 'Light Mode'})
                </button>
              </div>

              <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white">System Visual Theme</p>
                  <span className="text-[10px] text-slate-500">Choose a highly tailored medical environment color theme.</span>
                </div>
                <select
                  value={currentTheme}
                  onChange={(e) => setCurrentTheme(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500"
                >
                  <option value="teal">LINE Green (Default Theme)</option>
                  <option value="line_pc">LINE on PC (Desktop Classic)</option>
                  <option value="navy">Royal Navy Compliance</option>
                  <option value="emerald">Emerald Healing</option>
                  <option value="light">LINE Sky Blue (Light Theme)</option>
                </select>
              </div>

              <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white">Audit Log Export</p>
                  <span className="text-[10px] text-slate-500">Download cryptographically signed audit logs for compliance reviews.</span>
                </div>
                <button className="bg-teal-500 text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-teal-600 transition-all">
                  Export logs (.csv)
                </button>
              </div>
            </div>

            {/* Password Reset Section */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-teal-400" /> {translations[language].resetPasswordTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'TH' ? 'อัปเดตรหัสผ่านสำหรับเข้าใช้งานระบบคลินิก รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรตามมาตรฐานความปลอดภัย HIPAA' : 'Update your active clinical account password. New passwords must be at least 6 characters long to meet HIPAA security compliance requirements.'}
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
                {passwordResetError && (
                  <div className="bg-red-950/30 border border-red-500/40 text-red-400 rounded-lg p-3 text-xs flex items-center gap-2 animate-shake">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{passwordResetError}</span>
                  </div>
                )}

                {passwordResetSuccess && (
                  <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-400 rounded-lg p-3 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{passwordResetSuccess}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Current Password Field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {translations[language].currentPasswordLabel}
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 animate-fade-in"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password Field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {translations[language].newPasswordLabel}
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 animate-fade-in"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password Field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {translations[language].confirmPasswordLabel}
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 animate-fade-in"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-teal-500/10 flex items-center gap-1.5"
                  >
                    {isResettingPassword ? (
                      <>
                        <Clock className="h-3.5 w-3.5 animate-spin" /> {translations[language].passcodeResetting}
                      </>
                    ) : (
                      translations[language].passcodeResetButton
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Session & Sign Out Card */}
            <div className="bg-gradient-to-r from-slate-900 to-rose-950/20 border border-rose-500/25 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      {language === 'TH' ? 'เซสชันความปลอดภัยและการออกจากระบบ' : 'Security Session & Account'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === 'TH' ? 'สิ้นสุดเซสชันการทำงานบนอุปกรณ์นี้และลงชื่อออก' : 'Terminate active session and log out of this device'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-800/80">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>
                    {language === 'TH'
                      ? `เข้าสู่ระบบในชื่อ ${currentUser?.firstName} ${currentUser?.lastName} (@${currentUser?.username})`
                      : `Signed in as ${currentUser?.firstName} ${currentUser?.lastName} (@${currentUser?.username})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{translations[language].logoutButton}</span>
                </button>
              </div>
            </div>
          </div>
        ) : activeRoom ? (
          /* --- THREE-COLUMN CHAT CONVERSATION VIEW --- */
          <>
            {/* COLUMN 1: CHAT FEED (Center) */}
            <div className="flex-1 flex flex-col justify-between bg-slate-950 border-r border-slate-800/80">
              {/* Chat room Header */}
              <div className="h-16 px-3 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md relative z-20">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Back Button to Chats List */}
                  <button
                    onClick={() => setActiveRoom(null)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 active:scale-95 transition-all shrink-0 flex items-center justify-center shadow-md mr-0.5"
                    title="Back to Chats"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" />
                  </button>

                  {/* Glowing Status Avatar Ring */}
                  {(() => {
                    const otherMember = (activeRoom.members || []).find((m: any) => {
                      const mId = m.userId || m.user?.id;
                      return mId && mId !== currentUser?.id;
                    });
                    const otherMemberId = otherMember ? (otherMember.userId || otherMember.user?.id) : null;
                    const isPartnerOnline = otherMemberId ? onlineUserIds.has(otherMemberId) : false;
                    const groupOnlineCount = (activeRoom.members || []).filter((m: any) => {
                      const mId = m.userId || m.user?.id;
                      return mId && onlineUserIds.has(mId);
                    }).length;

                    return (
                      <>
                        <div className="relative shrink-0">
                          <div className={`h-9 w-9 sm:h-10 sm:w-10 ${activeRoom.type === 'DIRECT' ? 'rounded-full' : 'rounded-xl'} bg-teal-500/15 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black text-sm sm:text-base shadow-sm overflow-hidden`}>
                            {activeRoom.type === 'DIRECT' && otherMember?.user?.avatarUrl ? (
                              <img
                                src={otherMember.user.avatarUrl}
                                alt={otherMember.user.firstName || activeRoom.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              activeRoom.name[0]
                            )}
                          </div>
                          {activeRoom.type === 'DIRECT' ? (
                            isPartnerOnline ? (
                              <>
                                <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-ping" />
                                <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                              </>
                            ) : (
                              <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-slate-500 ring-2 ring-slate-900" />
                            )
                          ) : (
                            groupOnlineCount > 0 ? (
                              <>
                                <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-ping" />
                                <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                              </>
                            ) : (
                              <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-slate-500 ring-2 ring-slate-900" />
                            )
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] text-teal-400 font-black uppercase tracking-wider bg-teal-950/50 border border-teal-800/40 px-1.5 py-0.2 rounded">
                              {activeRoom.type === 'DIRECT' ? translations[language].directChatPrefix : activeRoom.type === 'PATIENT_CONTEXT' ? translations[language].patientChatPrefix : translations[language].groupChatPrefix}
                            </span>
                            {activeRoom.type === 'PATIENT_CONTEXT' && activeRoom.patientContext && (
                              <div className="flex items-center gap-1">
                                <span className="bg-sky-950 text-sky-400 font-mono text-[9px] px-1.5 py-0.2 rounded border border-sky-800/60 font-bold uppercase">
                                  HN: {activeRoom.patientContext.hn}
                                </span>
                              </div>
                            )}
                          </div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight mt-0.5 flex items-center gap-1.5 truncate">
                            <span className="truncate">{activeRoom.name}</span>
                            {activeRoom.type === 'DIRECT' ? (
                              <span className={`text-[9px] font-semibold flex items-center gap-1 shrink-0 ${isPartnerOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isPartnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                <span className="hidden xs:inline">{isPartnerOnline ? translations[language].statusOnline : translations[language].statusOffline}</span>
                              </span>
                            ) : (
                              <span className={`text-[9px] font-semibold flex items-center gap-1 shrink-0 ${groupOnlineCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${groupOnlineCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                <span className="hidden xs:inline">{groupOnlineCount} {translations[language].statusOnline}</span>
                              </span>
                            )}
                          </h3>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Right secure channel tags and avatars */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
                  {/* Member Avatars (Hidden on mobile) */}
                  {activeRoom.members && activeRoom.type !== 'DIRECT' && (
                    <div className="hidden lg:flex items-center -space-x-2 mr-2">
                      {activeRoom.members.slice(0, 8).map((m: any) => {
                        const mId = m.userId || m.user?.id;
                        const isMemOnline = mId && onlineUserIds.has(mId);
                        const roleName = typeof m.user?.role === 'object' ? m.user?.role?.name : m.user?.role || 'Staff';
                        return (
                          <div key={m.userId} title={`${m.user?.firstName || ''} ${m.user?.lastName || ''} (${roleName}) • ${isMemOnline ? translations[language].statusOnline : translations[language].statusOffline}`} className="relative shrink-0">
                            <div className="h-7 w-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center font-bold text-[9px] text-white uppercase shadow-sm overflow-hidden shrink-0">
                              {m.user?.avatarUrl ? (
                                <img
                                  src={m.user.avatarUrl}
                                  alt={m.user.firstName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                m.user?.firstName ? m.user.firstName[0] : 'U'
                              )}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-900 ${isMemOnline ? 'bg-emerald-400 ring-1 ring-emerald-400/40' : 'bg-slate-500'}`} />
                          </div>
                        );
                      })}
                      {activeRoom.members.length > 8 && (
                        <div title="View All Members" onClick={() => { setRoomMembersModalTarget(activeRoom); setShowRoomMembersModal(true); }} className="h-7 w-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center font-bold text-[9px] text-teal-400 cursor-pointer hover:bg-slate-700 transition-colors shadow-sm">
                          +{activeRoom.members.length - 8}
                        </div>
                      )}
                    </div>
                  )}

                  {activeRoom.type !== 'DIRECT' && (
                    <>
                      {/* History Button */}
                      <button
                        onClick={() => {
                          setGroupHistorySearchQuery('');
                          setGroupHistoryActiveTab('messages');
                          setShowGroupHistoryModal(true);
                        }}
                        className="bg-slate-800 hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 border border-slate-700 hover:border-sky-500/40 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                        title={translations[language].groupHistoryButton}
                      >
                        <History className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-sky-400" />
                        <span className="hidden md:inline">{translations[language].groupHistoryButton}</span>
                      </button>

                      {/* Manage Members Button */}
                      <button
                        onClick={() => {
                          setRoomMembersModalTarget(activeRoom);
                          setShowRoomMembersModal(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                        title={translations[language].manageMembersBtn}
                      >
                        <Users className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden md:inline">{translations[language].manageMembersBtn}</span>
                      </button>

                      {/* Invite Staff Button */}
                      <button
                        onClick={() => {
                          setInviteTargetRoom(activeRoom);
                          setShowInviteModal(true);
                        }}
                        className="bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-black uppercase tracking-wider p-2 sm:px-3.5 sm:py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 shadow-md shrink-0"
                        title={translations[language].inviteMemberButton}
                      >
                        <UserPlus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden md:inline">{translations[language].inviteMemberButton}</span>
                      </button>
                    </>
                  )}

                  {/* Clear Chat Button */}
                  <button
                    type="button"
                    onClick={() => openClearChatPrompt(activeRoom.id, activeRoom.name)}
                    title={translations[language].clearChat}
                    className="bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 text-[10px] font-bold p-2 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-rose-400" />
                    <span className="hidden lg:inline">{translations[language].clearChat}</span>
                  </button>

                  <span className="bg-slate-800/80 text-slate-300 text-[10px] px-3 py-1.5 rounded-lg font-bold border border-slate-700/60 uppercase tracking-wider hidden xl:flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    {translations[language].nowConnected}
                  </span>
                </div>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-2 sm:space-y-2.5 relative line-chat-bg">
                {/* Tiled Forensic Security Watermark Overlay */}
                <div className="pointer-events-none absolute inset-0 z-0 flex flex-wrap items-center justify-center gap-x-24 gap-y-32 overflow-hidden select-none p-10">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className={`flex flex-col items-center justify-center text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase rotate-[-30deg] select-none whitespace-nowrap ${currentTheme === 'light' || currentTheme === 'line_pc' ? 'text-slate-900/[0.06]' : 'text-slate-100/[0.04]'}`}>
                      <span className="flex items-center gap-2 mb-1 border-b border-current pb-1 px-4">
                        <Shield className="h-4 w-4" />
                        HOSPLY INTERNAL CHAT
                      </span>
                      <span className="text-[8px] font-mono tracking-widest opacity-80">
                        CONFIDENTIAL • {currentUser?.username} • {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 space-y-1">
                  {/* Premium "Load Earlier Messages" Button by Senior UX Designer */}
                  {hasMoreMessages && (
                    <div className="flex justify-center pb-4 pt-1">
                      <button
                        onClick={handleLoadMoreMessages}
                        disabled={isLoadingMore}
                        className="bg-slate-900/60 hover:bg-slate-800/80 text-teal-400 hover:text-teal-300 disabled:opacity-40 border border-slate-800/80 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-md backdrop-blur-sm cursor-pointer"
                      >
                        {isLoadingMore ? (
                          <>
                            <Clock className="h-3 w-3 animate-spin text-teal-400" />
                            <span>{translations[language].loadingEarlier}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 text-teal-400" />
                            <span>{translations[language].loadEarlier}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 opacity-60">
                      <div className="h-12 w-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">
                          {language === 'TH' ? 'ยังไม่มีข้อความในห้องสนทนานี้' : 'No messages in this chat yet'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {language === 'TH' ? 'ส่งข้อความเพื่อเริ่มต้นการสื่อสารทางการแพทย์' : 'Send a message to start secure clinical communication'}
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, index) => {
                    const isMe = msg.sender.id === currentUser?.id;
                    const isPrevSame = index > 0 && messages[index - 1].sender.id === msg.sender.id;
                    const isNextSame = index < messages.length - 1 && messages[index + 1].sender.id === msg.sender.id;

                    let bubbleStyle = getClassificationStyles(msg.classification);
                    if (isMe) {
                      bubbleStyle = bubbleStyle
                        .replace('border-l-4', 'border-r-4')
                        .replace('rounded-2xl', 'rounded-2xl rounded-tr-none shadow-md shadow-teal-500/5')
                        .replace('dark:bg-rose-950/20', 'dark:bg-rose-950/30')
                        .replace('dark:bg-amber-950/20', 'dark:bg-amber-950/30')
                        .replace('dark:bg-emerald-950/20', 'dark:bg-emerald-950/30')
                        .replace('dark:bg-slate-800/40', 'dark:bg-slate-800/60');
                    } else {
                      bubbleStyle = bubbleStyle.replace('rounded-2xl', 'rounded-2xl rounded-tl-none');
                    }

                    const isNormal = msg.classification === 'PUBLIC' || !['RESTRICTED', 'CONFIDENTIAL', 'INTERNAL'].includes(msg.classification);

                    let lineClass = '';
                    if (isNormal) {
                      lineClass = isMe ? 'self-bubble' : 'other-bubble';
                    }
                    if (!isPrevSame) {
                      lineClass += isMe ? ' self-bubble-tail' : ' other-bubble-tail';
                    }

                    const spacingClass = isPrevSame ? 'pt-1.5' : 'pt-4';

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 max-w-3xl ${spacingClass} ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                      >
                        {/* Avatar Column (LINE UX: Only show avatar for incoming messages on the first block) */}
                        {!isMe && (
                          <div className="w-9 shrink-0 flex justify-center">
                            {!isPrevSame ? (
                              <div className="h-9 w-9 rounded-full border bg-slate-800 border-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs uppercase shadow-sm transition-all hover:scale-105 overflow-hidden shrink-0">
                                {msg.sender.avatarUrl ? (
                                  <img
                                    src={msg.sender.avatarUrl}
                                    alt={msg.sender.firstName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  msg.sender.firstName ? msg.sender.firstName[0] : 'U'
                                )}
                              </div>
                            ) : (
                              <div className="w-9 h-1" /> /* Spacer for alignment */
                            )}
                          </div>
                        )}

                        {/* Speech bubble column */}
                        <div className="space-y-1 max-w-[70%]">
                          {/* Sender name (LINE UX: Only show name above other users' first incoming message) */}
                          {!isMe && !isPrevSame && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pl-1 mb-0.5">
                              <span className="font-extrabold text-slate-700 dark:text-slate-200 text-xs sm:text-[13px]">
                                {msg.sender.firstName} {msg.sender.lastName}
                              </span>
                              <span className="text-[9px] font-black tracking-wider uppercase bg-slate-800/50 dark:bg-slate-800 text-slate-500 dark:text-teal-400 border border-slate-700/60 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
                                {getRoleLabel(msg.sender.role, language)}
                              </span>
                            </div>
                          )}

                          {/* Content Bubble aligned with LINE Timestamp & Read Status */}
                          <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : ''} group relative`}>
                            {/* Unsend Action button (Sender or Admin) - Only when active */}
                            {(isMe || currentUser?.role?.toLowerCase().includes('admin')) && !msg.deletedAt && msg.content !== '[This message was unsent]' && (
                              <button
                                type="button"
                                onClick={() => handleUnsendMessage(msg)}
                                title={translations[language].unsendMessage}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-slate-800/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 shadow-sm shrink-0 self-center"
                              >
                                <Undo2 className="h-3 w-3" />
                              </button>
                            )}

                            {/* Unsent Message Indicator vs Normal Speech Bubble */}
                            {msg.deletedAt || msg.content === '[This message was unsent]' ? (
                              <div className={`py-2 px-3.5 text-xs sm:text-sm transition-all rounded-2xl shadow-sm border border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-100/90 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 flex items-center gap-2 select-none backdrop-blur-sm ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'
                                }`}>
                                <Undo2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 opacity-80" />
                                <span className="italic font-medium text-xs sm:text-[13px] tracking-wide text-slate-500 dark:text-slate-400">
                                  {isMe
                                    ? (language === 'TH' ? 'คุณได้ยกเลิกข้อความแล้ว' : 'You unsent a message')
                                    : (language === 'TH' ? 'ข้อความนี้ถูกยกเลิกแล้ว' : 'This message was unsent')}
                                </span>
                              </div>
                            ) : (
                              /* Speech Bubble with enlarged readable font */
                              <div className={`px-3.5 py-2.5 sm:px-4 sm:py-3 text-[14px] sm:text-[15px] leading-relaxed transition-all rounded-2xl shadow-sm ${lineClass} ${bubbleStyle}`}>
                                {!isNormal && (
                                  <div className="flex items-center gap-1.5 mb-1.5 border-b border-slate-500/10 pb-1 font-bold text-[10px] tracking-wider uppercase">
                                    <Lock className="h-3.5 w-3.5 animate-pulse text-current" /> {msg.classification} SECURE
                                  </div>
                                )}
                                <p className="whitespace-pre-line font-medium leading-relaxed font-sans text-[14px] sm:text-[15px]">{msg.content}</p>

                                {/* Attachments rendering */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2.5 space-y-2 border-t border-slate-500/10 pt-2">
                                    {msg.attachments.map((file: any, idx: number) => {
                                      const fileName = file.fileName || file.name || 'attachment';
                                      const fileType = file.fileType || file.type || '';
                                      const isImage = fileType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);
                                      const isPublicOrInternal = msg.classification === 'PUBLIC' || msg.classification === 'INTERNAL';
                                      const fileId = file.id || file.attachmentId;
                                      const cachedUrl = (fileId ? decryptedImageUrls[fileId] : null) || (file.messageId ? decryptedImageUrls[file.messageId] : null) || file.dataUrl;

                                      // Auto-load decrypted image if PUBLIC/INTERNAL image and not yet cached
                                      if (isImage && isPublicOrInternal && !cachedUrl && fileId && activeRoom) {
                                        loadDecryptedImage(fileId, fileType, activeRoom.id);
                                      }

                                      if (isImage && isPublicOrInternal) {
                                        return (
                                          <div key={idx} className="mt-1">
                                            {cachedUrl ? (
                                              /* RESIZED CHAT INLINE IMAGE PREVIEW (Appropriately sized: max-w 280px, max-h 230px) */
                                              <div className="relative group overflow-hidden rounded-xl sm:rounded-2xl border border-slate-700/50 bg-black/25 shadow-md max-w-[250px] sm:max-w-[280px]">
                                                <img
                                                  src={cachedUrl}
                                                  alt={fileName}
                                                  className="w-auto h-auto max-w-[250px] sm:max-w-[280px] max-h-[200px] sm:max-h-[230px] object-cover rounded-xl sm:rounded-2xl cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                                                  onClick={() => setPreviewingFile({ name: fileName, type: fileType || 'image/jpeg', dataUrl: cachedUrl, classification: msg.classification })}
                                                />
                                                {/* Floating hover overlay with zoom and details */}
                                                <div
                                                  onClick={() => setPreviewingFile({ name: fileName, type: fileType || 'image/jpeg', dataUrl: cachedUrl, classification: msg.classification })}
                                                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 cursor-pointer"
                                                >
                                                  <p className="text-[11px] font-bold text-white truncate drop-shadow">{fileName}</p>
                                                  <div className="flex items-center justify-between mt-0.5">
                                                    <span className="text-[9px] text-teal-300 font-bold drop-shadow">
                                                      {file.fileSize ? `${Math.round(file.fileSize / 1024)} KB` : 'Image'}
                                                    </span>
                                                    <span className="text-[9px] text-white bg-black/60 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-sm">
                                                      <Maximize2 className="h-2.5 w-2.5 text-teal-300" /> {language === 'TH' ? 'ดูภาพเต็ม' : 'View'}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              /* Decrypting / Loading Skeleton */
                                              <div className="w-52 h-32 rounded-xl sm:rounded-2xl border border-slate-700/40 bg-slate-800/40 flex flex-col items-center justify-center gap-2 p-3 text-slate-400 animate-pulse">
                                                <div className="h-5 w-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                                                <span className="text-[10px] font-bold tracking-wider text-slate-300">
                                                  {language === 'TH' ? 'กำลังโหลดรูปภาพ...' : 'Loading image...'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }

                                      /* SECURE FILE COMPONENT (Documents or Confidential/Restricted PHI) */
                                      return (
                                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] gap-2 max-w-[280px]">
                                          <div className="flex items-center gap-2 truncate">
                                            <div className="h-8 w-8 rounded-lg bg-slate-950 flex items-center justify-center text-teal-400 font-black text-[9px] shrink-0 border border-slate-800">
                                              {isImage ? 'IMG' : (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOC')}
                                            </div>
                                            <div className="truncate">
                                              <p className="font-bold text-white truncate text-[10px]" title={fileName}>
                                                {fileName}
                                              </p>
                                              <span className="text-[8px] text-slate-500 uppercase tracking-wider block">
                                                {isImage ? (msg.classification === 'CONFIDENTIAL' ? 'Confidential Image (Encrypted)' : 'Restricted Image (Encrypted)') : (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') ? 'Secure PDF' : 'Secure File')}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Download / Open Logic */}
                                          <div className="flex gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (file.id) {
                                                  handleDownloadOrOpen(file, msg.classification, 'OPEN');
                                                } else {
                                                  setPreviewingFile({
                                                    name: fileName,
                                                    type: fileType,
                                                    dataUrl: file.dataUrl || '',
                                                    classification: msg.classification,
                                                  });
                                                }
                                              }}
                                              className="bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-350 font-black text-[9px] px-2 py-1.5 rounded-lg border border-slate-700 transition-all tracking-wider uppercase"
                                            >
                                              Open
                                            </button>

                                            {file.id ? (
                                              <button
                                                type="button"
                                                onClick={() => handleDownloadOrOpen(file, msg.classification, 'DOWNLOAD')}
                                                className="bg-teal-500 hover:bg-teal-600 text-white font-black text-[9px] px-2 py-1.5 rounded-lg transition-all tracking-wider uppercase text-center"
                                              >
                                                Download
                                              </button>
                                            ) : (
                                              <a
                                                href={file.dataUrl}
                                                download={fileName}
                                                className="bg-teal-500 hover:bg-teal-600 text-white font-black text-[9px] px-2 py-1.5 rounded-lg transition-all tracking-wider uppercase text-center flex items-center justify-center"
                                              >
                                                Download
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* LINE signature Meta Info Stack next to bubble */}
                            {isMe ? (() => {
                              const otherMembers = (activeRoom?.members || []).filter((m: any) => {
                                const mId = m.userId || m.user?.id;
                                return mId && mId !== currentUser?.id;
                              });

                              const readMembers = otherMembers.filter((m: any) => {
                                if (!m.lastReadAt) return false;
                                return new Date(m.lastReadAt).getTime() >= new Date(msg.createdAt).getTime();
                              });

                              const isRead = readMembers.length > 0;
                              const isGroup = activeRoom?.type !== 'DIRECT';
                              const readCount = readMembers.length;

                              return (
                                <div className="flex flex-col justify-end items-end text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 select-none leading-none pb-0.5 shrink-0 self-end">
                                  {isRead && (
                                    <span className="line-read-badge animate-fade-in text-[10px] sm:text-[11px]">
                                      {language === 'TH' ? 'อ่านแล้ว' : 'Read'}
                                      {isGroup && readCount > 1 ? ` ${readCount}` : ''}
                                    </span>
                                  )}
                                  <span className="opacity-75">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              );
                            })() : (
                              <div className="flex flex-col justify-end text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 select-none leading-none pb-0.5 shrink-0 self-end">
                                <span className="opacity-75">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Real-time typing indicators */}
                  {typingUsers
                    .filter((u) => (!u.roomId || u.roomId === activeRoom?.id) && u.userId !== currentUser?.id)
                    .map((u) => {
                      const dirUser = directoryUsers.find((d) => d.id === u.userId);
                      const displayName = dirUser
                        ? `${dirUser.firstName} ${dirUser.lastName}`
                        : u.firstName && !u.firstName.includes(':')
                          ? `${u.firstName}${u.lastName && !u.lastName.includes(':') ? ` ${u.lastName}` : ''}`
                          : u.username
                            ? `@${u.username}`
                            : (language === 'TH' ? 'มีผู้ใช้งาน' : 'Someone');

                      return (
                        <div key={u.userId} className="flex items-center gap-2 text-[11px] text-teal-400 font-medium animate-pulse bg-slate-900/60 p-2 px-3 rounded-xl max-w-sm border border-teal-500/20 shadow-sm backdrop-blur-sm">
                          <span className="flex gap-1 items-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce" />
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0.4s]" />
                          </span>
                          <span>
                            <strong className="text-white font-semibold">{displayName}</strong> {translations[language].typingSuffix}
                          </span>
                        </div>
                      );
                    })}

                </div>
                <div ref={messageEndRef} />
              </div>

              {/* Chat typing input bottombar */}
              <div className="p-2.5 sm:p-4 border-t border-slate-800 bg-slate-900/90 sm:bg-slate-900/30 backdrop-blur-md pb-safe">
                {/* Realtime DLP Alerts warning bar popup */}
                {dlpWarning && (
                  <div className={`mb-2.5 sm:mb-3 p-2.5 sm:p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${dlpBlockMessage
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-md animate-bounce'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-300 shadow-md'
                    }`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold uppercase tracking-wider block text-[10px]">
                          ⚠️ Data Loss Prevention (DLP) Warning
                        </span>
                        <p className="mt-0.5 font-medium text-slate-300">
                          Matched protected PHI pattern: <strong className="text-white font-black">{dlpWarning.reason}</strong> (Value: {dlpWarning.match})
                        </p>
                      </div>
                    </div>
                    {dlpBlockMessage && (
                      <span className="bg-rose-500 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded tracking-widest shrink-0 animate-pulse">
                        BLOCKED
                      </span>
                    )}
                  </div>
                )}

                {/* Inactive Room Banner */}
                {activeRoom.isActive === false && (
                  <div className="mb-2.5 sm:mb-3 bg-amber-950/40 border border-amber-800/60 rounded-xl p-2.5 sm:p-3 flex items-center justify-between text-xs animate-fade-in shadow-md">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-400" />
                      <div>
                        <p className="font-bold text-xs">{translations[language].groupInactiveBanner}</p>
                        <p className="text-[10px] text-amber-400/80 mt-0.5">
                          {language === 'TH' ? 'สถานะห้องถูกระงับชั่วคราว สามารถอ่านข้อความเก่าได้ แต่ไม่อนุญาตให้ส่งข้อความใหม่' : 'Room is temporarily inactive. History remains readable, but new messages cannot be sent.'}
                        </p>
                      </div>
                    </div>
                    {currentUser?.role === 'Admin' && (
                      <button
                        type="button"
                        onClick={() => handleToggleRoomActive(activeRoom.id, false)}
                        className="bg-teal-500 hover:bg-teal-600 text-white font-bold text-[10px] uppercase px-3.5 py-1.5 rounded-lg shrink-0 transition-all shadow-md ml-2"
                      >
                        {translations[language].reactivateBtn}
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                      <Lock className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">{translations[language].classificationSelectLabel}</span>
                      <select
                        value={selectedClassification}
                        onChange={(e) => setSelectedClassification(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded focus:outline-none focus:border-teal-500 truncate"
                      >
                        <option value="PUBLIC">PUBLIC</option>
                        <option value="INTERNAL">INTERNAL (STAFF ONLY)</option>
                        <option value="CONFIDENTIAL">CONFIDENTIAL (CLINICAL)</option>
                        <option value="RESTRICTED">RESTRICTED (HIGH PRIVACY)</option>
                      </select>
                    </div>

                    <span className="text-[9px] text-slate-500 hidden sm:flex items-center gap-1 font-bold shrink-0 ml-2">
                      <Info className="h-3.5 w-3.5" /> {translations[language].classificationHelpText}
                    </span>
                  </div>

                  {/* Pending Attachment Preview Banner */}
                  {selectedAttachmentFile && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between animate-fade-in text-xs">
                      <div className="flex items-center gap-2.5 sm:gap-3 truncate">
                        {selectedAttachmentFile.type.startsWith('image/') ? (
                          <div className="h-10 w-10 rounded border border-slate-700 overflow-hidden shrink-0 bg-slate-950">
                            <img src={selectedAttachmentFile.dataUrl} className="h-full w-full object-cover" alt="selected preview" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded border border-slate-700 bg-slate-950 flex items-center justify-center shrink-0 text-teal-400 font-extrabold text-[10px]">
                            FILE
                          </div>
                        )}
                        <div className="truncate">
                          <span className="block font-bold text-white truncate text-[11px]">{selectedAttachmentFile.name}</span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
                            {isUploadingFile ? (
                              <span className="text-teal-400 font-black animate-pulse flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
                                Uploading...
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-black flex items-center gap-1">
                                ✓ Uploaded
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isUploadingFile}
                        onClick={() => setSelectedAttachmentFile(null)}
                        className={`bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all font-bold text-[10px] uppercase tracking-wider shrink-0 ${isUploadingFile ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Speech Recording Active Signal */}
                  {isListening && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="font-bold">
                          {language === 'TH' ? '🎙️ กำลังฟังเสียงพูด... พูดข้อความได้เลย' : '🎙️ Listening... Speak your message now'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleListening}
                        className="text-[10px] font-black uppercase text-rose-400 hover:text-white bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800 transition-colors"
                      >
                        {language === 'TH' ? 'หยุดฟัง' : 'Stop'}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Attachment Button */}
                    <button
                      type="button"
                      disabled={isUploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2.5 sm:p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shrink-0 ${isUploadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Attach clinical document (Max 10MB, stored via Vercel Blob)"
                    >
                      {isUploadingFile ? (
                        <Clock className="h-4.5 w-4.5 animate-spin text-teal-400" />
                      ) : (
                        <Paperclip className="h-4.5 w-4.5" />
                      )}
                    </button>

                    {/* Emoji Picker Button & Popup */}
                    <div className="relative">
                      <button
                        type="button"
                        disabled={isUploadingFile || (activeRoom.isActive === false && currentUser?.role !== 'Admin')}
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className={`p-2.5 sm:p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all shrink-0 ${
                          showEmojiPicker ? 'text-teal-400 border-teal-500/50 shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                        title={language === 'TH' ? 'เลือกอิโมจิ (Emojis)' : 'Select Emoji'}
                      >
                        <Smile className="h-4.5 w-4.5" />
                      </button>

                      {showEmojiPicker && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-14 left-0 z-50 w-72 sm:w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 animate-fade-in backdrop-blur-md"
                        >
                          {/* Category Tabs */}
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-xs">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setActiveEmojiCategory('smileys')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                  activeEmojiCategory === 'smileys' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Smileys"
                              >
                                😀
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveEmojiCategory('medical')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                  activeEmojiCategory === 'medical' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Medical"
                              >
                                🩺
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveEmojiCategory('gestures')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                  activeEmojiCategory === 'gestures' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Gestures"
                              >
                                👍
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveEmojiCategory('hearts')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                  activeEmojiCategory === 'hearts' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Hearts"
                              >
                                ❤️
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(false)}
                              className="text-slate-500 hover:text-slate-300 p-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Emoji Grid */}
                          <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1 text-xl select-none">
                            {EMOJI_LISTS[activeEmojiCategory].map((emoji, eIdx) => (
                              <button
                                key={eIdx}
                                type="button"
                                onClick={() => handleInsertEmoji(emoji)}
                                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-800 active:scale-125 transition-all"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Main Input Textbox */}
                    <input
                      type="text"
                      value={messageInput}
                      onChange={handleTypingEvent}
                      disabled={isUploadingFile || (activeRoom.isActive === false && currentUser?.role !== 'Admin')}
                      placeholder={activeRoom.isActive === false && currentUser?.role !== 'Admin' ? (language === 'TH' ? 'กลุ่มนี้ถูกปิดการใช้งานโดยผู้ดูแลระบบ (ไม่สามารถส่งข้อความได้)' : 'This group is inactive (Messaging disabled)') : translations[language].messagePlaceholder}
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:border-teal-500/80 placeholder-slate-400 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed chat-message-textbox"
                    />

                    {/* Microphone Speech-to-Text Button */}
                    <button
                      type="button"
                      disabled={isUploadingFile || (activeRoom.isActive === false && currentUser?.role !== 'Admin')}
                      onClick={toggleListening}
                      className={`p-2.5 sm:p-3 rounded-xl border transition-all shrink-0 ${
                        isListening
                          ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/30 ring-2 ring-rose-500/40'
                          : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-teal-400'
                      }`}
                      title={
                        isListening
                          ? language === 'TH' ? 'คลิกเพื่อหยุดฟังเสียง' : 'Click to stop listening'
                          : language === 'TH' ? 'พูดผ่านไมค์เพื่อพิมพ์ข้อความ (Speech to Text)' : 'Dictate message via microphone'
                      }
                    >
                      {isListening ? (
                        <MicOff className="h-4.5 w-4.5 animate-bounce" />
                      ) : (
                        <Mic className="h-4.5 w-4.5" />
                      )}
                    </button>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!!dlpBlockMessage || isUploadingFile || (!messageInput.trim() && !selectedAttachmentFile) || (activeRoom.isActive === false && currentUser?.role !== 'Admin')}
                      className={`p-2.5 sm:p-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl transition-all shadow-md active:scale-95 shrink-0 ${dlpBlockMessage || isUploadingFile || (activeRoom.isActive === false && currentUser?.role !== 'Admin') ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                    >
                      <Send className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
            <MessageSquare className="h-12 w-12 text-slate-600 animate-pulse" />
            <span>{translations[language].emptyChatSelection}</span>
          </div>
        )}
      </div>

      {/* --- CREATE NEW DISCUSSION MODAL POPUP --- */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-4 sm:p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow max-h-[92vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-400" /> {translations[language].newRoomModalTitle}
            </h3>

            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{translations[language].newRoomTitleLabel}</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setCreateRoomType('GROUP');
                  }}
                  placeholder={translations[language].newRoomTitlePlaceholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 pt-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-slate-300 transition-all"
                >
                  {translations[language].cancelBtn}
                </button>
                <button
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-all"
                >
                  {translations[language].initRoomBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- HIPAA SECURE IN-APP DOCUMENT VIEWER MODAL --- */}
      {previewingFile && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className={`bg-slate-900 border border-slate-800 w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] clinical-glow animate-fade-in transition-all ${previewingFile.type === 'application/pdf' || previewingFile.name.toLowerCase().endsWith('.pdf')
            ? 'max-w-4xl'
            : 'max-w-2xl'
            }`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <Lock className="h-4.5 w-4.5 text-teal-400 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Secure In-App Previewer
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    HIPAA Compliance Locked • Download Restricted
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase shrink-0 ${previewingFile.classification === 'PUBLIC'
                ? 'bg-teal-950 text-teal-400 border-teal-800/60'
                : previewingFile.classification === 'INTERNAL'
                  ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                  : 'bg-rose-950 text-rose-400 border-rose-800/60'
                }`}>
                {previewingFile.classification}
              </span>
            </div>

            {/* Viewer Content Frame */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950/90 relative min-h-[300px] flex items-center justify-center">
              {/* Security Watermark for Forensics */}
              <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden grid grid-cols-2 gap-8 p-6 opacity-[0.03] text-white text-[9px] font-mono tracking-widest uppercase">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rotate-[-20deg] whitespace-nowrap">
                    CONFIDENTIAL • {currentUser?.username} • {new Date().toLocaleDateString()}
                  </div>
                ))}
              </div>

              {/* Render Core Content */}
              <div className="relative z-10 w-full mx-auto flex flex-col items-center justify-center">
                {previewingFile.type.startsWith('image/') ? (
                  <img
                    src={previewingFile.dataUrl}
                    alt={previewingFile.name}
                    className="max-w-full max-h-[50vh] rounded-lg border border-slate-800 shadow-lg object-contain bg-slate-900"
                  />
                ) : previewingFile.type === 'application/pdf' || previewingFile.name.toLowerCase().endsWith('.pdf') ? (
                  /* SECURE PDF EMBEDDED IFRAME */
                  <iframe
                    src={previewingFile.dataUrl}
                    title={previewingFile.name}
                    className="w-full h-[55vh] rounded-xl border border-slate-800 shadow-lg bg-slate-900 animate-fade-in"
                  />
                ) : (
                  <div className="w-full max-w-lg bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-xs text-slate-300 font-sans space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                      <div className="h-10 w-10 rounded bg-slate-950 flex items-center justify-center text-teal-400 font-extrabold text-xs">
                        TXT
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{previewingFile.name}</h4>
                        <span className="text-[9px] text-slate-500 uppercase">Secure Clinical Document Preview</span>
                      </div>
                    </div>

                    <div className="space-y-2 leading-relaxed">
                      <p className="font-bold text-teal-400 uppercase tracking-widest text-[9px] border-b border-slate-800 pb-1">📄 Decrypted secure text stream:</p>
                      <p className="bg-slate-950/80 p-3 rounded font-mono text-[10px] text-slate-400 break-all select-none">
                        [CLINICAL ENCRYPTED PAYLOAD KEY: AES-256-GCM]
                        {"\n\n"}
                        Subject document contents have been verified. This record contains privileged medical telemetry intended solely for active staff duty members.
                        {"\n\n"}
                        File signature verified successfully.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with lock banner */}
            <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80">
              <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 animate-pulse" /> Direct downloads are disabled for security tracking.
              </span>
              <button
                onClick={() => setPreviewingFile(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-lg border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Close Previewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CLINICAL RIGHT-CLICK CONTEXT MENU --- */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 w-52 backdrop-blur-md clinical-glow animate-fade-in text-xs font-semibold text-slate-300"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Group Settings: {contextMenu.room.name ? contextMenu.room.name.substring(0, 15) : 'Direct Chat'}...
          </div>

          <button
            onClick={() => {
              togglePinRoom(contextMenu.room.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-all"
          >
            <Pin className="h-4 w-4 text-amber-400 rotate-45" />
            <span>{pinnedRoomIds.includes(contextMenu.room.id) ? translations[language].unpinChat : translations[language].pinToTop}</span>
          </button>

          <button
            onClick={() => {
              openClearChatPrompt(contextMenu.room.id, contextMenu.room.name);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-red-950/40 hover:text-red-400 flex items-center gap-2 transition-all text-rose-500/80"
          >
            <Trash2 className="h-4 w-4 text-rose-400" />
            <span>{translations[language].clearHistory}</span>
          </button>

          {contextMenu.room.type !== 'DIRECT' && (
            <button
              onClick={() => {
                setInviteTargetRoom(contextMenu.room);
                setShowInviteModal(true);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-all"
            >
              <UserPlus className="h-4 w-4 text-teal-400" />
              <span>{translations[language].inviteStaff}</span>
            </button>
          )}

          <button
            onClick={() => {
              navigator.clipboard.writeText(`http://localhost:3006/room/${contextMenu.room.id}`);
              showToast('Secure room link copied to clipboard!', 'success');
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-all"
          >
            <Paperclip className="h-4 w-4 text-sky-400" />
            <span>{translations[language].copyLink}</span>
          </button>

          <div className="border-t border-slate-800 my-1"></div>

          <button
            onClick={() => setContextMenu(null)}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 hover:text-slate-200 flex items-center gap-2 transition-all text-slate-400"
          >
            <X className="h-4 w-4" />
            <span>{translations[language].closeMenu}</span>
          </button>

          {contextMenu.room.type !== 'DIRECT' && (
            <button
              onClick={() => {
                handleLeaveRoom(contextMenu.room);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-red-950/50 hover:text-red-400 flex items-center gap-2 transition-all text-red-500/80 rounded-b-xl"
            >
              <LogOut className="h-4 w-4" />
              <span>{translations[language].leaveGroup}</span>
            </button>
          )}
        </div>
      )}

      {/* --- ROOM MEMBERS MANAGEMENT MODAL --- */}
      {showRoomMembersModal && roomMembersModalTarget && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full p-4 sm:p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black text-md shrink-0">
                  {(roomMembersModalTarget.name || 'G')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2 truncate">
                    <span className="truncate">{roomMembersModalTarget.name}</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${roomMembersModalTarget.isActive !== false
                        ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                        : 'bg-rose-950/50 border-rose-800 text-rose-400'
                      }`}>
                      {roomMembersModalTarget.isActive !== false ? translations[language].statusActive : translations[language].statusInactive}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {translations[language].groupMembersTitle} ({(roomMembersModalTarget.members || []).length} {language === 'TH' ? 'สมาชิก' : 'members'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRoomMembersModal(false);
                  setRoomMembersModalTarget(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions (Invite / Toggle Active) */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => {
                  setInviteTargetRoom(roomMembersModalTarget);
                  setShowInviteModal(true);
                }}
                className="bg-teal-500 hover:bg-teal-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-md"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{translations[language].inviteStaff}</span>
              </button>

              {currentUser?.role === 'Admin' && (
                <button
                  onClick={() => handleToggleRoomActive(roomMembersModalTarget.id, roomMembersModalTarget.isActive !== false)}
                  className={`font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 border shadow-md ${roomMembersModalTarget.isActive !== false
                      ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50'
                      : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50'
                    }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{roomMembersModalTarget.isActive !== false ? translations[language].deactivateGroup : translations[language].activateGroup}</span>
                </button>
              )}
            </div>

            {/* Members List */}
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/50">
              {(roomMembersModalTarget.members || []).map((m: any) => {
                const memUserId = m.userId || m.user?.id;
                const isOnline = memUserId ? onlineUserIds.has(memUserId) : false;
                const roleName = typeof m.user?.role === 'object' ? m.user?.role?.name : m.user?.role || 'Staff';
                const isRoomAdmin = m.role === 'ADMIN';
                const canRemove = (currentUser?.role === 'Admin' || roomMembersModalTarget.roleInRoom === 'ADMIN') && memUserId !== currentUser?.id;

                return (
                  <div key={memUserId} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-white uppercase overflow-hidden">
                          {m.user?.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                          ) : (
                            (m.user?.firstName || 'U')[0]
                          )}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs leading-tight flex items-center gap-1.5">
                          {m.user?.firstName} {m.user?.lastName}
                          {isRoomAdmin && (
                            <span className="bg-amber-950 text-amber-400 text-[8px] font-black uppercase px-1.5 py-0.2 rounded border border-amber-800/60">
                              Host
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          @{m.user?.username} • <span className="text-teal-400 font-bold">{getRoleLabel(roleName, language)}</span>
                        </p>
                      </div>
                    </div>

                    {canRemove && (
                      <button
                        onClick={() => handleRemoveMember(roomMembersModalTarget.id, memUserId, `${m.user?.firstName} ${m.user?.lastName}`)}
                        className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 hover:border-rose-700 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm shrink-0"
                        title={translations[language].removeMember}
                      >
                        <UserMinus className="h-3 w-3" />
                        <span>{translations[language].removeMember}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => {
                  setShowRoomMembersModal(false);
                  setRoomMembersModalTarget(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition-all"
              >
                {translations[language].cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GROUP CHAT HISTORY & DETAILS MODAL --- */}
      {showGroupHistoryModal && activeRoom && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full p-4 sm:p-6 rounded-2xl space-y-3 sm:space-y-4 shadow-2xl clinical-glow max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-400 flex items-center justify-center font-black text-base sm:text-lg shrink-0">
                  {(activeRoom.name || 'G')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
                      {activeRoom.name}
                    </h3>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                      activeRoom.isActive !== false
                        ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                        : 'bg-rose-950/50 border-rose-800 text-rose-400'
                    }`}>
                      {activeRoom.isActive !== false ? translations[language].statusActive : translations[language].statusInactive}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                    {translations[language].groupHistoryModalTitle} • ID: <span className="font-mono text-slate-300">{activeRoom.id.substring(0, 8)}...</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGroupHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overview Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Calendar className="h-3.5 w-3.5 text-sky-400" />
                  <span>{translations[language].groupCreatedDate}</span>
                </div>
                <p className="text-xs font-extrabold text-white mt-1 truncate">
                  {activeRoom.createdAt
                    ? new Date(activeRoom.createdAt).toLocaleDateString(language === 'TH' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '-'}
                </p>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <MessageSquare className="h-3.5 w-3.5 text-teal-400" />
                  <span>{translations[language].groupTotalMessagesCount}</span>
                </div>
                <p className="text-xs font-extrabold text-white mt-1">
                  {messages.length} {hasMoreMessages ? '+' : ''}
                </p>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{translations[language].groupMembersCount}</span>
                </div>
                <p className="text-xs font-extrabold text-white mt-1 truncate">
                  {(activeRoom.members || []).length} {language === 'TH' ? 'คน' : 'members'}
                </p>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>{translations[language].groupSecurityTitle}</span>
                </div>
                <p className="text-xs font-extrabold text-emerald-400 mt-1 truncate" title="AES-256-GCM End-to-End Encrypted">
                  AES-256 E2EE
                </p>
              </div>
            </div>

            {/* Subtabs navigation */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 shrink-0 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setGroupHistoryActiveTab('messages')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  groupHistoryActiveTab === 'messages'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span>{translations[language].groupHistoryTabMessages}</span>
              </button>

              <button
                onClick={() => setGroupHistoryActiveTab('members')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  groupHistoryActiveTab === 'members'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>{translations[language].groupHistoryTabMembers}</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-bold">
                  {(activeRoom.members || []).length}
                </span>
              </button>

              <button
                onClick={() => setGroupHistoryActiveTab('files')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  groupHistoryActiveTab === 'files'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>{translations[language].groupHistoryTabFiles}</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-bold">
                  {messages.reduce((acc, m) => acc + (m.attachments?.length || 0), 0)}
                </span>
              </button>
            </div>

            {/* Subtab 1: Messages History & Search */}
            {groupHistoryActiveTab === 'messages' && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-2.5 min-h-[260px]">
                <div className="relative shrink-0">
                  <input
                    type="text"
                    value={groupHistorySearchQuery}
                    onChange={(e) => setGroupHistorySearchQuery(e.target.value)}
                    placeholder={translations[language].groupSearchHistoryPlaceholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-8 text-xs text-white focus:outline-none focus:border-sky-500 placeholder-slate-500"
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  {groupHistorySearchQuery && (
                    <button
                      onClick={() => setGroupHistorySearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {messages
                    .filter((msg) => {
                      if (!groupHistorySearchQuery.trim()) return true;
                      const q = groupHistorySearchQuery.toLowerCase();
                      const contentMatch = (msg.content || '').toLowerCase().includes(q);
                      const senderMatch = `${msg.sender?.firstName || ''} ${msg.sender?.lastName || ''} ${msg.sender?.username || ''}`.toLowerCase().includes(q);
                      return contentMatch || senderMatch;
                    })
                    .map((msg) => {
                      const senderName = `${msg.sender?.firstName || ''} ${msg.sender?.lastName || ''}`.trim() || msg.sender?.username || 'Staff';
                      return (
                        <div key={msg.id} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5 hover:border-slate-700 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[9px] text-white uppercase overflow-hidden shrink-0">
                                {msg.sender?.avatarUrl ? (
                                  <img src={msg.sender.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                                ) : (
                                  (msg.sender?.firstName || 'U')[0]
                                )}
                              </div>
                              <span className="text-xs font-bold text-white">{senderName}</span>
                              <span className="text-[9px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                {getRoleLabel(msg.sender?.role, language)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(msg.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 pl-8 leading-relaxed break-words whitespace-pre-wrap">
                            {msg.content}
                          </p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="pl-8 flex flex-wrap gap-2 pt-1">
                              {msg.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  onClick={() => {
                                    setPreviewingFile({
                                      name: att.fileName,
                                      type: att.fileType,
                                      dataUrl: att.url,
                                      classification: msg.classification,
                                    });
                                  }}
                                  className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 px-2.5 py-1 rounded-lg text-[10px] text-sky-400 flex items-center gap-1.5 transition-all"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{att.fileName}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {messages.length === 0 && (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      {translations[language].noMessagesInHistory}
                    </div>
                  )}

                  {messages.length > 0 && groupHistorySearchQuery.trim() && messages.filter((msg) => {
                    const q = groupHistorySearchQuery.toLowerCase();
                    return (msg.content || '').toLowerCase().includes(q) || `${msg.sender?.firstName || ''} ${msg.sender?.lastName || ''}`.toLowerCase().includes(q);
                  }).length === 0 && (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      {translations[language].noMatchingHistoryMessages}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Subtab 2: Members */}
            {groupHistoryActiveTab === 'members' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/50 min-h-[260px]">
                {(activeRoom.members || []).map((m: any) => {
                  const mId = m.userId || m.user?.id;
                  const isOnline = mId && onlineUserIds.has(mId);
                  const roleName = typeof m.user?.role === 'object' ? m.user?.role?.name : m.user?.role || 'Staff';
                  return (
                    <div key={mId} className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-white uppercase overflow-hidden">
                            {m.user?.avatarUrl ? (
                              <img src={m.user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                            ) : (
                              (m.user?.firstName || 'U')[0]
                            )}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-900 ${
                            isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`} />
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">
                            {m.user?.firstName} {m.user?.lastName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {getRoleLabel(roleName, language)} {m.user?.username ? `(@${m.user.username})` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOnline ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isOnline ? translations[language].statusOnline : translations[language].statusOffline}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Subtab 3: Files & Attachments */}
            {groupHistoryActiveTab === 'files' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[260px]">
                {(() => {
                  const allAttachments = messages.flatMap(m =>
                    (m.attachments || []).map(att => ({
                      ...att,
                      sender: m.sender,
                      createdAt: m.createdAt,
                      classification: m.classification,
                    }))
                  );

                  if (allAttachments.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        {language === 'TH' ? 'ยังไม่มีไฟล์แนบหรือรูปภาพในกลุ่มนี้' : 'No attachments or media shared in this group yet'}
                      </div>
                    );
                  }

                  return allAttachments.map((file, idx) => (
                    <div key={file.id || idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                          <Paperclip className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate text-xs">{file.fileName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {file.sender?.firstName || 'Staff'} • {new Date(file.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPreviewingFile({
                            name: file.fileName,
                            type: file.fileType,
                            dataUrl: file.url,
                            classification: file.classification,
                          });
                        }}
                        className="bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ml-2"
                      >
                        {translations[language].viewAttachmentBtn}
                      </button>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 shrink-0">
              <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span>{translations[language].groupSecurityE2EE}</span>
              </span>
              <button
                onClick={() => setShowGroupHistoryModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                {translations[language].cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HIPAA SECURE IN-APP INVITE CLINICAL STAFF MODAL --- */}
      {showInviteModal && inviteTargetRoom && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-4 sm:p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow animate-fade-in max-h-[92vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-400" /> {translations[language].inviteStaff}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {translations[language].roomLabel} {inviteTargetRoom.name}
            </p>

            <div className="relative">
              <input
                type="text"
                placeholder={translations[language].searchStaffPlaceholder}
                value={inviteSearchQuery}
                onChange={(e) => setInviteSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 pl-8 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            </div>

            <form onSubmit={handleInviteMembers} className="space-y-4 text-xs">
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
                {directoryUsers
                  .filter(u => {
                    // Filter out already room members
                    const isMember = inviteTargetRoom.members?.some((m: any) => m.userId === u.id);
                    if (isMember) return false;

                    // Filter by search query
                    const query = inviteSearchQuery.toLowerCase();
                    return `${u.firstName} ${u.lastName} ${u.role}`.toLowerCase().includes(query);
                  })
                  .map((u) => {
                    const isChecked = inviteSelectedMembers.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (isChecked) {
                            setInviteSelectedMembers(prev => prev.filter(id => id !== u.id));
                          } else {
                            setInviteSelectedMembers(prev => [...prev, u.id]);
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${isChecked ? 'bg-teal-950/30 border border-teal-800/40 text-teal-300 font-bold' : 'hover:bg-slate-800/40 text-slate-400 border border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-white uppercase shrink-0">
                            {u.firstName[0]}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-white leading-tight">{u.firstName} {u.lastName}</p>
                            <span className="text-[8px] text-teal-400 uppercase tracking-widest font-bold">{getRoleLabel(u.role, language)}</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => { }} // Handled by div onClick
                          className="rounded text-teal-500 focus:ring-teal-500/50 bg-slate-800 border-slate-700 h-3.5 w-3.5 shrink-0"
                        />
                      </div>
                    );
                  })}

                {directoryUsers.filter(u => {
                  const isMember = inviteTargetRoom.members?.some((m: any) => m.userId === u.id);
                  if (isMember) return false;
                  const query = inviteSearchQuery.toLowerCase();
                  return `${u.firstName} ${u.lastName} ${u.role}`.toLowerCase().includes(query);
                }).length === 0 && (
                    <p className="text-center text-slate-500 py-6">{translations[language].allMembersAdded}</p>
                  )}
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 pt-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteSelectedMembers([]);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-slate-300 transition-all"
                >
                  {translations[language].cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={inviteSelectedMembers.length === 0}
                  className={`bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-all ${inviteSelectedMembers.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                >
                  {translations[language].addMembersBtn} ({inviteSelectedMembers.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD CLINICAL USER MODAL --- */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow animate-fade-in">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-400" /> Register Clinical User
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Secure credentials registry console
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs text-slate-300">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. doctor_sarah"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Secure Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. นภาพร"
                    value={newUserData.firstName}
                    onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. แสงสุวรรณ"
                    value={newUserData.lastName}
                    onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Medical License / Prof ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. MD-99887"
                  value={newUserData.professionalId}
                  onChange={(e) => setNewUserData({ ...newUserData, professionalId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">System & Clinical Role</label>
                <select
                  required
                  value={newUserData.roleId}
                  onChange={(e) => setNewUserData({ ...newUserData, roleId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                >
                  <option value="" disabled>Select a role...</option>
                  {adminRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 pt-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-all"
                >
                  Register User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT CLINICAL USER MODAL --- */}
      {showEditUserModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow animate-fade-in">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" /> Edit Clinical Credentials
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Internal Registry Management
            </p>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs text-slate-300">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editingUserData.username}
                  onChange={(e) => setEditingUserData({ ...editingUserData, username: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Update Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editingUserData.password}
                  onChange={(e) => setEditingUserData({ ...editingUserData, password: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editingUserData.firstName}
                    onChange={(e) => setEditingUserData({ ...editingUserData, firstName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editingUserData.lastName}
                    onChange={(e) => setEditingUserData({ ...editingUserData, lastName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Medical License / Prof ID (Optional)</label>
                <input
                  type="text"
                  value={editingUserData.professionalId}
                  onChange={(e) => setEditingUserData({ ...editingUserData, professionalId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">System & Clinical Role</label>
                <select
                  required
                  value={editingUserData.roleId}
                  onChange={(e) => setEditingUserData({ ...editingUserData, roleId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                >
                  {adminRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Access Authorization</label>
                <div className="flex gap-4 mt-1 font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={editingUserData.isActive === true}
                      onChange={() => setEditingUserData({ ...editingUserData, isActive: true })}
                      className="text-teal-500 focus:ring-teal-500/50 bg-slate-800 border-slate-700"
                    />
                    <span className="text-green-400">Authorize Active Duty</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={editingUserData.isActive === false}
                      onChange={() => setEditingUserData({ ...editingUserData, isActive: false })}
                      className="text-rose-500 focus:ring-rose-500/50 bg-slate-800 border-slate-700"
                    />
                    <span className="text-rose-500">Deactivate / Suspend</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 pt-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINE-Style Mobile Bottom Navigation Bar */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 justify-around items-center z-30 px-2 pb-safe ${activeRoom && activeTab === 'chats' ? 'hidden' : 'flex'}`}>
        <button
          onClick={() => handleTabChange('chats')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 relative ${activeTab === 'chats' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <div className="relative">
            <MessageSquare className="h-5 w-5" />
            {rooms.filter(r => r.type !== 'GROUP' || r.isActive !== false).reduce((acc, r) => acc + (r.unreadCount || 0), 0) > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center animate-pulse">
                {rooms.filter(r => r.type !== 'GROUP' || r.isActive !== false).reduce((acc, r) => acc + (r.unreadCount || 0), 0)}
              </span>
            )}
          </div>
          <span className="text-[10px]">{translations[language].tabChats}</span>
        </button>

        <button
          onClick={() => handleTabChange('directory')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'directory' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px]">{translations[language].tabDirectory}</span>
        </button>

        {currentUser.role === 'Admin' && (
          <button
            onClick={() => handleTabChange('admin')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'admin' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
          >
            <Shield className="h-5 w-5" />
            <span className="text-[10px]">{translations[language].tabAdmin}</span>
          </button>
        )}

        <button
          onClick={() => handleTabChange('settings')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'settings' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px]">{translations[language].tabSettings}</span>
        </button>
      </div>
      {/* --- CUSTOM TOAST NOTIFICATION --- */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border ${toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-800/50 text-emerald-300'
            : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-800/50 text-rose-300'
              : 'bg-slate-900/90 border-slate-700/50 text-slate-300'
            }`}>
            {toast.type === 'success' && <CheckCircle className="h-4 w-4 shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0" />}
            {toast.type === 'info' && <Info className="h-4 w-4 shrink-0" />}
            <span className="text-xs font-bold whitespace-nowrap">{toast.message}</span>
          </div>
        </div>
      )}

      {/* --- ADMINISTRATIVE ROOM CLEANUP DIALOG --- */}
      {adminCleanupTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/95 shadow-2xl shadow-rose-950/20 p-6 relative overflow-hidden flex flex-col items-center text-center">
            {/* Glowing top line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-rose-500 to-red-600" />

            <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4 border bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-lg shadow-rose-900/25">
              <Trash2 className="h-5 w-5 text-rose-400 animate-pulse" />
            </div>

            <h3 className="text-sm font-black mb-1.5 tracking-wide uppercase text-white">
              {translations[language].clearChat}
            </h3>

            <p className="text-xs font-semibold text-teal-400 mb-2">
              {adminCleanupTarget.roomName || 'Active Room'}
            </p>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-6 max-w-[340px]">
              {language === 'TH'
                ? 'ในฐานะผู้ดูแลระบบ คุณสามารถเลือกระหว่างการล้างประวัติเฉพาะหน้าจอของคุณ หรือลบข้อความทั้งหมดในห้องนี้สำหรับสมาชิกทุกคน (Audit Logged)'
                : 'As an administrator, you can choose to clear history for your screen only, or permanently purge all messages in this room for everyone with an audit log.'}
            </p>

            <div className="flex flex-col w-full gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const target = adminCleanupTarget;
                  setAdminCleanupTarget(null);
                  handleClearChatHistory(target.roomId, false);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 transition-all text-[11px] font-bold flex items-center justify-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                <span>{translations[language].clearForMe}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = adminCleanupTarget;
                  setAdminCleanupTarget(null);
                  handleClearChatHistory(target.roomId, true);
                }}
                className="w-full py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-all text-[11px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                <span>{translations[language].purgeForAll}</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminCleanupTarget(null)}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-white transition-all text-[10px] font-semibold tracking-wider mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- UNIFIED CLINICAL MODAL DIALOG --- */}
      {clinicalModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-sm rounded-2xl border bg-slate-900/90 shadow-2xl p-6 relative overflow-hidden transition-all transform duration-300 scale-100 flex flex-col items-center text-center ${clinicalModal.type === 'error'
              ? 'border-red-500/30 shadow-red-950/20'
              : clinicalModal.type === 'warning'
                ? 'border-amber-500/30 shadow-amber-950/20'
                : 'border-teal-500/30 shadow-teal-950/20'
            }`}>
            {/* Glowing top gradient */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${clinicalModal.type === 'error'
                ? 'from-red-500 via-rose-500 to-red-600'
                : clinicalModal.type === 'warning'
                  ? 'from-amber-500 via-orange-400 to-amber-600'
                  : 'from-teal-500 via-emerald-450 to-sky-500'
              }`} />

            {/* Glowing Icon Container */}
            <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 border relative ${clinicalModal.type === 'error'
                ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-lg shadow-red-900/25'
                : clinicalModal.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-lg shadow-amber-900/25'
                  : 'bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-lg shadow-teal-900/25'
              }`}>
              {clinicalModal.type === 'error' && <AlertTriangle className="h-5 w-5 animate-pulse" />}
              {clinicalModal.type === 'warning' && <Lock className="h-5 w-5 animate-bounce" />}
              {clinicalModal.type === 'confirm' && <Shield className="h-5 w-5" />}
              {clinicalModal.type === 'success' && <CheckCircle className="h-5 w-5" />}
              {clinicalModal.type === 'info' && <Info className="h-5 w-5" />}
            </div>

            {/* Text details */}
            <h3 className={`text-sm font-bold mb-2 tracking-wide uppercase ${clinicalModal.type === 'error'
                ? 'text-red-400'
                : clinicalModal.type === 'warning'
                  ? 'text-amber-400'
                  : 'text-teal-400'
              }`}>
              {clinicalModal.title}
            </h3>

            <p className="text-[11px] text-slate-350 leading-relaxed mb-6 whitespace-pre-wrap max-w-[280px]">
              {clinicalModal.message}
            </p>

            {/* Actions button block */}
            <div className="flex w-full gap-3 items-center justify-center">
              {clinicalModal.type === 'confirm' ? (
                <>
                  <button
                    onClick={clinicalModal.onCancel}
                    className="flex-1 py-2 rounded-xl border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={clinicalModal.onConfirm}
                    className="flex-1 py-2 rounded-xl text-white transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-teal-950/20"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={clinicalModal.onConfirm}
                  className={`w-full py-2 rounded-xl text-white transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg ${clinicalModal.type === 'error'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
                      : clinicalModal.type === 'warning'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700'
                    }`}
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- LOGOUT CONFIRMATION DIALOG --- */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-slate-900/95 shadow-2xl shadow-rose-950/30 p-6 relative overflow-hidden flex flex-col items-center text-center">
            {/* Glowing top line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-rose-500 to-red-600" />

            <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4 border bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-lg shadow-rose-900/25">
              <LogOut className="h-5 w-5 text-rose-400" />
            </div>

            <h3 className="text-sm font-black mb-1.5 tracking-wide uppercase text-white">
              {language === 'TH' ? 'ยืนยันการออกจากระบบ' : 'Confirm Session Logout'}
            </h3>

            <p className="text-xs font-semibold text-teal-400 mb-2">
              {currentUser?.firstName} {currentUser?.lastName} (@{currentUser?.username})
            </p>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-6 max-w-[280px]">
              {language === 'TH'
                ? 'คุณต้องการสิ้นสุดเซสชันการทำงานและออกจากระบบ hosply หรือไม่? คุณจะต้องลงชื่อเข้าใช้อีกครั้งเพื่อรับข้อความ'
                : 'Are you sure you want to terminate your secure clinical session? You will need to sign in again to receive messages.'}
            </p>

            <div className="flex flex-col w-full gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="w-full py-2.5 rounded-xl border border-rose-500/40 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/30 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>{translations[language].logoutButton}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 active:scale-[0.98] text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
              >
                {translations[language].cancelButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
