
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, UserRole, User, SafetyChecklist } from '../types';
import { Button } from '../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  FileDown, 
  Loader2, 
  MapPin, 
  Calendar as CalendarIcon, 
  Clock, 
  Image as ImageIcon, 
  Edit2, 
  Save, 
  X,
  Check,
  PlusCircle,
  User as UserIcon,
  ChevronDown,
  Keyboard,
  ExternalLink,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Trash,
  AlertTriangle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  parseISO, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  subDays,
  addMilliseconds,
  setHours,
  setMinutes,
  isValid
} from 'date-fns';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const CHECKLIST_LABELS: Record<string, string> = {
  knowJobSafety: "Job Safety", weatherCheck: "Weather", safePassInDate: "Safe Pass", 
  hazardAwareness: "Hazards", floorConditions: "Floors", manualHandlingCert: "Manual Handling",
  liftingHelp: "Lifting Help", anchorPoints: "Anchor Points", ladderFooting: "Ladder Footing",
  safetyCones: "Cones", communication: "Communc.", laddersCheck: "Ladders", 
  sharpEdges: "Sharp Edges", scraperCovers: "Scraper Covers", hotSurfaces: "Hot Surfaces",
  chemicalCourse: "Chem. Course", chemicalAwareness: "Chem. Awareness", 
  tidyEquipment: "Tidy Equip.", laddersStored: "Ladders Stored", highVis: "PPE: High Vis",
  helmet: "PPE: Helmet", goggles: "PPE: Goggles", gloves: "PPE: Gloves",
  mask: "PPE: Mask", earMuffs: "PPE: Ear Muffs", faceGuard: "PPE: Face Guard",
  harness: "PPE: Harness", boots: "PPE: Boots"
};

