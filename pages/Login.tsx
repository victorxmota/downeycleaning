a distanncia dos meus filhos
motivação para me tornar uma pessoa melhor
estou me fechando.
tá me ajudando a fortalece e evoluir 

vou vai aprender pela dor 



import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmail } from '../services/firebase';
import { Database } from '../services/database';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LogIn, User as UserIcon, Lock, Loader2 } from 'lucide-react';
import logo from '../assets/downey-logo.png'; // ajusta o path se necessário

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please provide Email/ID and Password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let emailToLogin = identifier;

      if (!identifier.includes('@')) {
        const user = await Database.getUserByAccountId(identifier);
        if (user && user.email) {
          emailToLogin = user.email;
        } else {
          throw new Error('Account ID not found.');
        }
      }

      await loginWithEmail(emailToLogin, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message === 'Account ID not found.' ? 'Account ID not found.' : 'Invalid credentials. Please check your data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-brand-100">
        
        {/* Logo substituindo o ícone anterior */}
        <div className="text-center mb-10">
          <img
            src={logo}
            alt="Downey Cleaning"
            className="w-48 mx-auto mb-4 object-contain"
          />
          <p className="text-gray-400 mt-2 font-medium">Professional Access Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Input
              label="Email or Account ID"
              placeholder="name@downeycleaning.ie"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="pl-10"
            />
            <UserIcon className="absolute left-3 top-9 text-gray-400" size={18} />
          </div>

          <div className="relative">
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-10"
            />
            <Lock className="absolute left-3 top-9 text-gray-400" size={18} />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-100 animate-shake flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
              {error}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={loading}
            className="h-14 text-lg font-bold shadow-lg"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <><LogIn size={20} className="mr-2" /> Secure Login</>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            Internal Use Only
          </p>
          <p className="text-[10px] text-gray-300 mt-2 italic">
            Access to this system is restricted to authorized personnel.
            All activities are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
};
