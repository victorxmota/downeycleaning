

import React from 'react';
import { useAuth } from '../App';
import { UserRole } from '../types';
import { User, Phone, Mail, CreditCard, Shield } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-brand-500 h-32 relative">
          <div className="absolute -bottom-16 left-8">
            <div className="w-32 h-32 bg-white rounded-full p-2 shadow-lg">
              <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                <User size={64} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-20 pb-8 px-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{user.name}</h1>
              <p className="text-brand-500 font-bold mt-1 uppercase text-sm tracking-wider">
                {user.role === UserRole.ADMIN ? 'System Administrator' : 'Cleaning Professional'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-200 transition-colors">
              <div className="bg-white p-2 rounded-lg shadow-sm text-brand-500"><Mail size={20} /></div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Official Email</p>
                <p className="font-bold text-gray-800">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-200 transition-colors">
              <div className="bg-white p-2 rounded-lg shadow-sm text-brand-500"><Phone size={20} /></div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Contact Number</p>
                <p className="font-bold text-gray-800">{user.phone || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-200 transition-colors">
              <div className="bg-white p-2 rounded-lg shadow-sm text-brand-500"><CreditCard size={20} /></div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">PPS Number</p>
                <p className="font-bold text-gray-800">{user.pps || 'Information pending'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-200 transition-colors">
              <div className="bg-white p-2 rounded-lg shadow-sm text-brand-500"><Shield size={20} /></div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Account ID</p>
                <p className="font-mono text-xs font-bold text-gray-400 truncate w-40">{user.id}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-8 flex justify-center">
            <Button variant="danger" onClick={logout} className="w-full max-w-xs h-12 text-lg font-bold shadow-md">
              Secure Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
