import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { User as UserIcon, Phone, Mail, CreditCard, Shield } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-brand-900 h-32 relative">
          <div className="absolute -bottom-16 left-8">
            <div className="w-32 h-32 bg-white rounded-full p-2 shadow-lg">
              <div className="w-full h-full bg-brand-50 rounded-full flex items-center justify-center text-brand-300">
                <UserIcon size={64} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-20 pb-10 px-10">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-brand-100 text-brand-700 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {user.role === UserRole.ADMIN ? 'Administrator' : 'Professional Staff'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center space-x-3 text-gray-400 mb-2">
                <Mail size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Corporate Email</span>
              </div>
              <p className="font-bold text-gray-800 text-sm">{user.email}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center space-x-3 text-gray-400 mb-2">
                <Phone size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Phone Contact</span>
              </div>
              <p className="font-bold text-gray-800 text-sm">{user.phone || 'Not provided'}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center space-x-3 text-gray-400 mb-2">
                <CreditCard size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">PPS Registration</span>
              </div>
              <p className="font-bold text-gray-800 text-sm">{user.pps || 'Verified'}</p>
            </div>

            <div className="p-4 bg-brand-50 rounded-xl border border-brand-100">
              <div className="flex items-center space-x-3 text-brand-600 mb-2">
                <Shield size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Security Status</span>
              </div>
              <p className="font-black text-brand-900 uppercase text-xs">Active License</p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-[10px] text-gray-300 font-mono uppercase tracking-tighter">System UID: {user.id}</span>
            <Button variant="danger" size="sm" onClick={logout} className="px-10">
              Sign Out Securely
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};