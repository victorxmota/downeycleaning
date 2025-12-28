import { User, UserRole, ScheduleItem, TimeRecord, Office } from '../types';
import { FirebaseUser } from './firebase';

// Initial Seed Data
const INITIAL_USERS: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@clean.com',
    role: UserRole.ADMIN,
    pps: '1234567A',
    phone: '+1 555 0001',
    password: '123'
  },
  {
    id: '2',
    name: 'John Doe',
    email: 'john@clean.com',
    role: UserRole.EMPLOYEE,
    pps: '9876543B',
    phone: '+1 555 0002',
    password: '123'
  },
  {
    id: '3',
    name: 'Jane Smith',
    email: 'jane@clean.com',
    role: UserRole.EMPLOYEE,
    pps: '4567890C',
    phone: '+1 555 0003',
    password: '123'
  }
];

const INITIAL_SCHEDULES: ScheduleItem[] = [
  { id: 's1', userId: '2', locationName: 'Tech Corp Office', address: '123 Tech Blvd', dayOfWeek: 1, hoursPerDay: 4 }, // Mon
  { id: 's2', userId: '2', locationName: 'Tech Corp Office', address: '123 Tech Blvd', dayOfWeek: 3, hoursPerDay: 4 }, // Wed
  { id: 's3', userId: '2', locationName: 'Tech Corp Office', address: '123 Tech Blvd', dayOfWeek: 5, hoursPerDay: 4 }, // Fri
  { id: 's4', userId: '3', locationName: 'Downtown Mall', address: '456 Main St', dayOfWeek: 2, hoursPerDay: 6 }, // Tue
  { id: 's5', userId: '3', locationName: 'Downtown Mall', address: '456 Main St', dayOfWeek: 4, hoursPerDay: 6 }, // Thu
];

// LocalStorage Keys
const KEYS = {
  USERS: 'clean_app_users',
  SCHEDULES: 'clean_app_schedules',
  RECORDS: 'clean_app_records',
  ACTIVE_SESSION: 'clean_app_active_session',
  OFFICES: 'clean_app_offices'
};

// Helper to initialize DB
const initDB = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(KEYS.SCHEDULES)) {
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(INITIAL_SCHEDULES));
  }
  if (!localStorage.getItem(KEYS.RECORDS)) {
    localStorage.setItem(KEYS.RECORDS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.OFFICES)) {
    localStorage.setItem(KEYS.OFFICES, JSON.stringify([]));
  }
};

export const MockDB = {
  init: initDB,

  getUsers: (): User[] => {
    return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  },

  getUserById: (id: string): User | undefined => {
    const users = MockDB.getUsers();
    return users.find(u => u.id === id);
  },

  // Novo método para integrar com Firebase
  findOrCreateGoogleUser: (firebaseUser: FirebaseUser): User => {
    const users = MockDB.getUsers();
    let user = users.find(u => u.email === firebaseUser.email);

    if (!user) {
      // Cria um novo usuário funcionário se não existir
      user = {
        id: firebaseUser.uid, // Usa o ID do Firebase
        name: firebaseUser.displayName || 'Google User',
        email: firebaseUser.email || '',
        role: UserRole.EMPLOYEE, // Padrão: Funcionário
        pps: 'Update Profile',
        phone: 'Update Profile',
        // Sem senha pois é auth social
      };
      users.push(user);
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    }
    
    return user;
  },

  getSchedules: (): ScheduleItem[] => {
    return JSON.parse(localStorage.getItem(KEYS.SCHEDULES) || '[]');
  },

  getSchedulesByUser: (userId: string): ScheduleItem[] => {
    return MockDB.getSchedules().filter(s => s.userId === userId);
  },

  addSchedule: (schedule: ScheduleItem) => {
    const schedules = MockDB.getSchedules();
    schedules.push(schedule);
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
  },

  deleteSchedule: (id: string) => {
    const schedules = MockDB.getSchedules().filter(s => s.id !== id);
    localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules));
  },

  getTimeRecords: (): TimeRecord[] => {
    return JSON.parse(localStorage.getItem(KEYS.RECORDS) || '[]');
  },

  getTimeRecordsByUser: (userId: string): TimeRecord[] => {
    return MockDB.getTimeRecords().filter(r => r.userId === userId);
  },

  saveTimeRecord: (record: TimeRecord) => {
    const records = MockDB.getTimeRecords();
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  },

  getActiveSession: (): TimeRecord | null => {
    const session = localStorage.getItem(KEYS.ACTIVE_SESSION);
    return session ? JSON.parse(session) : null;
  },

  setActiveSession: (record: TimeRecord | null) => {
    if (record) {
      localStorage.setItem(KEYS.ACTIVE_SESSION, JSON.stringify(record));
    } else {
      localStorage.removeItem(KEYS.ACTIVE_SESSION);
    }
  },

  // Offices Methods
  getOffices: (): Office[] => {
    return JSON.parse(localStorage.getItem(KEYS.OFFICES) || '[]');
  },

  addOffice: (office: Office) => {
    const offices = MockDB.getOffices();
    offices.push(office);
    localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
  },

  deleteOffice: (id: string) => {
    const offices = MockDB.getOffices().filter(o => o.id !== id);
    localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
  }
};

// Initialize immediately
initDB();
