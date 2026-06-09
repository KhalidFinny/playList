import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Home, CheckCircle2, AlertCircle } from "lucide-react";

// Shared Components
import { Badge } from "@/shared/components/badge";
import { SecretDoor } from "@/shared/components/SecretDoor";

// Feature Components
import { JoinFlow } from "../features/participant/components/JoinFlow";
import { RequestFlow } from "../features/participant/components/RequestFlow";
import { NowPlayingBar } from "../features/participant/components/NowPlayingBar";

// Page Logic
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
    statusMsg,
    suggestions,
    handleSelect,
    handleKeySubmit,
    vibes,
  } = useParticipantPage();

  // SEO
  useEffect(() => {
    document.title = isJoined
      ? `Station ${roomId.toUpperCase()} | PLAY LIST`
      : "Join Broadcast | PLAY LIST";
  }, [isJoined, roomId]);

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-[#1a101c] font-poppins overflow-x-hidden relative selection:bg-orange-500 selection:text-white">
      {/* BACKGROUND DECOR */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-[0.03]">
        <div className="w-[400px] h-[400px] border border-black rounded-full" />
        <div className="absolute w-[600px] h-[600px] border border-black rounded-full" />
        <div className="absolute w-[800px] h-[800px] border border-black rounded-full" />
      </div>

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-6 md:px-12 flex justify-between items-center bg-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-5">
          <SecretDoor size="xl" />
          <div className="flex flex-col">
            <span className="font-bebas text-4xl tracking-tighter text-black leading-none uppercase">
              PLAY LIST
            </span>
            <span className="text-[9px] text-black/20 font-bold uppercase tracking-[0.2em] leading-none mt-1">
              Room // {roomId?.toUpperCase() || "Music Room"}
            </span>
          </div>

        </div>

        <div className="flex items-center gap-4">
          {isJoined && (
            <Badge
              variant="outline"
              className="hidden md:flex items-center gap-2 bg-white border-black/10 rounded-full px-6 py-3 h-auto text-sm font-bold tracking-widest text-black/40 uppercase"
            >
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Room: {roomId.toUpperCase()}
            </Badge>
          )}
          <Link
            to="/"
            className="w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center text-black/40 hover:text-black transition-colors"
          >
            <Home size={18} />
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
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
          />
        )}
      </AnimatePresence>

      <NowPlayingBar
        nowPlaying={nowPlaying}
        roomId={roomId}
        isVisible={isJoined && !!nowPlaying}
      />

      <AnimatePresence>
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-24 left-0 right-0 flex justify-center pointer-events-none z-100"
          >
            <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-black/10 shadow-lg shadow-black/5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  statusMsg?.type === "success"
                    ? "bg-orange-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {statusMsg?.type === "success" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black/30 mb-0.5">
                  {statusMsg?.type === "success" ? "Confirmed" : "Error"}
                </p>
                <p className="text-sm font-bold text-black/80 leading-tight tracking-tight truncate max-w-[320px]">
                  {statusMsg?.text}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
