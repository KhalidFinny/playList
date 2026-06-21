import { motion, AnimatePresence } from "framer-motion";
import { Play, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Track } from "@/shared/types";

interface NowPlayingBarProps {
  nowPlaying: Track | null;
  roomId: string;
  isVisible: boolean;
}

export function NowPlayingBar({
  nowPlaying,
  roomId,
  isVisible,
}: NowPlayingBarProps) {
  return (
    <AnimatePresence>
      {isVisible && nowPlaying && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-black/10 p-6 md:px-12 flex items-center justify-between"
        >
          <div className="flex items-center gap-5 overflow-hidden min-w-0">
            <div className="relative w-14 h-14 bg-black rounded-xl overflow-hidden shrink-0">
              {nowPlaying.thumbnail ? (
                <img
                  src={nowPlaying.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Radio size={24} className="text-white animate-pulse" />
                </div>
              )}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mb-1">
                Live Broadcast
              </p>
              <h3 className="text-lg font-bold text-black line-clamp-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {nowPlaying.title}
              </h3>
              <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest line-clamp-1">
                {nowPlaying.author}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <Link
              to="/r/$roomId"
              params={{ roomId }}
              className="flex items-center gap-3 bg-black text-white px-6 py-3 rounded-full hover:bg-orange-500 transition-all active:scale-95"
            >
              <Play size={14} fill="currentColor" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Open Room
              </span>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
