
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Calendar, ClipboardCheck, User as UserIcon, Users, BarChart2, LogOut, LayoutDashboard, Bell, AlertTriangle, ArrowRight } from 'lucide-react';
import { UserRole, TimeRecord } from '../types';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { registerFCMServiceWorker, requestFCMToken, initForegroundFCMListener } from '../services/fcm';

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
  const [activeToast, setActiveToast] = useState<{ title: string; message: string } | null>(null);
  const isAutoCheckingOutRef = useRef(false);
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
      
      // Register FCM service worker and fetch token if permitted
      registerFCMServiceWorker();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        requestFCMToken().then(({ token }) => {
          if (token && user.id) {
            Database.saveUserFcmToken(user.id, token);
          }
        }).catch(err => console.warn("FCM Auto Init error:", err));
      }

      let cleanupFCM = () => {};
      initForegroundFCMListener(() => {
        fetchUnread();
      }).then(unsub => {
        cleanupFCM = unsub;
      });

      // Listen for notification changes anywhere in the app
      window.addEventListener('downey:notifications-updated', fetchUnread);

      const handleToast = (e: Event) => {
        const customEvent = e as CustomEvent;
        const detail = customEvent.detail;
        if (!detail) return;
        
        if (detail.recipientId === 'all' || detail.recipientId === user?.id || user?.role === UserRole.ADMIN) {
          setActiveToast({
            title: detail.title || 'New Notification',
            message: detail.message || ''
          });
        }
      };

      window.addEventListener('downey:toast-notification', handleToast);
      
      const interval = setInterval(fetchUnread, 60000); // Background check every minute
      return () => {
        clearInterval(interval);
        cleanupFCM();
        window.removeEventListener('downey:notifications-updated', fetchUnread);
        window.removeEventListener('downey:toast-notification', handleToast);
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
    isAutoCheckingOutRef.current = false;
  }, [activeSession?.id]);

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
          if (isAutoCheckingOutRef.current) return;

          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;

          const distance = getDistanceInMeters(startLat, startLng, currentLat, currentLng);

          if (distance > 1000) {
            // 1. Automatic Checkout (> 1 km / 1000 meters)
            isAutoCheckingOutRef.current = true;
            try {
              const sessionId = activeSession.id;
              const sessionLocation = activeSession.locationName;
              const existingNotes = activeSession.notes ? activeSession.notes + '\n' : '';
              const autoCheckoutNote = `${existingNotes}[Automatic checkout triggered: Distance > 1 km (${distance.toFixed(0)}m)]`;

              // End shift in database
              await Database.endShift(sessionId, {
                endTime: new Date().toISOString(),
                endLocation: { lat: currentLat, lng: currentLng },
                isPaused: false,
                notes: autoCheckoutNote
              });

              // Clean up alert flags and update state IMMEDIATELY
              const alertKey500 = `downey_shift_alert_500m_sent_${sessionId}`;
              localStorage.removeItem(alertKey500);

              setActiveSession(null);
              setShowGeofenceModal(false);
              window.dispatchEvent(new CustomEvent('downey:shift-changed'));

              // Send notifications asynchronously without blocking checkout completion
              try {
                // Notification for employee
                await Database.sendNotification({
                  senderId: 'system',
                  senderName: 'Location Tracker',
                  recipientId: user.id,
                  title: '🚨 Automatic Checkout Completed',
                  message: `Attention: Your shift at "${sessionLocation}" was automatically checked out because you moved ${distance.toFixed(0)}m (${(distance / 1000).toFixed(2)} km) away from the check-in point (exceeded 1 km maximum radius).`,
                  createdAt: new Date().toISOString(),
                  readBy: []
                });

                // Notification for admins
                const allUsers = await Database.getAllUsers();
                const admins = allUsers.filter(u => u.role === UserRole.ADMIN);

                for (const admin of admins) {
                  await Database.sendNotification({
                    senderId: 'system',
                    senderName: 'Location Tracker',
                    recipientId: admin.id,
                    title: `🚨 Automatic Checkout: ${user.name} (> 1 km)`,
                    message: `ADMINISTRATIVE GEOLOCATION ALERT:\nEmployee ${user.name} (${user.email}) had an AUTOMATIC CHECKOUT triggered after moving more than 1 km away from their shift location.\n\nRecord Details:\n- Employee: ${user.name}\n- Email: ${user.email}\n- Shift Location: ${sessionLocation}\n- Recorded Distance: ${distance.toFixed(0)} meters (${(distance / 1000).toFixed(2)} km)\n- Automatic Checkout Time: ${new Date().toLocaleTimeString('en-US')}`,
                    createdAt: new Date().toISOString(),
                    readBy: []
                  });
                }
              } catch (notifErr) {
                console.error("Error sending auto-checkout notifications:", notifErr);
              }
            } catch (err) {
              console.error("Error during automatic checkout:", err);
              isAutoCheckingOutRef.current = false;
            }
          } else if (distance > 500) {
            // 2. Single Warning Notification when exceeding 500m (no recurring notifications)
            const alertKey500 = `downey_shift_alert_500m_sent_${activeSession.id}`;
            const alertSent = localStorage.getItem(alertKey500);

            if (!alertSent) {
              localStorage.setItem(alertKey500, 'true');

              try {
                // Single notification to employee
                await Database.sendNotification({
                  senderId: 'system',
                  senderName: 'Location Tracker',
                  recipientId: user.id,
                  title: '🚨 Geofence Distance Warning (500m)',
                  message: `Attention: You have moved ${distance.toFixed(0)}m away from the starting point of your shift "${activeSession.locationName}". Please remain within the 500m safety radius. Exceeding 1 km will trigger an automatic checkout.`,
                  createdAt: new Date().toISOString(),
                  readBy: []
                });

                // Single notification to administrators
                const allUsers = await Database.getAllUsers();
                const admins = allUsers.filter(u => u.role === UserRole.ADMIN);

                for (const admin of admins) {
                  await Database.sendNotification({
                    senderId: 'system',
                    senderName: 'Location Tracker',
                    recipientId: admin.id,
                    title: `🚨 Alert: Employee Out of Bounds (${user.name})`,
                    message: `ADMINISTRATIVE GEOLOCATION ALERT:\nEmployee ${user.name} (${user.email}) has moved ${distance.toFixed(0)}m away from the authorized work location for their shift (exceeded 500m radius).\n\nRecord Details:\n- Employee: ${user.name}\n- Email: ${user.email}\n- Shift Location: ${activeSession.locationName}\n- Recorded Distance: ${distance.toFixed(0)} meters (Radius limit: 500m, Auto-checkout: 1km)\n- Record Time: ${new Date().toLocaleTimeString('en-US')}`,
                    createdAt: new Date().toISOString(),
                    readBy: []
                  });
                }
              } catch (err) {
                console.error("Error dispatching 500m proximity notifications:", err);
              }
            }
          } else {
            // 3. Reset lock when employee returns within 500 meters
            const alertKey500 = `downey_shift_alert_500m_sent_${activeSession.id}`;
            localStorage.removeItem(alertKey500);
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

      {/* Floating Toast Notification Alert */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-sm w-[calc(100vw-40px)] bg-brand-900 text-white p-5 rounded-2xl shadow-2xl border-2 border-amber-400 animate-slide-down flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
              <Bell size={16} className="animate-bounce" />
              <span>New Notification</span>
            </div>
            <button 
              onClick={() => setActiveToast(null)} 
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
          <h4 className="font-extrabold text-sm text-white line-clamp-1">{activeToast.title}</h4>
          <p className="text-xs text-brand-100 line-clamp-2 leading-relaxed">{activeToast.message}</p>
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                setActiveToast(null);
                navigate('/notifications');
              }}
              className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <span>View Notifications</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
