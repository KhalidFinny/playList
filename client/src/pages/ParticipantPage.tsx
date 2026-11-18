import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";

import { Snackbar } from "@/shared/components/snackbar";
import { RoomHeader } from "@/shared/components/RoomHeader";

import { JoinFlow } from "../features/participant/components/JoinFlow";
import { RequestFlow } from "../features/participant/components/RequestFlow";
import { NowPlayingBar } from "../features/participant/components/NowPlayingBar";
import { ListenToggle } from "../features/participant/components/ListenToggle";

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
      <RoomHeader roomId={roomId || "Music room"} live={isJoined}>
        <ListenToggle />
      </RoomHeader>

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
