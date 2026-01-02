
import React, { useState, useEffect, useRef } from 'react';
import { Database } from '../services/database';
import { TimeRecord, User } from '../types';
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
  AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Global Leaflet declaration
declare const L: any;

export const Dashboard: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<(TimeRecord & { user?: User })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
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
    let checkInterval: number;
    
    const initMap = () => {
      if (mapContainerRef.current && !mapRef.current && typeof L !== 'undefined') {
        try {
          mapRef.current = L.map(mapContainerRef.current, {
            zoomControl: false,
            scrollWheelZoom: true,
            fadeAnimation: true
          }).setView([-23.5505, -46.6333], 12);

          // Professional Esri Tiles (Clean visual similar to Google Maps)
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Downey Cleaning',
            maxZoom: 19
          }).addTo(mapRef.current);

          L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

          // Force map size recalculation
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

    // Retry initialization until Leaflet is loaded
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
  }, []);

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
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 p-2 rounded-xl text-green-600">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{stats.activeCount}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Online Now</p>
            </div>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-brand-100 p-2 rounded-xl text-brand-600">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{stats.totalToday}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Jobs Today</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-1 shadow-2xl overflow-hidden relative h-[580px] border-[4px] border-white ring-1 ring-gray-100">
            <div 
              ref={mapContainerRef} 
              id="dashboard-map"
              className="z-0 w-full h-full bg-slate-100" 
              style={{ position: 'relative', height: '100%', width: '100%' }}
            />
            
            {/* Loading Overlay */}
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

            {/* Map Controls */}
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

        {/* Side List */}
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

                      {/* GPS Warning */}
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
