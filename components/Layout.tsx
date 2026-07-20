
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Calendar, ClipboardCheck, User as UserIcon, Users, BarChart2, LogOut, LayoutDashboard, Bell, AlertTriangle } from 'lucide-react';
import { UserRole, TimeRecord } from '../types';
import { useAuth } from '../App';
import { Database } from '../services/database';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeSession, setActiveSession] = useState<TimeRecord | null>(null);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [geofenceDistance, setGeofenceDistance] = useState(0);
  const [geofenceLocation, setGeofenceLocation] = useState('');
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

  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchActiveSession = async () => {
    if (!user || user.role !== UserRole.EMPLOYEE) {
      setActiveSession(null);
      return;
    }
    try {
      const session = await Database.getActiveSession(user.id);
      setActiveSession(session);
    } catch (e) {
      console.error("Error fetching active session in Layout:", e);
    }
  };

  useEffect(() => {
    if (user && user.role === UserRole.EMPLOYEE) {
      fetchActiveSession();
      
      window.addEventListener('downey:shift-changed', fetchActiveSession);
      return () => {
        window.removeEventListener('downey:shift-changed', fetchActiveSession);
      };
    } else {
      setActiveSession(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== UserRole.EMPLOYEE || !activeSession || !activeSession.startLocation) {
      setShowGeofenceModal(false);
      return;
    }

    const startLat = activeSession.startLocation.lat;
    const startLng = activeSession.startLocation.lng;

    if (!startLat || !startLng) return;

    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;

          const distance = getDistanceInMeters(startLat, startLng, currentLat, currentLng);

          if (distance > 200) {
            // Actively set state to show on-screen modal warning
            setGeofenceDistance(distance);
            setGeofenceLocation(activeSession.locationName || 'Starting Location');
            setShowGeofenceModal(true);

            const alertKey = `downey_shift_alert_sent_${activeSession.id}`;
            const alreadySent = localStorage.getItem(alertKey);

            if (!alreadySent) {
              localStorage.setItem(alertKey, 'true');

              try {
                // 1. Send detailed notification to the employee
                await Database.sendNotification({
                  senderId: 'system',
                  senderName: 'Location Tracker',
                  recipientId: user.id,
                  title: '🚨 Geofence Distance Warning',
                  message: `SAFETY DISTANCE WARNING:\nYou have moved ${distance.toFixed(0)} meters away from the authorized starting point for your shift at "${activeSession.locationName}".\n\nClear Instructions for Safe Return:\n1. Stop your current activities immediately.\n2. Return safely towards the authorized work area at "${activeSession.locationName}".\n3. Stay within the 200-meter radius to ensure your shift hours continue to be validated.\n4. In case of GPS signal errors or other unexpected issues, notify your administrative supervisor immediately.`,
                  createdAt: new Date().toISOString(),
                  readBy: []
                });

                // 2. Send specific detailed notification to all administrators
                const allUsers = await Database.getAllUsers();
                const admins = allUsers.filter(u => u.role === UserRole.ADMIN);

                for (const admin of admins) {
                  await Database.sendNotification({
                    senderId: 'system',
                    senderName: 'Location Tracker',
                    recipientId: admin.id,
                    title: `🚨 Alert: Employee Out of Bounds (${user.name})`,
                    message: `ADMINISTRATIVE GEOLOCATION ALERT:\nEmployee ${user.name} (${user.email}) has moved away from the authorized work location for their shift.\n\nRecord Details:\n- Employee: ${user.name}\n- Email: ${user.email}\n- Shift Location: ${activeSession.locationName}\n- Recorded Distance: ${distance.toFixed(0)} meters (Exceeded the allowed radius limit of 200m)\n- Record Time: ${new Date().toLocaleTimeString('en-US')}`,
                    createdAt: new Date().toISOString(),
                    readBy: []
                  });
                }
              } catch (err) {
                console.error("Error dispatching proximity notifications:", err);
              }
            }
          } else {
            // Auto-hide the modal if they return to the safe area
            setShowGeofenceModal(false);
          }
        },
        (error) => {
          console.error("Error watching geolocation in Layout:", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [activeSession, user]);

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
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { name: 'Schedule', path: '/agenda', icon: Calendar, roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
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

      {/* Geofence Alert Modal */}
      {showGeofenceModal && (
        <div className="fixed inset-0 bg-red-950/85 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-8 shadow-2xl border-2 border-red-500 animate-bounce-soft relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
            
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={36} className="text-red-600 animate-pulse" />
            </div>
            
            <h3 className="text-2xl font-black text-red-600 text-center uppercase tracking-tight">
              🚨 Distance Warning!
            </h3>
            
            <p className="text-gray-700 text-center text-sm mt-3 font-semibold leading-relaxed">
              You have moved <span className="text-red-600 font-extrabold text-base underline">{geofenceDistance.toFixed(0)} meters</span> away from the authorized starting point for your shift at <span className="font-extrabold text-gray-900">"{geofenceLocation}"</span>.
            </p>

            <div className="bg-red-50/70 border border-red-100 rounded-2xl p-5 mt-6 space-y-3">
              <h4 className="text-xs font-black uppercase text-red-800 tracking-wider">
                Safety Instructions for Return:
              </h4>
              <ul className="text-xs text-red-700 font-bold space-y-2.5 list-decimal list-inside leading-relaxed">
                <li>Stop your current activities immediately.</li>
                <li>Return safely towards the authorized work location: <span className="underline font-black text-red-800">"{geofenceLocation}"</span>.</li>
                <li>Stay within the 200-meter safety radius to ensure your shift hours continue to be validated.</li>
                <li>In case of unexpected issues or GPS signal failures, notify your administrative supervisor immediately.</li>
              </ul>
            </div>

            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => setShowGeofenceModal(false)}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg transition-all"
              >
                Understood, I am returning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
