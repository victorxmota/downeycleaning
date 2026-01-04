
import React, { useState, useEffect } from 'react';
import { Database } from '../services/database';
import { registerWithEmail, resetUserPassword } from '../services/firebase';
import { User, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Users as UsersIcon, UserPlus, Mail, Phone, Shield, Search, Loader2, X, Trash2, Edit, KeyRound, CheckCircle2 } from 'lucide-react';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    pps: '',
    role: UserRole.EMPLOYEE
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await Database.getAllUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setResetEmailSent(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      pps: '',
      role: UserRole.EMPLOYEE
    });
    setFormError('');
    setIsAdding(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setResetEmailSent(null);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', 
      phone: user.phone || '',
      pps: user.pps || '',
      role: user.role
    });
    setFormError('');
    setIsAdding(true);
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (editingUser) {
        await Database.updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          pps: formData.pps,
          role: formData.role
        });
        alert('User updated successfully in the database.');
        setIsAdding(false);
        loadUsers();
      } else {
        const firebaseUser = await registerWithEmail(formData.email, formData.password);
        await Database.syncUser(firebaseUser, {
          name: formData.name,
          phone: formData.phone,
          pps: formData.pps,
          role: formData.role
        });
        
        alert('User created successfully!');
        setIsAdding(false);
        loadUsers();
      }
    } catch (err: any) {
      setFormError(err.message || 'Error processing request');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSendResetEmail = async (email: string) => {
    setFormLoading(true);
    try {
      await resetUserPassword(email);
      setResetEmailSent(email);
      setTimeout(() => setResetEmailSent(null), 5000);
    } catch (err: any) {
      alert('Error sending reset email: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) return;
    
    try {
      await Database.deleteUser(user.id);
      alert('User removed from database.');
      loadUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to delete user.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <UsersIcon className="text-brand-600" />
            Personnel Management
          </h2>
          <p className="text-sm text-gray-500">Full control over employee records</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <UserPlus size={18} className="mr-2" /> New Employee
        </Button>
      </header>

      {isAdding && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-brand-900 p-6 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">
                {editingUser ? `Edit Professional: ${editingUser.name}` : 'Add New Professional'}
              </h3>
              <button onClick={() => setIsAdding(false)} className="text-white/60 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrUpdateUser} className="p-6 space-y-4">
              <Input 
                label="Full Name" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Email" 
                  type="email" 
                  required 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
                {!editingUser ? (
                  <Input 
                    label="Initial Password" 
                    type="password" 
                    required 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="Enter password"
                  />
                ) : (
                   <div className="flex flex-col">
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1">Security / Password</label>
                      {resetEmailSent === formData.email ? (
                        <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-[10px] text-green-700 font-bold flex items-center gap-2">
                          <CheckCircle2 size={16} /> Link sent to {formData.email}!
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendResetEmail(formData.email)}
                          disabled={formLoading}
                          className="flex items-center justify-center gap-2 p-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl border border-brand-200 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {formLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                          Send Password Reset Link
                        </button>
                      )}
                   </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Phone" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
                <Input 
                  label="PPS Number" 
                  value={formData.pps} 
                  onChange={e => setFormData({...formData, pps: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">User Role</label>
                <select 
                  className="w-full border p-2 rounded-md bg-white text-sm font-medium"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.EMPLOYEE}>Cleaning Professional</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                </select>
              </div>

              {formError && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded">{formError}</p>}

              <div className="pt-4 flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button type="submit" fullWidth disabled={formLoading}>
                  {formLoading ? <Loader2 className="animate-spin" /> : (editingUser ? 'Save Changes' : 'Confirm Registration')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by name, email or Account ID..." 
          className="bg-transparent border-none focus:ring-0 text-sm w-full font-medium"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Account ID</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-600" /></td></tr>
              ) : filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-brand-50/20 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{user.name}</div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1"><Mail size={10}/> {user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-[10px] font-bold text-gray-400">
                    {user.id}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${user.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-brand-50 text-brand-700 border border-brand-100'}`}>
                      <Shield size={10} /> {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleSendResetEmail(user.email)}
                        className={`p-2 rounded-lg transition-all ${resetEmailSent === user.email ? 'text-green-600 bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`}
                        title="Send Password Reset Link"
                        disabled={formLoading}
                      >
                        {resetEmailSent === user.email ? <CheckCircle2 size={16} /> : <KeyRound size={16} />}
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Record"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredUsers.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
