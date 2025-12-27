
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Calendar, ClipboardCheck, User as UserIcon, BarChart2, LogOut } from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Schedule', path: '/', icon: Calendar, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { name: 'Check-In', path: '/check-in', icon: ClipboardCheck, roles: [UserRole.EMPLOYEE] },
    { name: 'Reports', path: '/reports', icon: BarChart2, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { name: 'Profile', path: '/profile', icon: UserIcon, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center md:hidden fixed top-0 w-full z-50">
        <h1 className="text-lg font-bold text-brand-600">Downey Cleaning</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform w-64 bg-brand-900 text-white z-40 flex flex-col`}>
        <div className="p-6 border-b border-white/10 hidden md:block">
          <h1 className="text-xl font-bold">Downey Cleaning</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-16 md:mt-0">
          {menuItems.filter(i => i.roles.includes(user?.role as any)).map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition ${isActive(item.path) ? 'bg-brand-600' : 'hover:bg-white/5'}`}>
              <item.icon size={18} /> {item.name}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="p-4 flex items-center gap-3 text-red-400 hover:bg-red-900/20 text-sm border-t border-white/5">
          <LogOut size={18} /> Sign Out
        </button>
      </aside>

      <main className="flex-1 p-6 md:p-10 pt-24 md:pt-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
