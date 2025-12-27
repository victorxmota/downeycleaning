import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database } from '../services/database';
import { TimeRecord, UserRole, User } from '../types';
import { Button } from '../components/ui/Button';
import { FileDown, Loader2, ClipboardList } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        if (user.role === UserRole.ADMIN) {
          const [allRecs, allUsers] = await Promise.all([
            Database.getAllRecords(),
            Database.getAllUsers()
          ]);
          setRecords(allRecs);
          setFilteredRecords(allRecs);
          setUsers(allUsers.filter(u => u.role === UserRole.EMPLOYEE));
        } else {
          const myRecs = await Database.getRecordsByUser(user.id);
          setRecords(myRecs);
          setFilteredRecords(myRecs);
          setUsers([user]);
          setSelectedUserFilter(user.id);
        }
      } catch (err) {
        console.error("Error loading reports:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedUserFilter === 'all') {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(records.filter(r => r.userId === selectedUserFilter));
    }
  }, [selectedUserFilter, records]);

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const activeUser = users.find(u => u.id === selectedUserFilter) || user;
    
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199);
    doc.text('DOWNEY CLEANING - SERVICE LOG REPORT', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Staff: ${selectedUserFilter === 'all' ? 'All Staff' : activeUser?.name}`, 14, 22);
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 27);

    const tableData = [...filteredRecords]
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map(r => [
        format(parseISO(r.date), 'dd/MM/yyyy'),
        r.locationName,
        format(parseISO(r.startTime), 'HH:mm'),
        r.endTime ? format(parseISO(r.endTime), 'HH:mm') : 'Active',
        r.endTime ? 'Completed' : 'Ongoing'
      ]);

    autoTable(doc, {
      head: [['Date', 'Location', 'Check-In', 'Check-Out', 'Status']],
      body: tableData,
      startY: 35,
      headStyles: { fillColor: [12, 74, 110] },
      styles: { fontSize: 9 }
    });

    doc.save(`Service_Log_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="animate-spin text-brand-600" size={48} />
        <p className="text-gray-500 font-medium">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="text-brand-600" /> Operational Reports
          </h2>
          <p className="text-gray-500 text-sm">Attendance and service duration tracking</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {user?.role === UserRole.ADMIN && (
            <select 
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-brand-500 flex-1 md:flex-none"
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
            >
              <option value="all">Entire Team</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <Button variant="primary" onClick={exportPDF} size="sm" className="flex-1 md:flex-none">
            <FileDown size={18} className="mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Location</th>
                <th className="p-4">Time Period</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...filteredRecords]
                .sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .map((record) => (
                <tr key={record.id} className="hover:bg-brand-50/20 transition-colors">
                  <td className="p-4 font-mono text-gray-600">
                    {format(parseISO(record.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{record.locationName}</div>
                  </td>
                  <td className="p-4 text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {format(parseISO(record.startTime), 'HH:mm')}
                      </span>
                      <span className="text-gray-300">→</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${record.endTime ? 'bg-gray-100 text-gray-700' : 'bg-orange-50 text-orange-700 animate-pulse'}`}>
                        {record.endTime ? format(parseISO(record.endTime), 'HH:mm') : 'Working'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${record.endTime ? 'bg-green-50 text-green-700 border-green-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
                      {record.endTime ? 'Completed' : 'On Site'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-gray-400 font-medium">
                    No service records found for the selected view.
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