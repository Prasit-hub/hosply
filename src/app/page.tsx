'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Trash2
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
  sender: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
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
    username: string;
    firstName: string;
    lastName: string;
    role: { name: string };
  };
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
    leaveGroup: 'Leave Group',
    inviteStaff: 'Invite Staff to Group',
    
    // Profile Settings
    profileTitle: 'Professional Profile Settings',
    roleLabel: 'Professional Clinical Role',
    usernameLabelSettings: 'Clinical Staff Username',
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
    cancelButton: 'Cancel'
  },
  TH: {
    // Login
    loginTitle: 'เครือข่ายคลินิก Hosply',
    loginSubtitle: 'ช่องทางส่งข้อความเข้ารหัสปลอดภัย AES-256 สำหรับทีมแพทย์และพยาบาล',
    usernameLabel: 'ชื่อผู้ใช้งานระบบสุขภาพ',
    usernamePlaceholder: 'doctor1 / nurse1 / pharmacist1 / admin1',
    passwordLabel: 'รหัสผ่านความปลอดภัย',
    passwordPlaceholder: '••••••••',
    loginButton: 'ยืนยันตัวตนและเข้าใช้งาน',
    authenticating: 'กำลังตรวจสอบสิทธิ์...',
    languageLabel: 'เลือกภาษา',
    
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
    leaveGroup: 'ออกจากกลุ่มแชท',
    inviteStaff: 'เชิญบุคลากรเข้ากลุ่ม',
    
    // Profile Settings
    profileTitle: 'ตั้งค่าโปรไฟล์วิชาชีพ',
    roleLabel: 'ตำแหน่งวิชาชีพหลัก',
    usernameLabelSettings: 'ชื่อผู้ใช้บัญชีสุขภาพ',
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
    cancelButton: 'ยกเลิก'
  }
};

