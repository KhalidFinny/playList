import React from "react";
import { motion } from "framer-motion";
import logo from "../../../assets/logo.svg";

export const VinylSVG: React.FC<{ isSpinning: boolean }> = ({ isSpinning }) => {
  return (
    <svg viewBox="0 0 500 500" className="w-full h-full drop-shadow-2xl overflow-visible">
      <defs>
        {/* Main Base Gradient */}
        <radialGradient id="vinylBody" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#2D1B33" />
          <stop offset="85%" stopColor="#1A0F1E" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>

        {/* Shine/Reflection Gradients */}
        <linearGradient id="shine1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.1" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id="shine2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.05" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.05" />
        </linearGradient>

        {/* Label Gradient - Amber/Orange from reference */}
        <radialGradient id="labelGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff9a3d" />
          <stop offset="60%" stopColor="#ff5e1a" />
          <stop offset="100%" stopColor="#d94b15" />
        </radialGradient>
      </defs>

      {/* Main Disc */}
      <circle cx="250" cy="250" r="240" fill="url(#vinylBody)" stroke="#39283F" strokeWidth="2" />

      {/* Grooves (The "Realism" layer) */}
      <g opacity="0.3">
        {[...Array(20)].map((_, i) => (
          <circle
            key={i}
            cx="250"
            cy="250"
            r={80 + i * 8}
            fill="none"
            stroke="white"
            strokeWidth="0.5"
            opacity={0.1 + (i % 3) * 0.05}
          />
        ))}
      </g>

      {/* Rotating Content Group (Strictly the record surface details) */}
      <motion.g
        animate={{ rotate: isSpinning ? 360 : 0 }}
        transition={{
          repeat: Infinity,
          duration: 4,
          ease: "linear",
        }}
        style={{ originX: "250px", originY: "250px" }}
      >
        <g opacity="0.4">
          <path
            d="M250 10 L250 90"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.2"
          />
          <path
            d="M10 250 L90 250"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.2"
          />
        </g>
      </motion.g>

      {/* Static Center Label Background (Does not rotate or pulse) */}
      <g className="cursor-pointer group/label">
        {/* Outer label rings */}
        <circle cx="250" cy="250" r="85" fill="rgba(57,40,63,0.05)" />
        <circle cx="250" cy="250" r="75" fill="url(#labelGradient)" />

        {/* Fine rings on label */}
        {[65, 60, 55, 50, 45].map((r, i) => (
          <circle
            key={i}
            cx="250"
            cy="250"
            r={r}
            fill="none"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="0.5"
          />
        ))}

        {/* Small Hole Detail */}
        <circle cx="250" cy="250" r="4" fill="#000" opacity="0.8" />

        {/* The Logo Button - Static center */}
        <image
          href={logo}
          x="200"
          y="200"
          width="100"
          height="100"
          className="group-hover/label:scale-105 transition-transform duration-300"
          style={{ transformOrigin: "250px 250px" }}
        />
      </g>

      {/* Static Shine (Creates depth against the rotating record) */}
      <g pointerEvents="none">
        <path d="M250 10 Q 350 50 490 250 L 250 250 Z" fill="url(#shine1)" opacity="0.6" />
        <path d="M250 490 Q 150 450 10 250 L 250 250 Z" fill="url(#shine2)" opacity="0.6" />
      </g>

      {/* Outer Rim Highlight */}
      <circle cx="250" cy="250" r="242" fill="none" stroke="white" strokeWidth="1" opacity="0.05" />
    </svg>
  );
};
