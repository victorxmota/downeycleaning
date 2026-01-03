
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Database } from '../services/database';
import { ScheduleItem, UserRole, User, Office } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Trash2, Calendar, Clock, MapPin, Save, X, CheckSquare, Square, Loader2, Edit2, Check, Plus, Building2, FileText, Info } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const Agenda: React.FC = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'agenda' | 'offices'>('agenda');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(user?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isAddingOffice, setIsAddingOffice] = useState(false);
  
  // Selected shift for detailed modal
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<ScheduleItem | null>(null);

  // States for editing a specific schedule
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editHoursValue, setEditHoursValue] = useState<number>(0);
  const [editNotesValue, setEditNotesValue] = useState<string>('');

  // New Office form state
  const [newOffice, setNewOffice] = useState<Partial<Office>>({
    name: '',
    eircode: '',
    address: ''
  });

  const [newSchedule, setNewSchedule] = useState<Partial<ScheduleItem>>({
    hoursPerDay: 4,
    locationName: '',
    address: '',
    notes: ''
  });
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        if (isAdmin) {
          const allUsers = await Database.getAllUsers();
          setUsers(allUsers.filter((u: User) => u.role === UserRole.EMPLOYEE));
        }
        const allOffices = await Database.getOffices();
        setOffices(allOffices);
      } catch (e) {
        console.error("Error initializing agenda data:", e);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedUser) {
      loadSchedules(selectedUser);
    } else if (user) {
      setSelectedUser(user.id);
      loadSchedules(user.id);
    }
  }, [selectedUser, user]);

  const loadSchedules = async (userId: string) => {
    setIsLoading(true);
    try {
      const data = await Database.getSchedulesByUser(userId);
      setSchedules(data);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const calculateWeeklyHours = () => {
    return schedules.reduce((acc, curr) => acc + curr.hoursPerDay, 0);
  };

  const toggleScheduleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex) 
        : [...prev, dayIndex]
    );
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.locationName || !newSchedule.address) {
      alert("Location and Address are required");
      return;
    }
    if (selectedDays.length === 0) {
      alert("Please select at least one day of the week.");
      return;
    }

    const targetUserId = isAdmin ? selectedUser : user?.id;
    if (!targetUserId) {
      alert("Target user not identified.");
      return;
    }

    setIsLoading(true);
    try {
      for (const dayIndex of selectedDays) {
        const item: any = {
          userId: targetUserId,
          locationName: newSchedule.locationName!,
          address: newSchedule.address!,
          dayOfWeek: dayIndex,
          hoursPerDay: Number(newSchedule.hoursPerDay),
          notes: newSchedule.notes || ''
        };
        await Database.addSchedule(item);
      }

      await loadSchedules(targetUserId);
      setIsAddingSchedule(false);
      setNewSchedule({ hoursPerDay: 4, locationName: '', address: '', notes: '' });
      setSelectedDays([]);
    } catch (e) {
      console.error(e);
      alert("Error adding schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOffice = async () => {
    if (!newOffice.name || !newOffice.address) {
      alert("Name and Address are required");
      return;
    }
    setIsLoading(true);
    try {
      await Database.addOffice({
        name: newOffice.name!,
        eircode: newOffice.eircode || '',
        address: newOffice.address!,
        defaultSchedule: []
      });
      const allOffices = await Database.getOffices();
      setOffices(allOffices);
      setIsAddingOffice(false);
      setNewOffice({ name: '', eircode: '', address: '' });
    } catch (e) {
      console.error(e);
      alert("Error adding office.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOffice = async (id: string) => {
    if (window.confirm('Delete this site location?')) {
      setIsLoading(true);
      await Database.deleteOffice(id);
      const allOffices = await Database.getOffices();
      setOffices(allOffices);
      setIsLoading(false);
    }
  };

  const handleUpdateSchedule = async (id: string) => {
    setIsLoading(true);
    try {
      await Database.updateSchedule(id, { 
        hoursPerDay: editHoursValue,
        notes: editNotesValue
      });
      const targetUserId = isAdmin ? selectedUser : user?.id;
      if (targetUserId) await loadSchedules(targetUserId);
      setEditingScheduleId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to update schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this schedule?')) {
      setIsLoading(true);
      await Database.deleteSchedule(id);
      const targetUserId = isAdmin ? selectedUser : user?.id;
      if (targetUserId) await loadSchedules(targetUserId);
      setIsLoading(false);
    }
  };

  const startEditing = (schedule: ScheduleItem) => {
    setEditingScheduleId(schedule.id);
    setEditHoursValue(schedule.hoursPerDay);
    setEditNotesValue(schedule.notes || '');
  };

  const handleOfficeSelectForSchedule = (officeId: string) => {
    const office = offices.find(o => o.id === officeId);
    if (office) {
      setNewSchedule({
        ...newSchedule,
        locationName: office.name,
        address: office.address
      });
    }
  };

  if (isLoading && schedules.length === 0 && viewMode === 'agenda') {
      return (
        <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{viewMode === 'agenda' ? 'Work Schedule' : 'Manage Locations'}</h2>
          <p className="text-gray-500">{viewMode === 'agenda' ? 'Plan and manage operational cleaning shifts' : 'Configure official service sites'}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
            {isAdmin && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setViewMode(viewMode === 'agenda' ? 'offices' : 'agenda')}
                  className="rounded-xl font-bold border-brand-600 text-brand-600"
                >
                  {viewMode === 'agenda' ? <Building2 size={18} className="mr-2" /> : <Calendar size={18} className="mr-2" />}
                  {viewMode === 'agenda' ? 'Manage Sites' : 'View Schedule'}
                </Button>
                {viewMode === 'agenda' && (
                  <div className="flex flex-col mr-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Employee View</span>
                    <select 
                      className="border rounded-xl px-3 py-2 bg-white text-sm font-bold border-gray-200 outline-none focus:ring-2 focus:ring-brand-500"
                      value={selectedUser}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedUser(e.target.value)}
                    >
                      <option value={user?.id}>My Own Agenda</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {viewMode === 'agenda' ? (
                  <Button 
                    onClick={() => setIsAddingSchedule(!isAddingSchedule)}
                    className={`${isAddingSchedule ? 'bg-gray-100 text-gray-600' : 'bg-brand-600'} rounded-xl font-bold`}
                  >
                    {isAddingSchedule ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                    {isAddingSchedule ? 'Cancel' : 'Add Shift'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setIsAddingOffice(!isAddingOffice)}
                    className={`${isAddingOffice ? 'bg-gray-100 text-gray-600' : 'bg-brand-600'} rounded-xl font-bold`}
                  >
                    {isAddingOffice ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                    {isAddingOffice ? 'Cancel' : 'New Site'}
                  </Button>
                )}
              </>
            )}
        </div>
      </header>

      {viewMode === 'agenda' ? (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Total Weekly Hours</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Accumulated Forecast</p>
            </div>
            <div className="text-4xl font-black text-brand-600 tracking-tighter">{calculateWeeklyHours()}h</div>
          </div>

          {isAddingSchedule && isAdmin && (
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 space-y-4 animate-fade-in text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Calendar size={120} />
              </div>
              
              <div className="flex justify-between items-center border-b border-slate-700 pb-4 relative z-10">
                 <h3 className="font-black text-xl tracking-tight uppercase">Assign New Shift</h3>
                 <button onClick={() => setIsAddingSchedule(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Assign To Employee</label>
                  <select 
                    className="w-full rounded-xl border-slate-700 bg-slate-800 text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                    value={selectedUser}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedUser(e.target.value)}
                  >
                    <option value={user?.id}>Assign to myself</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                {offices.length > 0 && (
                  <div className="md:col-span-2">
                     <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Quick Select Location</label>
                     <select 
                        className="w-full rounded-xl border-slate-700 bg-slate-800 text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleOfficeSelectForSchedule(e.target.value)}
                     >
                       <option value="">-- Select Registered Site --</option>
                       {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                     </select>
                  </div>
                )}

                <Input 
                  label="Site Name" 
                  placeholder="e.g. Downey Tech Hub"
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={newSchedule.locationName || ''} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchedule({...newSchedule, locationName: e.target.value})} 
                  className="bg-slate-800 border-slate-700 placeholder:text-slate-500 font-bold rounded-xl" 
                />
                <Input 
                  label="Address Detail" 
                  placeholder="123 Street Ave, D02"
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={newSchedule.address || ''} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchedule({...newSchedule, address: e.target.value})} 
                  className="bg-slate-800 border-slate-700 placeholder:text-slate-500 font-bold rounded-xl" 
                />

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service Description / Notes</label>
                  <textarea 
                    className="w-full rounded-xl border-slate-700 bg-slate-800 text-white p-3 focus:ring-2 focus:ring-brand-500 outline-none font-bold min-h-[100px]"
                    placeholder="Describe specific tasks for this shift..."
                    value={newSchedule.notes || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSchedule({...newSchedule, notes: e.target.value})}
                  />
                </div>
              </div>

              <div className="relative z-10">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Days of Week (Multiple selection)</label>
                <div className="flex flex-wrap gap-2">
                   {DAYS.map((day, idx) => (
                     <button
                       key={idx}
                       type="button"
                       onClick={() => toggleScheduleDay(idx)}
                       className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-[10px] font-black transition-all ${selectedDays.includes(idx) ? 'bg-brand-500 border-brand-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                       {selectedDays.includes(idx) ? <CheckSquare size={14} /> : <Square size={14} />}
                       <span>{day.substring(0, 3).toUpperCase()}</span>
                     </button>
                   ))}
                </div>
              </div>

              <div className="w-1/3 relative z-10">
                <Input 
                  label="Shift Duration (Hours)" 
                  type="number" 
                  min="0.5" 
                  step="0.5"
                  labelClassName="text-slate-400 font-black uppercase text-[10px] tracking-widest"
                  value={newSchedule.hoursPerDay} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchedule({...newSchedule, hoursPerDay: Number(e.target.value)})} 
                  className="bg-slate-800 border-slate-700 font-bold text-white rounded-xl" 
                />
              </div>

              <Button 
                onClick={handleAddSchedule} 
                fullWidth 
                disabled={isLoading} 
                className="rounded-xl h-14 text-lg font-black shadow-xl relative z-10"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2"/> : <Save size={20} className="mr-2"/>} 
                CONFIRM SHIFT
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((schedule) => (
              <div 
                key={schedule.id} 
                onClick={() => setSelectedShiftDetail(schedule)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative group hover:shadow-md transition-all border-b-4 border-b-brand-100 cursor-pointer"
              >
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {editingScheduleId !== schedule.id && (
                      <button 
                        onClick={() => startEditing(schedule)} 
                        className="text-gray-300 hover:text-brand-600 transition-colors p-1"
                        title="Edit Schedule"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
                <div className="flex items-center space-x-2 mb-4">
                  <div className="bg-brand-50 p-2 rounded-lg text-brand-600">
                    <Calendar size={18} />
                  </div>
                  <span className="font-black text-gray-900 uppercase text-xs tracking-widest">{DAYS[schedule.dayOfWeek]}</span>
                </div>
                <div className="space-y-4 text-gray-600">
                  <div className="flex items-start space-x-3">
                    <MapPin size={18} className="mt-1 flex-shrink-0 text-brand-400" />
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 tracking-tight leading-tight truncate">{schedule.locationName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 truncate">{schedule.address}</p>
                    </div>
                  </div>
                  
                  {editingScheduleId === schedule.id ? (
                    <div className="space-y-3 bg-brand-50 p-4 rounded-xl border border-brand-200 animate-fade-in shadow-inner" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-brand-600" />
                        <input 
                          type="number" 
                          min="0.5" 
                          step="0.5"
                          className="w-20 p-1.5 text-sm border border-brand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                          value={editHoursValue}
                          onChange={(e) => setEditHoursValue(Number(e.target.value))}
                        />
                        <span className="text-xs font-black text-brand-600 uppercase">h</span>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Update Service Description</label>
                        <textarea 
                          className="w-full p-2 text-xs border border-brand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-medium min-h-[70px] bg-white"
                          value={editNotesValue}
                          onChange={(e) => setEditNotesValue(e.target.value)}
                          placeholder="Update shift instructions..."
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdateSchedule(schedule.id)}
                          className="flex-1 rounded-lg text-[10px] font-black shadow-sm"
                        >
                          {isLoading ? <Loader2 className="animate-spin" size={14}/> : <Check size={14} className="mr-1" />} SAVE
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => setEditingScheduleId(null)}
                          className="flex-1 rounded-lg text-[10px] font-black border-gray-200"
                        >
                          <X size={14} className="mr-1" /> CANCEL
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-black bg-gray-50 px-3 py-1.5 rounded-xl w-fit text-brand-600 text-[10px] uppercase tracking-widest border border-gray-100">
                        <Clock size={14} />
                        <span>{schedule.hoursPerDay} hours</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-black text-gray-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                        <Info size={12}/> View details
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {schedules.length === 0 && !isAddingSchedule && (
              <div className="col-span-full py-20 text-center text-gray-400 bg-white border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                <Calendar size={48} className="text-gray-200" />
                <p className="italic font-bold text-sm uppercase tracking-widest">No operational shifts scheduled for this period.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {isAddingOffice && isAdmin && (
             <div className="bg-white p-6 rounded-2xl border border-brand-100 shadow-xl space-y-4 animate-fade-in">
                <h3 className="font-black text-brand-900 uppercase tracking-widest border-b pb-2">Add New Service Site</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <Input label="Site Name" value={newOffice.name} onChange={e => setNewOffice({...newOffice, name: e.target.value})} />
                   <Input label="Eircode / ZIP" value={newOffice.eircode} onChange={e => setNewOffice({...newOffice, eircode: e.target.value})} />
                   <Input label="Full Address" value={newOffice.address} onChange={e => setNewOffice({...newOffice, address: e.target.value})} />
                </div>
                <div className="flex gap-2">
                   <Button onClick={handleAddOffice} disabled={isLoading} className="font-bold">
                      {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />} Save Site
                   </Button>
                   <Button variant="outline" onClick={() => setIsAddingOffice(false)} className="font-bold">Cancel</Button>
                </div>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offices.map((office) => (
              <div key={office.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 group hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-brand-50 p-3 rounded-xl text-brand-600">
                    <Building2 size={24} />
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDeleteOffice(office.id)} className="text-gray-300 hover:text-red-500 p-1">
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                <h3 className="font-black text-gray-900 text-lg leading-tight mb-1">{office.name}</h3>
                <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mb-4">{office.eircode || 'No Eircode'}</p>
                <div className="flex items-start gap-2 text-gray-500">
                  <MapPin size={16} className="mt-1 shrink-0" />
                  <p className="text-sm font-medium">{office.address}</p>
                </div>
              </div>
            ))}
            {offices.length === 0 && !isAddingOffice && (
              <div className="col-span-full py-20 text-center text-gray-400 bg-white border-2 border-dashed border-gray-100 rounded-2xl">
                 <p className="font-bold italic">No site locations registered yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shift Detail Modal */}
      {selectedShiftDetail && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedShiftDetail(null)}>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fade-in relative" onClick={(e) => e.stopPropagation()}>
            <div className="bg-brand-900 p-8 text-white">
              <div className="flex justify-between items-start">
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md mb-4">
                   <Calendar size={28} className="text-white" />
                </div>
                <button onClick={() => setSelectedShiftDetail(null)} className="text-white/60 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{selectedShiftDetail.locationName}</h3>
              <p className="text-brand-300 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">{DAYS[selectedShiftDetail.dayOfWeek]} Operations</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Time Assigned</p>
                    <div className="flex items-center gap-2 text-brand-600 font-black">
                       <Clock size={16} /> {selectedShiftDetail.hoursPerDay} Hours
                    </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Frequency</p>
                    <div className="flex items-center gap-2 text-brand-600 font-black">
                       <Calendar size={16} /> Weekly
                    </div>
                 </div>
              </div>

              <div className="space-y-1">
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Service Location</p>
                 <div className="flex items-start gap-2">
                    <MapPin className="text-brand-500 shrink-0 mt-1" size={18} />
                    <p className="font-bold text-gray-700 leading-tight">{selectedShiftDetail.address}</p>
                 </div>
              </div>

              <div className="space-y-3 bg-brand-50 p-6 rounded-3xl border border-brand-100">
                 <div className="flex items-center gap-2">
                    <FileText className="text-brand-600" size={18} />
                    <p className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Service Instructions / Notes</p>
                 </div>
                 <p className="text-sm font-medium text-brand-800 leading-relaxed italic whitespace-pre-wrap">
                    {selectedShiftDetail.notes || 'No specific instructions provided for this site.'}
                 </p>
              </div>

              <Button fullWidth onClick={() => setSelectedShiftDetail(null)} className="h-14 rounded-2xl font-black tracking-tight text-lg shadow-xl">
                 Got it, thanks!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
