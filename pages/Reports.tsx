
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, UserRole, User } from '../types';
import { Button } from '../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileDown, Loader2, MapPin, Calendar as CalendarIcon, ClipboardCheck, Clock, Image as ImageIcon } from 'lucide-react';
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
  subDays
} from 'date-fns';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>(user?.id || 'all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('weekly');
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
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
        } catch (error) {
            console.error("Error loading report data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    let result = [...records];

    if (user?.role === UserRole.ADMIN && selectedUserFilter !== 'all') {
      result = result.filter((r) => r.userId === selectedUserFilter);
    } else if (user?.role !== UserRole.ADMIN) {
      result = result.filter((r) => r.userId === user?.id);
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    switch (selectedPeriod) {
      case 'daily':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'weekly':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'custom':
        start = startOfDay(parseISO(customStartDate));
        end = endOfDay(parseISO(customEndDate));
        break;
      default:
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
    }

    result = result.filter((record) => {
      const recordDate = parseISO(record.startTime);
      return isWithinInterval(recordDate, { start, end });
    });

    setFilteredRecords(result);
  }, [selectedUserFilter, selectedPeriod, customStartDate, customEndDate, records, user]);

  const msToTime = (durationMs: number) => {
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return `${hours}h ${minutes}min`;
  };

  const calculateTotalTime = () => {
    const totalMs = filteredRecords.reduce((acc, rec) => {
      if (!rec.endTime) return acc;
      const start = new Date(rec.startTime).getTime();
      const end = new Date(rec.endTime).getTime();
      const pause = rec.totalPausedMs || 0;
      return acc + (end - start - pause);
    }, 0);
    return totalMs;
  };

  const getChartData = () => {
    const data: Record<string, number> = {};
    filteredRecords.forEach((record) => {
      if (!record.endTime) return;
      const date = parseISO(record.date);
      const label = format(date, 'dd/MM');
      const start = parseISO(record.startTime);
      const end = parseISO(record.endTime);
      const pause = record.totalPausedMs || 0;
      const hours = (end.getTime() - start.getTime() - pause) / 36e5;
      data[label] = (data[label] || 0) + hours;
    });
    return Object.keys(data).map(label => ({ 
      name: label, 
      hours: Number(data[label].toFixed(2)),
      formatted: msToTime(data[label] * 3600000)
    }));
  };

  const formatGPS = (loc?: {lat: number, lng: number}) => {
    if (!loc) return 'N/A';
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const reportUser = users.find(u => u.id === selectedUserFilter) || user;
    
    const img = new Image();
    img.src = 'logo.png';
    
    img.onload = () => {
      doc.addImage(img, 'PNG', 14, 8, 25, 25);
      renderPDFContent(doc, reportUser);
    };

    img.onerror = () => {
      renderPDFContent(doc, reportUser);
    };
  };

  const renderPDFContent = (doc: jsPDF, reportUser: any) => {
    doc.setFontSize(22);
    doc.setTextColor(0, 84, 139);
    doc.text('DOWNEY CLEANING SERVICES', 42, 18);
    
    doc.setFontSize(8);
    doc.setTextColor(255, 194, 14);
    doc.text('PROFESSIONAL HYGIENE SOLUTIONS', 42, 23);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Official Service Report: ${reportUser?.name || 'All Personnel'}`, 42, 30);
    doc.text(`Total Period Hours: ${msToTime(calculateTotalTime())}`, 42, 35);
    
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 280, 15, { align: 'right' });
    
    const tableData = filteredRecords
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map((rec) => {
          const start = new Date(rec.startTime).getTime();
          const end = rec.endTime ? new Date(rec.endTime).getTime() : Date.now();
          const pause = rec.totalPausedMs || 0;
          const diff = end - start - pause;
          const duration = msToTime(diff);

          return [
            format(parseISO(rec.date), 'dd/MM/yyyy'),
            rec.locationName,
            `${format(parseISO(rec.startTime), 'HH:mm')} - ${rec.endTime ? format(parseISO(rec.endTime), 'HH:mm') : 'Active' }`,
            duration,
            `GPS IN: ${formatGPS(rec.startLocation)}\nGPS OUT: ${formatGPS(rec.endLocation)}`,
            rec.endTime ? 'COMPLETED' : 'IN PROGRESS'
          ];
      });

    autoTable(doc, {
      head: [['DATE', 'SITE LOCATION', 'SHIFT TIME', 'DURATION', 'GPS LOGS', 'STATUS']],
      body: tableData,
      startY: 42,
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [0, 84, 139], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 247, 255] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(12);
    doc.setTextColor(0, 84, 139);
    doc.text(`Grand Total Worked: ${msToTime(calculateTotalTime())}`, 14, finalY + 15);

    doc.save(`Downey_Cleaning_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-sm hidden md:block border border-gray-100">
            <img src="logo.png" alt="Downey Logo" className="w-12 h-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-600 tracking-tight">Activity Reports</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Official staff logs and compliance evidence</p>
          </div>
        </div>
        <Button onClick={exportPDF} className="shadow-lg bg-brand-600 hover:bg-brand-900 font-bold rounded-xl">
          <FileDown size={18} className="mr-2" /> Export PDF
        </Button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        {user?.role === UserRole.ADMIN && (
          <div className="flex flex-col min-w-[180px]">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Employee Filter</label>
            <select className="border p-2.5 rounded-xl bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all" value={selectedUserFilter} onChange={e => setSelectedUserFilter(e.target.value)}>
              <option value="all">All Personnel</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col min-w-[150px]">
          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Timeframe</label>
          <select className="border p-2.5 rounded-xl bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value as PeriodType)}>
            <option value="daily">Today</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="yearly">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {selectedPeriod === 'custom' && (
          <div className="flex gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Start</label>
              <input type="date" className="border p-2.5 rounded-xl text-sm font-bold bg-gray-50" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">End</label>
              <input type="date" className="border p-2.5 rounded-xl text-sm font-bold bg-gray-50" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex-1"></div>

        <div className="bg-brand-accent p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center min-w-[200px] border-b-4 border-yellow-600 scale-105 transform">
           <span className="text-[10px] font-black text-brand-900 uppercase tracking-widest mb-1">Period Total</span>
           <span className="text-3xl font-black text-brand-900 flex items-center gap-2">
             <Clock size={24} /> {msToTime(calculateTotalTime())}
           </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 h-80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <img src="logo.png" className="w-40 h-auto" />
        </div>
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <CalendarIcon size={14} className="text-brand-accent" /> Operational Hours Trend
        </h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={getChartData()}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
              cursor={{fill: '#f0f9ff'}}
              formatter={(value: number, name: string, props: any) => [props.payload.formatted, 'Duration']}
            />
            <Bar dataKey="hours" fill="#00548b" radius={[6, 6, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-[0.2em]">
              <tr>
                <th className="p-4">Date / Staff</th>
                <th className="p-4">Location</th>
                <th className="p-4">Duration</th>
                <th className="p-4">GPS Log</th>
                <th className="p-4">Evidence</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .map((record) => {
                  const start = new Date(record.startTime).getTime();
                  const end = record.endTime ? new Date(record.endTime).getTime() : Date.now();
                  const pause = record.totalPausedMs || 0;
                  const diff = end - start - pause;
                  
                  return (
                    <tr key={record.id} className="hover:bg-brand-50/30 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{format(parseISO(record.date), 'dd/MM/yyyy')}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-wider">
                          {users.find(u => u.id === record.userId)?.name || 'Staff Member'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-black text-brand-600">{record.locationName}</div>
                      </td>
                      <td className="p-4 font-black text-brand-900">
                        {msToTime(diff)}
                        <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                          {format(parseISO(record.startTime), 'HH:mm')} → {record.endTime ? format(parseISO(record.endTime), 'HH:mm') : '...'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-[9px] text-gray-400 font-mono">
                          <span className="flex items-center gap-1">
                            <MapPin size={10} className="text-green-500" /> IN: {formatGPS(record.startLocation)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={10} className="text-red-500" /> OUT: {formatGPS(record.endLocation)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                            {record.photoUrl && (
                                <a href={record.photoUrl} target="_blank" rel="noreferrer" className="relative hover:scale-110 transition-transform">
                                    <img src={record.photoUrl} className="w-10 h-10 rounded-xl shadow-md object-cover border-2 border-white ring-1 ring-gray-100" alt="IN" />
                                </a>
                            )}
                            {record.endPhotoUrl && (
                                <a href={record.endPhotoUrl} target="_blank" rel="noreferrer" className="relative hover:scale-110 transition-transform">
                                    <img src={record.endPhotoUrl} className="w-10 h-10 rounded-xl shadow-md object-cover border-2 border-white ring-1 ring-gray-100" alt="OUT" />
                                </a>
                            )}
                            {!record.photoUrl && !record.endPhotoUrl && (
                                <div className="w-10 h-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                                  <ImageIcon size={14} />
                                </div>
                            )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${record.endTime ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-brand-accent text-brand-900 border border-brand-accent animate-pulse'}`}>
                          {record.endTime ? 'Verified' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {filteredRecords.length === 0 && (
                <tr><td colSpan={6} className="p-20 text-center text-gray-400 italic font-bold">No operational data found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
