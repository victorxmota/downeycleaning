import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  limit,
  arrayUnion
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import type { FirebaseUser } from "./firebase";
import { User, UserRole, ScheduleItem, TimeRecord, Office, AppNotification } from "../types";

const USERS_COL = 'users';
const SCHEDULES_COL = 'schedules';
const OFFICES_COL = 'offices';
const RECORDS_COL = 'records';
const NOTIFICATIONS_COL = 'notifications';

const ADMIN_EMAIL = 'adminreports@downeycleaning.ie';

// Helper to notify other components of notification changes
const notifyNotificationChange = () => {
  window.dispatchEvent(new CustomEvent('downey:notifications-updated'));
};

const sanitizeData = (data: any) => {
  const clean: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] === undefined || data[key] === null) {
      if (key === 'readBy') clean[key] = [];
      else if (key === 'recipientId') clean[key] = 'all';
    } else if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
      clean[key] = sanitizeData(data[key]);
    } else {
      clean[key] = data[key];
    }
  });
  return clean;
};

export const Database = {
  syncUser: async (firebaseUser: FirebaseUser, extraData?: Partial<User>): Promise<User> => {
    const userRef = doc(db, USERS_COL, firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    const isSystemAdmin = firebaseUser.email === ADMIN_EMAIL;

    if (userSnap.exists()) {
      const existingData = userSnap.data() as User;
      if (isSystemAdmin && existingData.role !== UserRole.ADMIN) {
        await updateDoc(userRef, { role: UserRole.ADMIN });
        return { ...existingData, role: UserRole.ADMIN };
      }
      return existingData;
    } else {
      const newUser: User = {
        id: firebaseUser.uid,
        name: extraData?.name || firebaseUser.displayName || (isSystemAdmin ? 'System Admin' : 'New User'),
        email: firebaseUser.email || '',
        role: isSystemAdmin ? UserRole.ADMIN : (extraData?.role || UserRole.EMPLOYEE),
        pps: extraData?.pps || '',
        phone: extraData?.phone || '',
      };
      await setDoc(userRef, sanitizeData(newUser));
      return newUser;
    }
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<void> => {
    const userRef = doc(db, USERS_COL, userId);
    await updateDoc(userRef, sanitizeData(updates));
  },

  deleteUser: async (userId: string): Promise<void> => {
    const userRef = doc(db, USERS_COL, userId);
    await deleteDoc(userRef);
  },

  getUserByAccountId: async (accountId: string): Promise<User | null> => {
    const userRef = doc(db, USERS_COL, accountId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data() as User;
    }
    return null;
  },

  getAllUsers: async (): Promise<User[]> => {
    const q = query(collection(db, USERS_COL));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as User));
  },

  sendNotification: async (notification: Omit<AppNotification, 'id'>) => {
    try {
      const dataToSave = {
        senderId: notification.senderId,
        senderName: notification.senderName,
        recipientId: notification.recipientId || 'all',
        title: notification.title.trim(),
        message: notification.message.trim(),
        createdAt: notification.createdAt || new Date().toISOString(),
        readBy: []
      };

      const docRef = await addDoc(collection(db, NOTIFICATIONS_COL), dataToSave);
      notifyNotificationChange();
      return docRef;
    } catch (error: any) {
      console.error("Database: Erro ao gravar notificação:", error);
      throw error;
    }
  },

  getNotificationsForUser: async (userId: string): Promise<AppNotification[]> => {
    if (!userId) return [];
    try {
      const q = query(
        collection(db, NOTIFICATIONS_COL), 
        where("recipientId", "in", [userId, "all"]),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => ({ ...doc.data() as any, id: doc.id } as AppNotification))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error("Database: Erro ao buscar notificações recebidas:", error);
      return [];
    }
  },

  getSentNotifications: async (adminId: string): Promise<AppNotification[]> => {
    try {
      const q = query(
        collection(db, NOTIFICATIONS_COL),
        where("senderId", "==", adminId),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => ({ ...doc.data() as any, id: doc.id } as AppNotification))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error("Database: Erro ao buscar notificações enviadas:", error);
      return [];
    }
  },

  markNotificationAsRead: async (notificationId: string, userId: string) => {
    if (!userId || !notificationId) return;
    try {
      const docRef = doc(db, NOTIFICATIONS_COL, notificationId);
      await updateDoc(docRef, {
        readBy: arrayUnion(userId)
      });
      notifyNotificationChange();
    } catch (error) {
      console.error("Database: Error marking notification as read:", error);
      throw error;
    }
  },

  deleteNotification: async (id: string) => {
    try {
      const docRef = doc(db, NOTIFICATIONS_COL, id);
      await deleteDoc(docRef);
      notifyNotificationChange();
    } catch (error: any) {
      console.error("Database: Erro ao excluir notificação:", error);
      throw error;
    }
  },

  getSchedulesByUser: async (userId: string): Promise<ScheduleItem[]> => {
    const q = query(collection(db, SCHEDULES_COL), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as ScheduleItem));
  },

  addSchedule: async (schedule: Omit<ScheduleItem, 'id'>) => {
    await addDoc(collection(db, SCHEDULES_COL), sanitizeData(schedule));
  },

  updateSchedule: async (id: string, updates: Partial<ScheduleItem>) => {
    const docRef = doc(db, SCHEDULES_COL, id);
    await updateDoc(docRef, sanitizeData(updates));
  },

  deleteSchedule: async (id: string) => {
    await deleteDoc(doc(db, SCHEDULES_COL, id));
  },

  getOffices: async (): Promise<Office[]> => {
    const querySnapshot = await getDocs(collection(db, OFFICES_COL));
    return querySnapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as Office));
  },

  addOffice: async (office: Omit<Office, 'id'>) => {
    await addDoc(collection(db, OFFICES_COL), sanitizeData(office));
  },

  deleteOffice: async (id: string) => {
    await deleteDoc(doc(db, OFFICES_COL, id));
  },

  getActiveSession: async (userId: string): Promise<TimeRecord | null> => {
    const q = query(collection(db, RECORDS_COL), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const active = querySnapshot.docs
      .map(doc => ({ ...doc.data() as any, id: doc.id } as TimeRecord))
      .find(r => !r.endTime);
    return active || null;
  },

  getAllRecords: async (): Promise<TimeRecord[]> => {
    const querySnapshot = await getDocs(collection(db, RECORDS_COL));
    return querySnapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as TimeRecord));
  },

  getRecordsByUser: async (userId: string): Promise<TimeRecord[]> => {
    const q = query(collection(db, RECORDS_COL), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id } as TimeRecord));
  },

  startShift: async (record: Omit<TimeRecord, 'id' | 'photoUrl'>, photoFile?: File): Promise<TimeRecord> => {
    let photoUrl = null;
    if (photoFile) {
        photoUrl = await Database.uploadFile(photoFile, `shifts/${record.userId}/start_${Date.now()}`);
    }
    const finalData = sanitizeData({ ...record, photoUrl, isPaused: false, totalPausedMs: 0 });
    const docRef = await addDoc(collection(db, RECORDS_COL), finalData);
    return { ...finalData, id: docRef.id };
  },

  togglePause: async (record: TimeRecord): Promise<TimeRecord> => {
    const docRef = doc(db, RECORDS_COL, record.id);
    const now = new Date().toISOString();
    let updates: Partial<TimeRecord> = {};
    if (record.isPaused) {
      const pausedAt = new Date(record.pausedAt!).getTime();
      const currentPauseDuration = Date.now() - pausedAt;
      const totalPausedMs = (record.totalPausedMs || 0) + currentPauseDuration;
      updates = { isPaused: false, pausedAt: undefined, totalPausedMs: totalPausedMs };
    } else {
      updates = { isPaused: true, pausedAt: now };
    }
    await updateDoc(docRef, sanitizeData(updates));
    return { ...record, ...updates };
  },

  endShift: async (recordId: string, updates: Partial<TimeRecord>, photoFile?: File) => {
    const dataToUpdate: any = { ...updates };
    if (photoFile) {
        const photoUrl = await Database.uploadFile(photoFile, `shifts/end_${recordId}_${Date.now()}`);
        dataToUpdate.endPhotoUrl = photoUrl;
    }
    const docRef = doc(db, RECORDS_COL, recordId);
    await updateDoc(docRef, sanitizeData(dataToUpdate));
  },

  updateRecord: async (recordId: string, updates: Partial<TimeRecord>) => {
    const docRef = doc(db, RECORDS_COL, recordId);
    await updateDoc(docRef, sanitizeData(updates));
  },

  deleteRecord: async (recordId: string) => {
    const docRef = doc(db, RECORDS_COL, recordId);
    await deleteDoc(docRef);
  },

  addRecord: async (record: Omit<TimeRecord, 'id'>) => {
    await addDoc(collection(db, RECORDS_COL), sanitizeData(record));
  },

  uploadFile: async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  }
};