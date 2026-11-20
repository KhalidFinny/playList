import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Trash2 } from "lucide-react";
import { Card } from "@/shared/components/card";
import { Badge } from "@/shared/components/badge";
import { Shape } from "@/shared/shapes/shape";
import { transitions } from "@/shared/motion/springs";
import { roomModeLabel } from "@/shared/lib/roomMode";
import type { Station } from "@/shared/types";

interface StationCardProps {
  station: Station;
  onDelete: () => void;
}

/**
 * M3 card for a station. The `cookie12` shape stands in for the vinyl record —
 * it is the app's primary repeated unit, so the shape earns its keep here.
 *
 * The whole card is a real link, stretched over the surface by an absolutely
 * positioned `Link`, rather than a div with an `onClick`. That is what gives it
 * keyboard activation, open-in-new-tab, and the router's intent preload, which
 * together are why the station opens without a pause. The delete button sits
 * above the stretched link so it still takes its own clicks.
 */
export function StationCard({ station, onDelete }: StationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.base}
      key={station.id}
      className="relative"
    >
      <Card
        variant="filled"
        interactive
        className="flex items-center justify-between gap-4 p-4 sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-4">
          <Shape name="cookie12" size={48} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-title-large">{station.id.toUpperCase()}</h3>
              <Badge variant="status" className="shrink-0 bg-tertiary" />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-label-medium text-on-surface-variant">
              {roomModeLabel(station.mode)} · Access code
              <span className="rounded-m3-xs bg-surface-container-highest px-2 py-0.5 text-title-small text-on-surface">
                {station.passkey}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Delete station ${station.id}`}
            title="Delete station"
            onClick={onDelete}
            className="state-layer relative z-10 flex size-10 items-center justify-center rounded-m3-full text-on-surface-variant outline-none transition-colors hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Trash2 size={20} />
          </button>

          <span className="flex size-10 items-center justify-center rounded-m3-full text-on-surface-variant">
            <ChevronRight size={22} />
          </span>
        </div>
      </Card>

      {/* The stretched link. Its accessible name is the station, so a screen
          reader announces one link per card rather than a nameless one. */}
      <Link
        to="/admin/$roomId"
        params={{ roomId: station.id }}
        aria-label={`Open station ${station.id.toUpperCase()}`}
        className="absolute inset-0 rounded-m3-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </motion.div>
  );
}
