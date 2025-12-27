

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, SafetyChecklist } from '../types';
import { Button } from '../components/ui/Button';
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
  Edit2
} from 'lucide-react';

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
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  
  const [endPhotoPreview, setEndPhotoPreview] = useState<string | null>(null);
  const [endPhotoFile, setEndPhotoFile] = useState<File | null>(null);

  const [checklist, setChecklist] = useState<SafetyChecklist>(INITIAL_CHECKLIST);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
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
        }

        const schedules = await Database.getSchedulesByUser(user.id);
        const uniqueLocs = new Map();
        schedules.forEach(s => {
          if (!uniqueLocs.has(s.locationName)) {
            uniqueLocs.set(s.locationName, s.address);
          }
        });
        
        const locArray = Array.from(uniqueLocs.entries()).map(([name, address]) => ({ name, address }));
        setAvailableLocations(locArray);
        
        if (locArray.length === 0) {
          setIsManualLocation(true);
        }
      } catch (e) {
        console.error("Error initializing check-in", e);
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, [user]);

  useEffect(() => {
    if (activeSession) {
      const startTime = new Date(activeSession.startTime).getTime();
      timerRef.current = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, isEnd: boolean) => {
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
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve(null),
        { enableHighAccuracy: true, timeout: 4000 }
      );
    });
  };

  const handleStartShift = async () => {
    if (!user || !locationName.trim()) {
      alert("Please select or type a location.");
      return;
    }

    // Opcional: Validar se ao menos alguns itens do checklist foram marcados
    const checkedCount = Object.values(checklist).filter(v => v === true).length;
    if (checkedCount < 5) {
      if (!confirm("You have very few items checked in the safety plan. Are you sure you want to proceed?")) return;
    }

    setIsProcessing(true);
    
    try {
        const location = await getCurrentLocation();
        
        const recordData: Omit<TimeRecord, 'id' | 'photoUrl'> = {
          userId: user.id,
          locationName: locationName.trim(),
          startTime: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          safetyChecklist: { ...checklist },
          startLocation: location || undefined
        };

        const newRecord = await Database.startShift(recordData, photoFile || undefined);
        setActiveSession(newRecord);
        // Reset local previews
        setPhotoFile(null);
    } catch (error: any) {
        console.error("Failed to start shift:", error);
        alert(`Error: ${error.message || "Could not start shift. Check your connection."}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeSession) return;
    
    setIsProcessing(true);
    try {
      const location = await getCurrentLocation();
      await Database.endShift(activeSession.id, {
        endTime: new Date().toISOString(),
        endLocation: location || undefined
      }, endPhotoFile || undefined);
      
      setActiveSession(null);
      setPhotoPreview(null);
      setPhotoFile(null);
      setEndPhotoPreview(null);
      setEndPhotoFile(null);
      setLocationName('');
      setChecklist(INITIAL_CHECKLIST);
    } catch (error: any) {
      console.error(error);
      alert(`Error ending shift: ${error.message}`);
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
      <p className="text-gray-500 font-medium">Loading security protocols...</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-brand-600" />
            Safety Plan of Action
          </h2>
          <p className="text-gray-500 text-sm italic mt-1">"Safety is our own responsibility. Take 20 seconds to be aware of hazards."</p>
        </div>
        {activeSession && (
          <div className="bg-brand-900 text-white px-4 py-2 rounded-full font-mono font-bold animate-pulse">
            {formatTime(elapsedTime)}
          </div>
        )}
      </header>

      {/* Checklist Sections */}
      <Section title="Plan of Action" icon={ShieldCheck}>
        <CheckItem id="knowJobSafety" label="Know how to complete the job safely?" />
        <CheckItem id="weatherCheck" label="Weather conditions appropriate?" />
        <CheckItem id="safePassInDate" label="Safe Pass in date?" />
        <CheckItem id="hazardAwareness" label="Aware of slip, trip and fall hazards?" />
        <CheckItem id="floorConditions" label="Wet/mildew floors cleaned in advance?" />
      </Section>

      <Section title="Lifting Plan" icon={Box}>
        <CheckItem id="manualHandlingCert" label="Manual Handling Cert complete?" />
        <CheckItem id="liftingHelp" label="Heavy lifting (property owner/2 people)?" />
      </Section>

      <Section title="Working at Heights" icon={Construction}>
        <CheckItem id="anchorPoints" label="Tie onto anchor points?" />
        <CheckItem id="ladderFooting" label="One person to foot the ladder?" />
        <CheckItem id="safetyCones" label="Cones/barriers/wet floor signs?" />
        <CheckItem id="communication" label="Communicate with work colleagues/others?" />
      </Section>

      <Section title="Equipment Checked" icon={Activity}>
        <CheckItem id="laddersCheck" label="Ladders checked for safety?" />
        <CheckItem id="sharpEdges" label="Check for sharp edges?" />
        <CheckItem id="scraperCovers" label="Covers on scraper blades?" />
        <CheckItem id="hotSurfaces" label="Check for hot surfaces?" />
        <CheckItem id="chemicalCourse" label="Chemical Awareness course complete?" />
        <CheckItem id="chemicalAwareness" label="Aware of chemicals/dilution/safety?" />
        <CheckItem id="tidyEquipment" label="Equipment tidy during work/breaks?" />
        <CheckItem id="laddersStored" label="Ladders dismantled and stored safely?" />
      </Section>

      {/* PPE Visual Grid */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-2 mb-4">
          <AlertTriangle className="text-brand-600" size={20} />
          <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">PPE Required (Please Tick Box)</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {[
            { id: 'highVis', label: 'High Vis', icon: Construction },
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
                onClick={() => setIsManualLocation(!isManualLocation)}
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
                  placeholder="Type office name or address..."
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
                  <option value="">Select current office...</option>
                  {availableLocations.map((loc, idx) => (
                    <option key={idx} value={loc.name}>{loc.name} - {loc.address}</option>
                  ))}
                </select>
              )}
              <MapPin className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-tight">Start Photo (Optional)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="h-28 object-contain rounded shadow-sm" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-gray-400" />
                      <p className="text-xs text-gray-400 mt-2">Click to take/upload photo</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e, false)} />
            </label>
          </div>
        </div>
      )}

      <div className={`p-8 rounded-xl text-center transition-all shadow-lg ${activeSession ? 'bg-brand-900 text-white' : 'bg-brand-100'}`}>
        {activeSession ? (
          <div className="space-y-6">
             <div className="animate-pulse">
                <p className="text-brand-300 font-bold uppercase tracking-widest text-xs mb-1">Shift in Progress</p>
                <div className="text-5xl font-mono font-bold tracking-tighter">{formatTime(elapsedTime)}</div>
                <p className="text-brand-400 text-sm mt-2">{activeSession.locationName}</p>
             </div>
             
             <div className="bg-white/10 p-4 rounded-lg text-left border border-white/5">
                <label className="block text-xs font-bold text-brand-200 mb-2 uppercase tracking-widest">End Photo (Optional)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-brand-700 border-dashed rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    {endPhotoPreview ? (
                      <img src={endPhotoPreview} alt="Preview" className="h-28 object-contain rounded shadow-sm" />
                    ) : (
                      <Camera className="w-8 h-8 text-brand-400" />
                    )}
                  </div>
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e, true)} />
                </label>
             </div>

             <Button 
                onClick={handleEndShift} 
                variant="danger" 
                size="lg" 
                className="w-full shadow-xl"
                disabled={isProcessing}
             >
                 {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <StopCircle className="mr-2"/>} Complete Shift
             </Button>
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
              {isProcessing ? "Processing..." : "Submit Plan & Start"}
            </Button>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Downey Cleaning Services Official Portal</p>
          </div>
        )}
      </div>
    </div>
  );
};
