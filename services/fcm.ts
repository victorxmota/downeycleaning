import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCs1NAMdvtuiWzbYMohY0aZa2AiS9z8uNw",
  authDomain: "downey-cleaning.firebaseapp.com",
  projectId: "downey-cleaning",
  storageBucket: "downey-cleaning.firebasestorage.app",
  messagingSenderId: "1001041748354",
  appId: "1:1001041748354:web:6f6ea1b637b8be84e2ef9b",
  measurementId: "G-MMZD70R02H"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messagingInstance: Messaging | null = null;

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn("FCM is not supported in this environment:", err);
  }
  return null;
};

export const registerFCMServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/"
    });
    console.log("FCM Service Worker registered successfully:", registration);
    return registration;
  } catch (error) {
    console.warn("Service Worker registration failed:", error);
    return null;
  }
};

export const requestFCMToken = async (): Promise<{ permission: NotificationPermission; token: string | null }> => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { permission: "denied", token: null };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { permission, token: null };
    }

    const swRegistration = await registerFCMServiceWorker();
    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      return { permission, token: null };
    }

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration || undefined
    }).catch(err => {
      console.warn("Could not retrieve FCM token:", err);
      return null;
    });

    return { permission, token };
  } catch (error) {
    console.error("Error requesting FCM token:", error);
    return { permission: "denied", token: null };
  }
};

export const initForegroundFCMListener = async (onMessageReceived: (payload: any) => void) => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log("Received foreground FCM message:", payload);
    const title = payload.notification?.title || payload.data?.title || "New Notification";
    const body = payload.notification?.body || payload.data?.message || "";

    // Trigger local push notification banner if allowed
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/assets/downey-logo.png"
        });
      } catch (e) {
        console.warn("Could not spawn native notification", e);
      }
    }

    onMessageReceived(payload);
  });
};

export const sendDevicePushNotification = (title: string, message: string) => {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: message,
        icon: "/assets/downey-logo.png",
        badge: "/assets/downey-logo.png"
      });
    } catch (e) {
      console.warn("Native Notification trigger fallback:", e);
    }
  }
};
