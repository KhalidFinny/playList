import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useParticipant } from '../../features/participant/hooks/useParticipant';

export function useParticipantPage() {
  const { roomId } = useParams({ from: '/r/$roomId/request' }) as { roomId: string };
  const navigate = useNavigate();
  const [passkey, setPasskey] = useState('');
  const [isJoined, setIsJoined] = useState(!!sessionStorage.getItem(`room_${roomId}_key`));
  const [isResolving, setIsResolving] = useState(false);
  
  const {
    query,
    setQuery,
    isConfirmed,
    setIsConfirmed,
    results,
    loading,
    submitting,
    nowPlaying,
    isPlaying,
    queue,
    statusMsg,
    suggestions,
    handleSelect,
    joinRoom,
    clearStatusMsg,
    resolveRoomByKey
  } = useParticipant(roomId);
  
  // Clear status on mount (Prevents sticky alerts on refresh)
  useEffect(() => {
    clearStatusMsg();
  }, [clearStatusMsg]);

  const hasJoinedSocket = useRef(false);

  // Auto-join if key exists
  useEffect(() => {
    if (roomId === 'join') return;
    const savedKey = sessionStorage.getItem(`room_${roomId}_key`);
    if (savedKey && !hasJoinedSocket.current) {
      hasJoinedSocket.current = true;
      joinRoom(savedKey, (success) => {
        setIsJoined(success);
        if (!success) {
          sessionStorage.removeItem(`room_${roomId}_key`);
          hasJoinedSocket.current = false;
        }
      }, true);
    }
  }, [roomId, joinRoom]);


  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkey.length !== 5) return;

    if (roomId === 'join') {
      setIsResolving(true);
      resolveRoomByKey(passkey, (success, resolvedRoomId) => {
        setIsResolving(false);
        if (success && resolvedRoomId && resolvedRoomId !== roomId) {
          sessionStorage.setItem(`room_${resolvedRoomId}_key`, passkey);
          navigate({ to: '/r/$roomId/request', params: { roomId: resolvedRoomId } });
        }
      });
    } else {
      joinRoom(passkey, (success) => {
        if (success) {
          sessionStorage.setItem(`room_${roomId}_key`, passkey);
          setIsJoined(true);
        }
      });
    }
  };

  const handlePasskeyChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setPasskey(clean);
    if (statusMsg) clearStatusMsg();
  };

  const vibes = ['Chill', 'Hype', 'Focus', 'Throwback', 'R&B', 'Lo-Fi'];

  return {
    roomId,
    passkey,
    handlePasskeyChange,
    isJoined,
    isResolving,
    query,
    setQuery,
    isConfirmed,
    setIsConfirmed,
    results,
    loading,
    submitting,
    nowPlaying,
    isPlaying,
    queue,
    statusMsg,
    suggestions,
    handleSelect,
    handleKeySubmit,
    vibes
  };
}
