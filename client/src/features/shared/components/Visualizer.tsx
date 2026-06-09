import { motion } from 'framer-motion';

interface VisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  color?: string;
  opacity?: number;
}

const barPattern = (index: number) => ({
  low: 12 + ((index * 17) % 40),
  high: 28 + ((index * 29) % 90),
  mid: 12 + ((index * 37) % 40),
  duration: 0.3 + ((index * 7) % 5) * 0.1,
});

export const Visualizer = ({
  isPlaying,
  barCount = 100,
  color = 'bg-orange-500',
  opacity = 0.5,
}: VisualizerProps) => {
  return (
    <section
      aria-label="Audio Visualizer"
      className="absolute bottom-0 left-0 w-full h-32 flex items-end justify-center gap-2 px-12 pointer-events-none overflow-hidden"
      style={{ opacity }}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const pattern = barPattern(i);
        return (
          <motion.div
            key={i}
            className={`w-1.5 ${color} rounded-t-full`}
            animate={{
              height: isPlaying ? [pattern.low, pattern.high, pattern.mid] : 6,
            }}
            transition={{
              repeat: Infinity,
              duration: pattern.duration,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </section>
  );
};
