
import React, { useState, useEffect } from 'react';
import { Database } from '../services/database';
import { TimeRecord, User, UserRole } from '../types';
import { 
  Users, 
  MapPin, 
  Clock, 
  Loader2, 
  ExternalLink, 
  ShieldCheck, 
  Navigation,
  Activity,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const Dashboard: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<(TimeRecord & { user?: User })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeCount: 0,
    totalToday: 0
  });

  const loadActiveData = async () => {
    setIsLoading(true);
    try {
      const [allRecords, allUsers] = await Promise.all([
        Database.getAllRecords(),
        Database.getAllUsers()
      ]);

      const active = allRecords
        .filter(r => !r.endTime)
        .map(rec => ({
          ...rec,
          user: allUsers.find(u => u.id === rec.userId)
        }));

      const today = allRecords.filter(r => r.date === new Date().toISOString().split('T')[0]);

      setActiveSessions(active);
      setStats({
        activeCount: active.length,
        totalToday: today.length
      });
    } catch (error) {
      console.error("Dashboard data load error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveData();
    const interval = setInterval(loadActiveData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getMapsLink = (loc?: { lat: number; lng: number }) => {
    if (!loc) return null;
    return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  };

  if (isLoading && activeSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="animate-spin text-brand-600" size={48} />
        <p className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Synchronizing Operations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-900 tracking-tight">Live Operations</h1>
          <p className="text-xs text-brand-600 font-bold uppercase tracking-widest mt-1">Real-time personnel monitoring & site control</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 p-2 rounded-xl text-green-600">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{stats.activeCount}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Active Shifts</p>
            </div>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-brand-100 p-2 rounded-xl text-brand-600">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{stats.totalToday}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Today's Jobs</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Map Visualization Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-1 shadow-2xl overflow-hidden relative min-h-[500px] border-[6px] border-white">
            {/* Mocked Radar / Map Visualization */}
            <div className="absolute inset-0 opacity-10">
               <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] h-[80%] border border-brand-500/20 rounded-full animate-ping" />
            </div>

            <div className="relative z-10 p-8 h-full flex flex-col">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                   <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                   <h3 className="text-white font-black text-sm uppercase tracking-widest">Global Field Position</h3>
                </div>
                <div className="bg-slate-800 text-slate-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border border-slate-700">
                  {format(new Date(), 'HH:mm:ss')} (LIVE)
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center">
                {activeSessions.length === 0 ? (
                  <div className="text-center">
                    <Navigation size={48} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold italic">No tracked units currently on site.</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    {activeSessions.map((session, idx) => (
                      <div 
                        key={session.id} 
                        className="absolute flex flex-col items-center group cursor-pointer"
                        style={{
                          left: `${30 + (idx * 15) % 60}%`,
                          top: `${20 + (idx * 20) % 60}%`,
                        }}
                      >
                         <div className="bg-brand-500 p-2 rounded-full shadow-[0_0_20px_rgba(14,165,233,0.5)] border-2 border-white transform transition-transform group-hover:scale-125">
                            <MapPin size={16} className="text-white" />
                         </div>
                         <div className="mt-2 bg-white px-3 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 whitespace-nowrap z-50">
                            <p className="text-xs font-black text-gray-900">{session.user?.name}</p>
                            <p className="text-[9px] text-brand-600 font-bold">{session.locationName}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="mt-auto pt-6 border-t border-slate-800 flex justify-between">
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Monitoring active since {format(new Date(), 'dd/MM/yy')}</p>
                <div className="flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <div className="w-2 h-2 rounded-full bg-slate-700" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Personnel List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
             <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Shift Activity Feed</h3>
             <span className="bg-brand-50 text-brand-600 px-2 py-1 rounded-md text-[9px] font-black uppercase">Recent first</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[600px] no-scrollbar pb-10">
            {activeSessions.map((session) => (
              <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-brand-500" />
                
                <div className="flex items-start gap-4">
                   <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-black text-lg border border-brand-100">
                     {session.user?.name.charAt(0)}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black text-gray-900 truncate">{session.user?.name}</h4>
                        <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1">
                          <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Live
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin size={12} className="text-brand-500" />
                        <span className="text-xs font-bold text-gray-500 truncate">{session.locationName}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-[10px] font-black text-gray-400 uppercase">Started: {format(parseISO(session.startTime), 'HH:mm')}</span>
                        </div>
                        
                        {session.startLocation && (
                          <a 
                            href={getMapsLink(session.startLocation)!} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-black text-brand-600 uppercase flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink size={10} /> GPS Link
                          </a>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            ))}

            {activeSessions.length === 0 && (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100 p-8">
                 <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Users size={24} className="text-gray-300" />
                 </div>
                 <p className="text-sm font-bold text-gray-400 italic">No cleaning professionals are currently checked in.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
