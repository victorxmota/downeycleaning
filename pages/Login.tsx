

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, loginWithEmail, registerWithEmail } from '../services/firebase';
import { Database } from '../services/database';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { UserPlus, LogIn, Mail, Lock, User as UserIcon, Phone, CreditCard } from 'lucide-react';

export const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pps, setPps] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Failed to login with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and Password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        if (!name || !phone || !pps) {
          setError('All fields are required for registration.');
          setLoading(false);
          return;
        }
        const firebaseUser = await registerWithEmail(email, password);
        await Database.syncUser(firebaseUser, { name, phone, pps });
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-brand-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-600">Downey Cleaning</h1>
          <p className="text-gray-500 mt-2">
            {isRegistering ? 'Create your professional account' : 'Professional Service Management'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <>
              <div className="relative">
                <Input 
                  label="Full Name" 
                  placeholder="John Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                />
                <UserIcon className="absolute right-3 top-9 text-gray-400" size={18} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Input 
                    label="Phone" 
                    placeholder="+353..." 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required
                  />
                  <Phone className="absolute right-3 top-9 text-gray-400" size={18} />
                </div>
                <div className="relative">
                  <Input 
                    label="PPS Number" 
                    placeholder="1234567A" 
                    value={pps} 
                    onChange={(e) => setPps(e.target.value)} 
                    required
                  />
                  <CreditCard className="absolute right-3 top-9 text-gray-400" size={18} />
                </div>
              </div>
            </>
          )}

          <div className="relative">
            <Input 
              label="Email Address" 
              type="email" 
              placeholder="name@company.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
            />
            <Mail className="absolute right-3 top-9 text-gray-400" size={18} />
          </div>

          <div className="relative">
            <Input 
              label="Password" 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
            <Lock className="absolute right-3 top-9 text-gray-400" size={18} />
          </div>

          <Button 
            type="submit" 
            fullWidth 
            disabled={loading}
            className="mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full mr-2"></div>
            ) : (
              isRegistering ? <UserPlus size={18} className="mr-2" /> : <LogIn size={18} className="mr-2" />
            )}
            {isRegistering ? 'Register Account' : 'Sign In'}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-400">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-lg p-3 text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm font-medium disabled:opacity-50"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            className="w-6 h-6 mr-3"
          />
          Google Workspace
        </button>

        {error && (
          <div className="mt-6 bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 animate-pulse">
            {error}
          </div>
        )}

        <div className="text-center mt-6">
          <button 
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="text-brand-600 hover:text-brand-700 font-medium text-sm transition-colors"
          >
            {isRegistering ? 'Already have an account? Sign in' : 'Don\'t have an account? Create one'}
          </button>
        </div>
        
        <div className="text-center text-xs text-gray-400 mt-6 pt-6 border-t">
          <p>Access restricted to Downey Cleaning authorized personnel.</p>
        </div>
      </div>
    </div>
  );
};
