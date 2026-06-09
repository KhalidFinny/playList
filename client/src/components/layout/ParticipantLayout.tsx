import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { socket } from '../../shared/lib/socket';

export function ParticipantLayout() {

  useEffect(() => {
    socket.connect();

    return () => {
      // Keep connection alive for transitions
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col">
      <main className="flex-1">
         <Outlet />
      </main>
    </div>
  );
}
