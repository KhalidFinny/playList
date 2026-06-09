import { motion } from "framer-motion";
import playIcon from "@/assets/PLay.svg";
import pauseIcon from "@/assets/Pause.svg";
import logo from "@/assets/logo.svg";

interface TurntableProps {
  isPlaying: boolean;
  onToggle?: () => void;
  progress: number;
  thumbnail?: string | null;
}

export const Turntable = ({
  isPlaying,
  onToggle,
  progress,
  thumbnail,
}: TurntableProps) => {
  const accentColor = isPlaying ? "rgba(249,115,22,1)" : "rgba(0,0,0,0.4)";
  const glowColor = isPlaying ? "rgba(249,115,22,0.1)" : "rgba(0,0,0,0.08)";

  return (
    <figure className="relative w-full aspect-square max-w-[1200px] flex items-center justify-center p-0">
      {/* ATMOSPHERIC RADIANCE */}
      <div
        className="absolute inset-0 transition-colors duration-1000 blur-[100px]"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 75%)`,
        }}
      />

      {/* PROGRESS RING (OUTER) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="49%"
            fill="none"
            stroke="rgba(0,0,0,0.02)"
            strokeWidth="1"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="49%"
            fill="none"
            stroke={accentColor}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progress }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
      </div>

      {/* MINIMAL SKETCH OUTLINES */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 15, 30].map((inset) => (
          <div
            key={inset}
            className={`absolute rounded-full border transition-all duration-1000 ${isPlaying ? "scale-105 border-orange-500/20" : "scale-100 border-black/5"}`}
            style={{ inset: `${inset}%` }}
          />
        ))}
      </div>

      {/* THE SCHEMATIC VINYL DISC (SPINNING LAYER) */}
      <motion.div
        animate={{ rotate: isPlaying ? 360 : 0 }}
        transition={{
          duration: 4,
          repeat: isPlaying ? Infinity : 0,
          ease: "linear",
        }}
        className={`relative w-[98%] h-[98%] rounded-full flex items-center justify-center bg-white border transition-colors duration-1000 ${isPlaying ? "border-orange-500/30 shadow-orange-500/10" : "border-black/10 shadow-black/5"} overflow-hidden shadow-2xl will-change-transform`}
      >
        {/* THUMBNAIL INTEGRATION */}
        {thumbnail && (
          <img
            src={thumbnail}
            alt="Disc Art"
            className={`absolute inset-0 w-full h-full object-cover opacity-10 transition-opacity duration-1000 ${isPlaying ? "opacity-20" : "opacity-5 grayscale"}`}
          />
        )}

        {/* GROOVE TEXTURES */}
        <svg className="absolute inset-0 w-full h-full opacity-60">
          {Array.from({ length: 45 }).map((_, i) => (
            <circle
              key={i}
              cx="50%"
              cy="50%"
              r={`${4 + i * 1.05}%`}
              fill="none"
              stroke={isPlaying ? "rgba(249,115,22,0.3)" : "rgba(0,0,0,0.12)"}
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* TECHNICAL REFRACTION */}
        <div
          className={`absolute inset-0 transition-colors duration-1000 ${isPlaying ? "bg-[conic-gradient(from_0deg,transparent_0%,rgba(249,115,22,0.05)_25%,transparent_50%,rgba(249,115,22,0.05)_75%,transparent_100%)]" : "bg-[conic-gradient(from_0deg,transparent_0%,rgba(0,0,0,0.02)_25%,transparent_50%,rgba(0,0,0,0.02)_75%,transparent_100%)]"}`}
        />
      </motion.div>

      {/* CENTER LABEL HUB (STATIONARY) - clickable for play/pause */}
      <button
        onClick={onToggle}
        disabled={!onToggle}
        className={`absolute z-20 w-[28%] h-[28%] rounded-full flex items-center justify-center bg-white border transition-colors duration-1000 ${isPlaying ? "border-orange-500/30" : "border-black/10"} shadow-xl shadow-black/5 ${onToggle ? "cursor-pointer hover:scale-105 active:scale-95" : "cursor-default"} transition-transform`}
      >
        <div className="w-[30%] h-[30%] flex items-center justify-center">
          {isPlaying ? (
            <img
              src={pauseIcon}
              alt="Pause"
              className="relative w-full h-full opacity-90 transition-all duration-300"
            />
          ) : (
            <img
              src={playIcon}
              alt="Play"
              className="relative w-full h-full opacity-90 translate-x-[2px] grayscale-0 transition-all duration-300"
            />
          )}
        </div>

        <div
          className={`absolute -top-[5%] w-[6%] h-[6%] z-40 transition-opacity duration-1000 ${isPlaying ? "opacity-55" : "opacity-35"}`}
        >
          <img
            src={logo}
            alt="Logo"
            className="relative w-full h-full grayscale"
          />
        </div>
      </button>

      {/* NEEDLE ASSEMBLY */}
      {/* Re-anchored so the stylus lands on vinyl grooves instead of floating off-axis */}
      <div className="absolute inset-0 pointer-events-none z-30">
        <div className="absolute left-[117%] top-[-3%]">
          {/* Pivot base (beefier) */}
          <div
            className={`relative w-[clamp(18px,1.9vw,30px)] h-[clamp(18px,1.9vw,30px)] rounded-full border-[2px] bg-white flex items-center justify-center shadow-md transition-colors duration-700 ${isPlaying ? "border-orange-500/65 shadow-orange-500/20" : "border-black/15"}`}
          >
            <div
              className={`w-[4px] h-[4px] rounded-full transition-colors duration-700 ${isPlaying ? "bg-orange-500" : "bg-black/35"}`}
            />
          </div>

          {/* Tonearm */}
          <motion.div
            initial={false}
            animate={{ rotate: isPlaying ? 168 : 180 }}
            transition={{ type: "spring", stiffness: 82, damping: 17 }}
            className="absolute left-1/2 top-1/2 -translate-y-1/2"
            style={{ transformOrigin: "0 50%" }}
          >
            <div
              className={`relative w-[clamp(190px,34vw,340px)] h-[clamp(5px,0.6vw,8px)] rounded-full transition-all duration-700 ${isPlaying ? "bg-orange-500/75 shadow-[0_0_18px_rgba(249,115,22,0.45)]" : "bg-black/28"}`}
            >
              {/* Counterweight */}
              <div className="absolute -left-[8px] top-1/2 -translate-y-1/2 w-[clamp(12px,1.2vw,18px)] h-[clamp(12px,1.2vw,18px)] rounded-full border-2 border-black/20 bg-white" />

              {/* Headshell + cartridge */}
              <div
                className={`absolute -right-[3px] top-1/2 -translate-y-1/2 w-[clamp(16px,1.9vw,26px)] h-[clamp(13px,1.5vw,20px)] rounded-[3px] border-2 bg-white transition-colors duration-700 ${isPlaying ? "border-orange-500/60" : "border-black/18"}`}
              >
                {/* Stylus */}
                <div
                  className={`absolute left-1/2 top-full -translate-x-1/2 w-[2px] h-[clamp(8px,0.9vw,12px)] transition-colors duration-700 ${isPlaying ? "bg-orange-500" : "bg-black/35"}`}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </figure>
  );
};
