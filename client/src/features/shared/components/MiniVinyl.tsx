import { motion } from "framer-motion";

interface MiniVinylProps {
  isPlaying: boolean;
  progress: number;
  thumbnail?: string | null;
  onToggle?: () => void;
}

export function MiniVinyl({ isPlaying, progress, thumbnail, onToggle }: MiniVinylProps) {
  return (
    <div className="relative flex flex-col items-center gap-5 w-full max-w-[240px] mx-auto">
      {/* The disc */}
      <button
        onClick={onToggle}
        className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-black cursor-pointer group"
      >
        {/* Vinyl shine layer */}
        <motion.div
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
          className="absolute inset-0 rounded-full overflow-hidden will-change-transform"
        >
          {/* Dark base */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-800" />

          {/* Groove rings */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
            {Array.from({ length: 24 }).map((_, i) => (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={18 + i * 3.2}
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="0.5"
              />
            ))}
          </svg>

          {/* Thumbnail cutout */}
          {thumbnail && (
            <div className="absolute inset-[22%] rounded-full overflow-hidden ring-1 ring-white/10">
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Orange accent ring when playing */}
          {isPlaying && (
            <div className="absolute inset-[2px] rounded-full ring-1 ring-orange-500/30" />
          )}

          {/* Spinning highlight sweep */}
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            className="absolute inset-0 rounded-full"
            style={{
              background: isPlaying
                ? "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 70%, transparent 100%)"
                : "none",
            }}
          />
        </motion.div>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-orange-500/70" />
          </div>
        </div>

        {/* Play/Pause overlay on hover */}
        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300">
          <div className={`w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-all duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100' : 'opacity-100 scale-100'}`}>
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-black">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-black ml-0.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </div>
        </div>
      </button>

      {/* Progress bar */}
      <div className="w-full max-w-[180px] h-1 bg-black/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-orange-500/50 rounded-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </div>
  );
}
