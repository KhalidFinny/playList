import { useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, Music, Search, KeyRound } from 'lucide-react';
import { AdminHeader } from '../shared/components/AdminHeader';
import { useAdminAuth } from '../features/admin/hooks/useAdminAuth';
import { PlaybackController } from '../features/admin/components/PlaybackController';
import { SongSearch } from '../features/admin/components/SongSearch';
import { ModerationQueue } from '../features/admin/components/ModerationQueue';
import { AccessCodeBanner } from '../features/admin/components/AccessCodeBanner';
import { useAdminDashboardPage } from '../hooks/pages/useAdminDashboardPage';

const isAdminTab = (value: string): value is 'review' | 'music' | 'search' | 'room' =>
  value === 'review' || value === 'music' || value === 'search' || value === 'room';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { logout, user, token, loading } = useAdminAuth();
  const {
    roomId, activeTab, setActiveTab, copied, handleCopyKey, tabs, connected, roomKey, nowPlaying,
    upNext, fullQueue, activePlayer, pendingQueue, processingId, editingId, editValue, setEditValue,
    searchQuery, setSearchQuery, searchResults, searchLoading, submittingId, suggestions,
    onSelectSuggestion, onPlayerReady, onPlayerEnd, togglePlayback, handleApprove,
    handleDelete, startEditing, handleSaveEdit, handleAddSong, setEditingId,
    setPreviewActive
  } = useAdminDashboardPage();

  // Track when preview is active so we can coordinate features
  const handlePreviewChange = useCallback((youtubeId: string | null) => {
    setPreviewActive(youtubeId !== null);
  }, [setPreviewActive]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !token) {
      navigate({ to: '/admin/login' });
    }
  }, [token, loading, navigate]);

  useEffect(() => {
    document.title = `Station ${roomId.toUpperCase()} | Admin Control`;
  }, [roomId]);

  const handleLogout = useCallback(() => {
    logout();
    navigate({ to: '/admin/login' });
  }, [logout, navigate]);

  if (loading || !token) return null;

  return (
    <div className="min-h-screen bg-[#fdfdfd] text-[#39283f] font-poppins mobile-content-area">
      <AdminHeader 
        connected={connected}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => {
          if (isAdminTab(id)) setActiveTab(id);
        }}
        user={user || undefined}
        onLogout={handleLogout}
        showBackToHub
        title={`Station: ${roomId.toUpperCase()}`}
      />

      {/* Mobile bottom navigation — icon + label, app-style */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-black/5 px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.id === 'review' ? ListMusic : tab.id === 'music' ? Music : tab.id === 'search' ? Search : KeyRound;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'review' | 'music' | 'search' | 'room')}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 transition-all duration-200 ${
                  isActive ? 'text-orange-600' : 'text-black/25 hover:text-black/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive ? 'bg-orange-500/10' : ''
                }`}>
                  <IconComponent size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${
                  isActive ? 'text-orange-600' : 'text-black/30'
                }`}>
                  {tab.id === 'review' ? 'Reviews' : tab.id === 'music' ? 'Music' : tab.id === 'search' ? 'Search' : 'Code'}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="w-full h-full px-2 xl:px-6 pt-24 pb-4">
        <AnimatePresence mode="wait">
          {activeTab === 'room' && (
            <motion.div key="room" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex justify-center">
              <div className="w-full max-w-4xl"><AccessCodeBanner roomKey={roomKey} copied={copied} onCopy={handleCopyKey} roomId={roomId} /></div>
            </motion.div>
          )}
          {activeTab === 'music' && (
            <motion.div key="music" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full h-[calc(100vh-10rem)]">
              <div className="w-full h-full"><PlaybackController roomId={roomId} nowPlaying={nowPlaying} upNext={upNext} fullQueue={fullQueue} activePlayer={activePlayer} onPlayerReady={onPlayerReady} onPlayerEnd={onPlayerEnd} togglePlayback={togglePlayback} /></div>
            </motion.div>
          )}
          {activeTab === 'review' && (
             <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex justify-center">
                <div className="w-full max-w-5xl"><ModerationQueue pendingQueue={pendingQueue} processingId={processingId} editingId={editingId} editValue={editValue} setEditValue={setEditValue} handleApprove={handleApprove} handleDelete={handleDelete} startEditing={startEditing} handleSaveEdit={handleSaveEdit} setEditingId={setEditingId} onPreviewChange={handlePreviewChange} /></div>
             </motion.div>
          )}
          {activeTab === 'search' && (
             <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex justify-center">
                <div className="w-full max-w-4xl"><SongSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchLoading={searchLoading} searchResults={searchResults} suggestions={suggestions} onSelectSuggestion={onSelectSuggestion} handleAddSong={handleAddSong} submittingId={submittingId} /></div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
