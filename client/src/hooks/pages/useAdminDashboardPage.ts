import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useAdminDashboard } from '../../features/admin/hooks/useAdminDashboard';

export function useAdminDashboardPage() {
  const { roomId } = useParams({ from: '/admin/$roomId' }) as { roomId: string };
  const [activeTab, setActiveTab] = useState<'review' | 'music' | 'search' | 'room'>('review');
  
  const dashboard = useAdminDashboard(roomId);

  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    if (!dashboard.roomKey) return;
    navigator.clipboard.writeText(dashboard.roomKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'review', label: 'REVIEW QUEUE' },
    { id: 'music', label: 'MUSIC ROOM' },
    { id: 'search', label: 'FIND TRACKS' },
    { id: 'room', label: 'ACCESS CODE' },
  ];

  return {
    roomId,
    activeTab,
    setActiveTab,
    copied,
    handleCopyKey,
    tabs,
    ...dashboard
  };
}
