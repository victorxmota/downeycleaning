
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Calendar, ClipboardCheck, User as UserIcon, Users, BarChart2, LogOut, LayoutDashboard, Bell } from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../App';
import { Database } from '../services/database';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const fetchUnread = async () => {
    if (!user) return;
    try {
      const notifications = await Database.getNotificationsForUser(user.id);
      const unread = notifications.filter(n => {
        const readBy = Array.isArray(n.readBy) ? n.readBy : [];
        return !readBy.includes(user.id);
      });
      setUnreadCount(unread.length);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnread();
      
      // Listen for notification changes anywhere in the app
      window.addEventListener('downey:notifications-updated', fetchUnread);
      
      const interval = setInterval(fetchUnread, 60000); // Background check every minute
      return () => {
        clearInterval(interval);
        window.removeEventListener('downey:notifications-updated', fetchUnread);
      };
    }
  }, [user]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: [UserRole.ADMIN] },
    { name: 'Schedule', path: user?.role === UserRole.ADMIN ? '/agenda' : '/', icon: Calendar, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { name: 'Check-In/Out', path: '/check-in', icon: ClipboardCheck, roles: [UserRole.EMPLOYEE] },
    { name: 'Notifications', path: '/notifications', icon: Bell, roles: [UserRole.ADMIN, UserRole.EMPLOYEE], badge: unreadCount },
    { name: 'Users', path: '/users', icon: Users, roles: [UserRole.ADMIN] },
    { name: 'Reports', path: '/reports', icon: BarChart2, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { name: 'Profile', path: '/profile', icon: UserIcon, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center md:hidden sticky top-0 z-20">
        <h1 className="text-xl font-bold text-brand-600">Downey Cleaning</h1>
        <div className="flex items-center gap-2">
           {unreadCount > 0 && (
             <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                {unreadCount}
             </div>
           )}
           <button onClick={toggleSidebar} className="p-2 text-gray-600">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside 
        className={`
          fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
          w-64 bg-brand-900 text-white shadow-xl z-30 flex flex-col
        `}
      >
        <div className="p-6 border-b border-brand-700 hidden md:block">
          <h1 className="text-2xl font-black tracking-tight text-white">Downey</h1>
          <p className="text-brand-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">Cleaning Services</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.filter(item => item.roles.includes(user?.role as UserRole)).map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                isActive(item.path) 
                  ? 'bg-brand-600 text-white shadow-lg' 
                  : 'text-brand-100 hover:bg-brand-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon size={20} className={isActive(item.path) ? 'text-white' : 'text-brand-400'} />
                <span className="font-bold text-sm">{item.name}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-700">
          <div className="mb-4 px-4">
             <p className="text-[10px] font-black uppercase text-brand-400 tracking-widest">Logged as</p>
             <p className="text-xs font-bold truncate text-white">{user?.name}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-200 hover:bg-red-900/40 hover:text-red-100 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-bold text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen">
        <div className="max-w-6xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
