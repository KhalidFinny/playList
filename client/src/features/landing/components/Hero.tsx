import React from "react";
import { motion } from "framer-motion";
import { transitions } from "@/shared/motion/springs";
import { useLanding } from "../hooks/useLanding";
import logo from "../../../assets/logo.svg";
import "./Hero.css";

/**
 * The record behind the hero.
 *
 * It has to read as a turning disc, which takes three layers: grooves that rotate
 * with it, an off-centre specular highlight that rotates too (a concentric groove
 * alone is invisible when it turns), and a rim shadow that gives the edge depth.
 *
 * Everything bright is a soft radial or an arc, never a straight band: a linear
 * gradient across a disc this large reads as a line sweeping the page rather than
 * as light sitting on a record.
 */
const FullScreenVinyl: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-[#050505]">
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        className="h-[150vmax] w-[150vmax] opacity-90"
      >
        <defs>
          <radialGradient id="vinylDepth" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1b1b1b" />
            <stop offset="62%" stopColor="#111111" />
            <stop offset="100%" stopColor="#050505" />
          </radialGradient>

          {/* Off-centre key light. Rotating this is what makes the disc turn. */}
          <radialGradient id="vinylSheen" cx="32%" cy="24%" r="62%">
            <stop offset="0%" stopColor="white" stopOpacity="0.16" />
            <stop offset="35%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Opposite, weaker fill so the far side is not flat black. */}
          <radialGradient id="vinylFill" cx="74%" cy="78%" r="55%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.045" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Rim shadow: darkens the last stretch of the edge so the disc has
              weight instead of ending flat against the page. */}
          <radialGradient id="vinylRim" cx="50%" cy="50%" r="50%">
            <stop offset="78%" stopColor="#000000" stopOpacity="0" />
            <stop offset="96%" stopColor="#000000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* Base. */}
        <circle cx="500" cy="500" r="500" fill="url(#vinylDepth)" />

        {/* The turning part: grooves, both highlights, and the specular arc. */}
        <g className="hero-disc">
          <g stroke="rgba(255,77,0,0.14)" fill="none" strokeWidth="0.8">
            {Array.from({ length: 40 }).map((_, i) => (
              <circle key={i} cx="500" cy="500" r={60 + i * 18} />
            ))}
          </g>

          <circle cx="500" cy="500" r="500" fill="url(#vinylSheen)" />
          <circle cx="500" cy="500" r="500" fill="url(#vinylFill)" />

          {/* A single soft specular arc, the way light catches the runout of a
              real record. Rotating with the disc, so the turn is unmistakable. */}
          <path
            d="M 268 176 A 400 400 0 0 1 760 232"
            fill="none"
            stroke="white"
            strokeOpacity="0.07"
            strokeWidth="26"
            strokeLinecap="round"
          />
        </g>

        {/* Stationary: the rim shadow and the outer edge highlight. */}
        <circle cx="500" cy="500" r="500" fill="url(#vinylRim)" />
        <circle
          cx="500"
          cy="500"
          r="498"
          fill="none"
          stroke="white"
          strokeOpacity="0.06"
          strokeWidth="2"
        />
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
            className="text-[31vw] font-black leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-center font-condensed [font-stretch:72%] transition-all hover:text-orange-500"
          >
            PLAY
          </motion.h1>

          <div className="relative flex items-center justify-center z-40 my-2">
            <div className="hero-glow absolute w-[180px] h-[180px] sm:w-[250px] sm:h-[250px] rounded-full" />
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleVinylClick}
              className="relative flex size-20 cursor-pointer items-center justify-center rounded-full border-2 border-orange-500 bg-transparent transition-colors duration-500 will-change-transform hover:border-orange-400 sm:size-24"
            >
              <div className="relative z-10 ml-[8%] flex h-1/2 w-1/2 items-center justify-center">
                <img src={logo} alt="Logo" className="relative h-full w-full" />
              </div>
            </motion.div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.base}
            onClick={handleVinylClick}
            className="text-[31vw] font-black leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-center font-condensed [font-stretch:72%] transition-all hover:text-orange-500"
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
              className="text-[14vw] font-black leading-none text-white tracking-tight select-none cursor-pointer drop-shadow-2xl text-right font-condensed [font-stretch:78%] transition-all hover:text-orange-500"
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
              className="relative flex size-28 cursor-pointer items-center justify-center rounded-full border-2 border-orange-500 bg-transparent transition-colors duration-500 will-change-transform hover:border-orange-400 md:size-56"
            >
              <div className="relative z-10 ml-[8%] flex h-1/2 w-1/2 items-center justify-center">
                <img src={logo} alt="Logo" className="relative h-full w-full" />
              </div>
            </motion.div>
          </div>

          <div className="flex justify-start overflow-visible">
            <motion.h1
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={transitions.base}
              onClick={handleVinylClick}
              className="text-[14vw] font-black leading-none text-white tracking-tight select-none cursor-pointer drop-shadow-2xl text-left font-condensed [font-stretch:78%] transition-all hover:text-orange-500 ml-4 md:ml-6"
            >
              LIST
            </motion.h1>
          </div>
        </div>
      </div>
    </section>
  );
};
