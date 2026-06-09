import { useState, useEffect, useRef } from 'react';
import { socket } from '../../../shared/lib/socket';
import type { AdminUser } from '../../../shared/types';

type AdminAuthenticateResponse =
  | { success: true; user: AdminUser }
  | { success: false };

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('adminToken')));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    socket.connect();

    if (!token) {
      return;
    }

    // Timeout: don't stay stuck in loading if socket is offline
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 3000);

    socket.emit('admin_authenticate', { token }, (res: AdminAuthenticateResponse) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (res.success) {
        setUser(res.user);
      } else {
        // Token invalid or expired
        setToken(null);
        setUser(null);
        localStorage.removeItem('adminToken');
      }
      setLoading(false);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [token]);

  const login = (newToken: string, newUser: AdminUser) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setUser(newUser);
    setLoading(false);
  };

  const logout = () => {
    // Invalidate server-side session
    const currentToken = localStorage.getItem('adminToken');
    if (currentToken) {
      socket.emit('admin_logout', { token: currentToken });
      socket.disconnect();
    }
    localStorage.removeItem('adminToken');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  return { token, user, loading, login, logout };
}
