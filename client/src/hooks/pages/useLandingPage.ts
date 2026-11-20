import { useState, useEffect } from "react";

/**
 * Whether the landing page should still show its splash.
 *
 * This used to be a hardcoded two second timer, which is a delay, not a load: it
 * made every visit to the landing page wait two seconds for nothing. It now waits
 * for the display face to be ready, with a short ceiling so a slow font never
 * holds the page hostage, and only on the first visit in a session.
 */
const SPLASH_KEY = "playlist.splash.shown";
const MAX_WAIT_MS = 900;

export function useLandingPage() {
  const [isLoading, setIsLoading] = useState(() => !sessionStorage.getItem(SPLASH_KEY));

  useEffect(() => {
    if (!isLoading) return;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem(SPLASH_KEY, "1");
      setIsLoading(false);
    };

    const timer = setTimeout(finish, MAX_WAIT_MS);
    void document.fonts?.ready.then(finish).catch(finish);

    return () => clearTimeout(timer);
  }, [isLoading]);

  return { isLoading };
}
