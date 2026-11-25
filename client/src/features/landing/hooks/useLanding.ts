import { useState, useCallback, useEffect } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useWipeStore } from "@/shared/lib/routeWipe";
import type { HeroState } from "../types";

export const useLanding = () => {
  const navigate = useNavigate();
  const router = useRouter();
  const [heroState, setHeroState] = useState<HeroState>({
    isSpinning: true,
    isHovered: false,
  });

  const handleVinylClick = useCallback(() => {
    localStorage.setItem("has_visited_play_music", "true");
    // The circle covers the screen first, then the room code is navigated to
    // underneath it and revealed as the circle contracts.
    useWipeStore.getState().start(() => {
      navigate({ to: "/r/$roomId/request", params: { roomId: "join" } });
    }, window.location.pathname);
  }, [navigate]);

  /**
   * Fetches the room-code route ahead of the click.
   *
   * The record is a div with an onClick, not a link, so the router's intent
   * preload never fired for it, and the route is nine chunks. On a first visit
   * none of them are cached, so the whole load happened after the click.
   */
  const preloadRoom = useCallback(() => {
    void router.preloadRoute({ to: "/r/$roomId/request", params: { roomId: "join" } });
  }, [router]);

  // The landing has exactly one destination, so warming it while the page is
  // idle costs one route and removes the only wait behind the wipe. Hover alone
  // was not enough: a phone has no hover, and a visitor who clicks immediately
  // never produced one.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 200));
    const handle = idle(preloadRoom);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, [preloadRoom]);

  const setHovered = useCallback((hovered: boolean) => {
    setHeroState((prev) => ({ ...prev, isHovered: hovered }));
  }, []);

  const toggleSpin = useCallback(() => {
    setHeroState((prev) => ({ ...prev, isSpinning: !prev.isSpinning }));
  }, []);

  return {
    heroState,
    handleVinylClick,
    preloadRoom,
    setHovered,
    toggleSpin,
  };
};
