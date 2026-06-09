import { motion } from "framer-motion";

interface SoundwaveVisualizerProps {
  isPlaying: boolean;
  progress: number;
  thumbnail?: string | null;
  onToggle?: () => void;
}

const BAR_COUNT = 36;
const BAR_VARIANCE = Array.from({ length: BAR_COUNT }).map((_, i) => ({
  height: 0.12 + Math.sin(i * 1.7) * 0.28 + Math.cos(i * 0.9) * 0.18,
  delay: Math.sin(i * 2.3) * 0.3,
  speed: 0.5 + Math.sin(i * 1.3) * 0.25,
}));

export function SoundwaveVisualizer({
  isPlaying,
  progress,
  thumbnail,
  onToggle,
}: SoundwaveVisualizerProps) {
  return (
    <div className="relative w-full max-w-[320px] mx-auto flex flex-col items-center gap-6">
      {/* Album art thumbnail */}
      <button
        onClick={onToggle}
        className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl overflow-hidden bg-black/5 shadow-2xl shadow-black/10 group cursor-pointer"
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Now Playing"
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/5">
            <div className="w-16 h-16 rounded-full bg-black/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-black/20">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          </div>
        )}

        {/* Play/Pause overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all duration-300">
          <div className={`w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center transition-all duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100' : 'opacity-100 scale-100'}`}>
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-black">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-black ml-0.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </div>
        </div>

        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
          <circle
            cx="50%"
            cy="50%"
            r="46%"
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth="2"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="46%"
            fill="none"
            stroke="rgba(249,115,22,0.6)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progress }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
      </button>

      {/* Soundwave bars */}
      <div className="flex items-end justify-center gap-[3px] sm:gap-1 h-20 sm:h-24 w-full px-4">
        {BAR_VARIANCE.map((v, i) => {
          const barHeight = Math.max(6, v.height * 100);
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-full"
              style={{
                backgroundColor: isPlaying
                  ? `rgba(249,115,22,${0.25 + v.height * 0.5})`
                  : "rgba(0,0,0,0.08)",
                minHeight: "4px",
              }}
              animate={
                isPlaying
                  ? {
                      height: [
                        `${barHeight * 0.4}%`,
                        `${barHeight * (0.7 + v.delay * 0.3)}%`,
                        `${barHeight * (0.3 + Math.abs(v.delay) * 0.4)}%`,
                        `${barHeight * (0.8 + v.delay * 0.2)}%`,
                        `${barHeight * 0.4}%`,
                      ],
                    }
                  : {
                      height: "25%",
                    }
              }
              transition={
                isPlaying
                  ? {
                      duration: 0.8 + v.speed * 0.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: v.delay * 0.5,
                    }
                  : { duration: 0.4 }
              }
            />
          );
        })}
      </div>

      {/* Mini progress bar */}
      <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-orange-500/60 rounded-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </div>
  );
}
