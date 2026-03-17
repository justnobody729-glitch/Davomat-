export interface Student {
  id: string;
  name: string;
  class: string;
  parentId: string;
  studentId: string;
  createdAt: string;
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  telegramChatId?: string;
  studentIds: string[];
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  timestamp: any;
  exitTimestamp?: any;
  status: 'arrived' | 'late' | 'left' | 'early_exit';
  type: 'entry' | 'exit';
  userType: 'student' | 'teacher';
}

export interface Class {
  id: string;
  name: string;
  classTeacher: string;
  weeklyHours: number;
  dailySchedule: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
  };
  startTime: string;
  endTime: string;
  createdAt?: any;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'director' | 'admin' | 'staff';
  isPreRegistered?: boolean;
}
