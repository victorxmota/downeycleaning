
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, SafetyChecklist, GeoLocation } from '../types';
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
  Edit2,
  PauseCircle,
  Play,
  AlertCircle
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
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'acquired' | 'denied' | 'error'>('checking');
  
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

        checkGpsAvailability();
      } catch (e) {
        console.error("Error initializing check-in", e);
      } finally {
        setInitializing(false);
      }
    };
    init();
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

  const getRequiredLocation = (): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Seu navegador não suporta geolocalização. O GPS é obrigatório para check-in/out."));
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
            reject(new Error("Permissão de GPS negada. É obrigatório autorizar o acesso à localização para continuar."));
          } else {
            setGpsStatus('error');
            reject(new Error("Não foi possível obter sua localização. Certifique-se de que o GPS do dispositivo está ligado."));
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleStartShift = async () => {
    if (!user || !locationName.trim()) {
      alert("Por favor, selecione ou digite um local.");
      return;
    }

    const checkedCount = Object.values(checklist).filter(v => v === true).length;
    if (checkedCount < 5) {
      if (!confirm("Você marcou poucos itens de segurança. Deseja prosseguir mesmo assim?")) return;
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
    } catch (error: any) {
        console.error("Falha ao iniciar turno:", error);
        alert(error.message || "Não foi possível iniciar o turno. O GPS é obrigatório.");
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
      alert("Falha ao atualizar pausa.");
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
        isPaused: false
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
      alert(error.message || "Não foi possível encerrar o turno. A localização GPS é obrigatória para verificação.");
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
      <p className="text-gray-500 font-medium">Iniciando protocolos de segurança...</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-brand-600" />
            Plano de Segurança Ativo
          </h2>
          <p className="text-gray-500 text-sm italic mt-1">O GPS é obrigatório para registrar seu serviço.</p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
          gpsStatus === 'acquired' ? 'bg-green-50 text-green-700 border-green-200' : 
          gpsStatus === 'denied' ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' :
          'bg-gray-50 text-gray-500 border-gray-200'
        }`}>
          {gpsStatus === 'acquired' ? <><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> GPS ATIVO</> :
           gpsStatus === 'denied' ? <><AlertCircle size={12} /> GPS BLOQUEADO</> :
           <><Loader2 size={12} className="animate-spin" /> VERIFICANDO GPS</>}
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
            <p className="text-red-900 font-black uppercase text-xs tracking-widest">Ação Bloqueada: GPS Negado</p>
            <p className="text-red-700 text-xs mt-1">A Downey Cleaning exige verificação GPS. Por favor, autorize a localização nas configurações do navegador e atualize a página.</p>
          </div>
        </div>
      )}

      {/* Checklist Sections */}
      <Section title="Plano de Ação" icon={ShieldCheck}>
        <CheckItem id="knowJobSafety" label="Sabe completar o trabalho com segurança?" />
        <CheckItem id="weatherCheck" label="Condições climáticas apropriadas?" />
        <CheckItem id="safePassInDate" label="Safe Pass em dia?" />
        <CheckItem id="hazardAwareness" label="Ciente de riscos de tropeço/queda?" />
        <CheckItem id="floorConditions" label="Pisos molhados identificados?" />
      </Section>

      <Section title="Levantamento de Peso" icon={Box}>
        <CheckItem id="manualHandlingCert" label="Certificado de Manual Handling completo?" />
        <CheckItem id="liftingHelp" label="Peso excessivo (precisa de ajuda)?" />
      </Section>

      <Section title="Trabalho em Altura" icon={Construction}>
        <CheckItem id="anchorPoints" label="Pontos de ancoragem identificados?" />
        <CheckItem id="ladderFooting" label="Uma pessoa segurando a escada?" />
        <CheckItem id="safetyCones" label="Cones/sinalização de piso molhado?" />
        <CheckItem id="communication" label="Comunicação com colegas ativa?" />
      </Section>

      <Section title="Equipamento Verificado" icon={Activity}>
        <CheckItem id="laddersCheck" label="Escadas verificadas?" />
        <CheckItem id="sharpEdges" label="Verificou bordas afiadas?" />
        <CheckItem id="scraperCovers" label="Protetores nas lâminas?" />
        <CheckItem id="hotSurfaces" label="Cuidado com superfícies quentes?" />
        <CheckItem id="chemicalCourse" label="Treinamento de químicos completo?" />
        <CheckItem id="chemicalAwareness" label="Ciente das diluições/segurança?" />
        <CheckItem id="tidyEquipment" label="Equipamento organizado?" />
        <CheckItem id="laddersStored" label="Escadas guardadas com segurança?" />
      </Section>

      {/* PPE Visual Grid */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-2 mb-4">
          <AlertTriangle className="text-brand-600" size={20} />
          <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">EPIs Necessários</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {[
            { id: 'highVis', label: 'Colete', icon: Construction },
            { id: 'helmet', label: 'Capacete', icon: HardHat },
            { id: 'goggles', label: 'Óculos', icon: Glasses },
            { id: 'gloves', label: 'Luvas', icon: Hand },
            { id: 'mask', label: 'Máscara', icon: ShieldCheck },
            { id: 'earMuffs', label: 'Protetor Auricular', icon: Activity },
            { id: 'faceGuard', label: 'Protetor Facial', icon: ShieldCheck },
            { id: 'harness', label: 'Cinto', icon: ShieldCheck },
            { id: 'boots', label: 'Botas', icon: MapPin },
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
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">Local de Trabalho</label>
              <button 
                onClick={() => setIsManualLocation(!isManualLocation)}
                className="text-xs text-brand-600 font-bold flex items-center gap-1 hover:underline"
              >
                {isManualLocation ? <ChevronDown size={14}/> : <Edit2 size={14}/>}
                {isManualLocation ? "Selecionar da lista" : "Digitar manualmente"}
              </button>
            </div>
            <div className="relative">
              {isManualLocation ? (
                <input
                  type="text"
                  placeholder="Nome do local ou endereço..."
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
                  <option value="">Selecione o local...</option>
                  {availableLocations.map((loc, idx) => (
                    <option key={idx} value={loc.name}>{loc.name} - {loc.address}</option>
                  ))}
                </select>
              )}
              <MapPin className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-tight">Foto Início (Opcional)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="h-28 object-contain rounded shadow-sm" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-gray-400" />
                      <p className="text-xs text-gray-400 mt-2">Clique para tirar foto</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e, false)} />
            </label>
          </div>
        </div>
      )}

      <div className={`p-8 rounded-xl text-center transition-all shadow-lg ${activeSession ? (activeSession.isPaused ? 'bg-orange-600 text-white' : 'bg-brand-900 text-white') : 'bg-brand-100'}`}>
        {activeSession ? (
          <div className="space-y-6">
             <div className={activeSession.isPaused ? '' : 'animate-pulse'}>
                <p className="text-white/70 font-bold uppercase tracking-widest text-[10px] mb-1">
                  {activeSession.isPaused ? 'Turno em Pausa / Break' : 'Turno em Andamento'}
                </p>
                <div className="text-5xl font-mono font-bold tracking-tighter">{formatTime(elapsedTime)}</div>
                <p className="text-white/60 text-sm mt-2 font-medium">{activeSession.locationName}</p>
             </div>
             
             <div className="bg-white/10 p-4 rounded-lg text-left border border-white/5">
                <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-widest">Foto Final (Opcional)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-white/20 border-dashed rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    {endPhotoPreview ? (
                      <img src={endPhotoPreview} alt="Preview" className="h-28 object-contain rounded shadow-sm" />
                    ) : (
                      <Camera className="w-8 h-8 text-white/40" />
                    )}
                  </div>
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e, true)} />
                </label>
             </div>

             <div className="flex gap-4">
                <Button 
                    onClick={handleTogglePause} 
                    variant="secondary"
                    className={`flex-1 font-bold ${activeSession.isPaused ? 'bg-green-500 text-white border-none hover:bg-green-600' : 'bg-white text-orange-600 border-none'}`}
                    disabled={isProcessing}
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : (activeSession.isPaused ? <Play size={20} className="mr-2"/> : <PauseCircle size={20} className="mr-2"/>)}
                    {activeSession.isPaused ? 'Retomar' : 'Pausar'}
                </Button>

                <Button 
                    onClick={handleEndShift} 
                    variant="danger" 
                    className="flex-1 shadow-xl font-bold bg-red-500 hover:bg-red-600 border-none"
                    disabled={isProcessing}
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <StopCircle size={20} className="mr-2"/>} 
                    Finalizar
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
              {isProcessing ? "Verificando GPS..." : "Submeter e Iniciar"}
            </Button>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">O GPS é obrigatório para iniciar.</p>
          </div>
        )}
      </div>
    </div>
  );
};