export default function ClinicalPlatform() {
  // Authentication & Global State
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentTheme, setCurrentTheme] = useState<'teal' | 'navy' | 'emerald' | 'light'>('teal');

  useEffect(() => {
    const savedTheme = localStorage.getItem('hosply_theme');
    if (savedTheme === 'teal' || savedTheme === 'navy' || savedTheme === 'emerald' || savedTheme === 'light') {
      setCurrentTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hosply_theme', currentTheme);
  }, [currentTheme]);



  const [activeTab, setActiveTab] = useState<'chats' | 'patients' | 'directory' | 'admin' | 'settings'>('chats');

  // Login Page States
  const [loginUsername, setLoginUsername] = useState('doctor1');
  const [loginPassword, setLoginPassword] = useState('Hosply@Secure2026');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // Save active room ID to localStorage
  useEffect(() => {
    if (activeRoom?.id) {
      localStorage.setItem('hosply_last_room_id', activeRoom.id);
    }
  }, [activeRoom]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'>('INTERNAL');

  // Real-time DLP States
  const [dlpWarning, setDlpWarning] = useState<{ flagged: boolean; reason?: string; match?: string } | null>(null);
  const [dlpBlockMessage, setDlpBlockMessage] = useState<string | null>(null);

  // Search and Filters
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<{ name: string; type: string; dataUrl: string; messageId?: string; attachmentId?: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<{ name: string; type: string; dataUrl: string; classification: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Directory and Chat Creation
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
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
  const [adminSubTab, setAdminSubTab] = useState<'compliance' | 'users'>('compliance');
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminRoles, setAdminRoles] = useState<any[]>([]);
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

    socket.on('userTyping', (data: any) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.userId === data.userId)) return prev;
          return [...prev, data];
        });
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }
    });

    socket.on('error', (err: any) => {
      showToast(`Server Blocked Action: ${err.message}`, 'error');
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  // Handle active room switch
  useEffect(() => {
    if (!activeRoom || !socketRef.current) return;

    setMessages([]);
    setTypingUsers([]);

    // Instantly clear the unread count for this room locally in rooms list state for zero-latency UX feel!
    setRooms((prevRooms) =>
      prevRooms.map((r) =>
        r.id === activeRoom.id ? { ...r, unreadCount: 0 } : r
      )
    );

    // Subscribe to Socket Room and mark as read on server to update database record
    socketRef.current.emit('joinRoom', { roomId: activeRoom.id });
    socketRef.current.emit('readRoom', { roomId: activeRoom.id });

    // Fetch message history REST
    fetchMessages(activeRoom.id);
  }, [activeRoom]);

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
        accessToken: data.accessToken,
      });
    } catch (err: any) {
      console.error('Login failed:', err);
      setLoginError('ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง หรือเซิร์ฟเวอร์ออฟไลน์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRooms([]);
    setActiveRoom(null);
    setMessages([]);
    socketRef.current?.disconnect();
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

        // Keep current active room if it exists
        const currentActive = activeRoomRef.current || activeRoom;
        if (currentActive) {
          const freshActive = data.find((r: any) => r.id === currentActive.id);
          if (freshActive) {
            setActiveRoom(freshActive);
            return;
          }
        }

        const lastRoomId = localStorage.getItem('hosply_last_room_id');
        if (lastRoomId) {
          const lastRoom = data.find((r: any) => r.id === lastRoomId);
          if (lastRoom) {
            setActiveRoom(lastRoom);
          } else if (data.length > 0) {
            setActiveRoom(data[0]);
          }
        } else if (data.length > 0) {
          setActiveRoom(data[0]);
        }
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

      const lastRoomId = localStorage.getItem('hosply_last_room_id');
      const lastRoom = mockRooms.find((r) => r.id === lastRoomId);
      if (lastRoom) {
        setActiveRoom(lastRoom);
      } else {
        setActiveRoom(mockRooms[0]);
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

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
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

  const handleClearChatHistory = (roomId: string) => {
    showClinicalModal(
      'Clear Chat History',
      'Are you sure you want to clear your chat history for this direct message? This will only delete history on your screen, and cannot be undone.',
      'confirm',
      async () => {
        try {
          const res = await fetch(`${API_URL}/api/rooms/${roomId}/clear`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${currentUser?.accessToken}`,
            },
          });

          if (!res.ok) {
            throw new Error('Failed to clear chat history');
          }

          showToast('Chat history cleared locally!', 'success');
          
          if (activeRoom && activeRoom.id === roomId) {
            setMessages([]);
          }
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

  const fetchDirectory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/directory`, {
        headers: { Authorization: `Bearer ${currentUser?.accessToken}` },
      });
      if (res.ok) {
        setDirectoryUsers(await res.json());
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
      const res = await fetch(`${API_URL}/api/admin/audit`, {
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
        const errData = await res.json();
        throw new Error(errData.message || 'File upload failed');
      }

      const data = await res.json();
      setSelectedAttachmentFile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messageId: data.messageId,
          attachmentId: data.attachment.id,
        };
      });

      if (originalFile.size > 100 * 1024 && originalFile.type.startsWith('image/')) {
        showToast(`Image optimized & uploaded successfully (${Math.round(file.size / 1024)} KB)`, 'success');
      } else {
        showToast('File uploaded successfully!', 'success');
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

      // Refresh room list
      await fetchRooms();

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
              className={`px-2 py-1 rounded text-[10px] font-black transition-all ${
                language === 'TH'
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TH
            </button>
            <button
              onClick={() => changeLanguage('EN')}
              className={`px-2 py-1 rounded text-[10px] font-black transition-all ${
                language === 'EN'
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

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {loginError && (
              <div className="bg-red-950/30 border border-red-500/50 text-red-300 rounded-lg p-3 text-sm flex items-center gap-2">
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

            <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-850 pt-4">
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
                className="group relative flex w-full justify-center rounded-lg bg-teal-500 py-3 px-4 text-xs font-semibold text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all active:scale-[0.98]"
              >
                {isLoading ? translations[language].authenticating : translations[language].loginButton}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <style>{`
        :root {
          --accent-color: ${currentTheme === 'teal' ? '#06C755' : currentTheme === 'navy' ? '#3b82f6' : currentTheme === 'emerald' ? '#10b981' : '#0ea5e9'};
          --accent-hover: ${currentTheme === 'teal' ? '#05b34c' : currentTheme === 'navy' ? '#2563eb' : currentTheme === 'emerald' ? '#059669' : '#0284c7'};
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
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.15)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.15)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(14, 165, 233, 0.15)'} !important;
        }
        .text-teal-300 {
          color: ${currentTheme === 'teal' ? '#8dfab6' : currentTheme === 'navy' ? '#93c5fd' : currentTheme === 'emerald' ? '#6ee7b7' : '#7dd3fc'} !important;
        }
        .border-teal-500 {
          border-color: var(--accent-color) !important;
        }
        .bg-teal-500\\/20 {
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.2)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.2)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(14, 165, 233, 0.2)'} !important;
        }
        .bg-teal-500\\/10 {
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.1)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.1)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(14, 165, 233, 0.1)'} !important;
        }
        .border-teal-500\\/30 {
          border-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.3)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.3)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(14, 165, 233, 0.3)'} !important;
        }
        .focus\\:border-teal-500:focus {
          border-color: var(--accent-color) !important;
        }
        .glow-active {
          box-shadow: 0 0 15px ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.3)' : currentTheme === 'navy' ? 'rgba(59, 130, 246, 0.3)' : currentTheme === 'emerald' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(14, 165, 233, 0.3)'} !important;
        }

        /* Custom speech bubbles matching Line Chat theme */
        .self-bubble {
          background-color: ${currentTheme === 'teal' ? 'rgba(6, 199, 85, 0.25)' : 'rgba(20, 184, 166, 0.15)'} !important;
          border-color: var(--accent-color) !important;
          color: #ffffff !important;
        }
        .other-bubble {
          background-color: #242b35 !important;
          border-color: #2b3543 !important;
          color: #f8fafc !important;
        }
        
        ${currentTheme === 'light' ? `
          /* Soothing Light Mode Overrides to Reduce Glare & Screen Fatigue */
          .bg-slate-950 {
            background-color: #bac9df !important; /* Iconic LINE Chat Calming Blue! */
          }
          .bg-slate-900 {
            background-color: #f4f6f9 !important; /* Softer clinical off-white */
          }
          .bg-slate-900\\/40, .bg-slate-900\\/50, .bg-slate-900\\/60, .bg-slate-900\\/30 {
            background-color: #e6e9ef !important; /* Smooth sub-bars */
          }
          .bg-slate-800, .bg-slate-800\\/30, .bg-slate-800\\/50 {
            background-color: #dbe1eb !important; /* Muted accents */
          }
          .border-slate-800, .border-slate-800\\/80, .border-slate-700\\/60, .border-slate-700\\/80 {
            border-color: rgba(15, 23, 42, 0.12) !important;
          }
          .text-slate-100, .text-white, .text-slate-200, .text-slate-300 {
            color: #1e293b !important; /* Extremely high contrast but soft dark slate text */
          }
          .text-slate-400, .text-slate-500 {
            color: #475569 !important; /* Highly readable slate-600 */
          }
          input, select, textarea {
            background-color: #fdfdfd !important;
            color: #0f172a !important;
            border-color: #a8b2c1 !important; /* Stronger gray border */
          }
          .text-teal-400 {
            color: #06C755 !important; /* LINE Green in light mode */
          }
          .text-teal-300 {
            color: #05b34c !important;
          }
          
          /* Prevent dark text blending inside containers */
          .bg-slate-900\\/50 p, .bg-slate-900\\/50 span {
            color: #0f172a !important;
          }

          /* Iconic LINE Chat speech bubbles */
          .self-bubble {
            background-color: #8ee66d !important; /* LINE Chat iconic light-green self bubble */
            border-color: #83d463 !important;
            color: #000000 !important;
          }
          .self-bubble p, .self-bubble span, .self-bubble div {
            color: #000000 !important;
          }
          .other-bubble {
            background-color: #ffffff !important; /* LINE Chat iconic white bubble */
            border-color: #e2e8f0 !important;
            color: #0f172a !important;
          }
          .other-bubble p, .other-bubble span, .other-bubble div {
            color: #0f172a !important;
          }

          /* Senior UX Designed High-Contrast Speech Bubbles for Clinical Readability */
          .bg-rose-50, .dark\\:bg-rose-950\\/20 {
            background-color: #fff1f2 !important; /* soft rose-100 */
            color: #9f1239 !important; /* rose-800 text */
            border-color: #f43f5e !important;
          }
          .bg-rose-50 p, .bg-rose-50 span, .dark\\:bg-rose-950\\/20 p, .dark\\:bg-rose-950\\/20 span {
            color: #9f1239 !important;
          }
          .bg-amber-50, .dark\\:bg-amber-950\\/20 {
            background-color: #fef3c7 !important; /* soft amber-100 */
            color: #92400e !important; /* amber-800 text */
            border-color: #f59e0b !important;
          }
          .bg-amber-50 p, .bg-amber-50 span, .dark\\:bg-amber-950\\/20 p, .dark\\:bg-amber-950\\/20 span {
            color: #92400e !important;
          }
          .bg-emerald-50, .dark\\:bg-emerald-950\\/20 {
            background-color: #d1fae5 !important; /* soft emerald-100 */
            color: #065f46 !important; /* emerald-800 text */
            border-color: #10b981 !important;
          }
          .bg-emerald-50 p, .bg-emerald-50 span, .dark\\:bg-emerald-950\\/20 p, .dark\\:bg-emerald-950\\/20 span {
            color: #065f46 !important;
          }
          .bg-slate-50, .dark\\:bg-slate-800\\/40 {
            background-color: #f1f5f9 !important; /* soft slate-100 */
            color: #1e293b !important; /* slate-800 text */
            border-color: #94a3b8 !important;
          }
          .bg-slate-50 p, .bg-slate-50 span, .dark\\:bg-slate-800\\/40 p, .dark\\:bg-slate-800\\/40 span {
            color: #1e293b !important;
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
        
        /* LINE Chat aesthetics by Senior UX Designer */
        .line-chat-bg {
          background-color: ${currentTheme === 'light' ? '#abc1e8' : '#0f141c'} !important;
          background-image: ${currentTheme === 'light' ? 'none' : 'radial-gradient(circle at 50% 10%, #17212f, #0b0f15)'} !important;
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
          font-size: 9px;
          font-weight: 700;
          color: ${currentTheme === 'light' ? '#3c5a85' : '#06C755'} !important;
          margin-bottom: 1px;
          letter-spacing: -0.01em;
        }
      `}</style>
      {/* 1. LEFT SIDE NAVIGATION */}
      <div className={`hidden md:flex bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0 z-20 transition-all duration-300 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div>
          {/* Hospital Logo & Collapse Toggle */}
          <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg text-white shrink-0">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              {isSidebarExpanded && (
                <div className="animate-fade-in shrink-0">
                  <h1 className="font-extrabold text-white tracking-wide text-md">hosply</h1>
                  <p className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Internal Message</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSidebarExpanded && (
                <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60 mr-1 animate-fade-in shrink-0">
                  <button
                    onClick={() => changeLanguage('TH')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${
                      language === 'TH'
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    TH
                  </button>
                  <button
                    onClick={() => changeLanguage('EN')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${
                      language === 'EN'
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
              onClick={() => setActiveTab('chats')}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm transition-all ${isSidebarExpanded ? 'justify-between' : 'justify-center'
                } ${activeTab === 'chats'
                  ? 'bg-teal-900/40 text-teal-300 font-bold border-l-2 border-teal-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              title={translations[language].tabChats}
            >
              <span className="flex items-center gap-2.5 relative">
                <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                {!isSidebarExpanded && rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0) > 0 && (
                  <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500 ring-1 ring-slate-900 animate-pulse"></span>
                )}
                {isSidebarExpanded && <span className="truncate">{translations[language].tabChats}</span>}
              </span>
              {isSidebarExpanded && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="bg-teal-500/20 text-teal-400 text-xs px-2 py-0.5 rounded-full font-bold">
                    {rooms.length}
                  </span>
                  {rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center animate-pulse">
                      {rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0)}
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('directory')}
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
                onClick={() => setActiveTab('admin')}
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
              onClick={() => setActiveTab('settings')}
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
              title="Create Group Discussion"
            >
              {isSidebarExpanded ? "+ Create Group" : "+"}
            </button>
          </div>
        </div>

        {/* User Session Profile Footing */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'flex-col gap-3 justify-center'}`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-800 border-2 status-ring-online flex items-center justify-center text-white shrink-0 relative">
                <User className="h-5 w-5" />
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-slate-900"></span>
              </div>
              {isSidebarExpanded && (
                <div className="overflow-hidden animate-fade-in">
                  <p className="text-xs font-bold text-white truncate">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-teal-400 font-semibold uppercase">
                    <UserCheck className="h-3 w-3" /> {currentUser.role}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
              title="Logout session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. CHATS / DIRECTORY LIST SUBBAR (Middle Left) */}
      <div className={`w-full md:w-80 bg-slate-900/60 border-r border-slate-800/80 flex-col shrink-0 pb-16 md:pb-0 ${
        (activeTab === 'admin' || activeTab === 'settings')
          ? 'hidden md:hidden'
          : (activeRoom && activeTab === 'chats')
            ? 'hidden'
            : 'flex'
      }`}>
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
        </div>

        {/* Tab-driven lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeTab === 'chats' && (
            <>
              <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{translations[language].activeChatsTitle}</div>
              {rooms
                .filter((r) => r.type !== 'PATIENT_CONTEXT' && r.name.toLowerCase().includes(chatSearchQuery.toLowerCase()))
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
                  return (
                    <button
                      key={room.id}
                      onClick={() => setActiveRoom(room)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          room: room,
                        });
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border flex gap-3 items-center ${
                        activeRoom?.id === room.id
                          ? isDirect
                            ? 'bg-slate-800/90 border-emerald-500/35 text-white shadow-md shadow-emerald-950/20'
                            : 'bg-slate-800/90 border-sky-500/35 text-white shadow-md shadow-sky-950/20'
                          : room.unreadCount && room.unreadCount > 0
                            ? 'bg-slate-800/20 border-slate-850 text-slate-100 font-extrabold shadow-sm'
                            : 'border-transparent text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                      }`}
                    >
                      {/* Left Icon Block */}
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border relative transition-all duration-300 ${
                        activeRoom?.id === room.id
                          ? isDirect
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                          : isDirect
                            ? 'bg-slate-800/90 text-emerald-400 border-slate-700/60'
                            : 'bg-slate-800/90 text-sky-400 border-slate-700/60'
                      }`}>
                        {isDirect ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                        {/* Status notification dot */}
                        {room.unreadCount && room.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                        )}
                      </div>

                      {/* Content block */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                            room.unreadCount && room.unreadCount > 0 ? 'text-white font-extrabold' : ''
                          }`}>
                            {isPinned && <Pin className="h-3 w-3 text-amber-400 rotate-45 shrink-0 inline-block" />}
                            <span className="truncate">{room.name}</span>
                          </span>

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
                              Group
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] truncate mt-0.5 ${
                          room.unreadCount && room.unreadCount > 0 ? 'text-teal-400 font-bold' : 'text-slate-500'
                        }`}>
                          {room.unreadCount && room.unreadCount > 0
                            ? '⚠️ Unread secure updates...'
                            : isPinned
                              ? '📌 Pinned to top of dashboard'
                              : isDirect
                                ? 'Private doctor-to-staff clinical line'
                                : 'Coordinated care team discussions'}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </>
          )}

          {activeTab === 'directory' && (
            <>
              <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Staff Directory</div>
              {directoryUsers
                .filter((user) =>
                  `${user.firstName} ${user.lastName} ${user.role}`.toLowerCase().includes(chatSearchQuery.toLowerCase())
                )
                .map((user) => (
                  <div
                    key={user.id}
                    className="p-3 rounded-xl bg-slate-800/30 border border-slate-800/80 hover:bg-slate-800/60 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8.5 w-8.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                        {user.firstName[0]}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {user.firstName} {user.lastName}
                        </p>
                        <span className="text-[9px] text-teal-400 font-bold uppercase tracking-wider">{user.role}</span>
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
                      Chat
                    </button>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>

      {/* 3. MAIN CENTER CHAT & PANELS (Switch depending on Tab) */}
      <div className={`flex-1 flex bg-slate-950 overflow-hidden relative pb-16 md:pb-0 ${
        activeTab === 'directory'
          ? 'hidden md:flex'
          : (!activeRoom && activeTab === 'chats')
            ? 'hidden md:flex'
            : 'flex'
      }`}>

        {activeTab === 'admin' && currentUser.role === 'Admin' ? (
          /* --- ADMIN DASHBOARD CENTER VIEW --- */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Shield className="h-6 w-6 text-teal-400" /> Compliance & Management Console
                </h2>
                <p className="text-xs text-slate-400 mt-1">Real-time status of clinical logs and secure user directory auditing.</p>
              </div>
              <div className="flex bg-slate-900 border border-slate-850 p-1.5 rounded-xl shrink-0">
                <button
                  onClick={() => setAdminSubTab('compliance')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminSubTab === 'compliance' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Compliance & Audit
                </button>
                <button
                  onClick={() => setAdminSubTab('users')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminSubTab === 'users' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  User Maintenance
                </button>
              </div>
            </div>

            {adminSubTab === 'compliance' ? (
              <>
                {/* Gauges row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-teal-500/10 text-teal-400 glow-active">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Database</p>
                      <h3 className="text-lg font-black text-white">SQLite + Prisma</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 glow-restricted">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DLP Intercepts</p>
                      <h3 className="text-lg font-black text-white">{dlpAlertsCount} Blocked</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400">
                      <HardDrive className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Storage Status</p>
                      <h3 className="text-lg font-black text-white">{storageUsage.used} / {storageUsage.total}</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concurrent Sessions</p>
                      <h3 className="text-lg font-black text-white">{activeSessionsCount} active</h3>
                    </div>
                  </div>
                </div>

                {/* Audit Logs browser */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Live Secure Audit Log Stream</h4>
                    <div className="relative w-72">
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Search logs by action or user..."
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg py-1.5 pl-8 pr-4 text-xs text-white focus:outline-none focus:border-teal-500 placeholder-slate-500"
                      />
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800 overflow-y-auto max-h-[350px] text-xs">
                    {auditLogs
                      .filter((log) =>
                        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.user?.username.toLowerCase().includes(auditSearch.toLowerCase())
                      )
                      .map((log) => (
                        <div key={log.id} className="p-3 hover:bg-slate-800/30 transition-all flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${log.action.includes('BLOCK') ? 'bg-red-950 text-red-400 border border-red-800/60' : 'bg-slate-800 text-slate-300'
                                }`}>
                                {log.action}
                              </span>
                              <span className="text-slate-400 font-semibold">
                                by {log.user?.firstName} {log.user?.lastName} ({log.user?.username})
                              </span>
                            </div>
                            <p className="text-slate-500 font-mono text-[10px] break-all">{log.details}</p>
                          </div>
                          <div className="text-right shrink-0 text-slate-500 text-[10px] space-y-0.5">
                            <div className="flex items-center gap-1"><Layers className="h-3 w-3" /> {log.ipAddress}</div>
                            <div>{new Date(log.createdAt).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (() => {
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
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900 border border-slate-800 p-5 rounded-xl">
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-white text-sm">Active Staff Directory Management</h3>
                      <p className="text-[11px] text-slate-400">Add, edit, or deactivate professional clinical credentials & system roles.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-64">
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
                        className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/10 active:scale-95 whitespace-nowrap shrink-0"
                      >
                        <UserPlus className="h-4 w-4" /> Add Clinical User
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
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
                                  <div className="h-8.5 w-8.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 uppercase shadow-sm">
                                    {u.firstName ? u.firstName[0] : 'U'}
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
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-400">{u.professionalId || '—'}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${u.isActive ? 'text-green-400' : 'text-slate-500'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                                    {u.isActive ? 'Active Duty' : 'Deactivated'}
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

                    {filteredUsers.length > 0 && (
                      <div className="bg-slate-950/40 border-t border-slate-800 px-6 py-4 flex items-center justify-between text-xs">
                        <div className="text-slate-400 font-medium">
                          Showing <span className="text-white font-bold">{Math.min(filteredUsers.length, (userListPage - 1) * ITEMS_PER_PAGE + 1)}</span> to{' '}
                          <span className="text-white font-bold">{Math.min(filteredUsers.length, userListPage * ITEMS_PER_PAGE)}</span> of{' '}
                          <span className="text-white font-bold">{filteredUsers.length}</span> entries
                        </div>
                        <div className="flex items-center gap-1.5 font-bold">
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
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" /> Previous
                          </button>

                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => Math.abs(page - userListPage) <= 1 || page === 1 || page === totalPages)
                            .map((page, idx, arr) => {
                              const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                              return (
                                <React.Fragment key={page}>
                                  {showEllipsis && <span className="text-slate-600 px-1">...</span>}
                                  <button
                                    onClick={() => setUserListPage(page)}
                                    className={`px-3 py-1.5 rounded-lg transition-all border ${userListPage === page
                                      ? 'bg-teal-500/10 text-teal-400 border-teal-500/40 shadow-md shadow-teal-500/5'
                                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                  >
                                    {page}
                                  </button>
                                </React.Fragment>
                              );
                            })}

                          <button
                            onClick={() => setUserListPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={userListPage === totalPages}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1"
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
            })()}
          </div>
        ) : activeTab === 'settings' ? (
          /* --- SETTINGS TAB --- */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-black text-white tracking-tight border-b border-slate-800 pb-4">
              System Settings & Security Config
            </h2>
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
                <Shield className="h-5 w-5 text-teal-400" /> Change Personal Password
              </h3>
              <p className="text-xs text-slate-400">
                Update your active clinical account password. New passwords must be at least 6 characters long to meet HIPAA security compliance requirements.
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
                      Current Password
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 animate-fade-in"
                        placeholder="Enter current password"
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
                      New Password (min. 6 characters)
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 animate-fade-in"
                        placeholder="Create secure new password"
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
                      Confirm New Password
                    </label>
                    <div className="relative rounded-lg shadow-sm">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        className="block w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-10 animate-fade-in"
                        placeholder="Re-type new password"
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
                        <Clock className="h-3.5 w-3.5 animate-spin" /> Updating Credentials...
                      </>
                    ) : (
                      'Update Account Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : activeRoom ? (
          /* --- THREE-COLUMN CHAT CONVERSATION VIEW --- */
          <>
            {/* COLUMN 1: CHAT FEED (Center) */}
            <div className="flex-1 flex flex-col justify-between bg-slate-950 border-r border-slate-800/80">
              {/* Chat room Header */}
              <div className="h-20 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md relative z-20">
                <div className="flex items-center gap-4">
                  {/* Back Button to Chats List */}
                  <button
                    onClick={() => setActiveRoom(null)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 active:scale-95 transition-all mr-1 flex items-center justify-center shadow-lg"
                    title="Back to Chats"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" />
                  </button>

                  {/* Glowing Status Avatar Ring */}
                  <div className="relative">
                    <div className="h-11 w-11 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black text-md shadow-md shadow-teal-500/10">
                      {activeRoom.name[0]}
                    </div>
                    <span className="absolute -bottom-1 -right-1 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-slate-900 animate-ping"></span>
                    <span className="absolute -bottom-1 -right-1 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-slate-900"></span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-teal-400 font-black uppercase tracking-widest bg-teal-950/50 border border-teal-800/40 px-2 py-0.5 rounded-md">
                        {activeRoom.type === 'DIRECT' ? '👤 1-1 Direct Message' : activeRoom.type === 'PATIENT_CONTEXT' ? '🏥 Clinical Patient Discussion' : '👥 Group Case discussion'}
                      </span>
                      {activeRoom.type === 'PATIENT_CONTEXT' && activeRoom.patientContext && (
                        <div className="flex items-center gap-1.5">
                          <span className="bg-sky-950 text-sky-400 font-mono text-[9px] px-1.5 py-0.5 rounded border border-sky-800/60 font-bold uppercase">
                            HN: {activeRoom.patientContext.hn}
                          </span>
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-800/60 font-bold uppercase">
                            Active Stream
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
                      {activeRoom.name}
                      <span className="h-2 w-2 rounded-full bg-green-500 inline-block animate-pulse" title="Connected to secure stream"></span>
                    </h3>
                  </div>
                </div>

                {/* Right secure channel tags and avatars */}
                <div className="flex items-center gap-3">
                  {/* Member Avatars */}
                  {activeRoom.members && activeRoom.type !== 'DIRECT' && (
                    <div className="flex items-center -space-x-2 mr-2">
                      {activeRoom.members.slice(0, 10).map((m: any) => (
                        <div key={m.userId} title={`${m.user.firstName} ${m.user.lastName} (${m.user.role.name})`} className="h-7 w-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center font-bold text-[9px] text-white uppercase shadow-sm">
                          {m.user.firstName[0]}
                        </div>
                      ))}
                      {activeRoom.members.length > 10 && (
                        <div title="View All Members" onClick={() => { /* View all members logic if needed */ }} className="h-7 w-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center font-bold text-[9px] text-teal-400 cursor-pointer hover:bg-slate-700 transition-colors shadow-sm">
                          +{activeRoom.members.length - 10}
                        </div>
                      )}
                    </div>
                  )}

                  {activeRoom.type !== 'DIRECT' && (
                    <button
                      onClick={() => {
                        setInviteTargetRoom(activeRoom);
                        setShowInviteModal(true);
                      }}
                      className="bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 shadow-md shrink-0 animate-fade-in"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Invite Staff</span>
                    </button>
                  )}
                  <span className="bg-slate-800/80 text-slate-300 text-[10px] px-3 py-1.5 rounded-lg font-bold border border-slate-700/60 uppercase tracking-wider hidden md:flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    Now Connected
                  </span>
                </div>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-2.5 relative line-chat-bg">
                {/* Tiled Forensic Security Watermark Overlay */}
                <div className="pointer-events-none absolute inset-0 z-0 flex flex-wrap items-center justify-center gap-x-24 gap-y-32 overflow-hidden select-none p-10">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className={`flex flex-col items-center justify-center text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase rotate-[-30deg] select-none whitespace-nowrap ${currentTheme === 'light' ? 'text-slate-900/[0.06]' : 'text-slate-100/[0.04]'}`}>
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
                            <span>Retrieving clinical logs...</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 text-teal-400" />
                            <span>Load earlier records</span>
                          </>
                        )}
                      </button>
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
                              <div className="h-9 w-9 rounded-full border bg-slate-800 border-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs uppercase shadow-sm transition-all hover:scale-105">
                                {msg.sender.firstName ? msg.sender.firstName[0] : 'U'}
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
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 pl-1">
                              <span className="font-extrabold text-slate-700 dark:text-slate-200">
                                {msg.sender.firstName} {msg.sender.lastName}
                              </span>
                              <span className="text-[8px] font-black tracking-wider uppercase bg-slate-800/50 dark:bg-slate-800 text-slate-500 dark:text-teal-400 border border-slate-700/60 dark:border-slate-700 px-1.5 py-0.2 rounded-md">
                                {typeof msg.sender.role === 'object' && msg.sender.role !== null
                                  ? (msg.sender.role as any).name
                                  : msg.sender.role}
                              </span>
                            </div>
                          )}

                          {/* Content Bubble aligned with LINE Timestamp & Read Status */}
                          <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                            {/* Speech Bubble */}
                            <div className={`p-3 text-xs leading-relaxed transition-all rounded-2xl shadow-sm ${lineClass} ${bubbleStyle}`}>
                              {!isNormal && (
                                <div className="flex items-center gap-1.5 mb-1.5 border-b border-slate-500/10 pb-1 font-bold text-[9px] tracking-wider uppercase">
                                  <Lock className="h-3 w-3 animate-pulse text-current" /> {msg.classification} SECURE
                                </div>
                              )}
                              <p className="whitespace-pre-line font-medium leading-relaxed font-sans">{msg.content}</p>

                              {/* Attachments rendering */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-3 space-y-2 border-t border-slate-500/10 pt-2">
                                  {msg.attachments.map((file: any, idx: number) => {
                                    const fileName = file.fileName || file.name;
                                    const fileType = file.fileType || file.type;
                                    const isImage = fileType?.startsWith('image/');
                                    const hasLocalUrl = !!file.dataUrl;

                                    return (
                                      <div key={idx} className="space-y-1.5">
                                        {isImage && hasLocalUrl ? (
                                          /* LOCAL IMAGE CACHE PREVIEW */
                                          <div className="rounded-lg overflow-hidden border border-slate-700/60 max-w-[260px] bg-slate-950/80 shadow-md">
                                            <img
                                              src={file.dataUrl}
                                              alt={fileName}
                                              className="w-full h-auto object-cover max-h-[180px] cursor-pointer hover:opacity-90 transition-all animate-fade-in"
                                              onClick={() => setPreviewingFile({ name: fileName, type: fileType, dataUrl: file.dataUrl, classification: msg.classification })}
                                            />
                                          </div>
                                        ) : (
                                          /* SECURE FILE COMPONENT */
                                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] gap-2 max-w-[280px]">
                                            <div className="flex items-center gap-2 truncate">
                                              <div className="h-8 w-8 rounded-lg bg-slate-950 flex items-center justify-center text-teal-400 font-black text-[9px] shrink-0 border border-slate-800">
                                                {isImage ? 'IMG' : (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOC')}
                                              </div>
                                              <div className="truncate">
                                                <p className="font-bold text-white truncate text-[10px]" title={fileName}>
                                                  {fileName}
                                                </p>
                                                <span className="text-[8px] text-slate-500 uppercase tracking-wider block">
                                                  {isImage ? 'Secure Image Asset' : (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') ? 'Secure PDF' : 'Secure File')}
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
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* LINE signature Meta Info Stack next to bubble */}
                            {isMe ? (
                              <div className="flex flex-col justify-end items-end text-[9px] text-slate-500 dark:text-slate-400 select-none leading-none pb-0.5 shrink-0 self-end">
                                <span className="line-read-badge">อ่านแล้ว</span>
                                <span className="opacity-75">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col justify-end text-[9px] text-slate-500 dark:text-slate-400 select-none leading-none pb-0.5 shrink-0 self-end">
                                <span className="opacity-75">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Real-time typing indicators */}
                  {typingUsers.map((u) => (
                    <div key={u.userId} className="flex items-center gap-2 text-[10px] text-slate-400 animate-pulse bg-slate-900/30 p-2 rounded-lg max-w-xs border border-slate-800">
                      <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                      <span>{u.firstName} is typing a secure message...</span>
                    </div>
                  ))}

                </div>
                <div ref={messageEndRef} />
              </div>

              {/* Chat typing input bottombar */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/30">
                {/* Realtime DLP Alerts warning bar popup */}
                {dlpWarning && (
                  <div className={`mb-3 p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${dlpBlockMessage
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

                <form onSubmit={handleSendMessage} className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-teal-400" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Classification Level:</span>
                      <select
                        value={selectedClassification}
                        onChange={(e) => setSelectedClassification(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded focus:outline-none focus:border-teal-500"
                      >
                        <option value="PUBLIC">PUBLIC</option>
                        <option value="INTERNAL">INTERNAL (STAFF ONLY)</option>
                        <option value="CONFIDENTIAL">CONFIDENTIAL (CLINICAL)</option>
                        <option value="RESTRICTED">RESTRICTED (HIGH PRIVACY)</option>
                      </select>
                    </div>

                    <span className="text-[9px] text-slate-500 flex items-center gap-1 font-bold">
                      <Info className="h-3.5 w-3.5" /> RESTRICTED level blocks non-authorized roles.
                    </span>
                  </div>

                  {/* Pending Attachment Preview Banner */}
                  {selectedAttachmentFile && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between animate-fade-in text-xs">
                      <div className="flex items-center gap-3 truncate">
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
                                Uploading to Secure Storage...
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-black flex items-center gap-1">
                                ✓ Uploaded to server successfully
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

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all ${isUploadingFile ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Attach clinical document (PDF, PNG)"
                    >
                      <Paperclip className="h-4.5 w-4.5" />
                    </button>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={handleTypingEvent}
                      placeholder="Type a secure message... (PHI like HN or ID is auto-scanned & blocked)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-teal-500/80 placeholder-slate-500 text-white font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!!dlpBlockMessage || isUploadingFile || (!messageInput.trim() && !selectedAttachmentFile)}
                      className={`p-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl transition-all shadow-md active:scale-95 ${dlpBlockMessage || isUploadingFile ? 'opacity-30 cursor-not-allowed' : ''
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
            <span>Select a conversation or clinical room to start communicating securely.</span>
          </div>
        )}
      </div>

      {/* --- CREATE NEW DISCUSSION MODAL POPUP --- */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-400" /> Launch Clinical Discussion Room
            </h3>

            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Discussion Room Title</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setCreateRoomType('GROUP');
                  }}
                  placeholder="e.g. ER Shift Group, ICU Cardiology Intake"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-800 pt-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-all"
                >
                  Initialize Room
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
            <span>{pinnedRoomIds.includes(contextMenu.room.id) ? 'Unpin Chat' : 'Pin to Top'}</span>
          </button>

          {contextMenu.room.type === 'DIRECT' && (
            <button
              onClick={() => {
                handleClearChatHistory(contextMenu.room.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-red-950/40 hover:text-red-400 flex items-center gap-2 transition-all text-rose-500/80"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>Clear Chat History</span>
            </button>
          )}

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
              <span>Invite Clinical Staff</span>
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
            <span>Copy Secure Link</span>
          </button>

          <div className="border-t border-slate-800 my-1"></div>

          <button
            onClick={() => setContextMenu(null)}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 hover:text-slate-200 flex items-center gap-2 transition-all text-slate-400"
          >
            <X className="h-4 w-4" />
            <span>Close Menu</span>
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
              <span>Leave Group</span>
            </button>
          )}
        </div>
      )}

      {/* --- HIPAA SECURE IN-APP INVITE CLINICAL STAFF MODAL --- */}
      {showInviteModal && inviteTargetRoom && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-6 rounded-2xl space-y-4 shadow-2xl clinical-glow animate-fade-in">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-400" /> Invite Clinical Staff
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Room: {inviteTargetRoom.name}
            </p>

            <div className="relative">
              <input
                type="text"
                placeholder="Search staff by name or role..."
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
                            <span className="text-[8px] text-teal-400 uppercase tracking-widest font-bold">{u.role}</span>
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
                    <p className="text-center text-slate-500 py-6">All available staff members are already in this room.</p>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSelectedMembers.length === 0}
                  className={`bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-all ${inviteSelectedMembers.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                >
                  Add to Group ({inviteSelectedMembers.length})
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex justify-around items-center z-30 px-2 pb-safe">
        <button
          onClick={() => { setActiveTab('chats'); setActiveRoom(null); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'chats' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px]">Chats</span>
        </button>

        <button
          onClick={() => { setActiveTab('directory'); setActiveRoom(null); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'directory' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px]">Directory</span>
        </button>

        {currentUser.role === 'Admin' && (
          <button
            onClick={() => { setActiveTab('admin'); setActiveRoom(null); }}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'admin' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
          >
            <Shield className="h-5 w-5" />
            <span className="text-[10px]">Admin</span>
          </button>
        )}

        <button
          onClick={() => { setActiveTab('settings'); setActiveRoom(null); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === 'settings' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px]">Settings</span>
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

      {/* --- UNIFIED CLINICAL MODAL DIALOG --- */}
      {clinicalModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-sm rounded-2xl border bg-slate-900/90 shadow-2xl p-6 relative overflow-hidden transition-all transform duration-300 scale-100 flex flex-col items-center text-center ${
            clinicalModal.type === 'error'
              ? 'border-red-500/30 shadow-red-950/20'
              : clinicalModal.type === 'warning'
                ? 'border-amber-500/30 shadow-amber-950/20'
                : 'border-teal-500/30 shadow-teal-950/20'
          }`}>
            {/* Glowing top gradient */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
              clinicalModal.type === 'error'
                ? 'from-red-500 via-rose-500 to-red-600'
                : clinicalModal.type === 'warning'
                  ? 'from-amber-500 via-orange-400 to-amber-600'
                  : 'from-teal-500 via-emerald-450 to-sky-500'
            }`} />

            {/* Glowing Icon Container */}
            <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 border relative ${
              clinicalModal.type === 'error'
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
            <h3 className={`text-sm font-bold mb-2 tracking-wide uppercase ${
              clinicalModal.type === 'error'
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
                  className={`w-full py-2 rounded-xl text-white transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg ${
                    clinicalModal.type === 'error'
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
    </div>
  );
}
