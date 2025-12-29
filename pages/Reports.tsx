
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { TimeRecord, UserRole, User } from '../types';
import { Button } from '../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileDown, FileText, Loader2, MapPin, Calendar as CalendarIcon, Filter, Image as ImageIcon, ExternalLink } from 'lucide-react';
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

  const getChartData = () => {
    const data: Record<string, number> = {};
    filteredRecords.forEach((record) => {
      if (!record.endTime) return;
      const date = parseISO(record.date);
      const label = format(date, 'dd/MM');
      const start = parseISO(record.startTime);
      const end = parseISO(record.endTime);
      const hours = Math.abs(end.getTime() - start.getTime()) / 36e5;
      data[label] = (data[label] || 0) + Number(hours.toFixed(2));
    });
    return Object.keys(data).map(label => ({ name: label, hours: data[label] }));
  };

  const formatGPS = (loc?: {lat: number, lng: number}) => {
    if (!loc) return 'N/A';
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const reportUser = users.find(u => u.id === selectedUserFilter) || user;
    
    doc.setFontSize(20);
    doc.setTextColor(2, 132, 199); 
    doc.text('DOWNEY CLEANING SERVICES', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Service Report: ${reportUser?.name || 'All'}`, 14, 28);
    doc.text(`Period: ${selectedPeriod.toUpperCase()} (${format(new Date(), 'dd/MM/yyyy')})`, 14, 34);
    
    const tableData = filteredRecords
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map((rec) => [
          format(parseISO(rec.date), 'dd/MM/yyyy'),
          rec.locationName,
          `${format(parseISO(rec.startTime), 'HH:mm')} - ${rec.endTime ? format(parseISO(rec.endTime), 'HH:mm') : '...' }`,
          `IN: ${formatGPS(rec.startLocation)}\nOUT: ${formatGPS(rec.endLocation)}`,
          rec.endTime ? 'Completed' : 'Working'
      ]);

    autoTable(doc, {
      head: [['Date', 'Site', 'Shift Time', 'GPS Coordinates', 'Status']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [2, 132, 199] }
    });

    doc.save(`Downey_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Reports Dashboard</h2>
          <p className="text-sm text-gray-500">History and visual evidence log</p>
        </div>
        <Button onClick={exportPDF} size="sm"><FileDown size={18} className="mr-2" /> Export PDF</Button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4">
        {user?.role === UserRole.ADMIN && (
          <div className="flex flex-col min-w-[180px]">
            <label className="text-xs font-bold text-gray-400 uppercase mb-1">Employee</label>
            <select className="border p-2 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-brand-500" value={selectedUserFilter} onChange={e => setSelectedUserFilter(e.target.value)}>
              <option value="all">All Employees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 uppercase mb-1">Period</label>
          <select className="border p-2 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-brand-500" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value as PeriodType)}>
            <option value="daily">Today</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Customized period</option>
          </select>
        </div>

        {selectedPeriod === 'custom' && (
          <div className="flex gap-2">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1">From</label>
              <input type="date" className="border p-2 rounded text-sm" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1">To</label>
              <input type="date" className="border p-2 rounded text-sm" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 h-64">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <CalendarIcon size={14} /> Weekly Hours Performance
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={getChartData()}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="hours" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Location</th>
                <th className="p-4">Shift Time</th>
                <th className="p-4">GPS Entry/Exit</th>
                <th className="p-4">Photos</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .map((record) => (
                <tr key={record.id} className="hover:bg-brand-50/20 transition-colors">
                  <td className="p-4 font-medium text-gray-600">
                    {format(parseISO(record.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{record.locationName}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 font-mono text-xs">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{format(parseISO(record.startTime), 'HH:mm')}</span>
                        <span className="text-gray-300">-</span>
                        <span className={`${record.endTime ? 'bg-gray-100' : 'bg-brand-100 text-brand-700'} px-1.5 py-0.5 rounded`}>
                            {record.endTime ? format(parseISO(record.endTime), 'HH:mm') : 'Active'}
                        </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-mono">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-green-500" /> {formatGPS(record.startLocation)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-red-500" /> {formatGPS(record.endLocation)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                        {record.photoUrl ? (
                            <a href={record.photoUrl} target="_blank" rel="noreferrer" className="relative group">
                                <img src={record.photoUrl} className="w-8 h-8 rounded object-cover border border-gray-200 shadow-sm group-hover:opacity-75" alt="Start" />
                                <div className="absolute -top-1 -right-1 bg-green-500 w-2 h-2 rounded-full border border-white"></div>
                            </a>
                        ) : (
                            <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center border border-dashed border-gray-200 text-gray-300">
                                <ImageIcon size={14} />
                            </div>
                        )}
                        {record.endPhotoUrl ? (
                            <a href={record.endPhotoUrl} target="_blank" rel="noreferrer" className="relative group">
                                <img src={record.endPhotoUrl} className="w-8 h-8 rounded object-cover border border-gray-200 shadow-sm group-hover:opacity-75" alt="End" />
                                <div className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full border border-white"></div>
                            </a>
                        ) : (
                            <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center border border-dashed border-gray-200 text-gray-300">
                                <ImageIcon size={14} />
                            </div>
                        )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight ${record.endTime ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse'}`}>
                      {record.endTime ? 'Done' : 'In Work'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400 italic">
                        No records found for the selected filter.
                    </td>
                </tr>
              )}
            </tbody>a
          </table>
        </div>
      </div>
    </div>
  );
};
