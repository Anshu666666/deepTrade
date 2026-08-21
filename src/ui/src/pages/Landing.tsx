import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import videoSrc from '../assets/upscaled-video.mp4';
import demoVideo from '../assets/demo-video.mp4';
import MorphText from '../components/landing/MorphText';
import CandyButton from '../components/ui/candy-button';
import PhoneSequence from '../components/landing/PhoneSequence';
import TypingKeyboard from '../components/ui/typing-keyboard';
import { gsap } from 'gsap';
import macbookImg from '../assets/MacBook Pro.png';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

import { StarsBackground } from '../components/animate-ui/components/backgrounds/stars';
import { LogoSlider } from '../components/ui/logo-slider';
import { AnimatedFooter } from '../components/ui/animated-footer';
import { GlobeAnalytics } from '../components/ui/cobe-globe-analytics';
import logoDeepagents from '../assets/logos/logo-deepagents.png';
import logoSupabase from '../assets/logos/logo-supabas.png';
import logoTelegram from '../assets/logos/logo-telegram.png';
import logoUpstox from '../assets/logos/logo-upstox.png';
import logoExa from '../assets/logos/logo-exa.png';
import logoValyu from '../assets/logos/logo-valyu.png';
import VaultLock from '../components/forgeui/vault-lock';
import authenticatorIphoneImg from '../assets/authenticator-iphone.png';
import LaunchModal from '../components/landing/LaunchModal';

