
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCs1NAMdvtuiWzbYMohY0aZa2AiS9z8uNw",
  authDomain: "downey-cleaning.firebaseapp.com",
  projectId: "downey-cleaning",
  storageBucket: "downey-cleaning.firebasestorage.app",
  messagingSenderId: "1001041748354",
  appId: "1:1001041748354:web:6f6ea1b637b8be84e2ef9b",
  measurementId: "G-MMZD70R02H"
};

let app;
let auth: any;
let db: any;
let storage: any;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error("Erro ao inicializar serviços do Firebase:", error);
}

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Auth service not initialized");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google login error:", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  if (!auth) throw new Error("Auth service not initialized");
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
};

export const registerWithEmail = async (email: string, pass: string) => {
  if (!auth) throw new Error("Auth service not initialized");
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
};

export const logoutFirebase = async () => {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
};

export { auth, db, storage };
export type FirebaseUser = any;
