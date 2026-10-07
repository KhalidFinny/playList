import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Home } from "lucide-react";
import { Button } from "../shared/components/button";
import { Badge } from "../shared/components/badge";
import { SecretDoor } from "../shared/components/SecretDoor";
import { Logo } from "../shared/components/Logo";
import { MusicRoomView } from "../features/shared/components/MusicRoomView";
import { LoadingOverlay } from "../shared/components/LoadingOverlay";
import { ThemeToggle } from "../shared/components/theme-toggle";
import { useMusicRoomPage } from "../hooks/pages/useMusicRoomPage";

export function MusicRoom() {
  const { roomId, nowPlaying, queue, isPlaying, progress, currentTime, duration, isConnecting } =
    useMusicRoomPage();

  useEffect(() => {
    document.title = `${roomId.toUpperCase()} // Active Broadcast`;
  }, [roomId]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
      <LoadingOverlay isLoading={isConnecting} />

      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-4 bg-surface px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SecretDoor size="xl" />
          <span className="truncate text-title-large">Room · {roomId.toUpperCase()}</span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-2 rounded-m3-full bg-surface-container-high px-3 py-1.5">
            <Badge variant="status" className="animate-pulse bg-primary" />
            <span className="text-label-medium text-on-surface-variant">Live</span>
          </span>

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

      <main className="flex w-full flex-1 items-center justify-center overflow-hidden px-2 sm:px-6">
        <MusicRoomView
          roomId={roomId}
          nowPlaying={nowPlaying}
          queue={queue}
          isPlaying={isPlaying}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          role="participant"
        />
      </main>

      <AnimatePresence>
        {!nowPlaying && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-surface p-6 text-center"
          >
            <div className="flex max-w-md flex-col items-center gap-6">
              <Logo size={88} />
              <div className="flex flex-col gap-2">
                <h2 className="text-headline-medium-emphasized">No music playing</h2>
                <p className="text-body-medium text-on-surface-variant">
                  Waiting for the admin to play a song.
                </p>
              </div>
              <Button asChild size="md">
                <Link to="/r/$roomId/request" params={{ roomId }}>
                  Add a song <Plus size={20} />
                </Link>
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
