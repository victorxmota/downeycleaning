
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
    if (data[key] === undefined) {
      // Skip undefined
    } else if (data[key] === null) {
      if (key === 'readBy') clean[key] = [];
      else if (key === 'recipientId') clean[key] = 'all';
      else clean[key] = null;
    } else if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
      clean[key] = sanitizeData(data[key]);
    } else {
      clean[key] = data[key];
    }
  });
  return clean;
};

export const Database = {
  // Syncs firebase user with firestore user document
  syncUser: async (firebaseUser: FirebaseUser, extraData?: Partial<User>): Promise<User> => {
    const userRef = doc(db, USERS_COL, firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    const isSystemAdmin = firebaseUser.email === ADMIN_EMAIL;

    if (userSnap.exists()) {
      const existingData = userSnap.data() as User;
      if (isSystemAdmin && existingData.role !== UserRole.ADMIN) {
        await updateDoc(userRef, { role: UserRole.ADMIN });
        return { ...existingData, role: UserRole.ADMIN, id: firebaseUser.uid };
      }
      return { ...existingData, id: firebaseUser.uid };
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

  // Updates user information in firestore
  updateUser: async (userId: string, updates: Partial<User>): Promise<void> => {
    const userRef = doc(db, USERS_COL, userId);
    await updateDoc(userRef, sanitizeData(updates));
  },

  // Deletes user from firestore
  deleteUser: async (userId: string): Promise<void> => {
    const userRef = doc(db, USERS_COL, userId);
    await deleteDoc(userRef);
  },

  // Find a user by their UID/Account ID
  getUserByAccountId: async (accountId: string): Promise<User | null> => {
    const userRef = doc(db, USERS_COL, accountId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return { ...userSnap.data(), id: userSnap.id } as User;
    }
    return null;
  },

  // Get all registered users
  getAllUsers: async (): Promise<User[]> => {
    const q = query(collection(db, USERS_COL));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as User));
  },

  // Notifications logic
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
      console.error("Database: Error saving notification:", error);
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
        .map(doc => {
          const data = doc.data();
          return { 
            ...data, 
            id: doc.id,
            readBy: Array.isArray(data.readBy) ? data.readBy : [] 
          } as AppNotification;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error("Database: Error fetching received notifications:", error);
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
        .map(doc => {
          const data = doc.data();
          return { 
            ...data, 
            id: doc.id,
            readBy: Array.isArray(data.readBy) ? data.readBy : []
          } as AppNotification;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error("Database: Error fetching sent notifications:", error);
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
    }
  },

  deleteNotification: async (notificationId: string): Promise<void> => {
    const docRef = doc(db, NOTIFICATIONS_COL, notificationId);
    await deleteDoc(docRef);
    notifyNotificationChange();
  },

  // Offices management
  getOffices: async (): Promise<Office[]> => {
    const q = query(collection(db, OFFICES_COL));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Office));
  },

  addOffice: async (office: Omit<Office, 'id'>): Promise<void> => {
    await addDoc(collection(db, OFFICES_COL), sanitizeData(office));
  },

  deleteOffice: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, OFFICES_COL, id));
  },

  // Schedules management
  getSchedulesByUser: async (userId: string): Promise<ScheduleItem[]> => {
    const q = query(collection(db, SCHEDULES_COL), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ScheduleItem));
  },

  addSchedule: async (schedule: Omit<ScheduleItem, 'id'>): Promise<void> => {
    await addDoc(collection(db, SCHEDULES_COL), sanitizeData(schedule));
  },

  updateSchedule: async (id: string, updates: Partial<ScheduleItem>): Promise<void> => {
    await updateDoc(doc(db, SCHEDULES_COL, id), sanitizeData(updates));
  },

  deleteSchedule: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, SCHEDULES_COL, id));
  },

  // Shift records logic
  getActiveSession: async (userId: string): Promise<TimeRecord | null> => {
    const q = query(
      collection(db, RECORDS_COL), 
      where("userId", "==", userId), 
      where("endTime", "==", null)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as TimeRecord;
    }
    return null;
  },

  startShift: async (record: Omit<TimeRecord, 'id' | 'photoUrl'>, photo?: File): Promise<TimeRecord> => {
    let photoUrl = "";
    if (photo) {
      const storageRef = ref(storage, `shifts/${Date.now()}_${photo.name}`);
      await uploadBytes(storageRef, photo);
      photoUrl = await getDownloadURL(storageRef);
    }
    
    const data = { ...record, photoUrl, endTime: null, totalPausedMs: 0, isPaused: false };
    const docRef = await addDoc(collection(db, RECORDS_COL), sanitizeData(data));
    return { ...data, id: docRef.id } as TimeRecord;
  },

  togglePause: async (session: TimeRecord): Promise<TimeRecord> => {
    const now = new Date().toISOString();
    let updates: any = {};
    
    if (session.isPaused) {
      const pausedAt = new Date(session.pausedAt!).getTime();
      const currentPauseDuration = Date.now() - pausedAt;
      updates = {
        isPaused: false,
        pausedAt: null,
        totalPausedMs: (session.totalPausedMs || 0) + currentPauseDuration
      };
    } else {
      updates = {
        isPaused: true,
        pausedAt: now
      };
    }
    
    await updateDoc(doc(db, RECORDS_COL, session.id), updates);
    return { ...session, ...updates };
  },

  endShift: async (id: string, updates: Partial<TimeRecord>, photo?: File): Promise<void> => {
    let endPhotoUrl = "";
    if (photo) {
      const storageRef = ref(storage, `shifts/end_${Date.now()}_${photo.name}`);
      await uploadBytes(storageRef, photo);
      endPhotoUrl = await getDownloadURL(storageRef);
    }
    
    const finalUpdates = { ...updates, endPhotoUrl, isPaused: false };
    await updateDoc(doc(db, RECORDS_COL, id), sanitizeData(finalUpdates));
  },

  getAllRecords: async (): Promise<TimeRecord[]> => {
    const q = query(collection(db, RECORDS_COL), orderBy("startTime", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimeRecord));
  },

  getRecordsByUser: async (userId: string): Promise<TimeRecord[]> => {
    const q = query(
      collection(db, RECORDS_COL), 
      where("userId", "==", userId),
      orderBy("startTime", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimeRecord));
  },

  updateRecord: async (id: string, updates: Partial<TimeRecord>): Promise<void> => {
    await updateDoc(doc(db, RECORDS_COL, id), sanitizeData(updates));
  },

  deleteRecord: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, RECORDS_COL, id));
  },

  addRecord: async (record: Omit<TimeRecord, 'id'>): Promise<void> => {
    await addDoc(collection(db, RECORDS_COL), sanitizeData(record));
  }
};
