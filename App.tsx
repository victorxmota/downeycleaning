
import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from './types';
import { Database } from './services/database';
import { auth, logoutFirebase } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { CheckIn } from './pages/CheckIn';
import { Reports } from './pages/Reports';
import { Profile } from './pages/Profile';
import { Users } from './pages/Users';
import { ShieldAlert } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles?: UserRole[] }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  if (!auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full border border-red-100">
            <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="text-red-600 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Configuração Pendente</h1>
            <p className="text-gray-600 mb-6">
                O aplicativo não encontrou as chaves de API do Firebase.
            </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth as any, async (firebaseUser) => {
      // Definimos como true sempre que houver uma mudança de estado para evitar redirecionamentos precoces
      setIsLoading(true);
      
      if (firebaseUser) {
        try {
          const appUser = await Database.syncUser(firebaseUser);
          setUser(appUser);
        } catch (error) {
          console.error("Failed to sync user", error);
          setUser(null);
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
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
          <Route path="/check-in" element={<ProtectedRoute allowedRoles={[UserRole.EMPLOYEE]}><CheckIn /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><Users /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;
