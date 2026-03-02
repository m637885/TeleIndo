'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useConfigStore } from '@/store/useConfigStore';
import { Send, Phone, Lock, Hash, Settings } from 'lucide-react';

export function Auth() {
  const { authStep, submitPhone, submitCode, submitPassword, error } = useAppStore();
  const { isTestServer, setTestServer } = useConfigStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authStep === 'phone' && phone) {
      // Ensure phone number starts with + and has no spaces
      let formattedPhone = phone.replace(/\s+/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      submitPhone(formattedPhone);
    }
    if (authStep === 'code' && code) submitCode(code);
    if (authStep === 'password' && password) submitPassword(password);
  };

  if (authStep === 'authenticated') return null;

  if (authStep === 'init') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500">Initializing Telegram Client...</p>
          {error && <p className="text-red-500 mt-4 text-sm text-center">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 relative">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
          title="Server Configuration"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <Send className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
          Sign in to TeleIndo
        </h1>
        <p className="text-center text-slate-500 mb-8">
          {authStep === 'phone' && 'Please confirm your country code and enter your phone number.'}
          {authStep === 'code' && 'We have sent you a message in Telegram with the code.'}
          {authStep === 'password' && 'Your account is protected with an additional password.'}
        </p>

        {showConfig && authStep === 'phone' && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Server Configuration</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isTestServer}
                onChange={(e) => setTestServer(e.target.checked)}
                className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Use Test Server (DC 2)</span>
            </label>
            <p className="text-xs text-slate-500 mt-2">
              Check this if you are logging in with a test account (e.g., 999661xxxx).
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {authStep === 'phone' && (
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                autoFocus
              />
            </div>
          )}

          {authStep === 'code' && (
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                autoFocus
                maxLength={5}
                pattern="\d*"
              />
            </div>
          )}

          {authStep === 'password' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors"
          >
            NEXT
          </button>
        </form>
      </div>
    </div>
  );
}
