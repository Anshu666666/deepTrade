import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import videoSrc from '../assets/upscaled-video.mp4';
import MorphText from '../components/landing/MorphText';
import CandyButton from '../components/ui/candy-button';
import PhoneSequence from '../components/landing/PhoneSequence';
import TypingKeyboard from '../components/ui/typing-keyboard';
import { gsap } from 'gsap';
import macbookImg from '../assets/MacBook Pro.png';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

import { StarsBackground } from '../components/animate-ui/components/backgrounds/stars';

const Landing: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Adjust video speed as requested
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.7;
    }

    // GSAP Animation for Typing Keyboard tied to Section 3
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section3Ref.current,
          start: "top bottom", // Starts when top of section 3 hits bottom of viewport
          end: "bottom top",   // Ends when bottom of section 3 hits top of viewport
          scrub: true,
        }
      });

      // Animate up (takes up 20% of the scroll duration)
      tl.to(keyboardRef.current, { yPercent: -100, duration: 0.2, ease: "power1.out" });
      // Hold in place (takes up 60% of the scroll duration)
      tl.to(keyboardRef.current, { yPercent: -100, duration: 0.6 });
      // Animate down (takes up 20% of the scroll duration)
      tl.to(keyboardRef.current, { yPercent: 0, duration: 0.2, ease: "power1.in" });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative bg-black font-sans min-h-screen">
      
      {/* Global Stars Background (Above Phone, Below Section 1) */}
      <div className="fixed inset-0 z-40 pointer-events-none mix-blend-screen">
        <StarsBackground starColor="#ffffff" speed={30} className="opacity-60" />
      </div>

      {/* SECTION 1: HERO */}
      <div ref={heroRef} className="relative h-[100dvh] overflow-hidden text-white bg-black z-50" style={{ fontFamily: '"SF Pro Display", sans-serif' }}>
      {/* Background Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-0 brightness-75"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Top Navigation - Fixed & Transparent */}
      <header className="fixed top-0 left-0 w-full z-20 px-6 py-4 md:px-16 md:py-6 flex justify-between items-center bg-transparent box-border">
        <div className="text-xl md:text-2xl font-semibold tracking-wider">
          DeepTrade
        </div>
      </header>

      {/* Hero Content */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center px-6 md:px-8">
        
        <h1 
          className="text-[2.5rem] leading-[1.1] md:text-[5rem] text-center m-0 font-normal tracking-tight" 
          style={{ fontFamily: 'Lastik, serif', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
        >
          Where intuition meets
          <br />
          <MorphText texts={['intelligence.', 'markets.', 'execution.']} />
        </h1>

        <p className="text-zinc-200 text-base md:text-lg max-w-[600px] text-center mt-6 mb-10 md:mb-12 leading-relaxed tracking-wide" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          We design tools for deep thinkers, bold traders, and quiet rebels. Amid the noise of the market, we build autonomous agents for sharp focus and inspired research.
        </p>

        <Link to="/login" className="no-underline">
          <CandyButton className="px-6 py-3 text-sm text-white rounded-xl w-auto inline-flex items-center justify-center">
            Initialize Terminal
          </CandyButton>
        </Link>
      </div>

      {/* Bottom Text - Centered and Raised */}
      <div className="absolute bottom-12 md:bottom-20 left-0 w-full px-6 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-12 z-10 box-border pointer-events-none">
        <div className="text-white/70 text-[0.7rem] md:text-xs tracking-widest uppercase flex flex-col md:flex-row gap-2 md:gap-6 items-center text-center">
          <span>Real-time Market Intelligence</span>
          <span className="hidden md:block w-1 h-1 rounded-full bg-white/30"></span>
          <span>Deep SEC Filing Analysis</span>
        </div>
        
        <div className="hidden md:block w-1 h-1 rounded-full bg-white/50"></div>
        
        <div className="text-white/70 text-[0.7rem] md:text-xs tracking-widest uppercase flex flex-col md:flex-row gap-2 md:gap-6 items-center text-center">
          <span>Privacy First Architecture</span>
          <span className="hidden md:block w-1 h-1 rounded-full bg-white/30"></span>
          <span>Built for Individual Traders</span>
        </div>
      </div>

      {/* Bottom Vignette for Section 1 */}
      <div className="absolute bottom-0 left-0 w-full h-[40dvh] bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />
      </div>

      {/* SECTION 2: PHONE SEQUENCE */}
      <PhoneSequence />

      {/* SECTION 3: THE ENGINE (Triggers Keyboard) */}
      <div ref={section3Ref} className="relative min-h-[100dvh] bg-black text-white flex flex-col md:flex-row items-center justify-center md:justify-end px-8 md:px-12 lg:px-24 z-30 mt-[-100dvh] overflow-hidden gap-32 md:gap-0 pt-16 md:pt-0">
        
        {/* Pale Blurry Circular Gradient (Only in Section 3) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none z-0" />
        
        {/* Video & MacBook Container */}
        <div className="relative w-[90%] md:w-[45%] lg:w-[50%] md:absolute md:left-[8%] lg:left-[12%] md:top-1/2 md:-translate-y-1/2 z-10 flex flex-col items-center">
          {/* Video Placeholder */}
          <div className="w-full aspect-video bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-center shadow-2xl relative z-10 overflow-hidden backdrop-blur-sm">
            <span className="text-zinc-500 font-mono text-sm md:text-base tracking-widest uppercase text-center px-4">Video Placeholder</span>
          </div>

          {/* MacBook Mockup */}
          <img 
            src={macbookImg} 
            alt="MacBook Mockup" 
            className="absolute -bottom-20 -left-4 md:-bottom-24 md:-left-16 lg:-bottom-32 lg:-left-24 w-44 md:w-64 lg:w-[400px] object-contain z-20 pointer-events-none drop-shadow-2xl"
          />
        </div>

        {/* Text Section */}
        <div className="max-w-xl w-full text-center md:text-right z-10 relative md:w-[45%] pb-16 md:pb-0">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal mb-6" style={{ fontFamily: 'Lastik, serif' }}>
            The Autonomous Analyst.
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed md:text-xl">
            DeepTrade doesn't just display data—it reasons through it. 
            Our agentic architecture writes code, executes queries, and synthesizes 
            market intelligence on the fly.
          </p>
        </div>
      </div>

      {/* POP-UP TYPING KEYBOARD */}
      <div 
        ref={keyboardRef} 
        className="fixed bottom-0 left-[-150px] md:left-[-50px] translate-y-full z-20 pointer-events-none origin-bottom-left"
        style={{ transform: 'scale(0.6) translateY(100%)' }}
      >
        <TypingKeyboard />
      </div>

    </div>
  );
};

export default Landing;
