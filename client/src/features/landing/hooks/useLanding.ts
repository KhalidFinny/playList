import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { HeroState } from "../types";

export const useLanding = () => {
  const navigate = useNavigate();
  const [heroState, setHeroState] = useState<HeroState>({
    isSpinning: true,
    isHovered: false,
  });

  const handleVinylClick = useCallback(() => {
    localStorage.setItem("has_visited_play_music", "true");
    navigate({
      to: "/r/$roomId/request",
      params: { roomId: "join" },
    });
  }, [navigate]);

  const setHovered = useCallback((hovered: boolean) => {
    setHeroState((prev) => ({ ...prev, isHovered: hovered }));
  }, []);

  const toggleSpin = useCallback(() => {
    setHeroState((prev) => ({ ...prev, isSpinning: !prev.isSpinning }));
  }, []);

  return {
    heroState,
    handleVinylClick,
    setHovered,
    toggleSpin,
  };
};
