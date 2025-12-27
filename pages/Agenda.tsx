
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database } from '../services/database';
import { ScheduleItem, UserRole, User, Office } from '../types';
import { Button } from '../components/ui/Button';
import { Calendar, Loader2 } from 'lucide-react';

export const Agenda: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(user?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  
  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    const init = async () => {
      if (isAdmin) {
        const staff = await Database.getAllUsers();
        setUsers(staff.filter(u => u.role === UserRole.EMPLOYEE));
      }
    };
    init();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedUser) loadSchedules(selectedUser);
  }, [selectedUser]);

  const loadSchedules = async (userId: string) => {
    setIsLoading(true);
    const data = await Database.getSchedulesByUser(userId);
    setSchedules(data);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Work Assignments</h2>
        {isAdmin && (
          <select className="border rounded p-2 text-sm" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </header>

      {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map(s => (
            <div key={s.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-brand-600 font-bold mb-2">
                <Calendar size={18} />
                <span>Shift Plan</span>
              </div>
              <p className="font-bold text-gray-900">{s.locationName}</p>
              <p className="text-xs text-gray-500">{s.address}</p>
              <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                <span className="text-gray-400">Duration</span>
                <span className="font-bold text-brand-700">{s.hoursPerDay}h</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
