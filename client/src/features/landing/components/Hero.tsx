import React from "react";
import { motion } from "framer-motion";
import { transitions } from "@/shared/motion/springs";
import { useLanding } from "../hooks/useLanding";
import logo from "../../../assets/logo.svg";
import "./Hero.css";

const FullScreenVinyl: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#050505] overflow-hidden">
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        className="w-[150vmax] h-[150vmax] opacity-80"
      >
        <defs>
          <radialGradient id="vinylDepth" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#151515" />
            <stop offset="100%" stopColor="#050505" />
          </radialGradient>

          {/* Off-centre highlight. Concentric grooves rotating on their own are
              invisible, because a circle is rotationally symmetric; this is what
              makes the record's turn readable, the way light sits on a real one. */}
          <radialGradient id="vinylSheen" cx="34%" cy="27%" r="58%">
            <stop offset="0%" stopColor="white" stopOpacity="0.1" />
            <stop offset="45%" stopColor="white" stopOpacity="0.03" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          <filter id="softFade">
            <feGaussianBlur in="SourceGraphic" stdDeviation="60" />
          </filter>
        </defs>

        <circle cx="500" cy="500" r="500" fill="url(#vinylDepth)" />

        <g stroke="rgba(255,77,0,0.12)" fill="none" strokeWidth="0.8">
          {Array.from({ length: 40 }).map((_, i) => (
            <circle key={i} cx="500" cy="500" r={60 + i * 18} />
          ))}
        </g>

        {/* The record turning. The highlight is inside the rotation, so the disc
            visibly spins without a band sweeping across the whole hero. */}
        <g className="hero-disc">
          <circle cx="500" cy="500" r="500" fill="url(#vinylSheen)" />
        </g>

        {/* The rotating shine is gone. It was a full-width linear gradient that
            swept a hard diagonal band across the hero once a minute, which read as
            a stray line expanding out of the record rather than as light. The
            record still turns and the ripple still breathes; the highlight is
            carried by the radial gradient underneath. */}
      </svg>
    </div>
  );
};

export const Hero: React.FC = () => {
  const { handleVinylClick } = useLanding();

  return (
    <section
      className="relative min-h-screen w-full bg-[#050505] flex items-center justify-center overflow-hidden"
      id="hero"
    >
      <FullScreenVinyl />

      <div className="hero-breathe absolute inset-0 z-1 pointer-events-none bg-black/10" />

      {/* Corner metadata — compact on mobile */}
      <div className="absolute inset-0 p-6 sm:p-10 md:p-16 flex flex-col justify-between pointer-events-none z-30">
        <div className="flex justify-between items-start">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transitions.base}
            className="text-white/90 text-label-medium sm:text-label-large md:text-title-medium tracking-normal leading-relaxed"
          >
            SHARE YOUR MUSIC
            <div className="w-6 sm:w-10 h-[2px] bg-orange-500 mt-3 sm:mt-5 shadow-[0_0_20px_rgba(249,115,22,1)]"></div>
          </motion.div>
          <div />
        </div>

        <div className="flex justify-between items-end">
          <motion.div className="text-white/90 text-label-medium sm:text-label-large md:text-title-medium tracking-normal">
            <div className="w-6 sm:w-10 h-[2px] bg-orange-500 mb-3 sm:mb-5 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
            LIVE STREAMING
          </motion.div>
          <div className="text-white/5 text-title-large sm:text-headline-small md:text-headline-large font-light">
            ÷
          </div>
        </div>
      </div>

      <div className="relative z-20 w-full h-full flex items-center justify-center px-4 sm:px-8 md:px-0">
        {/* Mobile: vertical stack (PLAY above, circle, LIST below) */}
        <div className="flex sm:hidden flex-col items-center justify-center gap-6 w-full">
          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.base}
            onClick={handleVinylClick}
            className="text-[28vw] font-black leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-center font-condensed [font-stretch:72%] transition-all hover:text-orange-500"
          >
            PLAY
          </motion.h1>

          <div className="relative flex items-center justify-center z-40 my-2">
            <div className="hero-glow absolute w-[180px] h-[180px] sm:w-[250px] sm:h-[250px] rounded-full" />
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleVinylClick}
              className="relative cursor-pointer w-20 h-20 sm:w-24 sm:h-24 bg-linear-to-br from-orange-300 via-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/5 transition-all duration-500 will-change-transform overflow-hidden group"
            >
              <div className="relative w-1/2 h-1/2 ml-[8%] flex items-center justify-center z-10">
                <img src={logo} alt="Logo" className="relative w-full h-full brightness-[1.1]" />
              </div>
            </motion.div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.base}
            onClick={handleVinylClick}
            className="text-[28vw] font-black leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-center font-condensed [font-stretch:72%] transition-all hover:text-orange-500"
          >
            LIST
          </motion.h1>
        </div>

        {/* Desktop/tablet: horizontal layout (PLAY — ● — LIST) */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center w-full max-w-[100vw] gap-4 md:gap-10">
          <div className="flex justify-end overflow-visible">
            <motion.h1
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={transitions.base}
              onClick={handleVinylClick}
              className="text-[12vw] font-black leading-none text-white tracking-tight select-none cursor-pointer drop-shadow-2xl text-right font-condensed [font-stretch:78%] transition-all hover:text-orange-500"
            >
              PLAY
            </motion.h1>
          </div>

          <div className="relative flex items-center justify-center shrink-0 z-40">
            <div className="hero-glow absolute w-[250px] h-[250px] md:w-[500px] md:h-[500px] rounded-full" />

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleVinylClick}
              className="relative cursor-pointer w-28 h-28 md:w-56 md:h-56 bg-linear-to-br from-orange-300 via-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/5 transition-all duration-500 will-change-transform overflow-hidden group"
            >
              <div className="relative w-1/2 h-1/2 ml-[8%] flex items-center justify-center z-10">
                <img src={logo} alt="Logo" className="relative w-full h-full brightness-[1.1]" />
              </div>
            </motion.div>
          </div>

          <div className="flex justify-start overflow-visible">
            <motion.h1
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={transitions.base}
              onClick={handleVinylClick}
              className="text-[12vw] font-black leading-none text-white tracking-tight select-none cursor-pointer drop-shadow-2xl text-left font-condensed [font-stretch:78%] transition-all hover:text-orange-500 ml-4 md:ml-6"
            >
              LIST
            </motion.h1>
          </div>
        </div>
      </div>
    </section>
  );
};
