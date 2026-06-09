import React from "react";
import { Link } from "@tanstack/react-router";
import { Music, Plus, Headphones, Radio } from "lucide-react";
import { Button } from "../../../shared/components/button";
import type { Track } from "../../../shared/types";

interface StationSequenceProps {
  queue: Track[];
  roomId: string;
}

export const StationSequence: React.FC<StationSequenceProps> = ({
  queue,
  roomId,
}) => {
  return (
    <aside className="w-full bg-white/40 backdrop-blur-md border-l border-black/5 flex flex-col p-12">
      <div className="flex items-center justify-between mb-16">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white">
            <Radio size={18} strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-black">
            Up Next
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-bold text-black/45 uppercase tracking-widest">
            Live
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-10 pr-4 no-scrollbar">
        {queue.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-black/15 px-8 text-center">
            <Headphones className="text-black/30 mb-4" size={32} />
            <span className="text-xs font-bold text-black/55 uppercase tracking-widest leading-relaxed">
              Queue is empty
              <br />
              Add some songs!
            </span>
          </div>
        )}

        {queue.map((track, index) => (
          <div key={track.id} className="group relative">
            <div className="flex items-center gap-6">
              <span className="text-[10px] font-bold text-black/30 uppercase font-poppins shrink-0">
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <div className="relative w-16 h-16 shrink-0 bg-black/5 overflow-hidden rounded-sm">
                {track.thumbnail ? (
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-60"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/5">
                    <Music size={24} className="text-black/10" />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-black uppercase tracking-tight truncate font-poppins">
                  {track.title}
                </span>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest truncate mt-1">
                  {track.artist || track.author}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        asChild
        variant="outline"
        className="mt-8 w-full border-black/10 font-bold uppercase tracking-widest hover:border-black hover:bg-black/5 transition-all text-black/60 hover:text-black group"
      >
        <Link to="/r/$roomId/request" params={{ roomId }}>
          <Plus
            size={14}
            className="mr-2 text-orange-500 group-hover:rotate-90 transition-transform"
          />
          <span>Add to queue</span>
        </Link>
      </Button>
    </aside>
  );
};
