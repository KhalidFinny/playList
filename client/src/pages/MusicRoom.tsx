import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "../shared/components/button";
import { Logo } from "../shared/components/Logo";
import { RoomHeader } from "../shared/components/RoomHeader";
import { MusicRoomView } from "../features/shared/components/MusicRoomView";
import { ListenToggle } from "../features/participant/components/ListenToggle";
import { LoadingOverlay } from "../shared/components/LoadingOverlay";
import { transitions } from "../shared/motion/springs";
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

      <RoomHeader roomId={roomId} live>
        <ListenToggle />
      </RoomHeader>

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
            transition={transitions.base}
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
