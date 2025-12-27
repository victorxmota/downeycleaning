
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, UserRole, User, SafetyChecklist } from '../types';
import { Button } from '../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileDown, FileText, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';

// Mapeamento de chaves técnicas para nomes legíveis no relatório
const SAFETY_LABELS: Record<keyof SafetyChecklist, string> = {
  knowJobSafety: "Job Safety",
  weatherCheck: "Weather",
  safePassInDate: "Safe Pass",
  hazardAwareness: "Hazards Aware",
  floorConditions: "Floor Checked",
  manualHandlingCert: "Manual Handling",
  liftingHelp: "Lifting Plan",
  anchorPoints: "Anchor Points",
  ladderFooting: "Ladder Footing",
  safetyCones: "Cones/Signs",
  communication: "Comm. Done",
  laddersCheck: "Ladders Checked",
  sharpEdges: "No Sharp Edges",
  scraperCovers: "Scraper Covers",
  hotSurfaces: "No Hot Surfaces",
  chemicalCourse: "Chem Course",
  chemicalAwareness: "Chem Safety",
  tidyEquipment: "Tidy Equip.",
  laddersStored: "Ladders Stored",
  highVis: "High Vis",
  helmet: "Helmet",
  goggles: "Goggles",
  gloves: "Gloves",
  mask: "Mask",
  earMuffs: "Ear Muffs",
  faceGuard: "Face Guard",
  harness: "Harness",
  boots: "Boots"
};

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>(user?.id || 'all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        if (!user) return;
        setIsLoading(true);
        
        try {
            let allRecords: TimeRecord[] = [];
            
            if (user.role === UserRole.ADMIN) {
                const [fetchedRecords, fetchedUsers] = await Promise.all([
                    Database.getAllRecords(),
                    Database.getAllUsers()
                ]);
                allRecords = fetchedRecords;
                setUsers(fetchedUsers.filter((u: User) => u.role === UserRole.EMPLOYEE));
            } else {
                allRecords = await Database.getRecordsByUser(user.id);
                setUsers([user]);
                setSelectedUserFilter(user.id);
            }

            setRecords(allRecords);
            setFilteredRecords(allRecords);
        } catch (error) {
            console.error("Error loading report data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      if (selectedUserFilter === 'all') {
        setFilteredRecords(records);
      } else {
        setFilteredRecords(records.filter((r: TimeRecord) => r.userId === selectedUserFilter));
      }
    } else {
        setFilteredRecords(records);
    }
  }, [selectedUserFilter, records, user]);

  const getChartData = () => {
    const data: Record<string, number> = {};
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    filteredRecords.forEach((record: TimeRecord) => {
      if (!record.endTime) return;
      const date = parseISO(record.date);
      if (date >= weekStart && date <= weekEnd) {
        const dayName = format(date, 'EEEE');
        const start = parseISO(record.startTime);
        const end = parseISO(record.endTime);
        const hours = Math.abs(end.getTime() - start.getTime()) / 36e5;
        data[dayName] = (data[dayName] || 0) + Number(hours.toFixed(2));
      }
    });

    return Object.keys(data).map(day => ({ name: day, hours: data[day] }));
  };

  const formatGPS = (loc?: {lat: number, lng: number}) => {
    if (!loc) return 'Not recorded';
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  };

  const getSafetySummary = (checklist?: SafetyChecklist) => {
    if (!checklist) return 'No data';
    const checked = Object.entries(checklist)
      .filter(([_, value]) => value === true)
      .map(([key]) => SAFETY_LABELS[key as keyof SafetyChecklist] || key);
    
    return checked.length > 0 ? checked.join(', ') : 'None selected';
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const reportUser = users.find(u => u.id === selectedUserFilter) || user;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199); 
    doc.text('DOWNEY CLEANING SERVICES', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Staff Member: ${reportUser?.name || 'N/A'}`, 14, 22);
    doc.text(`Report Period: ${format(new Date(), 'MMMM yyyy')}`, 14, 27);
    doc.text(`Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 32);
    
    const tableData = filteredRecords
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map((rec: TimeRecord) => {
        const start = format(parseISO(rec.startTime), 'HH:mm');
        const end = rec.endTime ? format(parseISO(rec.endTime), 'HH:mm') : 'Active';
        
        return [
            format(parseISO(rec.date), 'dd/MM/yyyy'),
            rec.locationName,
            `${start} - ${end}`,
            getSafetySummary(rec.safetyChecklist),
            formatGPS(rec.startLocation),
            formatGPS(rec.endLocation),
            rec.endTime ? 'Done' : 'In Work'
        ];
    });

    autoTable(doc, {
      head: [['Date', 'Site', 'Shift', 'Safety Items Checked', 'GPS In', 'GPS Out', 'Status']],
      body: tableData,
      startY: 38,
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        3: { cellWidth: 80 }, // Dar mais espaço para a coluna de segurança
      },
      headStyles: { fillColor: [12, 74, 110] }, 
    });

    const fileName = `Downey_Report_${reportUser?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(fileName);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Service Reports</h2>
          <p className="text-gray-500">
            Individual service history for <strong>{users.find(u => u.id === selectedUserFilter)?.name || 'you'}</strong>
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
            {user?.role === UserRole.ADMIN && (
                <select 
                    className="border rounded-md px-3 py-2 bg-white text-sm font-medium shadow-sm"
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                >
                    <option value="all">All Employees</option>
                    {users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            )}
            <Button variant="primary" onClick={exportPDF} size="sm" className="shadow-sm">
                <FileDown size={18} className="mr-2" /> Export PDF
            </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Hours per Day (Current Week)</h3>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="hours" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <FileText className="text-brand-600" />
                <h3 className="font-bold text-gray-800">History Log</h3>
            </div>
            <span className="text-xs font-medium text-gray-400">{filteredRecords.length} entries found</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Shift</th>
                        <th className="p-4">Safety</th>
                        <th className="p-4">GPS Entry/Exit</th>
                        <th className="p-4">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredRecords
                      .sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                      .map((record: TimeRecord) => (
                        <tr key={record.id} className="hover:bg-brand-50/30 transition-colors">
                            <td className="p-4 font-mono font-medium text-gray-600">
                                {format(parseISO(record.date), 'dd/MM/yyyy')}
                            </td>
                            <td className="p-4">
                                <div className="font-bold text-gray-900">{record.locationName}</div>
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                        {format(parseISO(record.startTime), 'HH:mm')}
                                    </span>
                                    <span>-</span>
                                    <span className={`${record.endTime ? 'bg-gray-100' : 'bg-brand-100 text-brand-700'} px-2 py-0.5 rounded text-[10px] font-bold`}>
                                        {record.endTime ? format(parseISO(record.endTime), 'HH:mm') : '...'}
                                    </span>
                                </div>
                            </td>
                            <td className="p-4 max-w-[200px]">
                                <div className="flex items-center gap-1 text-brand-600">
                                    <ShieldCheck size={14} />
                                    <span className="text-[10px] truncate" title={getSafetySummary(record.safetyChecklist)}>
                                        {Object.values(record.safetyChecklist || {}).filter(v => v === true).length} items
                                    </span>
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-mono">
                                    <span className="flex items-center gap-1">
                                        <MapPin size={10} className="text-green-500" /> 
                                        {formatGPS(record.startLocation)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MapPin size={10} className="text-red-500" /> 
                                        {formatGPS(record.endLocation)}
                                    </span>
                                </div>
                            </td>
                            <td className="p-4">
                                {record.endTime ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase tracking-tighter">Done</span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-tighter animate-pulse">In Work</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-gray-400">
                            <FileText size={48} className="mx-auto mb-2 opacity-10" />
                            <p className="italic">No records found for the selected period.</p>
                        </td>
                      </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
