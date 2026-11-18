import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

import { Badge } from "./badge";
import { SecretDoor } from "./SecretDoor";
import { ThemeToggle } from "./theme-toggle";
import { SoundSettingsButton } from "./SoundSettings";
import { cn } from "@/shared/lib/utils";

interface RoomHeaderProps {
  roomId: string;
  /** The Live pill only exists once the visitor is actually in the room. */
  live?: boolean;
  /** Rendered before the theme toggle; the participant pages put Listen here. */
  children?: React.ReactNode;
}

/**
 * The app bar shared by the music room and the request room.
 *
 * One component because the two pages previously carried the same markup twice,
 * which is how they ended up truncating the room name differently. At 390px the
 * header drops the "Room · " prefix and the word "Live": with both, the room name
 * was reduced to "Room…", which told the visitor nothing.
 */
export function RoomHeader({ roomId, live = false, children }: RoomHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 bg-surface px-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SecretDoor size="xl" />
        <span className="truncate text-title-large">
          <span className="hidden sm:inline">Room · </span>
          {roomId.toUpperCase()}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {live && (
          <span className="flex items-center gap-2 rounded-m3-full bg-surface-container-high p-2 sm:px-3 sm:py-1.5">
            <Badge variant="status" className="animate-pulse bg-primary" />
            <span className="hidden text-label-medium text-on-surface-variant sm:inline">Live</span>
          </span>
        )}

        {children}

        <SoundSettingsButton />

        <ThemeToggle />

        <Link
          to="/"
          aria-label="Home"
          className={cn(
            "state-layer flex size-10 items-center justify-center rounded-m3-full text-on-surface-variant outline-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          <Home size={20} />
        </Link>
      </div>
    </header>
  );
}
