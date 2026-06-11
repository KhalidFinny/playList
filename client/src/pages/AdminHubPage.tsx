import React, { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Radio } from 'lucide-react';
import { useAdminAuth } from '../features/admin/hooks/useAdminAuth';
import { socket } from '../shared/lib/socket';
import { Modal } from '../shared/components/Modal';
import { AdminHeader } from '../shared/components/AdminHeader';
import { Button } from '../shared/components/button';
import { Input } from '../shared/components/input';
import { LoadingOverlay } from '../shared/components/LoadingOverlay';
import { StationCard } from '../features/admin/components/StationCard';
import { AdminApprovalCard } from '../features/admin/components/AdminApprovalCard';
import type {
  CreateStationResponse,
  GetMyStationsResponse,
  GetPendingAdminsResponse,
  ModerateAdminResponse,
  PendingAdmin,
  Station,
} from '../shared/types';

const isHubTab = (value: string): value is 'stations' | 'users' =>
  value === 'stations' || value === 'users';

export function AdminHubPage() {
  const { token, user, loading, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: '/login' });
  };
  const [stations, setStations] = useState<Station[]>([]);
  const [creating, setCreating] = useState(false);
  const [newStationId, setNewStationId] = useState('');
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [activeHubTab, setActiveHubTab] = useState<'stations' | 'users'>('stations');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Admin Hub | PLAY Sound Archive';
  }, []);

  useEffect(() => {
    if (token && activeHubTab === 'stations') {
      socket.emit('get_my_stations', { adminToken: token }, (res: GetMyStationsResponse) => {
        if (res.success) setStations(res.stations ?? []);
      });
    }
  }, [token, activeHubTab]);

  useEffect(() => {
    if (token && user?.role === 'super_admin' && activeHubTab === 'users') {
      socket.emit('get_pending_admins', { adminToken: token }, (res: GetPendingAdminsResponse) => {
        if (res.success) setPendingAdmins(res.admins ?? []);
      });
    }
  }, [token, user, activeHubTab]);

  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationId.trim() || !token) return;
    const roomId = newStationId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setCreating(true);
    socket.emit('create_station', { roomId, adminToken: token }, (res: CreateStationResponse) => {
      setCreating(false);
      if (res.success && res.roomId) {
        setIsCreateModalOpen(false);
        navigate({ to: '/admin/$roomId', params: { roomId: res.roomId } });
      }
    });
  };

  const handleApproveAdmin = (id: string) => {
    if (!token) return;
    socket.emit('approve_admin', { adminToken: token, targetId: id }, (res: ModerateAdminResponse) => {
      if (res.success) {
        setPendingAdmins((prev) => prev.filter((admin) => admin.id !== id));
      }
    });
  };

  const handleDenyAdmin = (id: string) => {
    if (!token) return;
    const shouldDeny = window.confirm('Deny registration?');
    if (!shouldDeny) return;

    socket.emit('deny_admin', { adminToken: token, targetId: id }, (res: ModerateAdminResponse) => {
      if (res.success) {
        setPendingAdmins((prev) => prev.filter((admin) => admin.id !== id));
      }
    });
  };

  if (loading || !token) return <LoadingOverlay isLoading={true} />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-black">
      <AdminHeader
        user={user || undefined}
        onLogout={handleLogout}
        title="Admin Hub"
        tabs={
          user?.role === 'super_admin'
            ? [
                { id: 'stations', label: 'Stations' },
                { id: 'users', label: `Approvals ${pendingAdmins.length > 0 ? '●' : ''}` },
              ]
            : undefined
        }
        activeTab={activeHubTab}
        onTabChange={(id) => {
          if (isHubTab(id)) setActiveHubTab(id);
        }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-20 pt-28 sm:pt-32">
        <AnimatePresence mode="wait">
          {activeHubTab === 'stations' ? (
            <motion.div
              key="stations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-32"
            >
              <div className="max-w-3xl mx-auto w-full">
                <div className="flex items-center justify-between mb-16">
                  <h2 className="text-sm font-bold uppercase tracking-[0.4em] text-black/30 flex items-center gap-4">
                    Broadcast Control <span className="w-8 h-px bg-black/10" />{' '}
                    <span className="text-orange-500">{stations.length} Active</span>
                  </h2>
                  <Button onClick={() => setIsCreateModalOpen(true)} variant="premium" size="premium-lg">
                    <Plus size={18} strokeWidth={3} /> Add Station
                  </Button>
                </div>

                {stations.length === 0 ? (
                  <div className="bg-white border border-black/5 rounded-[60px] p-32 text-center shadow-2xl shadow-black/2">
                    <div className="relative w-48 h-48 mx-auto mb-12">
                      <div className="absolute inset-0 bg-orange-500/5 rounded-full animate-ping" />
                      <div className="relative w-full h-full bg-[#f8f8f6] rounded-full flex items-center justify-center">
                        <Radio size={64} className="text-orange-500/20" />
                      </div>
                    </div>
                    <p className="font-poppins text-3xl text-black/20 font-bold tracking-tight leading-tight mb-8">
                      Your soundscape is currently empty.
                    </p>
                    <Button
                      onClick={() => setIsCreateModalOpen(true)}
                      variant="premium"
                      size="premium-lg"
                      className="px-12 py-6 rounded-3xl"
                    >
                      <Plus size={20} strokeWidth={3} /> Initialize First Station
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {stations.map((station) => (
                      <StationCard
                        key={station.id}
                        station={station}
                        onClick={() => navigate({ to: '/admin/$roomId', params: { roomId: station.id } })}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Provision New Station"
              >
                <form onSubmit={handleCreateStation} className="space-y-10">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-4 block">
                      Station Identity (URL Slug)
                    </label>
                    <Input
                      required
                      value={newStationId}
                      onChange={(e) => setNewStationId(e.target.value)}
                      placeholder="e.g. nocturnal-vibes"
                      variant="premium-hero"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={creating || !newStationId.trim()}
                    variant="premium"
                    className="w-full h-20 rounded-3xl flex items-center justify-center gap-4"
                  >
                    {creating ? 'Syncing...' : 'Establish Station'} {!creating && <Plus size={20} strokeWidth={3} />}
                  </Button>
                </form>
              </Modal>
            </motion.div>
          ) : (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-sm font-bold uppercase tracking-[0.4em] text-black/30 mb-12 text-center">
                Access Authorization Requests
              </h2>
              {pendingAdmins.length === 0 ? (
                <div className="text-center py-32 bg-white border border-black/5 rounded-[50px] shadow-sm">
                  <p className="text-lg font-poppins font-bold text-black/10 uppercase tracking-widest">
                    The queue is empty.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingAdmins.map((admin) => (
                    <AdminApprovalCard
                      key={admin.id}
                      admin={admin}
                      onApprove={handleApproveAdmin}
                      onDeny={handleDenyAdmin}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
