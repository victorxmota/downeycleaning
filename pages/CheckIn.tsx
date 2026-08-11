
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, SafetyChecklist, GeoLocation, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  Camera, 
  ShieldCheck, 
  PlayCircle, 
  StopCircle, 
  Check, 
  MapPin, 
  Loader2, 
  HardHat, 
  Glasses, 
  Hand, 
  Activity, 
  Construction, 
  Box, 
  AlertTriangle,
  ChevronDown,
  Edit2,
  PauseCircle,
  Play,
  AlertCircle,
  Plus,
  CheckSquare,
  Square,
  Save,
  X,
  Calendar,
  Clock,
  Info
} from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const INITIAL_CHECKLIST: SafetyChecklist = {
  knowJobSafety: false,
  weatherCheck: false,
  safePassInDate: false,
  hazardAwareness: false,
  floorConditions: false,
  manualHandlingCert: false,
  liftingHelp: false,
  anchorPoints: false,
  ladderFooting: false,
  safetyCones: false,
  communication: false,
  laddersCheck: false,
  sharpEdges: false,
  scraperCovers: false,
  hotSurfaces: false,
  chemicalCourse: false,
  chemicalAwareness: false,
  tidyEquipment: false,
  laddersStored: false,
  highVis: false,
  helmet: false,
  goggles: false,
  gloves: false,
  mask: false,
  earMuffs: false,
  faceGuard: false,
  harness: false,
  boots: false
};