const Landing: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const headerLogoRef = useRef<HTMLDivElement>(null);
  const headerBtnRef = useRef<HTMLDivElement>(null);

  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const navigate = useNavigate();

  // Play demo video only when scrolled into view
  useEffect(() => {
    const videoEl = demoVideoRef.current;
    if (!videoEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(videoEl);
    return () => observer.disconnect();
  }, []);

  const handleInitializeTerminal = () => {
    // Check if promotional showcase mode is enabled (e.g. Anshu's public Vercel promo deployment)
    const isPromoMode = import.meta.env.VITE_PROMO_MODE === 'true';
    if (isPromoMode) {
      setIsLaunchModalOpen(true);
    } else {
      // Normal execution: local machine or private self-hosted deployment
      navigate('/login');
    }
  };

  // GSAP Smooth Scroll Setup
  useEffect(() => {
    const lenis = new Lenis();

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(raf);
    };
  }, []);

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

    // Header logo + btn inward animation — ends by 50% of scroll into section 2
    const logoEl = headerLogoRef.current;
    const btnEl  = headerBtnRef.current;
    if (logoEl && btnEl) {
      gsap.fromTo(logoEl,
        { paddingLeft: 'clamp(16px, 4vw, 64px)' },
        { paddingLeft: 'clamp(24px, 6vw, 96px)', ease: 'power2.out',
          scrollTrigger: { trigger: document.body, start: 'top top', end: '+=50vh', scrub: 0.6 } }
      );
      gsap.fromTo(btnEl,
        { paddingRight: 'clamp(16px, 4vw, 64px)' },
        { paddingRight: 'clamp(24px, 6vw, 96px)', ease: 'power2.out',
          scrollTrigger: { trigger: document.body, start: 'top top', end: '+=50vh', scrub: 0.6 } }
      );
    }

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative bg-black font-sans min-h-screen">
      
      {/* Launch Modal for Public / Vercel visitors */}
      <LaunchModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
      />

      {/* Global Stars Background (Above Phone, Below Section 1) */}
      <div className="fixed inset-0 z-40 pointer-events-none mix-blend-screen">
        <StarsBackground starColor="#ffffff" speed={30} className="opacity-60" />
      </div>

      {/* Top Navigation — Glassmorphism */}
      <header
        className="fixed top-0 left-0 w-full flex justify-between items-center box-border py-2 sm:py-3 md:py-4"
        style={{
          zIndex: 999,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div ref={headerLogoRef} className="flex items-center" style={{ paddingLeft: 'clamp(14px, 3.5vw, 64px)' }}>
          <span className="text-white text-lg sm:text-xl md:text-2xl font-semibold tracking-wider select-none">DeepTrade</span>
        </div>
        <div ref={headerBtnRef} className="flex items-center" style={{ paddingRight: 'clamp(14px, 3.5vw, 64px)' }}>
          <CandyButton
            onClick={handleInitializeTerminal}
            className="text-xs sm:text-sm md:text-base px-3.5 py-1.5 sm:px-6 sm:py-2.5 md:px-8 md:py-3"
          >
            Initialize Terminal
          </CandyButton>
        </div>
      </header>

      {/* SECTION 1: HERO */}
      <div ref={heroRef} className="relative h-[100dvh] overflow-hidden text-white bg-black z-50" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>
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

      {/* Hero Content */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center px-6 md:px-8">
        
        <h1 
          className="leading-[1.1] text-center m-0 font-normal tracking-tight" 
          style={{ fontFamily: 'Lastik, serif', fontSize: 'clamp(1.8rem, 4vw, 4rem)', textShadow: '0 8px 40px rgba(0,0,0,0.8), 0 4px 20px rgba(0,0,0,0.6)' }}
        >
          Where intuition meets
          <br />
          <MorphText texts={['intelligence.', 'markets.', 'execution.']} />
        </h1>

        <p className="text-zinc-400 text-sm sm:text-base md:text-lg max-w-[580px] text-center mt-5 mb-10 md:mb-12 leading-snug tracking-wide">
          DeepTrade is a conversational financial research and broker execution assistant for individual traders — one AI that analyzes markets, synthesizes filings and news, and executes confirmed orders on your Upstox account directly from chat.
        </p>

      </div>

      {/* Bottom Text - Centered and Raised */}
      <div className="absolute bottom-12 md:bottom-20 left-0 w-full px-6 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-12 z-20 box-border pointer-events-none" style={{ textShadow: '0 4px 15px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.95)' }}>
        <div className="text-white/70 text-[0.7rem] md:text-xs tracking-widest uppercase flex flex-col md:flex-row gap-2 md:gap-6 items-center text-center">
          <span>Deep Financial Research</span>
          <span className="hidden md:block w-1 h-1 rounded-full bg-white/30"></span>
          <span>Transparent, Confirmed Execution</span>
        </div>
        
        <div className="hidden md:block w-1 h-1 rounded-full bg-white/50"></div>
        
        <div className="text-white/70 text-[0.7rem] md:text-xs tracking-widest uppercase flex flex-col md:flex-row gap-2 md:gap-6 items-center text-center">
          <span>Open Source · Any LLM</span>
          <span className="hidden md:block w-1 h-1 rounded-full bg-white/30"></span>
          <span>Built for Individual Traders</span>
        </div>
      </div>

      {/* Bottom Vignette for Section 1 — height scales with viewport */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" style={{ height: 'clamp(180px, 30dvh, 380px)' }} />
      </div>

      {/* SECTION 2: PHONE SEQUENCE */}
      <PhoneSequence />

      {/* SECTIONS 3 & 4 WRAPPER (Triggers Keyboard) */}
      <div ref={section3Ref} className="relative bg-black text-white z-30 mt-[-100dvh] overflow-hidden">
        
        {/* LOGO SLIDER SECTION */}
        <div className="relative z-20 bg-black pt-32 pb-20 md:pt-20 md:pb-28 flex flex-col items-center justify-center">
          <p className="text-zinc-500 text-xs md:text-sm uppercase tracking-[0.2em] mb-12 font-medium text-center">Made with</p>
          <LogoSlider
            logos={[
              <div key="gap1" />,
              <a key="1" href="https://pypi.org/project/deepagents/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoDeepagents} alt="Deepagents" className="object-contain w-[140px] md:w-[180px] max-w-none" /></a>,
              <div key="gap2" />,
              <a key="2" href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoSupabase} alt="Supabase" className="object-contain w-[180px] md:w-[240px] max-w-none scale-110" /></a>,
              <div key="gap3" />,
              <a key="3" href="https://telegram.org/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoTelegram} alt="Telegram" className="object-contain w-[180px] md:w-[220px] max-w-none scale-110" /></a>,
              <div key="gap4" />,
              <a key="4" href="https://upstox.com/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoUpstox} alt="Upstox" className="object-contain w-[120px] md:w-[150px] max-w-none" /></a>,
              <div key="gap5" />,
              <a key="5" href="https://exa.ai/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoExa} alt="Exa" className="object-contain w-[120px] md:w-[150px] max-w-none brightness-200" /></a>,
              <div key="gap6" />,
              <a key="6" href="https://valyu.ai/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoValyu} alt="Valyu" className="object-contain w-[130px] md:w-[165px] max-w-none brightness-200" /></a>,
              <div key="gap7" />,
              <a key="7" href="https://pypi.org/project/deepagents/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoDeepagents} alt="Deepagents" className="object-contain w-[140px] md:w-[180px] max-w-none" /></a>,
              <div key="gap8" />,
              <a key="8" href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoSupabase} alt="Supabase" className="object-contain w-[180px] md:w-[240px] max-w-none scale-110" /></a>,
              <div key="gap9" />,
              <a key="9" href="https://telegram.org/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoTelegram} alt="Telegram" className="object-contain w-[180px] md:w-[220px] max-w-none scale-110" /></a>,
              <div key="gap10" />,
              <a key="10" href="https://upstox.com/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoUpstox} alt="Upstox" className="object-contain w-[120px] md:w-[150px] max-w-none" /></a>,
              <div key="gap11" />,
              <a key="11" href="https://exa.ai/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoExa} alt="Exa" className="object-contain w-[120px] md:w-[150px] max-w-none brightness-200" /></a>,
              <div key="gap12" />,
              <a key="12" href="https://valyu.ai/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full opacity-70 hover:opacity-100 transition-opacity"><img src={logoValyu} alt="Valyu" className="object-contain w-[130px] md:w-[165px] max-w-none brightness-200" /></a>,
            ]}
            speed={38}
          />
        </div>
        
        {/* Pale Blurry Circular Gradients */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none z-0" />
        <div className="absolute top-[75%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none z-0" />

        {/* SECTION 3: THE ENGINE */}
        <div className="relative min-h-[100dvh] flex flex-col md:flex-row items-center justify-center md:justify-end px-8 md:px-12 lg:px-24 gap-32 md:gap-0 pt-16 md:pt-0">
          {/* Top vignette — same gradient as Section 1 bottom */}
          <div className="absolute top-0 left-0 w-full h-[30dvh] bg-gradient-to-b from-black via-black/80 to-transparent z-10 pointer-events-none" />
          {/* Video & MacBook Container */}
          <div className="relative w-[90%] md:w-[45%] lg:w-[50%] md:absolute md:left-[8%] lg:left-[12%] md:top-1/2 md:-translate-y-1/2 z-10 flex flex-col items-center">
            {/* Native Demo Video */}
            <div className="w-full bg-black border border-zinc-800 rounded-xl shadow-2xl relative z-10 overflow-hidden backdrop-blur-sm">
              <video
                ref={demoVideoRef}
                src={demoVideo}
                loop
                muted
                playsInline
                preload="metadata"
                className="w-full h-auto block rounded-xl"
              />
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
            <h2 
              className="font-normal mb-6" 
              style={{ fontFamily: 'Lastik, serif', fontSize: 'clamp(1.8rem, 4vw, 4rem)' }}
            >
              The Autonomous Analyst.
            </h2>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-lg md:ml-auto" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 4px 20px rgba(0,0,0,0.8)' }}>
              DeepTrade doesn't just display data — it researches it. Powered by Exa for real-time web intelligence and Valyu for financial datasets and filings, the agent pulls from both and synthesizes it into one clear answer, not a wall of raw numbers.
            </p>
          </div>
        </div>

        {/* SECTION 4: OPEN BY DESIGN */}
        <div
          className="relative min-h-[100dvh] flex flex-col items-center justify-center px-8 md:px-12 lg:px-24 text-center"
          style={{
            '--s4-label-gap':      'clamp(1.5rem, 3vw, 2.5rem)',
            '--s4-heading-gap':    'clamp(1.75rem, 3.5vw, 3rem)',
            '--s4-para-gap':       'clamp(1rem, 2vw, 1.5rem)',
            '--s4-line-height':    '1.5',
            '--s4-label-tracking': '0.2em',
          } as React.CSSProperties}
        >
          <div className="max-w-2xl w-full flex flex-col items-center z-10 relative">

            {/* Label row */}
            <div
              className="text-white/70 text-[0.7rem] md:text-xs uppercase flex flex-col md:flex-row gap-2 md:gap-4 items-center text-center"
              style={{ letterSpacing: 'var(--s4-label-tracking)', marginBottom: 'var(--s4-label-gap)' }}
            >
              <span>OPEN SOURCE</span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-white/30" />
              <span>MODEL-AGNOSTIC</span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-white/30" />
              <span>LOCAL OR CLOUD</span>
            </div>

            {/* Heading */}
            <h2
              className="font-normal"
              style={{ fontFamily: 'Lastik, serif', fontSize: 'clamp(1.8rem, 4vw, 4rem)', marginBottom: 'var(--s4-heading-gap)' }}
            >
              Open By Design.
            </h2>

            {/* Body copy */}
            <div
              className="text-zinc-300 text-xs sm:text-sm md:text-base max-w-xl flex flex-col"
              style={{ lineHeight: 'var(--s4-line-height)', gap: 'var(--s4-para-gap)', textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 4px 20px rgba(0,0,0,0.8)' }}
            >
              <p className="m-0">
                DeepTrade is fully open-source — audit it, fork it, make it yours. Bring
                your own model through OpenRouter, whether that's Claude, GPT, or an
                open-weight LLM, and run it wherever you want: locally on your own machine,
                or deployed to any cloud. The cost and the control are entirely yours.
              </p>
              <p className="m-0">
                Bring your own model — the LLM is yours to choose. Order execution runs
                on the official Upstox API, so every trade is placed through Upstox's own
                infrastructure, not a third-party intermediary.
              </p>
            </div>

          </div>

          {/* Globe Container - Full uncut sphere positioned to the right with margin */}
          <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-6 md:right-12 lg:right-20 w-60 sm:w-80 md:w-[420px] lg:w-[500px] z-0 pointer-events-auto opacity-75 drop-shadow-2xl">
            <GlobeAnalytics />
          </div>

        </div>

        {/* Generous margin/spacer between Section 4 and Section 5 */}
        <div className="w-full h-32 md:h-56 lg:h-72 pointer-events-none" />

        {/* SECTION 5: SECURITY & SANDBOX */}
        <div className="relative min-h-[100dvh] flex flex-col md:flex-row items-center justify-center md:justify-start px-8 md:px-12 lg:px-24 gap-16 md:gap-0 pt-16 md:pt-0 pb-16">
          
          {/* Text Section (Left) - Enhanced with z-30 pointer-events-auto */}
          <div className="max-w-xl w-full text-center md:text-left z-30 relative md:w-[45%] md:ml-12 lg:ml-24 pointer-events-auto">
            <h2 
              className="font-normal mb-6" 
              style={{ fontFamily: 'Lastik, serif', fontSize: 'clamp(1.8rem, 4vw, 4rem)' }}
            >
              Fortified Freedom.
            </h2>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed mb-4" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 4px 20px rgba(0,0,0,0.8)' }}>
              Trade with confidence. DeepTrade is guarded by a rigorous 7-day Time-Based One-Time Password (TOTP) cycle, ensuring your active session remains yours alone.
            </p>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 4px 20px rgba(0,0,0,0.8)' }}>
              Not ready to risk capital? Engage the Sandbox Mock Registry. The agent simulates real market executions with a virtual portfolio, letting you practice research and order execution with ₹10,00,000 in virtual funds and zero financial exposure.
            </p>
          </div>

          {/* Visuals Container (Right) - z-10 */}
          <div className="relative w-[90%] md:w-[45%] lg:w-[50%] md:absolute md:right-[8%] lg:right-[12%] md:top-1/2 md:-translate-y-1/2 z-10 flex flex-col items-center mt-6 md:mt-0 pointer-events-none sm:pointer-events-auto">
            {/* Vault Component */}
            <div className="w-full flex items-center justify-center relative z-10">
              <VaultLock 
                className="w-full lg:w-[650px]" 
                cardTitle="TOTP Authenticator"
                cardDescription="Scan the QR code to link your account. 7-day rolling sessions secured by time-based one-time passwords."
              />
            </div>

            {/* iPhone Mockup */}
            <img 
              src={authenticatorIphoneImg} 
              alt="Authenticator App on iPhone" 
              className="absolute -bottom-16 -right-4 sm:-bottom-24 sm:-right-8 md:-bottom-32 md:-right-24 lg:-bottom-48 lg:-right-32 w-36 sm:w-44 md:w-64 lg:w-[400px] object-contain z-10 pointer-events-none drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Spacer between Section 5 and Footer: tight on mobile, spacious on desktop */}
        <div className="w-full h-6 sm:h-12 md:h-48 lg:h-[250px] pointer-events-none" />
      </div>

      {/* POP-UP TYPING KEYBOARD */}
      <div 
        ref={keyboardRef} 
        className="fixed bottom-0 left-[-150px] md:left-[-50px] translate-y-full z-20 pointer-events-none origin-bottom-left"
        style={{ transform: 'scale(0.6) translateY(100%)' }}
      >
        <TypingKeyboard />
      </div>

      {/* FOOTER */}
      <div className="relative min-h-[50dvh] w-full z-30" style={{ height: 'clamp(400px, 55dvh, 650px)' }}>
        <AnimatedFooter
          headingLines={["Think. Analyse. Trade."]}
          leftImage="/footer-left.jpg"
          rightImage="/footer-right.jpg"
          background="#000000"
          textColor="#ffffff"
          charColor="#803500"
          hoverColor="#ff6a00"
          links={[
            { label: "GitHub", href: "https://github.com/Anshu666666/deepTrade" },
            { label: "Docs",   href: "https://github.com/Anshu666666/deepTrade/blob/master/README.md" },
            { label: "Made by Anshu666666", href: "https://www.linkedin.com/in/anshuman-biswas-iiitk/" },
          ]}
          copyright={`© ${new Date().getFullYear()} DeepTrade · MIT License`}
          revealOnScroll
        />
      </div>

    </div>
  );
};

export default Landing;
