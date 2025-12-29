
import React, { useState } from 'react';
import { useAuth } from '../App';
import { UserRole } from '../types';
import { User as UserIcon, Phone, Mail, CreditCard, Shield, Edit2, Save, X, Lock, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Database } from '../services/database';
import { updateUserAuthEmail, updateUserAuthPassword } from '../services/firebase';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Profile Form
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    pps: user?.pps || ''
  });

  // Password Form
  const [passData, setPassData] = useState({
    newPass: '',
    confirmPass: ''
  });

  if (!user) return null;

  const handleSaveProfile = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Update Auth Email if changed
      if (profileData.email !== user.email) {
        await updateUserAuthEmail(profileData.email);
      }
      
      // Update Firestore
      await Database.updateUser(user.id, {
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        pps: profileData.pps
      });
      
      alert('Profile updated successfully!');
      setIsEditing(false);
      window.location.reload(); // Refresh to sync auth state
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passData.newPass !== passData.confirmPass) {
      setError('Passwords do not match');
      return;
    }
    if (passData.newPass.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await updateUserAuthPassword(passData.newPass);
      alert('Password updated successfully!');
      setIsChangingPass(false);
      setPassData({ newPass: '', confirmPass: '' });
    } catch (err: any) {
      setError(err.message || 'Error updating password. You might need to log in again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-brand-900 h-32 relative">
          <div className="absolute -bottom-16 left-8">
            <div className="w-32 h-32 bg-white rounded-full p-2 shadow-lg">
              <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                <UserIcon size={64} />
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 right-8 flex gap-2">
            {!isEditing && !isChangingPass && (
               <>
                <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" onClick={() => setIsEditing(true)}>
                  <Edit2 size={16} className="mr-2" /> Edit Profile
                </Button>
                <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" onClick={() => setIsChangingPass(true)}>
                  <Lock size={16} className="mr-2" /> Security
                </Button>
               </>
            )}
          </div>
        </div>
        
        <div className="pt-20 pb-8 px-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{user.name}</h1>
              <p className="text-brand-600 font-bold mt-1 uppercase text-xs tracking-widest">
                {user.role === UserRole.ADMIN ? 'System Administrator' : 'Cleaning Professional'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
              {error}
            </div>
          )}

          {isEditing ? (
            <div className="mt-8 space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Full Name" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} />
                <Input label="Email Address" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} />
                <Input label="Phone Number" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} />
                <Input label="PPS Number" value={profileData.pps} onChange={e => setProfileData({...profileData, pps: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" fullWidth onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button fullWidth onClick={handleSaveProfile} disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={18} className="mr-2" /> Save Changes</>}
                </Button>
              </div>
            </div>
          ) : isChangingPass ? (
            <div className="mt-8 space-y-4 animate-fade-in">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                <Lock size={18} className="text-brand-600" /> Change Password
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="New Password" type="password" placeholder="At least 6 chars" value={passData.newPass} onChange={e => setPassData({...passData, newPass: e.target.value})} />
                <Input label="Confirm New Password" type="password" value={passData.confirmPass} onChange={e => setPassData({...passData, confirmPass: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" fullWidth onClick={() => setIsChangingPass(false)}>Cancel</Button>
                <Button fullWidth onClick={handleChangePassword} disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Update Password'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="bg-white p-2 rounded-lg shadow-sm text-brand-600"><Mail size={20} /></div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Official Email</p>
                  <p className="font-bold text-gray-800">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="bg-white p-2 rounded-lg shadow-sm text-brand-600"><Phone size={20} /></div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Contact Number</p>
                  <p className="font-bold text-gray-800">{user.phone || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="bg-white p-2 rounded-lg shadow-sm text-brand-600"><CreditCard size={20} /></div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">PPS Number</p>
                  <p className="font-bold text-gray-800">{user.pps || 'Information pending'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="bg-white p-2 rounded-lg shadow-sm text-brand-600"><Shield size={20} /></div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Account ID</p>
                  <p className="font-mono text-xs font-bold text-gray-400 truncate w-40">{user.id}</p>
                </div>
              </div>
            </div>
          )}

          {!isEditing && !isChangingPass && (
            <div className="mt-8 border-t border-gray-100 pt-8 flex justify-center">
              <Button variant="danger" onClick={logout} className="w-full max-w-xs h-12 text-lg font-bold shadow-md">
                Secure Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
