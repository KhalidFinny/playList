import { useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ListMusic, Music, Search, KeyRound } from "lucide-react";
import { AdminHeader } from "../shared/components/AdminHeader";
import { useAdminAuth } from "../features/admin/hooks/useAdminAuth";
import { PlaybackController } from "../features/admin/components/PlaybackController";
import { SongSearch } from "../features/admin/components/SongSearch";
import { ModerationQueue } from "../features/admin/components/ModerationQueue";
import { AccessCodeBanner } from "../features/admin/components/AccessCodeBanner";
import { LoadingOverlay } from "../shared/components/LoadingOverlay";
import { useAdminDashboardPage } from "../hooks/pages/useAdminDashboardPage";

const isAdminTab = (value: string): value is "review" | "music" | "search" | "room" =>
  value === "review" || value === "music" || value === "search" || value === "room";

const TAB_ICONS = {
  review: ListMusic,
  music: Music,
  search: Search,
  room: KeyRound,
} as const;

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { logout, user, token, loading } = useAdminAuth();
  const {
    roomId,
    activeTab,
    setActiveTab,
    copied,
    handleCopyKey,
    tabs,
    connected,
    roomKey,
    nowPlaying,
    upNext,
    fullQueue,
    activePlayer,
    hasPreviousTrack,
    pendingQueue,
    processingId,
    editingId,
    editValue,
    setEditValue,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    submittingId,
    suggestions,
    onSelectSuggestion,
    onPlayerReady,
    onPlayerEnd,
    onPrevious,
    togglePlayback,
    handleApprove,
    handleDelete,
    startEditing,
    handleSaveEdit,
    handleAddSong,
    handleClearQueue,
    setEditingId,
    setPreviewActive,
  } = useAdminDashboardPage();

  const handlePreviewChange = useCallback(
    (youtubeId: string | null) => {
      setPreviewActive(youtubeId !== null);
    },
    [setPreviewActive],
  );

  useEffect(() => {
    document.title = `Station ${roomId.toUpperCase()} | Admin Control`;
  }, [roomId]);

  const handleLogout = useCallback(() => {
    logout();
    navigate({ to: "/login" });
  }, [logout, navigate]);

  if (loading || !token) return <LoadingOverlay isLoading={true} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
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

      {/* Compact widths: M3 navigation bar */}
      <nav
        aria-label="Dashboard sections"
        className="fixed inset-x-0 bottom-0 z-50 flex h-20 items-stretch justify-around bg-surface-container elevation-3 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = TAB_ICONS[tab.id as keyof typeof TAB_ICONS] ?? ListMusic;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "review" | "music" | "search" | "room")}
              aria-current={isActive ? "page" : undefined}
              className="state-layer flex flex-1 flex-col items-center justify-center gap-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span
                className={`flex h-8 w-16 items-center justify-center rounded-m3-full transition-colors ${
                  isActive
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant"
                }`}
              >
                <Icon size={22} />
              </span>
              <span
                className={`text-label-medium ${
                  isActive ? "text-on-surface" : "text-on-surface-variant"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <main className="w-full flex-1 overflow-y-auto px-2 pb-24 pt-4 lg:pb-4 xl:px-6">
        {/* Kept mounted so the YouTube player keeps playing across tab switches */}
        <div className={activeTab === "music" ? "block h-full" : "hidden"}>
          <PlaybackController
            roomId={roomId}
            nowPlaying={nowPlaying}
            upNext={upNext}
            fullQueue={fullQueue}
            activePlayer={activePlayer}
            hasPreviousTrack={hasPreviousTrack}
            onPlayerReady={onPlayerReady}
            onPlayerEnd={onPlayerEnd}
            onPrevious={onPrevious}
            togglePlayback={togglePlayback}
            onGoToSearch={() => setActiveTab("search")}
          />
        </div>

        {/*
          Panels render directly: no enter/exit animation. Switching tabs is a
          state change, not a gesture, so motion here reads as bounce rather than
          feedback.

          All three panels also share one content width. They previously differed
          (4xl vs 5xl), which reflowed the centred content sideways on every
          switch.
        */}
        {activeTab === "room" && (
          <div className="mx-auto w-full max-w-5xl pt-4">
            <AccessCodeBanner
              roomKey={roomKey}
              copied={copied}
              onCopy={handleCopyKey}
              roomId={roomId}
            />
          </div>
        )}

        {activeTab === "review" && (
          <div className="mx-auto flex w-full max-w-5xl flex-col pt-4">
            <ModerationQueue
              pendingQueue={pendingQueue}
              processingId={processingId}
              editingId={editingId}
              editValue={editValue}
              setEditValue={setEditValue}
              handleApprove={handleApprove}
              handleDelete={handleDelete}
              startEditing={startEditing}
              handleSaveEdit={handleSaveEdit}
              setEditingId={setEditingId}
              onPreviewChange={handlePreviewChange}
              onClearQueue={handleClearQueue}
              pendingCount={pendingQueue.length}
            />
          </div>
        )}

        {activeTab === "search" && (
          <div className="mx-auto w-full max-w-5xl pt-4">
            <SongSearch
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchLoading={searchLoading}
              searchResults={searchResults}
              suggestions={suggestions}
              onSelectSuggestion={onSelectSuggestion}
              handleAddSong={handleAddSong}
              submittingId={submittingId}
            />
          </div>
        )}
      </main>
    </div>
  );
}
