import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { Home } from "lucide-react";

import { Badge } from "@/shared/components/badge";
import { SecretDoor } from "@/shared/components/SecretDoor";
import { Snackbar } from "@/shared/components/snackbar";
import { ThemeToggle } from "@/shared/components/theme-toggle";

import { JoinFlow } from "../features/participant/components/JoinFlow";
import { RequestFlow } from "../features/participant/components/RequestFlow";
import { NowPlayingBar } from "../features/participant/components/NowPlayingBar";

import { useParticipantPage } from "../hooks/pages/useParticipantPage";

export function ParticipantPage() {
  const {
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
    statusMsg,
    suggestions,
    handleSelect,
    handleKeySubmit,
    vibes,
    cooldownSeconds,
  } = useParticipantPage();

  useEffect(() => {
    document.title = isJoined
      ? `Station ${roomId.toUpperCase()} | PLAY LIST`
      : "Join Broadcast | PLAY LIST";
  }, [isJoined, roomId]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-surface text-on-surface">
      {/* Top app bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 bg-surface px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SecretDoor size="xl" />
          <span className="truncate text-title-large">
            Room · {roomId?.toUpperCase() || "Music Room"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isJoined && (
            <span className="hidden items-center gap-2 rounded-m3-full bg-surface-container-high px-3 py-1.5 md:flex">
              <Badge variant="status" className="animate-pulse bg-primary" />
              <span className="text-label-medium text-on-surface-variant">Live</span>
            </span>
          )}

          <ThemeToggle />

          <Link
            to="/"
            aria-label="Home"
            className="state-layer flex size-10 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Home size={20} />
          </Link>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!isJoined ? (
          <JoinFlow
            passkey={passkey}
            onPasskeyChange={handlePasskeyChange}
            onSubmit={handleKeySubmit}
            isResolving={isResolving}
          />
        ) : (
          <RequestFlow
            query={query}
            setQuery={setQuery}
            isConfirmed={isConfirmed}
            setIsConfirmed={setIsConfirmed}
            suggestions={suggestions}
            results={results}
            loading={loading}
            submitting={submitting}
            onSelect={handleSelect}
            vibes={vibes}
            cooldownSeconds={cooldownSeconds}
          />
        )}
      </AnimatePresence>

      <NowPlayingBar
        nowPlaying={nowPlaying}
        roomId={roomId}
        isVisible={isJoined && !!nowPlaying}
        isPlaying={isPlaying}
      />

      <Snackbar
        message={statusMsg?.text ?? ""}
        type={statusMsg?.type === "success" ? "success" : "error"}
        isOpen={statusMsg !== null}
      />
    </div>
  );
}
