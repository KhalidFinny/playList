import { motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { CircularProgress } from "@/shared/components/circular-progress";
import { cn } from "@/shared/lib/utils";

interface TurntableProps {
  isPlaying: boolean;
  onToggle?: () => void;
  progress: number;
}

/**
 * The vinyl. This is the app's identity, so the record and tonearm stay — but
 * every color now comes from the token layer rather than a hardcoded orange.
 *
 * The tonearm swings on the M3 expressive spatial spring, so it settles with the
 * slight overshoot the motion system specifies.
 *
 * Layer order matters here. The progress ring sits **behind** the tonearm: the arm
 * is opaque, so the arc is genuinely hidden where the arm crosses it rather than
 * showing through a translucent arm.
 *
 * The disc's edge is a conic-gradient fade that **sweeps around the rim while the
 * record plays** (8s, slower than the record's 4s, so the two read as separate
 * motions). It is a light source rather than part of the record, so it is not a
 * child of the spinning disc — it has its own rotation and freezes when paused.
 *
 * No elevation on the disc — the groove rings and the gradient edge carry it, and
 * a drop shadow under a record reads as a floating card.
 *
 * The disc carries **no artwork**. The album art lives beside the title in the
 * liner notes instead; at the size and opacity that kept the grooves readable it
 * read as a smudge, and a plain record is the better read.
 */
export const Turntable = ({ isPlaying, onToggle, progress }: TurntableProps) => {
  return (
    <figure className="relative flex aspect-square w-full max-w-[1200px] items-center justify-center">
      {/* Progress — M3's plain circular indicator, riding just outside the disc
          edge. A smooth arc, not the wavy variant: the squiggle competed with
          the grooves for the same read. */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <CircularProgress
          value={progress}
          thickness={5}
          className={isPlaying ? "text-primary" : "text-on-surface-variant"}
        />
      </div>

      {/* The disc. 90% leaves the ring's trough clear of the disc edge.
          Rotation is a CSS animation, not Framer Motion: a never-ending loop
          driven from the main thread wrote to the DOM every frame and cost far
          more than the compositor does. It also freezes where it is when paused,
          rather than rewinding to 0. */}
      <div
        className={cn(
          "disc-spin relative flex size-[90%] items-center justify-center overflow-hidden rounded-m3-full bg-surface-container-lowest transition-colors duration-700",
          !isPlaying && "anim-paused",
        )}
      >
        {/* Grooves. They stop short of the centre, as on a real record. The
            centre is left plain: no artwork sits on the disc. */}
        <svg className="absolute inset-0 size-full opacity-60">
          {Array.from({ length: 45 }).map((_, i) => (
            <circle
              key={i}
              cx="50%"
              cy="50%"
              r={`${32 + i * 1.05}%`}
              fill="none"
              stroke="currentColor"
              className={isPlaying ? "text-primary/30" : "text-outline-variant"}
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>

      {/* The disc's edge. Sits at the disc's bounds (the disc is 90%, centred, so
          its bounds are inset 5%) and stays put while the record spins. Its fade
          sweeps around the rim while playing. */}
      <div
        aria-hidden="true"
        className={cn(
          "disc-ring disc-ring-spin inset-[5%] z-10",
          !isPlaying && "anim-paused opacity-45",
        )}
      />

      {/* Stationary centre label. It is the transport control only when the role
          actually has one: participants get no control, so the label stays a plain
          disc rather than a disabled play button that implies an action. */}
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn(
            "state-layer absolute z-20 flex size-[28%] items-center justify-center rounded-m3-full",
            "border bg-surface-container-lowest transition-transform outline-none",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
            isPlaying ? "border-primary/40" : "border-outline-variant",
            "cursor-pointer hover:scale-105 active:scale-95",
          )}
        >
          {isPlaying ? (
            <Pause size={48} className="text-on-surface" />
          ) : (
            <Play size={48} className="ml-1 text-on-surface" fill="currentColor" />
          )}
        </button>
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "absolute z-20 size-[28%] rounded-m3-full border bg-surface-container-lowest",
            isPlaying ? "border-primary/40" : "border-outline-variant",
          )}
        />
      )}

      {/* Tonearm */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="absolute -top-[3%] left-[117%]">
          {/* Pivot */}
          <div
            className={cn(
              "relative flex size-[clamp(18px,1.9vw,30px)] items-center justify-center rounded-m3-full border-2",
              "bg-surface-container-lowest transition-colors duration-700",
              isPlaying ? "border-primary/60" : "border-outline",
            )}
          >
            <div
              className={cn(
                "size-1 rounded-m3-full transition-colors duration-700",
                isPlaying ? "bg-primary" : "bg-on-surface-variant",
              )}
            />
          </div>

          {/* Arm */}
          <motion.div
            initial={false}
            animate={{ rotate: isPlaying ? 168 : 180 }}
            transition={{ type: "spring", stiffness: 82, damping: 17 }}
            className="absolute left-1/2 top-1/2 -translate-y-1/2"
            style={{ transformOrigin: "0 50%" }}
          >
            <div
              className={cn(
                "relative h-[clamp(5px,0.6vw,8px)] w-[clamp(190px,34vw,340px)] rounded-m3-full transition-colors duration-700",
                // Opaque, so the squiggle ring is genuinely hidden behind the arm
                // rather than showing through it.
                isPlaying ? "bg-primary" : "bg-on-surface-variant",
              )}
            >
              {/* Counterweight */}
              <div className="absolute -left-2 top-1/2 size-[clamp(12px,1.2vw,18px)] -translate-y-1/2 rounded-m3-full border-2 border-outline bg-surface-container-lowest" />

              {/* Headshell */}
              <div
                className={cn(
                  "absolute -right-1 top-1/2 h-[clamp(13px,1.5vw,20px)] w-[clamp(16px,1.9vw,26px)] -translate-y-1/2 rounded-m3-xs border-2",
                  "bg-surface-container-lowest transition-colors duration-700",
                  isPlaying ? "border-primary/60" : "border-outline",
                )}
              >
                <div
                  className={cn(
                    "absolute left-1/2 top-full h-[clamp(8px,0.9vw,12px)] w-0.5 -translate-x-1/2 transition-colors duration-700",
                    isPlaying ? "bg-primary" : "bg-on-surface-variant/40",
                  )}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </figure>
  );
};
