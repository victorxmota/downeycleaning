
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { auth, logoutFirebase } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Database } from '../services/database';

interface AuthContextType {
  user: User | null;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth as any, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await Database.syncUser(firebaseUser);
          setUser(appUser);
        } catch (error) {
          console.error("Failed to sync user", error);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await logoutFirebase();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
