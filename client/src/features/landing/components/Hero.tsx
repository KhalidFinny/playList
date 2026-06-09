import React from 'react';
import { motion } from 'framer-motion';
import { useLanding } from '../hooks/useLanding';
import logo from '../../../assets/logo.svg';
import './Hero.css';

const FullScreenVinyl: React.FC<{ isSpinning: boolean }> = ({ isSpinning }) => {
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

          <mask id="rippleMask">
             <motion.circle 
               cx="500" cy="500" 
               fill="white"
               initial={{ r: 0 }}
               animate={{ r: [0, 1500], opacity: [0, 1, 1, 0] }}
               transition={{ repeat: Infinity, duration: 16, ease: "easeInOut" }}
             />
          </mask>

          <filter id="softFade">
            <feGaussianBlur in="SourceGraphic" stdDeviation="60" />
          </filter>

          <linearGradient id="vinylShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="48%" stopColor="white" stopOpacity="0.08" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
            <stop offset="52%" stopColor="white" stopOpacity="0.08" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="500" cy="500" r="500" fill="url(#vinylDepth)" />

        <g stroke="rgba(255,77,0,0.12)" fill="none" strokeWidth="0.8">
          {Array.from({ length: 40 }).map((_, i) => (
            <circle key={i} cx="500" cy="500" r={60 + i * 18} />
          ))}
        </g>

        <g mask="url(#rippleMask)" filter="url(#softFade)">
           <g stroke="rgba(255,77,0,0.15)" fill="none" strokeWidth="1.2">
              {Array.from({ length: 40 }).map((_, i) => (
                <circle key={i} cx="500" cy="500" r={60 + i * 18} />
              ))}
           </g>
        </g>

        <motion.g
          animate={{ rotate: isSpinning ? 360 : 0 }}
          transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
          style={{ originX: '500px', originY: '500px' }}
          className="will-change-transform"
        >
          <circle cx="500" cy="500" r="500" fill="url(#vinylShine)" />
        </motion.g>
      </svg>
    </div>
  );
};

export const Hero: React.FC = () => {
  const { heroState, handleVinylClick } = useLanding();

  return (
    <section 
      className="relative min-h-screen w-full bg-[#050505] flex items-center justify-center overflow-hidden"
      id="hero"
    >
      <FullScreenVinyl isSpinning={heroState.isSpinning} />

      <motion.div 
        animate={{ scale: [1, 1.005, 1], opacity: [0.8, 1, 0.8] }} 
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="absolute inset-0 z-1 pointer-events-none bg-black/10"
      />

      {/* Corner metadata — compact on mobile */}
      <div className="absolute inset-0 p-6 sm:p-10 md:p-16 flex flex-col justify-between pointer-events-none z-30">
        <div className="flex justify-between items-start">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/90 text-[10px] sm:text-[14px] md:text-[18px] tracking-normal font-syne leading-relaxed"
          >
            SHARE YOUR MUSIC
            <div className="w-6 sm:w-10 h-[2px] bg-orange-500 mt-3 sm:mt-5 shadow-[0_0_20px_rgba(249,115,22,1)]"></div>
          </motion.div>
          <div /> 
        </div>

        <div className="flex justify-between items-end">
          <motion.div className="text-white/90 text-[10px] sm:text-[14px] md:text-[18px] tracking-normal font-syne">
            <div className="w-6 sm:w-10 h-[2px] bg-orange-500 mb-3 sm:mb-5 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
            LIVE STREAMING
          </motion.div>
          <div className="text-white/5 text-lg sm:text-2xl md:text-4xl font-light font-syne">÷</div>
        </div>
      </div>

      <div className="relative z-20 w-full h-full flex items-center justify-center px-4 sm:px-8 md:px-0">
        {/* Mobile: vertical stack (PLAY above, circle, LIST below) */}
        <div className="flex sm:hidden flex-col items-center justify-center gap-6 w-full">
          <motion.h1 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleVinylClick}
            className="text-[28vw] leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-center font-bebas transition-all hover:text-orange-500"
          >
            PLAY
          </motion.h1>

          <div className="relative flex items-center justify-center z-40 my-2">
            <motion.div 
               animate={{ scale: [1, 1.05, 1], opacity: [0.02, 0.05, 0.02] }}
               transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
               className="absolute w-[180px] h-[180px] sm:w-[250px] sm:h-[250px] rounded-full bg-white/5 blur-[80px]"
            />
            <motion.div 
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.96 }}
               onClick={handleVinylClick}
               className="relative cursor-pointer w-20 h-20 sm:w-24 sm:h-24 bg-linear-to-br from-orange-300 via-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/5 transition-all duration-500 will-change-transform overflow-hidden group"
            >
                <div className="relative w-1/2 h-1/2 ml-[8%] flex items-center justify-center z-10">
                   <img 
                      src={logo} 
                      alt="Logo" 
                      className="relative w-full h-full brightness-[1.1]" 
                   />
                </div>
            </motion.div>
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleVinylClick}
            className="text-[28vw] leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-center font-bebas transition-all hover:text-orange-500"
          >
            LIST
          </motion.h1>
        </div>

        {/* Desktop/tablet: horizontal layout (PLAY — ● — LIST) */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center w-full max-w-[100vw] gap-8 md:gap-16">
          <div className="flex justify-end overflow-visible">
            <motion.h1 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleVinylClick}
              className="text-[18vw] leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-right font-bebas transition-all hover:text-orange-500"
            >
              PLAY
            </motion.h1>
          </div>

          <div className="relative flex items-center justify-center shrink-0 z-40">
              <motion.div 
                 animate={{ scale: [1, 1.05, 1], opacity: [0.02, 0.05, 0.02] }}
                 transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                 className="absolute w-[250px] h-[250px] md:w-[500px] md:h-[500px] rounded-full bg-white/5 blur-[120px]"
              />
              
              <motion.div 
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.96 }}
                 onClick={handleVinylClick}
                 className="relative cursor-pointer w-28 h-28 md:w-56 md:h-56 bg-linear-to-br from-orange-300 via-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/5 transition-all duration-500 will-change-transform overflow-hidden group"
              >
                  <div className="relative w-1/2 h-1/2 ml-[8%] flex items-center justify-center z-10">
                     <img 
                        src={logo} 
                        alt="Logo" 
                        className="relative w-full h-full brightness-[1.1]" 
                     />
                  </div>
              </motion.div>
          </div>

          <div className="flex justify-start overflow-visible">
            <motion.h1 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleVinylClick}
              className="text-[18vw] leading-none text-white tracking-widest select-none cursor-pointer drop-shadow-2xl text-left font-bebas transition-all hover:text-orange-500 ml-12 md:ml-24"
            >
              LIST
            </motion.h1>
          </div>
        </div>
      </div>
    </section>
  );
};
