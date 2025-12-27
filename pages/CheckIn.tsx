
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database } from '../services/database';
import { TimeRecord, SafetyChecklist } from '../types';
import { Button } from '../components/ui/Button';
import { Camera, ShieldCheck, PlayCircle, StopCircle, Check, MapPin, Loader2, HardHat, Glasses, Hand, Activity, Construction, Box, AlertTriangle, ChevronDown, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Added missing SAFETY_LABELS constant
const SAFETY_LABELS: Record<keyof SafetyChecklist, string> = {
  knowJobSafety: "Job Safety Plan", weatherCheck: "Weather Check", safePassInDate: "Safe Pass",
  hazardAwareness: "Hazard Awareness", floorConditions: "Floor Check", manualHandlingCert: "Manual Handling",
  liftingHelp: "Lifting Help", anchorPoints: "Anchor Points", ladderFooting: "Ladder Footing",
  safetyCones: "Safety Cones", communication: "Comm. Protocol", laddersCheck: "Ladder Check",
  sharpEdges: "Sharp Edges", scraperCovers: "Scraper Covers", hotSurfaces: "Hot Surfaces",
  chemicalCourse: "Chem Course", chemicalAwareness: "Chem Awareness", tidyEquipment: "Tidy Equip",
  laddersStored: "Ladder Storage", highVis: "High Vis", helmet: "Helmet", goggles: "Goggles",
  gloves: "Gloves", mask: "Mask", earMuffs: "Ear Muffs", faceGuard: "Face Guard", harness: "Harness", boots: "Boots"
};

const INITIAL_CHECKLIST: SafetyChecklist = {
  knowJobSafety: false, weatherCheck: false, safePassInDate: false, hazardAwareness: false, floorConditions: false,
  manualHandlingCert: false, liftingHelp: false, anchorPoints: false, ladderFooting: false, safetyCones: false,
  communication: false, laddersCheck: false, sharpEdges: false, scraperCovers: false, hotSurfaces: false,
  chemicalCourse: false, chemicalAwareness: false, tidyEquipment: false, laddersStored: false,
  highVis: false, helmet: false, goggles: false, gloves: false, mask: false, earMuffs: false, faceGuard: false, harness: false, boots: false
};

export const CheckIn: React.FC = () => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<TimeRecord | null>(null);
  const [locationName, setLocationName] = useState('');
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<{name: string, address: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
          if (session.safetyChecklist) setChecklist({ ...INITIAL_CHECKLIST, ...session.safetyChecklist });
        }
        const schedules = await Database.getSchedulesByUser(user.id);
        const locs = schedules.map(s => ({ name: s.locationName, address: s.address }));
        setAvailableLocations(locs);
        if (locs.length === 0) setIsManualLocation(true);
      } catch (e) { console.error(e); } finally { setInitializing(false); }
    };
    init();
  }, [user]);

  useEffect(() => {
    if (activeSession) {
      const startTime = new Date(activeSession.startTime).getTime();
      timerRef.current = window.setInterval(() => setElapsedTime(Math.floor((Date.now() - startTime) / 1000)), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  const handleStartShift = async () => {
    if (!user || !locationName) return;
    setIsProcessing(true);
    try {
      const rec = await Database.startShift({
        userId: user.id,
        locationName: locationName,
        startTime: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        safetyChecklist: checklist
      }, photoFile || undefined);
      setActiveSession(rec);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleEndShift = async () => {
    if (!activeSession) return;
    setIsProcessing(true);
    try {
      await Database.endShift(activeSession.id, { endTime: new Date().toISOString() }, endPhotoFile || undefined);
      setActiveSession(null);
      setChecklist(INITIAL_CHECKLIST);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  if (initializing) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <h2 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="text-brand-600" /> Professional Safety Board</h2>
      
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.keys(INITIAL_CHECKLIST).slice(0, 8).map(key => (
            <button key={key} onClick={() => setChecklist(prev => ({...prev, [key]: !prev[key as keyof SafetyChecklist]}))} className={`p-2 rounded border text-[10px] font-bold ${checklist[key as keyof SafetyChecklist] ? 'bg-brand-500 text-white' : 'bg-gray-50'}`}>
              {SAFETY_LABELS[key as keyof SafetyChecklist]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-brand-900 p-8 rounded-2xl text-white text-center shadow-xl">
        {activeSession ? (
          <div className="space-y-4">
            <div className="text-4xl font-mono animate-pulse">{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</div>
            <p className="text-brand-300 font-bold uppercase">{activeSession.locationName}</p>
            <Button variant="danger" fullWidth onClick={handleEndShift} disabled={isProcessing}>End Shift</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <input className="w-full bg-white/10 p-3 rounded border border-white/20 text-white outline-none" placeholder="Enter Location..." value={locationName} onChange={e => setLocationName(e.target.value)} />
            <Button fullWidth onClick={handleStartShift} disabled={isProcessing || !locationName}>Start Service</Button>
          </div>
        )}
      </div>
    </div>
  );
};
