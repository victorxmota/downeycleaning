
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { AppNotification, User, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  Bell, 
  Send, 
  Trash2, 
  Users, 
  User as UserIcon, 
  Clock, 
  Loader2, 
  Mail,
  ChevronRight,
  Megaphone,
  UserCheck,
  Search,
  X,
  CheckCircle2,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  
  // Custom Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Recipient Search State
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Admin Form State
  const [newNotif, setNewNotif] = useState({
    recipientId: 'all',
    recipientName: 'All Staff (Broadcast)',
    title: '',
    message: ''
  });

  const isAdmin = user?.role === UserRole.ADMIN;

  const loadData = async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setIsLoading(true);
    try {
      if (activeTab === 'received') {
        const data = await Database.getNotificationsForUser(user.id);
        setNotifications(data);
      } else {
        const data = await Database.getSentNotifications(user.id);
        setNotifications(data);
      }
    } catch (e) {
      console.error("Error loading notifications data:", e);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (isAdmin) {
      loadUsers();
    }
    
    // Escuta por atualizações globais de notificações
    const handleUpdate = () => loadData(false);
    window.addEventListener('downey:notifications-updated', handleUpdate);
    
    return () => {
      window.removeEventListener('downey:notifications-updated', handleUpdate);
    };
  }, [user, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await Database.getAllUsers();
      const filtered = allUsers.filter(u => u.id && u.id !== user?.id);
      setAllUsersList(filtered);
    } catch (e) {
      console.error("Error loading users for notification:", e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newNotif.title.trim() || !newNotif.message.trim()) {
      alert("Please enter both a subject and a message.");
      return;
    }

    setIsSending(true);

    try {
      const payload = {
        senderId: user.id,
        senderName: user.name,
        recipientId: newNotif.recipientId,
        title: newNotif.title.trim(),
        message: newNotif.message.trim(),
        createdAt: new Date().toISOString(),
        readBy: []
      };

      await Database.sendNotification(payload);
      
      setNewNotif({ 
        recipientId: 'all', 
        recipientName: 'All Staff (Broadcast)',
        title: '', 
        message: '' 
      });
      setRecipientSearch('');
      setIsSending(false);
      
      alert('Notification dispatched successfully!');
      
      if (activeTab === 'sent') {
        loadData();
      } else {
        setActiveTab('sent'); 
      }
      
    } catch (error: any) {
      console.error("HandleSend: Erro capturado no componente:", error);
      setIsSending(false);
      alert(error.message || "Failed to send notification.");
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!user || activeTab === 'sent') return;
    
    const notif = notifications.find(n => n.id === id);
    const readBy = Array.isArray(notif?.readBy) ? notif!.readBy : [];
    
    if (notif && !readBy.includes(user.id)) {
      try {
        // Optimistic update for UI responsiveness
        setNotifications(prev => prev.map(n => 
          n.id === id ? { ...n, readBy: [...readBy, user.id] } : n
        ));
        
        // Update database
        await Database.markNotificationAsRead(id, user.id);
      } catch (e) {
        console.error("Error marking as read:", e);
        loadData(false);
      }
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      await Database.deleteNotification(itemToDelete);
      setNotifications(prev => prev.filter(n => n.id !== itemToDelete));
      setItemToDelete(null);
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      alert(`Failed to delete: ${error.message || 'Permission Denied'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectRecipient = (id: string, name: string) => {
    setNewNotif(prev => ({ ...prev, recipientId: id, recipientName: name }));
    setIsDropdownOpen(false);
    setRecipientSearch('');
  };

  const filteredRecipients = allUsersList.filter(u => {
    const search = recipientSearch.toLowerCase();
    return (u.name || '').toLowerCase().includes(search) || 
           (u.email || '').toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-brand-900 tracking-tight flex items-center gap-3">
            <Bell className="text-brand-600" /> Notifications Center
          </h2>
          <p className="text-xs text-brand-600 font-bold uppercase tracking-widest mt-1">Official Communications</p>
        </div>

        {isAdmin && (
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            <button 
              onClick={() => setActiveTab('received')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'received' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-brand-600'}`}
            >
              Inbox
            </button>
            <button 
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'sent' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-brand-600'}`}
            >
              Sent Log
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Composition Panel (Admin Only) */}
        {isAdmin && (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-brand-100 sticky top-8 overflow-visible">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-600 opacity-20" />
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                 <div className="flex items-center gap-2">
                    <Megaphone size={20} className="text-brand-600" />
                    <h3 className="font-black text-brand-900 uppercase text-xs tracking-widest">Send Message</h3>
                 </div>
                 <button 
                   type="button" 
                   onClick={loadUsers} 
                   className="text-brand-600 hover:rotate-180 transition-transform duration-500"
                 >
                   <RefreshCw size={14} />
                 </button>
              </div>
              
              <form onSubmit={handleSend} className="space-y-4">
                <div className="space-y-1 relative" ref={dropdownRef}>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Recipient Selection</label>
                  
                  <div 
                    className={`
                      w-full border p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all
                      ${newNotif.recipientId === 'all' ? 'bg-brand-50 border-brand-200' : 'bg-indigo-50 border-indigo-200'}
                    `}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {newNotif.recipientId === 'all' ? <Users size={16} className="text-brand-600" /> : <UserIcon size={16} className="text-indigo-600" />}
                      <span className={`text-sm font-bold truncate ${newNotif.recipientId === 'all' ? 'text-brand-900' : 'text-indigo-900'}`}>
                        {newNotif.recipientName}
                      </span>
                    </div>
                    <Filter size={14} className="text-gray-400" />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 w-full bg-white mt-2 rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-fade-in ring-4 ring-brand-500/5">
                      <div className="p-3 border-b bg-gray-50/50">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Search..."
                            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-xs font-bold outline-none"
                            value={recipientSearch}
                            onChange={(e) => setRecipientSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto p-1 no-scrollbar">
                        <button
                          type="button"
                          className="w-full text-left p-3 rounded-xl hover:bg-brand-50 flex items-center justify-between group transition-colors"
                          onClick={() => selectRecipient('all', 'All Staff (Broadcast)')}
                        >
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-brand-600" />
                            <span className="text-xs font-black uppercase text-brand-900">📢 All Staff</span>
                          </div>
                        </button>

                        {filteredRecipients.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            className="w-full text-left p-3 rounded-xl hover:bg-gray-50 flex items-center justify-between transition-colors"
                            onClick={() => selectRecipient(u.id, u.name)}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate text-gray-900">{u.name}</span>
                              <span className="text-[9px] text-gray-400 font-medium truncate">{u.email}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Input 
                  label="Subject Line" 
                  value={newNotif.title}
                  onChange={e => setNewNotif({...newNotif, title: e.target.value})}
                  required
                />

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Message Content</label>
                  <textarea 
                    className="w-full border-gray-200 border p-3 rounded-xl bg-gray-50 text-sm font-medium outline-none min-h-[140px] transition-all"
                    value={newNotif.message}
                    onChange={e => setNewNotif({...newNotif, message: e.target.value})}
                    required
                  />
                </div>

                <Button type="submit" fullWidth disabled={isSending} className="h-14 font-black shadow-lg rounded-2xl">
                  {isSending ? <Loader2 className="animate-spin" /> : <><Send size={18} className="mr-2" /> Dispatch Alert</>}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Message List */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'col-span-full'} space-y-4`}>
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-widest">
               {activeTab === 'received' ? 'Inbox' : 'Sent Communications'}
             </h3>
             <span className="bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">
               {notifications.length} Messages
             </span>
          </div>

          <div className="space-y-4">
            {notifications.map((notif) => {
              const readBy = Array.isArray(notif.readBy) ? notif.readBy : [];
              const isRead = readBy.includes(user?.id || '');
              const isGlobal = notif.recipientId === 'all';
              const isMySent = notif.senderId === user?.id;
              const isUnread = !isRead && activeTab === 'received';
              
              return (
                <div 
                  key={notif.id} 
                  className={`
                    group relative bg-white p-6 rounded-3xl shadow-sm border transition-all
                    ${(isRead || activeTab === 'sent') ? 'border-gray-100 opacity-90' : 'border-brand-300 ring-2 ring-brand-100/50 shadow-md animate-pulse-soft'}
                    hover:shadow-lg cursor-pointer
                  `}
                  onClick={() => handleMarkAsRead(notif.id)}
                >
                  {(isAdmin || isMySent) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setItemToDelete(notif.id); }}
                      className="absolute top-6 right-6 text-gray-300 hover:text-red-500 transition-colors p-2 z-10"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  {isUnread && (
                    <div className="absolute top-6 right-16 flex items-center gap-2">
                       <span className="bg-brand-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Unread</span>
                       <div className="relative flex h-2 w-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600"></span>
                       </div>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-5">
                    <div className="relative shrink-0">
                      <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                        ${isUnread ? 'bg-brand-600 text-white' : (isGlobal ? 'bg-brand-100 text-brand-600' : 'bg-indigo-100 text-indigo-600')}
                      `}>
                        {isGlobal ? <Users size={24} /> : <UserIcon size={24} />}
                      </div>
                      {isUnread && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-10">
                      <h4 className={`font-black text-lg tracking-tight mb-1 ${isUnread ? 'text-brand-900' : 'text-gray-700'}`}>
                        {notif.title}
                      </h4>
                      
                      <p className={`text-sm leading-relaxed mb-4 whitespace-pre-wrap ${isUnread ? 'text-brand-800 font-bold' : 'text-gray-500 font-medium'}`}>
                        {notif.message}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 border-t border-gray-50 pt-4">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          <Clock size={12} /> {format(parseISO(notif.createdAt), 'dd MMM, HH:mm')}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          <Mail size={12} /> 
                          {activeTab === 'received' ? `Sender: ${notif.senderName}` : `Target: ${notif.recipientId === 'all' ? 'All Staff' : 'Specific Employee'}`}
                        </div>
                      </div>
                    </div>
                    
                    {isUnread && (
                      <div className="self-center text-brand-600 animate-bounce-horizontal">
                         <ChevronRight size={20} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {notifications.length === 0 && !isLoading && (
              <div className="bg-white py-24 rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center px-6">
                 <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Bell size={40} className="text-gray-200" />
                 </div>
                 <h4 className="font-black text-gray-900 uppercase tracking-[0.2em] text-sm">No notifications</h4>
                 <p className="text-gray-400 text-xs mt-2 italic max-w-xs">You have no official alerts at this moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-brand-900/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-3xl p-8 shadow-2xl animate-shake border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h3 className="text-xl font-black text-brand-900 text-center uppercase tracking-tight">Confirm Deletion</h3>
            <p className="text-gray-500 text-center text-sm mt-3 font-medium">
              This action is permanent. Are you sure you want to delete this notification record?
            </p>
            <div className="flex gap-4 mt-8">
              <Button 
                variant="outline" 
                fullWidth 
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="rounded-2xl h-12 font-black"
              >
                Cancel
              </Button>
              <Button 
                variant="danger" 
                fullWidth 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-2xl h-12 font-black bg-red-600 shadow-lg shadow-red-200"
              >
                {isDeleting ? <Loader2 className="animate-spin" /> : 'Delete Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
