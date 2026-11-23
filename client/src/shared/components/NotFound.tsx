import { Link } from "@tanstack/react-router";
import { Logo } from "@/shared/components/Logo";
import { Button } from "@/shared/components/button";

/**
 * Unknown path.
 *
 * The app is a client-routed SPA, so the host serves the shell for any path and
 * the router decides what it is. Before this there was no fallback, so a mistyped
 * URL rendered an empty page that looked like a crash. The HTTP status is still
 * 200, because the shell is genuinely served: a real 404 would mean giving up deep
 * links like `/r/intelixx`, which is the whole point of the fallback.
 */
export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo size={72} />
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-medium-emphasized">This page does not exist</h1>
        <p className="text-body-medium text-on-surface-variant">
          The link may be out of date, or the room may have been deleted.
        </p>
      </div>
      <Button asChild size="md">
        <Link to="/">Back to the start</Link>
      </Button>
    </div>
  );
}
