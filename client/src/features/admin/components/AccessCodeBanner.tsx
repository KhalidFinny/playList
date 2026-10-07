import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/button";
import { Card } from "@/shared/components/card";
import { Logo } from "@/shared/components/Logo";

interface AccessCodeBannerProps {
  roomKey: string | null;
  copied: boolean;
  onCopy: () => void;
  roomId: string;
}

/**
 * The room's join code. The code itself is the one place a display type role is
 * correct — it is the single most important value on the screen and is read
 * aloud, so it gets `display-medium` and generous tracking.
 */
export function AccessCodeBanner({ roomKey, copied, onCopy, roomId }: AccessCodeBannerProps) {
  return (
    <Card variant="filled" className="flex flex-col items-center gap-8 p-8 text-center sm:p-12">
      <div className="flex flex-col items-center">
        <Logo size={56} className="mb-4" />
        <p className="text-label-large uppercase tracking-[0.2em] text-on-surface-variant">
          Broadcast room code
        </p>

        <button
          type="button"
          onClick={onCopy}
          disabled={!roomKey}
          aria-label="Copy room code"
          className="state-layer mt-4 rounded-m3-lg px-6 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-38"
        >
          <span className="block text-display-medium tabular-nums tracking-[0.15em] text-on-surface">
            {roomKey ?? "——"}
          </span>
        </button>

        <p className="mt-3 text-body-medium text-on-surface-variant">
          Participants enter this code to join
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button onClick={onCopy} disabled={!roomKey} size="md" className="w-56">
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? "Copied" : "Copy code"}
        </Button>

        <a
          href={`/r/${roomId}`}
          target="_blank"
          rel="noreferrer"
          className="state-layer inline-flex items-center gap-2 rounded-m3-xs px-3 py-2 text-label-large text-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Open participant room <ExternalLink size={16} />
        </a>
      </div>
    </Card>
  );
}