const INITIAL_SAFETY: SafetyChecklist = {
  knowJobSafety: true, weatherCheck: true, safePassInDate: true, hazardAwareness: true,
  floorConditions: true, manualHandlingCert: true, liftingHelp: true, anchorPoints: true,
  ladderFooting: true, safetyCones: true, communication: true, laddersCheck: true,
  sharpEdges: true, scraperCovers: true, hotSurfaces: true, chemicalCourse: true,
  chemicalAwareness: true, tidyEquipment: true, laddersStored: true, highVis: true,
  helmet: true, goggles: true, gloves: true, mask: true, earMuffs: true, faceGuard: true,
  harness: true, boots: true
};

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('monthly'); 
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);

  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isManualLocationEntry, setIsManualLocationEntry] = useState(false);
  const [employeeLocations, setEmployeeLocations] = useState<string[]>([]);
  const [manualData, setManualData] = useState({
    userId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    locationName: '',
    hours: 4
  });

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editHours, setEditHours] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    if (user) {
      const initialFilter = isAdmin ? 'all' : user.id;
      setSelectedUserFilter(initialFilter);
      setManualData(prev => ({ ...prev, userId: isAdmin ? '' : user.id }));
      loadData(initialFilter);
    }
  }, [user]);

  const loadData = async (userIdFilter: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
        let allRecords: TimeRecord[] = [];
        if (isAdmin) {
            const fetchedUsers = await Database.getAllUsers();
            const employees = fetchedUsers.filter((u: User) => u.role === UserRole.EMPLOYEE);
            setUsers(employees);
            
            if (userIdFilter === 'all') {
              allRecords = await Database.getAllRecords();
            } else {
              allRecords = await Database.getRecordsByUser(userIdFilter);
            }
        } else {
            allRecords = await Database.getRecordsByUser(user.id);
            setUsers([user]);
        }
        setRecords(allRecords);
    } catch (error) {
        console.error("Error loading report data:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadData(selectedUserFilter);
    }
  }, [selectedUserFilter]);

  useEffect(() => {
    const fetchEmployeeSchedules = async () => {
      const targetUserId = isAdmin ? manualData.userId : user?.id;
      if (isAddingManual && targetUserId) {
        try {
          const schedules = await Database.getSchedulesByUser(targetUserId);
          const uniqueLocs = Array.from(new Set(schedules.map(s => s.locationName)));
          setEmployeeLocations(uniqueLocs);
          if (!isManualLocationEntry && uniqueLocs.length > 0 && !uniqueLocs.includes(manualData.locationName)) {
            setManualData(prev => ({ ...prev, locationName: uniqueLocs[0] }));
          } else if (uniqueLocs.length === 0) {
            setIsManualLocationEntry(true);
          }
        } catch (e) {}
      }
    };
    fetchEmployeeSchedules();
  }, [manualData.userId, isAddingManual, isAdmin, user?.id]);

  useEffect(() => {
    let result = [...records];
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (selectedPeriod) {
      case 'daily': start = startOfDay(now); end = endOfDay(now); break;
      case 'weekly': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
      case 'monthly': start = startOfMonth(now); end = endOfMonth(now); break;
      case 'yearly': start = startOfYear(now); end = endOfYear(now); break;
      case 'custom': start = startOfDay(parseISO(customStartDate)); end = endOfDay(parseISO(customEndDate)); break;
      default: start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 });
    }

    result = result.filter((record) => {
      if (!record.startTime) return false;
      const recordDate = typeof record.startTime === 'string' ? parseISO(record.startTime) : new Date(record.startTime);
      if (!isValid(recordDate)) return false;
      return isWithinInterval(recordDate, { start, end });
    });

    setFilteredRecords(result);
  }, [selectedPeriod, customStartDate, customEndDate, records]);

  const msToTime = (durationMs: number) => {
    if (isNaN(durationMs) || durationMs < 0) return "0h 0min";
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${minutes}min`;
  };

  const calculateTotalTime = () => {
    return filteredRecords.reduce((acc, rec) => {
      if (!rec.endTime) return acc;
      const start = new Date(rec.startTime).getTime();
      const end = new Date(rec.endTime).getTime();
      const pause = rec.totalPausedMs || 0;
      return acc + (end - start - pause);
    }, 0);
  };

  const getChartData = () => {
    const data: Record<string, number> = {};
    filteredRecords.forEach((record) => {
      if (!record.endTime) return;
      const recordDate = typeof record.startTime === 'string' ? parseISO(record.startTime) : new Date(record.startTime);
      if (!isValid(recordDate)) return;
      
      const label = format(recordDate, 'dd/MM');
      const start = recordDate.getTime();
      const end = new Date(record.endTime).getTime();
      const pause = record.totalPausedMs || 0;
      const hours = (end - start - pause) / 36e5;
      data[label] = (data[label] || 0) + Math.max(0, hours);
    });
    return Object.keys(data).map(label => ({ 
      name: label, 
      hours: Number(data[label].toFixed(2)),
      formatted: msToTime(data[label] * 3600000)
    }));
  };

  const formatGPS = (loc?: {lat: number, lng: number}) => {
    if (!loc || typeof loc.lat !== 'number') return 'N/A';
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  };

  const getCheckedItems = (checklist?: SafetyChecklist) => {
    if (!checklist) return [];
    return Object.entries(checklist)
      .filter(([_, checked]) => checked === true)
      .map(([key, _]) => CHECKLIST_LABELS[key] || key);
  };

  const handleAddManualShift = async () => {
    const targetUserId = isAdmin ? manualData.userId : user?.id;
    if (!manualData.locationName || !targetUserId) {
      alert("Please select employee and location.");
      return;
    }
    
    setIsUpdating(true);
    try {
      const baseDate = parseISO(manualData.date);
      const start = setHours(setMinutes(baseDate, 0), 8);
      const end = addMilliseconds(start, manualData.hours * 3600000);
      
      const newRecord: Omit<TimeRecord, 'id'> = {
        userId: targetUserId,
        locationName: manualData.locationName,
        date: manualData.date,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        safetyChecklist: { ...INITIAL_SAFETY },
        totalPausedMs: 0,
        isPaused: false
      };

      await Database.addRecord(newRecord);
      await loadData(selectedUserFilter);
      setIsAddingManual(false);
      setManualData(prev => ({ ...prev, locationName: '', hours: 4 }));
    } catch (e) {
      alert("Failed to add manual shift.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateRecord = async (id: string) => {
    setIsUpdating(true);
    try {
      const record = records.find(r => r.id === id);
      if (!record) return;

      const durationMs = editHours * 3600000;
      const startTime = new Date(record.startTime);
      const endTime = new Date(startTime.getTime() + durationMs + (record.totalPausedMs || 0));

      await Database.updateRecord(id, {
        locationName: editLocation,
        endTime: endTime.toISOString()
      });
      
      await loadData(selectedUserFilter);
      setEditingRecordId(null);
    } catch (e) {
      alert("Failed to update record.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this shift record?")) return;
    setIsUpdating(true);
    try {
      await Database.deleteRecord(id);
      await loadData(selectedUserFilter);
    } catch (e) {
      alert("Failed to delete record.");
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditing = (record: TimeRecord) => {
    setEditingRecordId(record.id);
    setEditLocation(record.locationName);
    const start = new Date(record.startTime).getTime();
    const end = record.endTime ? new Date(record.endTime).getTime() : Date.now();
    const pause = record.totalPausedMs || 0;
    setEditHours((end - start - pause) / 3600000);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const reportUser = users.find(u => u.id === selectedUserFilter) || user;
    const img = new Image();
    img.src = 'logo.png';
    img.onload = () => { doc.addImage(img, 'PNG', 14, 8, 25, 25); renderPDFContent(doc, reportUser); };
    img.onerror = () => { renderPDFContent(doc, reportUser); };
  };

  const renderPDFContent = (doc: jsPDF, reportUser: any) => {
    doc.setFontSize(22); doc.setTextColor(0, 84, 139); doc.text('DOWNEY CLEANING SERVICES', 42, 18);
    doc.setFontSize(8); doc.setTextColor(255, 194, 14); doc.text('PROFESSIONAL HYGIENE SOLUTIONS', 42, 23);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Official Service Report: ${reportUser?.name || 'All Personnel'}`, 42, 30);
    doc.text(`Total Period Hours: ${msToTime(calculateTotalTime())}`, 42, 35);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 280, 15, { align: 'right' });
    
    const tableData = filteredRecords
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map((rec) => {
          const start = new Date(rec.startTime).getTime();
          const end = rec.endTime ? new Date(rec.endTime).getTime() : Date.now();
          const pause = rec.totalPausedMs || 0;
          const duration = msToTime(end - start - pause);
          const checkedSafety = getCheckedItems(rec.safetyChecklist).join(', ');

          return [
            format(parseISO(rec.date), 'dd/MM/yyyy'),
            rec.locationName,
            `${format(parseISO(rec.startTime), 'HH:mm')} - ${rec.endTime ? format(parseISO(rec.endTime), 'HH:mm') : 'Active' }`,
            duration,
            checkedSafety || 'None',
            `GPS IN: ${formatGPS(rec.startLocation)}\nGPS OUT: ${formatGPS(rec.endLocation)}`,
            rec.endTime ? 'COMPLETED' : 'IN PROGRESS'
          ];
      });

    autoTable(doc, {
      head: [['DATE', 'SITE LOCATION', 'SHIFT TIME', 'DURATION', 'SAFETY COMPLIANCE', 'GPS LOGS', 'STATUS']],
      body: tableData,
      startY: 42,
      styles: { fontSize: 7, cellPadding: 2, font: 'helvetica', overflow: 'linebreak' },
      columnStyles: { 4: { cellWidth: 50 }, 5: { cellWidth: 35 } },
      headStyles: { fillColor: [0, 84, 139], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 247, 255] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(12); doc.setTextColor(0, 84, 139); doc.text(`Grand Total Worked: ${msToTime(calculateTotalTime())}`, 14, finalY + 15);
    doc.save(`Downey_Cleaning_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-brand-600" size={48}/>
        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Syncing Reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-sm hidden md:block border border-gray-100">
            <img src="logo.png" alt="Downey Logo" className="w-12 h-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-600 tracking-tight">Activity Reports</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Official staff logs and compliance evidence</p>
          </div>
        </div>
        <div className="flex gap-2">
            {isAdmin && (
              <Button onClick={() => setIsAddingManual(!isAddingManual)} variant="outline" className="border-brand-600 text-brand-600 hover:bg-brand-50 rounded-xl font-bold">
                {isAddingManual ? <X size={18} className="mr-2" /> : <PlusCircle size={18} className="mr-2" />} 
                {isAddingManual ? 'Cancel' : 'Manual Shift'}
              </Button>
            )}
            <Button onClick={exportPDF} className="shadow-lg bg-brand-600 hover:bg-brand-900 font-bold rounded-xl">
              <FileDown size={18} className="mr-2" /> Export PDF
            </Button>
        </div>
      </header>

      {isAddingManual && isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-brand-100 animate-fade-in space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                <PlusCircle className="text-brand-600" size={20} />
                <h3 className="font-black text-brand-900 text-sm uppercase tracking-widest">Register Manual Operational Shift</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Personnel</label>
                  <div className="relative">
                      <UserIcon className="absolute left-3 top-3 text-gray-400" size={16} />
                      <select 
                          className="w-full border p-2.5 pl-10 rounded-xl bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                          value={manualData.userId}
                          onChange={(e) => setManualData({...manualData, userId: e.target.value})}
                      >
                          <option value="">Select Staff...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                  </div>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Shift Date</label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-3 text-gray-400" size={16} />
                        <input type="date" className="w-full border p-2.5 pl-10 rounded-xl bg-gray-50 text-sm font-bold outline-none" value={manualData.date} onChange={(e) => setManualData({...manualData, date: e.target.value})} />
                    </div>
                </div>
                <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Location Name</label>
                      <button onClick={() => setIsManualLocationEntry(!isManualLocationEntry)} className="text-[9px] font-black text-brand-600 uppercase flex items-center gap-1">
                        {isManualLocationEntry ? "From List" : "Type Name"}
                      </button>
                    </div>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                        {isManualLocationEntry || employeeLocations.length === 0 ? (
                           <input type="text" placeholder="Site name..." className="w-full border p-2.5 pl-10 rounded-xl bg-gray-50 text-sm font-bold outline-none" value={manualData.locationName} onChange={(e) => setManualData({...manualData, locationName: e.target.value})} />
                        ) : (
                           <select className="w-full border p-2.5 pl-10 rounded-xl bg-gray-50 text-sm font-bold outline-none" value={manualData.locationName} onChange={(e) => setManualData({...manualData, locationName: e.target.value})} >
                              <option value="">Select location...</option>
                              {employeeLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                           </select>
                        )}
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Hours</label>
                    <div className="relative flex gap-2">
                        <input type="number" step="0.5" className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-bold outline-none" value={manualData.hours} onChange={(e) => setManualData({...manualData, hours: Number(e.target.value)})} />
                        <Button onClick={handleAddManualShift} disabled={isUpdating} className="rounded-xl px-4 h-[45px]">
                            {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        {isAdmin && (
          <div className="flex flex-col min-w-[180px]">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Employee Filter</label>
            <select className="border p-2.5 rounded-xl bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all outline-none" value={selectedUserFilter} onChange={e => setSelectedUserFilter(e.target.value)}>
              <option value="all">All Personnel</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col min-w-[150px]">
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Timeframe</label>
          <select className="border p-2.5 rounded-xl bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all outline-none" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value as PeriodType)}>
            <option value="daily">Today</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {selectedPeriod === 'custom' && (
          <div className="flex gap-2">
            <input type="date" className="border p-2.5 rounded-xl text-sm font-bold bg-gray-50" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
            <input type="date" className="border p-2.5 rounded-xl text-sm font-bold bg-gray-50" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
          </div>
        )}

        <div className="flex-1"></div>

        <div className="bg-brand-accent p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center min-w-[200px] border-b-4 border-yellow-600">
           <span className="text-[10px] font-black text-brand-900 uppercase tracking-widest mb-1">Period Total</span>
           <span className="text-3xl font-black text-brand-900 flex items-center gap-2">
             <Clock size={24} /> {msToTime(calculateTotalTime())}
           </span>
        </div>
      </div>

      {/* Operational Hours Trend Chart Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest flex items-center gap-2">
            <CalendarIcon size={16} className="text-brand-600" /> Operational Hours Trend
          </h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number, name: string, props: any) => [props.payload.formatted, 'Duration']}
              />
              <Bar 
                dataKey="hours" 
                fill="#0284c7" 
                radius={[6, 6, 0, 0]} 
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-[0.2em]">
              <tr>
                <th className="p-4">Date / Staff</th>
                <th className="p-4">Location</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Safety</th>
                <th className="p-4">GPS Log</th>
                <th className="p-4">Evidence</th>
                <th className="p-4 text-center">Status</th>
                {isAdmin && <th className="p-4 text-center">Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length > 0 ? filteredRecords.map((record) => {
                  const isEditing = editingRecordId === record.id;
                  const start = new Date(record.startTime).getTime();
                  const end = record.endTime ? new Date(record.endTime).getTime() : Date.now();
                  const pause = record.totalPausedMs || 0;
                  const diff = end - start - pause;
                  const checkedCount = Object.values(record.safetyChecklist || {}).filter(v => v === true).length;
                  const staff = users.find(u => u.id === record.userId);
                  
                  return (
                    <tr key={record.id} className="hover:bg-brand-50/30 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{format(parseISO(record.date), 'dd/MM/yyyy')}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-wider">
                          {staff?.name || 'Personnel'}
                        </div>
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <input 
                            className="border p-2 rounded-lg text-sm font-bold w-full"
                            value={editLocation}
                            onChange={e => setEditLocation(e.target.value)}
                          />
                        ) : (
                          <div className="font-black text-brand-600 max-w-[200px] leading-tight">{record.locationName}</div>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                             <input 
                                type="number"
                                step="0.5"
                                className="border p-2 rounded-lg text-sm font-bold w-16"
                                value={editHours}
                                onChange={e => setEditHours(Number(e.target.value))}
                             />
                             <span className="text-[10px] font-black">h</span>
                          </div>
                        ) : (
                          <>
                            <div className="font-black text-gray-900">{msToTime(diff)}</div>
                            <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                              {format(parseISO(record.startTime), 'HH:mm')} → {record.endTime ? format(parseISO(record.endTime), 'HH:mm') : '...'}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="p-4">
                        {checkedCount > 0 ? (
                           <div className="flex items-center gap-1 bg-green-50 text-green-700 px-1.5 py-1 rounded text-[9px] font-black border border-green-100 uppercase tracking-tighter w-fit">
                             <ShieldCheck size={10} /> {checkedCount} ITEMS
                           </div>
                        ) : (
                           <span className="text-[10px] text-gray-300 font-bold italic">No data</span>
                        )}
                      </td>
                      <td className="p-4 text-[9px] text-gray-400 font-mono">
                        <div className="mb-2">
                          {record.startLocation ? (
                            <a 
                              href={`https://www.google.com/maps?q=${record.startLocation.lat},${record.startLocation.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-brand-600 transition-colors"
                              title="View check-in on Google Maps"
                            >
                              <MapPin size={10} className="text-brand-500" /> 
                              IN: {record.startLocation.lat.toFixed(4)}, {record.startLocation.lng.toFixed(4)}
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-300"><MapPin size={10} /> IN: N/A</div>
                          )}
                        </div>
                        <div>
                          {record.endLocation ? (
                            <a 
                              href={`https://www.google.com/maps?q=${record.endLocation.lat},${record.endLocation.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-brand-600 transition-colors"
                              title="View check-out on Google Maps"
                            >
                              <MapPin size={10} className="text-red-500" /> 
                              OUT: {record.endLocation.lat.toFixed(4)}, {record.endLocation.lng.toFixed(4)}
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-300"><MapPin size={10} /> OUT: N/A</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                         <div className="flex gap-1.5">
                           {record.photoUrl ? (
                             <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:scale-110 transition-transform">
                               <img src={record.photoUrl} alt="In" className="w-full h-full object-cover" />
                             </div>
                           ) : (
                             <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 border-dashed flex items-center justify-center text-gray-300">
                               <ImageIcon size={14} />
                             </div>
                           )}
                           {record.endPhotoUrl && (
                             <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:scale-110 transition-transform">
                               <img src={record.endPhotoUrl} alt="Out" className="w-full h-full object-cover" />
                             </div>
                           )}
                         </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${record.endTime ? 'bg-green-100 text-green-700' : 'bg-brand-accent text-brand-900 animate-pulse'}`}>
                          {record.endTime ? 'VERIFIED' : 'LIVE'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-4">
                          <div className="flex justify-center gap-3">
                            {isEditing ? (
                              <>
                                <button onClick={() => handleUpdateRecord(record.id)} className="text-brand-600 hover:scale-125 transition-transform" title="Save Changes">
                                  <Save size={18} />
                                </button>
                                <button onClick={() => setEditingRecordId(null)} className="text-gray-400 hover:scale-125 transition-transform" title="Cancel">
                                  <X size={18} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditing(record)} className="text-brand-500 hover:scale-125 transition-transform" title="Edit Shift">
                                  <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDeleteRecord(record.id)} className="text-red-500 hover:scale-125 transition-transform" title="Delete Shift">
                                  <Trash size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                <tr><td colSpan={isAdmin ? 8 : 7} className="p-20 text-center text-gray-400 italic font-bold uppercase text-[10px] tracking-widest">No service logs found for the selected period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
