import React, { useState, useEffect, useRef } from 'react';
import { Database } from '../services/database';
import { TimeRecord, User, UserRole, ScheduleItem } from '../types';
import { GoogleGenAI } from "@google/genai";
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  Clock, 
  Loader2, 
  ExternalLink, 
  Activity,
  Calendar,
  Navigation,
  RefreshCw,
  LocateFixed,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Smile,
  ShieldCheck,
  Check
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Global Leaflet declaration
declare const L: any;

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Employee-specific states
  const [employeeSchedules, setEmployeeSchedules] = useState<ScheduleItem[]>([]);
  const [employeeActiveSession, setEmployeeActiveSession] = useState<TimeRecord | null>(null);
  const [employeeRecords, setEmployeeRecords] = useState<TimeRecord[]>([]);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(true);

  // Admin-specific states
  const [activeSessions, setActiveSessions] = useState<(TimeRecord & { user?: User })[]>([]);
  const [isLoading, setIsLoading] = useState(user?.role === UserRole.ADMIN);
  const [mapReady, setMapReady] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeCount: 0,
    totalToday: 0
  });
  
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);

  const loadActiveData = async () => {
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
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate operational insights using Gemini AI
  const generateAiInsights = async () => {
    if (activeSessions.length === 0) return;
    setIsGeneratingAi(true);
    try {
      // Create a new GoogleGenAI instance right before making an API call for freshest credentials
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = activeSessions.map(s => ({
        personnel: s.user?.name,
        site: s.locationName,
        startTime: format(parseISO(s.startTime), 'HH:mm'),
        safetyCompliance: Object.values(s.safetyChecklist || {}).filter(v => v === true).length + " checks verified"
      }));

      // Task involves advanced reasoning/analysis of field operations, so gemini-3-pro-preview is selected
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze the current Downey Cleaning field operations and provide 2-3 professional, concise insights for the manager. Team status: ${JSON.stringify(context)}.`,
      });

      // Extract generated text from response.text property (not a method)
      setAiInsights(response.text || "Operations appearing normal across all active sites.");
    } catch (error) {
      console.error("Gemini AI error:", error);
      setAiInsights("Unable to generate AI insights at this time. Operations monitoring remains active.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const updateMapMarkers = (sessions: (TimeRecord & { user?: User })[]) => {
    if (!mapRef.current || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);
    let hasCoords = false;

    sessions.forEach(session => {
      const coords = session.startLocation;
      if (coords && coords.lat && coords.lng) {
        hasCoords = true;
        const latLng = [coords.lat, coords.lng];
        
        const customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div class="flex flex-col items-center group">
              <div class="relative">
                <div class="bg-brand-600 p-2 rounded-full shadow-2xl border-2 border-white transform transition-all duration-300 scale-100 group-hover:scale-125 z-10 relative">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-600 rotate-45 border-r-2 border-b-2 border-white shadow-lg"></div>
              </div>
              <div class="mt-3 bg-white px-3 py-1 rounded-full text-[10px] font-black border border-gray-100 shadow-2xl whitespace-nowrap text-brand-900 ring-2 ring-brand-100">
                ${session.user?.name.split(' ')[0] || 'Unit'}
              </div>
            </div>
          `,
          iconSize: [45, 65],
          iconAnchor: [22.5, 55]
        });

        const marker = L.marker(latLng, { icon: customIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div class="font-sans p-1 min-w-[150px]">
              <p class="font-black text-brand-900 text-sm mb-1">${session.user?.name}</p>
              <div class="flex items-center gap-1 text-[10px] text-gray-500 font-bold mb-2">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                 ${session.locationName}
              </div>
              <div class="bg-brand-50 p-2 rounded-lg text-[9px] font-black text-brand-600 uppercase">
                Checked-in at ${format(parseISO(session.startTime), 'HH:mm')}
              </div>
            </div>
          `);
        
        markersRef.current.push(marker);
        bounds.extend(latLng);
      }
    });

    if (hasCoords && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    }
  };

  useEffect(() => {
    if (!user) return;

    if (user.role === UserRole.ADMIN) {
      let checkInterval: number;
      
      const initMap = () => {
        if (mapContainerRef.current && !mapRef.current && typeof L !== 'undefined') {
          try {
            mapRef.current = L.map(mapContainerRef.current, {
              zoomControl: false,
              scrollWheelZoom: true,
              fadeAnimation: true
            }).setView([-23.5505, -46.6333], 12);

            // Professional Street Map Tiles
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
              attribution: 'Tiles &copy; Esri &mdash; Downey Cleaning',
              maxZoom: 19
            }).addTo(mapRef.current);

            L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.invalidateSize();
                setMapReady(true);
                clearInterval(checkInterval);
              }
            }, 500);
          } catch (err) {
            console.error("Error initializing map:", err);
          }
        }
      };

      checkInterval = window.setInterval(() => {
        if (typeof L !== 'undefined') {
          initMap();
        }
      }, 300);

      loadActiveData();
      const refreshInterval = setInterval(loadActiveData, 30000); 

      const handleResize = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        clearInterval(checkInterval);
        clearInterval(refreshInterval);
        window.removeEventListener('resize', handleResize);
      };
    } else {
      const loadEmployeeDashboard = async () => {
        setIsEmployeeLoading(true);
        try {
          const [schedules, active, records] = await Promise.all([
            Database.getSchedulesByUser(user.id),
            Database.getActiveSession(user.id),
            Database.getRecordsByUser(user.id)
          ]);
          setEmployeeRecords(records);
          setEmployeeActiveSession(active);

          // Sort schedules based on the chronological completion order in the last 3 weeks
          const threeWeeksAgo = new Date();
          threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

          // Find the most recent completion timestamp for each schedule (by scheduleId or locationName)
          const lastCompletionTimeMap = new Map<string, number>();

          // Sort records oldest to newest to ensure the latest completion timestamp overwrites previous ones
          const completedIn3Weeks = records
            .filter(r => r.endTime && new Date(r.startTime) >= threeWeeksAgo)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

          completedIn3Weeks.forEach(r => {
            const key = r.scheduleId || r.locationName;
            lastCompletionTimeMap.set(key, new Date(r.startTime).getTime());
          });

          // Sort schedules:
          // Schedules completed in the last 3 weeks go first, ordered chronologically by their last execution.
          // Schedules not completed in the last 3 weeks go after.
          const sortedSchedules = [...schedules].sort((a, b) => {
            const timeA = lastCompletionTimeMap.get(a.id) || lastCompletionTimeMap.get(a.locationName) || 0;
            const timeB = lastCompletionTimeMap.get(b.id) || lastCompletionTimeMap.get(b.locationName) || 0;

            if (timeA > 0 && timeB > 0) {
              return timeA - timeB; // Chronological sequence
            }
            if (timeA > 0) return -1;
            if (timeB > 0) return 1;

            return 0;
          });

          setEmployeeSchedules(sortedSchedules);
        } catch (error) {
          console.error("Error loading employee dashboard:", error);
        } finally {
          setIsEmployeeLoading(false);
        }
      };
      loadEmployeeDashboard();
    }
  }, [user]);

  useEffect(() => {
    if (mapReady && mapRef.current) {
      updateMapMarkers(activeSessions);
    }
  }, [mapReady, activeSessions]);

  const centerMapOnAll = () => {
    if (mapRef.current && markersRef.current.length > 0) {
      const bounds = L.latLngBounds(markersRef.current.map(m => m.getLatLng()));
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    }
  };

  if (user?.role === UserRole.EMPLOYEE) {
    if (isEmployeeLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4 text-center">
          <Loader2 className="animate-spin text-brand-600" size={48} />
          <p className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Loading Dashboard...</p>
        </div>
      );
    }

    const isShiftCompletedToday = (sched: ScheduleItem) => {
      const todayStr = new Date().toISOString().split('T')[0];
      return employeeRecords.some(r => 
        r.date === todayStr && 
        r.endTime && 
        (r.scheduleId === sched.id || r.locationName === sched.locationName)
      );
    };

    const isShiftActiveToday = (sched: ScheduleItem) => {
      const todayStr = new Date().toISOString().split('T')[0];
      return employeeRecords.some(r => 
        r.date === todayStr && 
        !r.endTime && 
        (r.scheduleId === sched.id || r.locationName === sched.locationName)
      );
    };

    const todayDayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const todaySchedules = employeeSchedules.filter(s => s.dayOfWeek === todayDayOfWeek);

    const DAYS_EN = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];

    return (
      <div className="space-y-6">
        {/* Welcome Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-brand-900 tracking-tight">
              Hello, {user.name}!
            </h1>
            <p className="text-xs text-brand-600 font-bold uppercase tracking-widest mt-1">
              Employee Dashboard
            </p>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <Calendar className="text-brand-500" size={20} />
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">
                {format(new Date(), 'dd/MM/yyyy')}
              </p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                {DAYS_EN[todayDayOfWeek]}
              </p>
            </div>
          </div>
        </header>

        {/* Hero Card: Today's Shift Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {employeeActiveSession ? (
              <div className="bg-gradient-to-br from-brand-900 to-brand-800 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Activity size={120} />
                </div>
                <div>
                  <span className="bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 mb-4">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    Active Shift
                  </span>
                  <h3 className="text-2xl font-black leading-tight tracking-tight">
                    {employeeActiveSession.locationName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-brand-300 text-xs mt-1 font-bold">
                    <MapPin size={14} />
                    <span>Started at: {format(parseISO(employeeActiveSession.startTime), 'HH:mm')}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center">
                  <button
                    onClick={() => navigate('/check-in')}
                    className="w-full sm:w-auto bg-white text-brand-900 px-6 py-3 rounded-2xl shadow-lg font-black text-sm hover:bg-brand-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Go to Check-In/Out
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : todaySchedules.length > 0 && isShiftCompletedToday(todaySchedules[0]) ? (
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <ShieldCheck size={120} />
                </div>
                <div>
                  <span className="bg-white/20 text-emerald-100 border border-white/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 mb-4">
                    <Check size={12} className="stroke-[3]" />
                    Turno Realizado
                  </span>
                  <h3 className="text-2xl font-black leading-tight tracking-tight">
                    {todaySchedules[0].locationName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-emerald-100 text-xs mt-1.5 font-bold">
                    <MapPin size={14} />
                    <span className="truncate max-w-[300px]">{todaySchedules[0].address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-100 text-xs mt-1 font-bold">
                    <Clock size={14} />
                    <span>Duração Prevista: {todaySchedules[0].hoursPerDay}h</span>
                  </div>
                  <p className="text-xs text-emerald-50 mt-3 font-semibold bg-white/10 p-3 rounded-xl border border-white/5 leading-relaxed">
                    Você já iniciou e finalizou este turno hoje com sucesso. Ótimo trabalho!
                  </p>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => navigate('/check-in')}
                    className="w-full sm:w-auto bg-white text-emerald-800 px-6 py-3 rounded-2xl shadow-lg font-black text-sm hover:bg-emerald-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Ver Detalhes do Registro
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : todaySchedules.length > 0 ? (
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Clock size={120} />
                </div>
                <div>
                  <span className="bg-white/20 text-white border border-white/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 mb-4">
                    Shift Today
                  </span>
                  <h3 className="text-2xl font-black leading-tight tracking-tight">
                    {todaySchedules[0].locationName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-amber-100 text-xs mt-1 font-bold">
                    <MapPin size={14} />
                    <span className="truncate max-w-[300px]">{todaySchedules[0].address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-100 text-xs mt-1 font-bold">
                    <Clock size={14} />
                    <span>Planned Hours: {todaySchedules[0].hoursPerDay}h</span>
                  </div>
                  {todaySchedules[0].notes && (
                    <p className="text-xs text-amber-50 italic mt-2 bg-black/10 p-3 rounded-xl border border-white/5 leading-relaxed">
                      "{todaySchedules[0].notes}"
                    </p>
                  )}
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => navigate('/check-in')}
                    className="w-full sm:w-auto bg-white text-amber-700 px-6 py-3 rounded-2xl shadow-lg font-black text-sm hover:bg-amber-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Start Shift
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Smile size={120} />
                </div>
                <div>
                  <span className="bg-white/20 text-white border border-white/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 mb-4">
                    Status
                  </span>
                  <h3 className="text-2xl font-black leading-tight tracking-tight">
                    No shifts scheduled today!
                  </h3>
                  <p className="text-sm text-teal-100 mt-2 font-medium">
                    You have no cleaning shifts scheduled for today. Enjoy your day off!
                  </p>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => navigate('/agenda')}
                    className="w-full sm:w-auto bg-white text-teal-800 px-6 py-3 rounded-2xl shadow-lg font-black text-sm hover:bg-teal-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    View Full Schedule
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick stats / Highlights */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest mb-4">Weekly Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-50 p-2 rounded-xl text-brand-600">
                      <Calendar size={16} />
                    </div>
                    <span className="text-xs font-bold text-gray-500">Working days</span>
                  </div>
                  <span className="font-black text-gray-900 text-sm">
                    {Array.from(new Set(employeeSchedules.map(s => s.dayOfWeek))).length} / 7
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-50 p-2 rounded-xl text-brand-600">
                      <Clock size={16} />
                    </div>
                    <span className="text-xs font-bold text-gray-500">Total planned hours</span>
                  </div>
                  <span className="font-black text-brand-600 text-sm">
                    {employeeSchedules.reduce((acc, curr) => acc + curr.hoursPerDay, 0)}h
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/agenda')}
              className="mt-6 w-full bg-brand-50 hover:bg-brand-100 text-brand-700 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
            >
              View Details
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Weekly Schedule Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-brand-900 tracking-tight flex items-center gap-2">
              <Calendar size={20} className="text-brand-500" />
              Weekly Schedule
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {/* Loop through each day of the week, highlighting today */}
            {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
              const daySchedules = employeeSchedules.filter(s => s.dayOfWeek === dayIdx);
              const isToday = dayIdx === todayDayOfWeek;

              return (
                <div
                  key={dayIdx}
                  className={`rounded-2xl p-4 transition-all relative flex flex-col justify-between ${
                    isToday
                      ? 'bg-gradient-to-b from-brand-50/70 to-white border-[3px] border-brand-500 shadow-md ring-4 ring-brand-50'
                      : 'bg-white border border-gray-100 shadow-sm'
                  }`}
                >
                  {isToday && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">
                      Today
                    </span>
                  )}
                  
                  <div>
                    <p className={`text-center font-black uppercase text-[10px] tracking-wider ${isToday ? 'text-brand-700' : 'text-gray-400'}`}>
                      {DAYS_EN[dayIdx]}
                    </p>

                    <div className="mt-3 space-y-2">
                      {daySchedules.length > 0 ? (
                        daySchedules.map(sched => {
                          const completed = isToday && isShiftCompletedToday(sched);
                          const active = isToday && isShiftActiveToday(sched);
                          return (
                            <div
                              key={sched.id}
                              className={`p-2.5 rounded-xl text-left border transition-all ${
                                completed
                                  ? 'bg-green-500/10 border-green-500 text-green-900 shadow-sm'
                                  : active
                                  ? 'bg-brand-500/10 border-brand-500 text-brand-900 animate-pulse'
                                  : isToday
                                  ? 'bg-brand-500/5 border-brand-200'
                                  : 'bg-gray-50 border-gray-100'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <p className={`font-black text-[11px] leading-tight truncate ${completed ? 'text-green-800' : 'text-gray-900'}`} title={sched.locationName}>
                                  {sched.locationName}
                                </p>
                                {completed && (
                                  <span className="bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-tight">
                                    Done
                                  </span>
                                )}
                                {active && (
                                  <span className="bg-brand-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-tight">
                                    Live
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500 font-bold">
                                <Clock size={10} className={completed ? 'text-green-500 shrink-0' : 'text-gray-400 shrink-0'} />
                                <span className={completed ? 'text-green-700' : ''}>{sched.hoursPerDay}h</span>
                              </div>
                              {sched.notes && (
                                <div className={`mt-1 text-[8px] italic truncate ${completed ? 'text-green-600/80' : 'text-gray-400'}`} title={sched.notes}>
                                  {sched.notes}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-gray-300 italic text-[10px] font-medium uppercase tracking-wider">
                          Day Off
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && activeSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4 text-center">
        <Loader2 className="animate-spin text-brand-600" size={48} />
        <p className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em]">Connecting to Operations Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-900 tracking-tight">Live Operations</h1>
          <p className="text-xs text-brand-600 font-bold uppercase tracking-widest mt-1">Global Team Status</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={generateAiInsights}
            disabled={isGeneratingAi || activeSessions.length === 0}
            className="bg-brand-600 text-white px-6 py-3 rounded-2xl shadow-lg border-b-4 border-brand-800 flex items-center gap-2 hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGeneratingAi ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            <span className="font-bold text-sm">AI Insights</span>
          </button>

          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 p-2 rounded-xl text-green-600">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{stats.activeCount}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Online Now</p>
            </div>
          </div>
          <button 
            onClick={loadActiveData}
            className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-gray-400 hover:text-brand-600 hover:border-brand-100 transition-all active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {aiInsights && (
        <div className="bg-brand-900 text-white p-6 rounded-3xl animate-fade-in relative overflow-hidden shadow-xl">
           <div className="absolute top-0 right-0 p-6 opacity-10">
              <Sparkles size={80} />
           </div>
           <h3 className="text-brand-400 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 mb-3">
             <Sparkles size={14} /> Gemini AI Operational Intelligence
           </h3>
           <p className="text-sm font-medium leading-relaxed italic border-l-2 border-brand-500 pl-4">
             "{aiInsights}"
           </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-1 shadow-2xl overflow-hidden relative h-[580px] border-[4px] border-white ring-1 ring-gray-100">
            <div 
              ref={mapContainerRef} 
              id="dashboard-map"
              className="z-0 w-full h-full bg-slate-100" 
              style={{ position: 'relative', height: '100%', width: '100%' }}
            />
            
            {!mapReady && (
              <div className="absolute inset-0 z-[2000] bg-white flex flex-col items-center justify-center text-center">
                 <div className="relative">
                    <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <MapPin className="text-brand-600" size={24} />
                    </div>
                 </div>
                 <p className="text-xs font-black text-gray-500 uppercase mt-4 tracking-widest">Syncing GPS Satellites...</p>
              </div>
            )}

            {mapReady && (
              <>
                <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                  <button 
                    onClick={centerMapOnAll}
                    className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 text-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-2 font-black text-[10px] uppercase tracking-wider"
                  >
                    <LocateFixed size={18} /> Center All
                  </button>
                </div>

                <div className="absolute top-4 right-16 z-[1000] pointer-events-none">
                  <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[9px] font-black uppercase border border-gray-100 shadow-lg flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Real-time Monitoring
                  </div>
                </div>
              </>
            )}

            {activeSessions.length === 0 && mapReady && (
              <div className="absolute inset-0 z-[1001] bg-gray-50/40 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none">
                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center text-center">
                  <Navigation size={48} className="text-gray-300 mb-4" />
                  <p className="text-gray-900 font-black text-sm uppercase tracking-widest">No units in field</p>
                  <p className="text-gray-400 text-xs mt-1">Awaiting employee check-ins.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 flex flex-col h-[580px]">
          <div className="flex items-center justify-between">
             <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Team Status</h3>
             <span className="bg-brand-50 text-brand-600 px-2 py-1 rounded-md text-[9px] font-black uppercase">Live</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pr-1 pb-10">
            {activeSessions.map((session) => (
              <div 
                key={session.id} 
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
                onClick={() => {
                  if (mapRef.current && session.startLocation) {
                    mapRef.current.setView([session.startLocation.lat, session.startLocation.lng], 18);
                    markersRef.current.find(m => m.getLatLng().lat === session.startLocation?.lat)?.openPopup();
                  }
                }}
              >
                <div className="absolute top-0 right-0 w-1 h-full bg-brand-500" />
                
                <div className="flex items-start gap-4">
                   <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-black text-lg border border-brand-100 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                     {session.user?.name.charAt(0)}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black text-gray-900 truncate leading-tight">{session.user?.name}</h4>
                        <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1 shrink-0">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Active
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin size={12} className="text-brand-500 shrink-0" />
                        <span className="text-xs font-bold text-gray-500 truncate">{session.locationName}</span>
                      </div>

                      {!session.startLocation && (
                        <div className="flex items-center gap-1 mt-2 text-[9px] font-bold text-orange-500 uppercase bg-orange-50 px-2 py-1 rounded w-fit">
                           <AlertCircle size={10} /> GPS location unavailable
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-[9px] font-black text-gray-400 uppercase">Started: {format(parseISO(session.startTime), 'HH:mm')}</span>
                        </div>
                        
                        {session.startLocation && (
                          <a 
                            href={`https://www.google.com/maps?q=${session.startLocation.lat},${session.startLocation.lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[9px] font-black text-brand-600 uppercase flex items-center gap-1 hover:underline bg-brand-50 px-2 py-1 rounded-lg"
                          >
                            <ExternalLink size={10} /> Google Maps
                          </a>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            ))}

            {activeSessions.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-gray-100 p-8 text-center">
                 <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Users size={24} className="text-gray-300" />
                 </div>
                 <p className="text-sm font-bold text-gray-400 italic">No staff members currently active.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};