export const CheckIn: React.FC = () => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<TimeRecord | null>(null);
  const [locationName, setLocationName] = useState('');
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<{name: string, address: string}[]>([]);
  
  const [isShowingAskRegisterModal, setIsShowingAskRegisterModal] = useState(false);
  const [isShowingCompanyRegisterModal, setIsShowingCompanyRegisterModal] = useState(false);
  const [newOfficeForm, setNewOfficeForm] = useState({
    name: '',
    eircode: '',
    address: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'acquired' | 'denied' | 'error'>('checking');
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  
  const [endPhotoPreview, setEndPhotoPreview] = useState<string | null>(null);
  const [endPhotoFile, setEndPhotoFile] = useState<File | null>(null);

  const [isShowingScheduleModal, setIsShowingScheduleModal] = useState(false);
  const [scheduleFormData, setScheduleFormData] = useState({
    address: '',
    notes: '',
    hoursPerDay: 4,
    days: [] as number[]
  });

  const [checklist, setChecklist] = useState<SafetyChecklist>(INITIAL_CHECKLIST);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  const loadAvailableLocations = async (userId: string, extraLoc?: { name: string, address: string }) => {
    try {
      const schedules = await Database.getSchedulesByUser(userId);
      
      const uniqueLocs = new Map<string, string>();
      schedules.forEach(s => {
        if (s.locationName && !uniqueLocs.has(s.locationName)) {
          uniqueLocs.set(s.locationName, s.address || '');
        }
      });

      // Fallback for ADMIN users if they have no individual scheduled locations
      if (user?.role === UserRole.ADMIN && uniqueLocs.size === 0) {
        const offices = await Database.getOffices();
        offices.forEach(o => {
          if (o.name && !uniqueLocs.has(o.name)) {
            uniqueLocs.set(o.name, o.address || '');
          }
        });
      }

      if (extraLoc && extraLoc.name) {
        uniqueLocs.set(extraLoc.name, extraLoc.address || '');
      }
      
      const locArray = Array.from(uniqueLocs.entries())
        .map(([name, address]) => ({ name, address }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setAvailableLocations(locArray);
      
      if (locArray.length === 0) {
        setIsManualLocation(true);
      }
    } catch (e) {
      console.error("Error loading locations:", e);
    }
  };

  const handleTypeManuallyClick = () => {
    if (isManualLocation) {
      setIsManualLocation(false);
    } else {
      setIsShowingAskRegisterModal(true);
    }
  };

  const handleAskRegisterNo = () => {
    setIsShowingAskRegisterModal(false);
    setIsManualLocation(true);
  };

  const handleAskRegisterYes = () => {
    setIsShowingAskRegisterModal(false);
    setNewOfficeForm({ name: '', eircode: '', address: '' });
    setIsShowingCompanyRegisterModal(true);
  };

  const handleSaveCompany = async () => {
    if (!newOfficeForm.name.trim() || !newOfficeForm.address.trim()) {
      alert("Location Name and Address are required.");
      return;
    }

    setIsProcessing(true);
    try {
      await Database.addOffice({
        name: newOfficeForm.name.trim(),
        eircode: newOfficeForm.eircode.trim(),
        address: newOfficeForm.address.trim(),
        defaultSchedule: []
      });

      alert("Location registered successfully!");
      setIsShowingCompanyRegisterModal(false);

      if (user) {
        await loadAvailableLocations(user.id, {
          name: newOfficeForm.name.trim(),
          address: newOfficeForm.address.trim()
        });
      }

      setLocationName(newOfficeForm.name.trim());
      setIsManualLocation(false);

    } catch (e: any) {
      console.error("Error registering company:", e);
      alert("Failed to register location: " + (e.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshActiveSession = async () => {
    if (!user) return;
    try {
      const session = await Database.getActiveSession(user.id);
      if (session) {
        setActiveSession(session);
        setLocationName(session.locationName);
        if (session.safetyChecklist) {
          setChecklist({ ...INITIAL_CHECKLIST, ...session.safetyChecklist });
        }
        setPhotoPreview(session.photoUrl || null);
      } else {
        setActiveSession(null);
        setLocationName('');
        setChecklist(INITIAL_CHECKLIST);
        setPhotoPreview(null);
        setCheckoutNotes('');
      }
    } catch (e) {
      console.error("Error refreshing active session in CheckIn:", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      try {
        await refreshActiveSession();
        await loadAvailableLocations(user.id);
        checkGpsAvailability();
      } catch (e) {
        console.error("Error initializing check-in", e);
      } finally {
        setInitializing(false);
      }
    };
    init();

    const handleShiftChanged = () => {
      refreshActiveSession();
    };

    window.addEventListener('downey:shift-changed', handleShiftChanged);
    return () => {
      window.removeEventListener('downey:shift-changed', handleShiftChanged);
    };
  }, [user]);

  const checkGpsAvailability = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus('acquired'),
      (err) => {
        if (err.code === 1) setGpsStatus('denied');
        else setGpsStatus('error');
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (activeSession) {
      const startTime = new Date(activeSession.startTime).getTime();
      const totalPausedMs = activeSession.totalPausedMs || 0;
      
      timerRef.current = window.setInterval(() => {
        let now = Date.now();
        let currentEffectiveTime = now - startTime - totalPausedMs;

        if (activeSession.isPaused && activeSession.pausedAt) {
          const pausedAt = new Date(activeSession.pausedAt).getTime();
          currentEffectiveTime -= (now - pausedAt);
        }

        setElapsedTime(Math.floor(currentEffectiveTime / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  const toggleScheduleDay = (dayIndex: number) => {
    setScheduleFormData(prev => ({
      ...prev,
      days: prev.days.includes(dayIndex) 
        ? prev.days.filter(d => d !== dayIndex) 
        : [...prev.days, dayIndex]
    }));
  };

  const handleRegisterSchedule = async () => {
    if (!user || !locationName.trim() || !scheduleFormData.address.trim()) {
      alert("Location and Address are required");
      return;
    }
    if (scheduleFormData.days.length === 0) {
      alert("Please select at least one day.");
      return;
    }
    
    setIsProcessing(true);
    try {
      if (!user) throw new Error("User session not found.");
      if (!locationName.trim()) throw new Error("Please enter the Site Name.");
      if (!scheduleFormData.address.trim()) throw new Error("Please enter the Site Address.");
      if (scheduleFormData.days.length === 0) throw new Error("Please select at least one day for this shift.");

      for (const day of scheduleFormData.days) {
        await Database.addSchedule({
          userId: user.id,
          locationName: locationName.trim(),
          address: scheduleFormData.address.trim(),
          dayOfWeek: day,
          hoursPerDay: Number(scheduleFormData.hoursPerDay),
          notes: scheduleFormData.notes
        });
      }
      
      alert("Shift registered successfully in your schedule!");
      setIsShowingScheduleModal(false);
      
      // Reset form
      setScheduleFormData({
        address: '',
        notes: '',
        hoursPerDay: 4,
        days: []
      });
      
      // Update available locations list
      const schedules = await Database.getSchedulesByUser(user.id);
      const uniqueLocs = new Map();
      schedules.forEach(s => {
        if (!uniqueLocs.has(s.locationName)) {
          uniqueLocs.set(s.locationName, s.address);
        }
      });
      const locArray = Array.from(uniqueLocs.entries()).map(([name, address]) => ({ name, address }));
      setAvailableLocations(locArray);
    } catch (error: any) {
      console.error("Error registering schedule:", error);
      alert("Failed to add to schedule: " + (error.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, isEnd: boolean) => {
    alert("Photo upload is temporarily unavailable.");
    e.target.value = '';
    return;
    /*
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEnd) {
          setEndPhotoPreview(reader.result as string);
          setEndPhotoFile(file);
        } else {
          setPhotoPreview(reader.result as string);
          setPhotoFile(file);
        }
      };
      reader.readAsDataURL(file);
    }
    */
  };

  const getRequiredLocation = (): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Your browser does not support geolocation. GPS is required for check-in/out."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatus('acquired');
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (err.code === 1) {
            setGpsStatus('denied');
            reject(new Error("GPS permission denied. Location access is mandatory to continue."));
          } else {
            setGpsStatus('error');
            reject(new Error("Unable to obtain your location. Please ensure device GPS is turned on."));
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleStartShift = async () => {
    if (!user || !locationName.trim()) {
      alert("Please select or type a location.");
      return;
    }

    const checkedCount = Object.values(checklist).filter(v => v === true).length;
    if (checkedCount < 5) {
      if (!confirm("You have checked very few safety items. Do you want to proceed anyway?")) return;
    }

    setIsProcessing(true);
    
    try {
        const location = await getRequiredLocation();
        
        const recordData: Omit<TimeRecord, 'id' | 'photoUrl'> = {
          userId: user.id,
          locationName: locationName.trim(),
          startTime: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          safetyChecklist: { ...checklist },
          startLocation: location
        };

        const newRecord = await Database.startShift(recordData, photoFile || undefined);
        setActiveSession(newRecord);
        setPhotoFile(null);
        window.dispatchEvent(new CustomEvent('downey:shift-changed'));
    } catch (error: any) {
        console.error("Failed to start shift:", error);
        alert(error.message || "Could not start the shift. GPS is required.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleTogglePause = async () => {
    if (!activeSession) return;
    setIsProcessing(true);
    try {
      const updatedSession = await Database.togglePause(activeSession);
      setActiveSession(updatedSession);
    } catch (error: any) {
      console.error(error);
      alert("Failed to update pause.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeSession) return;
    
    setIsProcessing(true);
    try {
      const location = await getRequiredLocation();
      await Database.endShift(activeSession.id, {
        endTime: new Date().toISOString(),
        endLocation: location,
        isPaused: false,
        notes: checkoutNotes.trim()
      }, endPhotoFile || undefined);
      
      setActiveSession(null);
      setPhotoPreview(null);
      setPhotoFile(null);
      setEndPhotoPreview(null);
      setEndPhotoFile(null);
      setLocationName('');
      setChecklist(INITIAL_CHECKLIST);
      setCheckoutNotes('');
      window.dispatchEvent(new CustomEvent('downey:shift-changed'));
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Could not end the shift. GPS location is mandatory for verification.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCheck = (key: keyof SafetyChecklist) => {
    if (!activeSession) {
      setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <Icon className="text-brand-600" size={20} />
        <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  );

  const CheckItem = ({ id, label }: { id: keyof SafetyChecklist, label: string }) => (
    <button
      onClick={() => toggleCheck(id)}
      disabled={!!activeSession}
      className={`
        flex items-center justify-between p-3 rounded-lg border text-left transition-all
        ${checklist[id] 
          ? 'border-brand-500 bg-brand-50 text-brand-700' 
          : 'border-gray-200 text-gray-500 hover:bg-gray-50'}
      `}
    >
      <span className="text-xs font-medium">{label}</span>
      <div className={`w-5 h-5 rounded border flex items-center justify-center ${checklist[id] ? 'bg-brand-500 border-brand-500' : 'bg-white border-gray-300'}`}>
        {checklist[id] && <Check size={14} className="text-white" />}
      </div>
    </button>
  );

  if (initializing) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="animate-spin text-brand-600" size={48} />
      <p className="text-gray-500 font-medium">Initializing security protocols...</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-brand-600" />
            SAFETY PLAN OF ACTION
          </h2>
          <p className="text-gray-500 text-sm italic mt-1">GPS is mandatory to register your service.</p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
          gpsStatus === 'acquired' ? 'bg-green-50 text-green-700 border-green-200' : 
          gpsStatus === 'denied' ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' :
          'bg-gray-50 text-gray-500 border-gray-200'
        }`}>
          {gpsStatus === 'acquired' ? <><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> GPS ACTIVE</> :
           gpsStatus === 'denied' ? <><AlertCircle size={12} /> GPS BLOCKED</> :
           <><Loader2 size={12} className="animate-spin" /> CHECKING GPS</>}
        </div>

        {activeSession && (
          <div className={`px-4 py-2 rounded-full font-mono font-bold transition-colors ${activeSession.isPaused ? 'bg-orange-500 text-white' : 'bg-brand-900 text-white animate-pulse'}`}>
            {formatTime(elapsedTime)}
          </div>
        )}
      </header>

      {gpsStatus === 'denied' && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3 animate-shake">
          <AlertTriangle className="text-red-600 shrink-0" size={24} />
          <div>
            <p className="text-red-900 font-black uppercase text-xs tracking-widest">Action Blocked: GPS Denied</p>
            <p className="text-red-700 text-xs mt-1">Downey Cleaning requires GPS verification. Please authorize location in browser settings and refresh the page.</p>
          </div>
        </div>
      )}

      {/* Checklist Sections */}
      <Section title="Plan of Action" icon={ShieldCheck}>
        <CheckItem id="knowJobSafety" label="Do you know how to complete the job safely?" />
        <CheckItem id="weatherCheck" label="Appropriate weather conditions?" />
        <CheckItem id="safePassInDate" label="Safe Pass in date?" />
        <CheckItem id="hazardAwareness" label="Aware of trip/fall hazards?" />
        <CheckItem id="floorConditions" label="Wet floors identified?" />
      </Section>

      <Section title="Manual Handling" icon={Box}>
        <CheckItem id="manualHandlingCert" label="Manual Handling training complete?" />
        <CheckItem id="liftingHelp" label="Excessive weight (need assistance)?" />
      </Section>

      <Section title="Working at Height" icon={Construction}>
        <CheckItem id="anchorPoints" label="Anchor points identified?" />
        <CheckItem id="ladderFooting" label="One person holding the ladder?" />
        <CheckItem id="safetyCones" label="Cones/wet floor signage?" />
        <CheckItem id="communication" label="Active communication with colleagues?" />
      </Section>

      <Section title="Equipment Verified" icon={Activity}>
        <CheckItem id="laddersCheck" label="Ladders checked?" />
        <CheckItem id="sharpEdges" label="Checked for sharp edges?" />
        <CheckItem id="scraperCovers" label="Covers on blades?" />
        <CheckItem id="hotSurfaces" label="Caution with hot surfaces?" />
        <CheckItem id="chemicalCourse" label="Chemical training complete?" />
        <CheckItem id="chemicalAwareness" label="Aware of dilutions/safety?" />
        <CheckItem id="tidyEquipment" label="Equipment organized?" />
        <CheckItem id="laddersStored" label="Ladders stored safely?" />
      </Section>

      {/* PPE Visual Grid */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-2 mb-4">
          <AlertTriangle className="text-brand-600" size={20} />
          <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">Required PPE</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {[
            { id: 'highVis', label: 'Hi-Vis', icon: Construction },
            { id: 'helmet', label: 'Helmet', icon: HardHat },
            { id: 'goggles', label: 'Goggles', icon: Glasses },
            { id: 'gloves', label: 'Gloves', icon: Hand },
            { id: 'mask', label: 'Mask', icon: ShieldCheck },
            { id: 'earMuffs', label: 'Ear Muffs', icon: Activity },
            { id: 'faceGuard', label: 'Face Guard', icon: ShieldCheck },
            { id: 'harness', label: 'Harness', icon: ShieldCheck },
            { id: 'boots', label: 'Boots', icon: MapPin },
          ].map((ppe) => (
            <button
              key={ppe.id}
              onClick={() => toggleCheck(ppe.id as keyof SafetyChecklist)}
              disabled={!!activeSession}
              className={`
                flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all
                ${checklist[ppe.id as keyof SafetyChecklist] 
                  ? 'border-brand-500 bg-brand-50 shadow-inner' 
                  : 'border-gray-100 bg-gray-50 opacity-60'}
              `}
            >
              <ppe.icon size={24} className={checklist[ppe.id as keyof SafetyChecklist] ? 'text-brand-600' : 'text-gray-400'} />
              <span className="text-[10px] mt-1 font-bold text-gray-600 uppercase text-center">{ppe.label}</span>
              <div className={`mt-1 w-4 h-4 rounded-sm border ${checklist[ppe.id as keyof SafetyChecklist] ? 'bg-brand-500 border-brand-500' : 'bg-white border-gray-300'}`}>
                {checklist[ppe.id as keyof SafetyChecklist] && <Check size={12} className="text-white mx-auto" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!activeSession && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">Work Location</label>
              <button 
                onClick={handleTypeManuallyClick}
                className="text-xs text-brand-600 font-bold flex items-center gap-1 hover:underline"
              >
                {isManualLocation ? <ChevronDown size={14}/> : <Edit2 size={14}/>}
                {isManualLocation ? "Select from list" : "Type manually"}
              </button>
            </div>
            <div className="relative">
              {isManualLocation ? (
                <input
                  type="text"
                  placeholder="Location name or address..."
                  className="w-full rounded-md border-gray-300 p-3 bg-white border font-medium"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              ) : (
                <select
                  className="w-full rounded-md border-gray-300 p-3 appearance-none bg-white border font-medium"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                >
                  <option value="">Select location...</option>
                  {availableLocations.map((loc, idx) => (
                    <option key={idx} value={loc.name}>{loc.name} - {loc.address}</option>
                  ))}
                </select>
              )}
              <MapPin className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>

          {isManualLocation && locationName.trim().length > 2 && (
            <div className="bg-brand-50 p-4 rounded-xl border border-brand-200 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Calendar className="text-brand-600" size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-900 uppercase tracking-widest">Recurring Schedule?</p>
                  <p className="text-[10px] text-brand-600 font-bold">Register this site in your weekly agenda.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsShowingScheduleModal(true)}
                className="bg-brand-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-colors shadow-sm whitespace-nowrap"
              >
                Yes, Register Site
              </button>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-tight">Start Photo (Temporarily Unavailable)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-not-allowed bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <Camera className="w-8 h-8 text-gray-300" />
                  <p className="text-xs text-gray-400 mt-2 italic">Feature disabled</p>
                </div>
                <input type="file" className="hidden" disabled onChange={(e) => handlePhotoSelect(e, false)} />
            </label>
          </div>
        </div>
      )}

      <div className={`p-8 rounded-xl text-center transition-all shadow-lg ${activeSession ? (activeSession.isPaused ? 'bg-orange-600 text-white' : 'bg-brand-900 text-white') : 'bg-brand-100'}`}>
        {activeSession ? (
          <div className="space-y-6">
             <div className={activeSession.isPaused ? '' : 'animate-pulse'}>
                <p className="text-white/70 font-bold uppercase tracking-widest text-[10px] mb-1">
                  {activeSession.isPaused ? 'Shift on Break' : 'Shift in Progress'}
                </p>
                <div className="text-5xl font-mono font-bold tracking-tighter">{formatTime(elapsedTime)}</div>
                <p className="text-white/60 text-sm mt-2 font-medium">{activeSession.locationName}</p>
             </div>
             
             <div className="bg-white/10 p-4 rounded-lg text-left border border-white/5">
                <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-widest">End Photo (Temporarily Unavailable)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-white/20 border-dashed rounded-lg cursor-not-allowed bg-white/5 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <Camera className="w-8 h-8 text-white/20" />
                    <p className="text-[10px] text-white/30 mt-2 italic font-bold">Feature disabled</p>
                  </div>
                  <input type="file" className="hidden" disabled onChange={(e) => handlePhotoSelect(e, true)} />
                </label>
             </div>

             <div className="bg-white/10 p-4 rounded-lg text-left border border-white/5 space-y-2">
                <label className="block text-xs font-bold text-white/70 uppercase tracking-widest">Observations</label>
                <textarea
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium placeholder:text-white/30 min-h-[80px] resize-none"
                  placeholder="Add any observations about today's work..."
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                />
             </div>

             <div className="flex gap-4">
                <Button 
                    onClick={handleTogglePause} 
                    variant="secondary"
                    className={`flex-1 font-bold ${activeSession.isPaused ? 'bg-green-500 text-white border-none hover:bg-green-600' : 'bg-white text-orange-600 border-none'}`}
                    disabled={isProcessing}
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : (activeSession.isPaused ? <Play size={20} className="mr-2"/> : <PauseCircle size={20} className="mr-2"/>)}
                    {activeSession.isPaused ? 'Resume' : 'Break'}
                </Button>

                <Button 
                    onClick={handleEndShift} 
                    variant="danger" 
                    className="flex-1 shadow-xl font-bold bg-red-500 hover:bg-red-600 border-none"
                    disabled={isProcessing}
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <StopCircle size={20} className="mr-2"/>} 
                    Finish
                </Button>
             </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              onClick={handleStartShift} 
              size="lg" 
              className="w-full shadow-md py-4 text-xl"
              disabled={isProcessing}
              >
              {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2"/>} 
              {isProcessing ? "Verifying GPS..." : "Submit and Start"}
            </Button>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">GPS is required to start.</p>
          </div>
        )}
      </div>

      {/* Register to Schedule Modal */}
      {isShowingScheduleModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fade-in text-white border border-slate-700">
            <div className="p-6 flex justify-between items-center border-b border-slate-800">
               <div>
                 <h3 className="text-xl font-black uppercase tracking-tight">Add to Weekly Schedule</h3>
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{locationName}</p>
               </div>
               <button onClick={() => setIsShowingScheduleModal(false)} className="text-slate-500 hover:text-white transition-colors">
                 <X size={28} />
               </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <Input 
                  label="Site Name" 
                  placeholder="e.g. Downey Tech Hub"
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={locationName} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocationName(e.target.value)} 
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-bold rounded-xl"
                />

                <Input 
                  label="Site Address" 
                  placeholder="Street, Building, Room..."
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={scheduleFormData.address} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduleFormData({...scheduleFormData, address: e.target.value})} 
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-bold rounded-xl"
                />

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Instructions / Notes</label>
                  <textarea 
                    className="w-full rounded-xl border-slate-700 bg-slate-800 text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none font-bold min-h-[80px]"
                    placeholder="Specific tasks for this recurring shift..."
                    value={scheduleFormData.notes}
                    onChange={(e) => setScheduleFormData({...scheduleFormData, notes: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Frequency</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((day, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleScheduleDay(idx)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black transition-all ${scheduleFormData.days.includes(idx) ? 'bg-brand-500 border-brand-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                      >
                        {day.substring(0, 3).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-1/2">
                   <Input 
                    label="Shift Duration (Hours)" 
                    type="number" 
                    min="0.5" 
                    step="0.5"
                    labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                    value={scheduleFormData.hoursPerDay} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduleFormData({...scheduleFormData, hoursPerDay: Number(e.target.value)})} 
                    className="bg-slate-800 border-slate-700 text-white font-bold rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                    variant="outline" 
                    fullWidth 
                    onClick={() => setIsShowingScheduleModal(false)}
                    className="border-slate-700 text-slate-400 hover:bg-slate-800 rounded-xl font-black"
                >
                    Cancel
                </Button>
                <Button 
                    fullWidth 
                    onClick={handleRegisterSchedule}
                    disabled={isProcessing}
                    className="bg-brand-600 hover:bg-brand-500 rounded-xl font-black shadow-lg"
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>} 
                    Confirm Registration
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ask to Register Modal */}
      {isShowingAskRegisterModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in text-white border border-slate-700">
            <div className="p-6 flex justify-between items-center border-b border-slate-800">
               <div>
                 <h3 className="text-xl font-black uppercase tracking-tight">Register Location?</h3>
               </div>
               <button onClick={() => setIsShowingAskRegisterModal(false)} className="text-slate-500 hover:text-white transition-colors">
                 <X size={28} />
               </button>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-sm text-slate-300 leading-relaxed font-medium">
                Would you like to register this new work location to save it for future check-ins?
              </p>

              <div className="flex gap-3">
                <Button 
                    variant="outline" 
                    fullWidth 
                    onClick={handleAskRegisterNo}
                    className="border-slate-700 text-slate-400 hover:bg-slate-800 rounded-xl font-black"
                >
                    No
                </Button>
                <Button 
                    fullWidth 
                    onClick={handleAskRegisterYes}
                    className="bg-brand-600 hover:bg-brand-500 rounded-xl font-black shadow-lg"
                >
                    Yes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company/Office Register Modal */}
      {isShowingCompanyRegisterModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fade-in text-white border border-slate-700">
            <div className="p-6 flex justify-between items-center border-b border-slate-800">
               <div>
                 <h3 className="text-xl font-black uppercase tracking-tight">Register Work Location</h3>
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Add new work location</p>
               </div>
               <button onClick={() => setIsShowingCompanyRegisterModal(false)} className="text-slate-500 hover:text-white transition-colors">
                 <X size={28} />
               </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <Input 
                  label="Location Name" 
                  placeholder="e.g. Downey Tech Hub, Central Office..."
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={newOfficeForm.name} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOfficeForm({...newOfficeForm, name: e.target.value})} 
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-bold rounded-xl"
                />

                <Input 
                  label="Eircode / ZIP" 
                  placeholder="e.g. D02 X123"
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={newOfficeForm.eircode} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOfficeForm({...newOfficeForm, eircode: e.target.value})} 
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-bold rounded-xl"
                />

                <Input 
                  label="Full Address" 
                  placeholder="Street, Number, Neighborhood, City..."
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={newOfficeForm.address} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOfficeForm({...newOfficeForm, address: e.target.value})} 
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-bold rounded-xl"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                    variant="outline" 
                    fullWidth 
                    onClick={() => setIsShowingCompanyRegisterModal(false)}
                    className="border-slate-700 text-slate-400 hover:bg-slate-800 rounded-xl font-black"
                >
                    Cancel
                </Button>
                <Button 
                    fullWidth 
                    onClick={handleSaveCompany}
                    disabled={isProcessing}
                    className="bg-brand-600 hover:bg-brand-500 rounded-xl font-black shadow-lg"
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>} 
                    Save Location
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 
