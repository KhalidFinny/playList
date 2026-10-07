import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/button";
import { Logo } from "@/shared/components/Logo";
import { transitions } from "@/shared/motion/springs";

interface JoinFlowProps {
  passkey: string;
  onPasskeyChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isResolving: boolean;
}

/**
 * Room-code entry.
 *
 * The code is the whole task, so it takes a display type role — but applied by
 * the caller, not baked into an input variant. The field itself is a normal M3
 * text field; the code is rendered large and tracked out.
 */
export function JoinFlow({ passkey, onPasskeyChange, onSubmit, isResolving }: JoinFlowProps) {
  return (
    <motion.div
      key="join-flow"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={transitions.base}
      className="relative z-20 flex min-h-screen flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex flex-col items-center">
          <Logo size={72} className="mb-5" />
          <h1 className="text-headline-medium-emphasized">Enter room code</h1>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            Enter the 5-digit number to join the broadcast.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="rounded-m3-xl bg-surface-container px-6 py-8">
            <label htmlFor="room-code" className="sr-only">
              Room code
            </label>
            <input
              id="room-code"
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={passkey}
              onChange={(e) => onPasskeyChange(e.target.value)}
              placeholder="00000"
              autoFocus
              className="w-full bg-transparent text-center text-display-medium tabular-nums tracking-[0.2em] text-on-surface outline-none placeholder:text-on-surface-variant/30"
            />
          </div>

          <Button
            type="submit"
            size="md"
            disabled={passkey.length !== 5 || isResolving}
            className="w-full"
          >
            {isResolving ? <Loader2 className="animate-spin" size={20} /> : "Access broadcast"}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
