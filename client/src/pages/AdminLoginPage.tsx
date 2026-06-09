import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, UserPlus } from 'lucide-react';
import { useAdminAuth } from '../features/admin/hooks/useAdminAuth';
import { socket } from '../shared/lib/socket';
import { Alert } from '../shared/components/Alert';
import type { AdminUser } from '../shared/types';

type AdminLoginResponse = {
  success: boolean;
  token?: string;
  user?: AdminUser;
  error?: string;
};

export function AdminLoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAdminAuth();

  // SEO
  React.useEffect(() => {
    document.title = isRegistering ? 'Register Admin Account | PLAY' : 'Admin Login | PLAY';
  }, [isRegistering]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return setError('Missing fields');

    setLoading(true);
    setError(null);

    const eventName = isRegistering ? 'admin_register' : 'admin_login';
    const payload = isRegistering ? { username, email, password } : { username, password };

    socket.emit(eventName, payload, (res: AdminLoginResponse) => {
      setLoading(false);
      if (res.success) {
        if (isRegistering) {
          // Switch to login mode after successful register
          setIsRegistering(false);
          setPassword('');
          setError('Registration successful. Please log in.');
        } else if (res.token && res.user) {
          login(res.token, res.user);
          navigate({ to: '/admin' });
        }
      } else {
        setError(res.error ?? 'Authentication failed');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-linear-to-b from-black to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-8 sm:mb-10">
          <span className="font-bebas text-5xl sm:text-6xl tracking-tighter text-black mb-4 block">PLAY</span>
          <p className="text-black/40 text-[10px] sm:text-sm font-bold uppercase tracking-widest">
            {isRegistering ? 'Authorized personnel only' : 'Station Command // Access Authorized'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 sm:p-8 rounded-3xl sm:rounded-4xl shadow-2xl shadow-black/5 border border-black/5 space-y-5 sm:space-y-6"
        >
          <AnimatePresence mode="wait">
            {error && (
              <Alert
                type={error.includes('successful') ? 'success' : 'error'}
                message={error}
                onClose={() => setError(null)}
              />
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-2 mb-1 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-14 bg-[#f8f8f6] rounded-2xl px-5 text-sm font-medium font-poppins outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="username"
              />
            </div>

            <AnimatePresence>
              {isRegistering && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-2 mb-1 block">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required={isRegistering}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-[#f8f8f6] rounded-2xl px-5 text-sm font-medium font-poppins outline-none focus:ring-2 focus:ring-orange-500/20 transition-all mb-4"
                    placeholder="name@playit.com"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-2 mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-[#f8f8f6] rounded-2xl px-5 text-sm font-medium font-poppins outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-black hover:bg-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {loading ? 'Processing...' : isRegistering ? 'Register' : 'Access Hub'}
            {!loading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-xs font-poppins text-black/40 hover:text-black transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {isRegistering ? (
              <>
                <Lock size={12} /> Return to Login
              </>
            ) : (
              <>
                <UserPlus size={12} /> Register new Admin
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
