import React from "react";
import { Hero } from "../features/landing/components/Hero";
import { LoadingOverlay } from "../shared/components/LoadingOverlay";
import logo from "../assets/logo.svg";
import { useLandingPage } from "../hooks/pages/useLandingPage";

export const LandingPage: React.FC = () => {
  const { isLoading } = useLandingPage();

  React.useEffect(() => {
    document.title = "PLAY // Sound Archive";
  }, []);

  return (
    <div className="min-h-screen bg-surface selection:bg-primary selection:text-on-primary">
      <LoadingOverlay isLoading={isLoading} />

      {/* Absolute Header for Logo Only — light text, sits over the dark hero */}
      <header className="absolute left-0 top-0 z-50 flex w-full justify-end px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Play Logo" className="size-8 sm:size-10" />
          <span className="text-headline-medium text-inverse-on-surface/70">PLAY</span>
        </div>
      </header>

      <main>
        <Hero />
      </main>
    </div>
  );
};
