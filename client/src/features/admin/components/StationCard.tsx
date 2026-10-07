import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Card } from "@/shared/components/card";
import { Badge } from "@/shared/components/badge";
import { Shape } from "@/shared/shapes/shape";

interface Station {
  id: string;
  passkey: string;
}

interface StationCardProps {
  station: Station;
  onClick: () => void;
}

/**
 * M3 card for a station. The `cookie12` shape stands in for the vinyl record —
 * it is the app's primary repeated unit, so the shape earns its keep here.
 */
export function StationCard({ station, onClick }: StationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      key={station.id}
      onClick={onClick}
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
            <p className="mt-0.5 flex items-center gap-2 text-label-medium text-on-surface-variant">
              Access code
              <span className="rounded-m3-xs bg-surface-container-highest px-2 py-0.5 text-title-small text-on-surface">
                {station.passkey}
              </span>
            </p>
          </div>
        </div>

        <span className="flex size-10 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant">
          <ChevronRight size={22} />
        </span>
      </Card>
    </motion.div>
  );
}
