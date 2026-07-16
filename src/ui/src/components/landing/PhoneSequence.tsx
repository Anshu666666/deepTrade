import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FlipText from '../ui/flip-text';
import LineHoverLink from '../ui/line-hover-link';
import AsciiGlitchRipple from '../ui/ascii-glitch-ripple';

gsap.registerPlugin(ScrollTrigger);

// Dynamically import all jpeg frames in the directory
const frameModules = import.meta.glob('../../assets/Mockups/IphoneMockup/*.jpg', { eager: true, query: '?url', import: 'default' });

// Extract and sort URLs numerically
const frameUrls = Object.keys(frameModules)
  .sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)\.jpg$/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/(\d+)\.jpg$/)?.[1] || '0', 10);
    return numA - numB;
  })
  .map(k => frameModules[k] as string);

const PhoneSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const imagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    if (frameUrls.length === 0) return;

    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    // Preload images
    frameUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === frameUrls.length) {
          imagesRef.current = images;
          setLoaded(true);
        }
      };
      images.push(img);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const renderFrame = (index: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = imagesRef.current[index];
      if (!img || !img.complete) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // MOBILE: Scale the phone for mobile view
        const scale = (canvas.height * 0.5) / img.height; 
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (canvas.width / 2) - (drawWidth / 2);
        // Position it resting at the bottom
        const y = canvas.height - drawHeight + (canvas.height * 0.05);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
      } else {
        // DESKTOP: Right side, centered vertically
        const scale = Math.min(canvas.width / img.width, (canvas.height * 0.9) / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        const progress = index / (frameUrls.length - 1 || 1);
        const startRatio = 0.75;
        const endRatio = 0.60;
        const currentRatio = startRatio - ((startRatio - endRatio) * progress);
        
        const x = (canvas.width * currentRatio) - (drawWidth / 2);
        const y = (canvas.height / 2) - (drawHeight / 2);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
      }
    };

    // Render first frame initially
    renderFrame(0);

    const ctx = gsap.context(() => {
      const playhead = { frame: 0 };
      
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=350%', // Locks section 2 for 3.5x viewport height (2.5x anim + 1x overlap)
          scrub: 0.1,    // Smooth tight scrubbing
          pin: true,
          pinSpacing: true, // Ensures it leaves space when unpinning
        }
      });

      // Set initial state for canvas
      gsap.set(canvasRef.current, { scale: 1, rotation: 5 });

      tl.addLabel('start', 0);

      // Animate frames over the first 2.5/3.5 of the scroll distance
      tl.to(playhead, {
        frame: frameUrls.length - 1,
        snap: 'frame',
        ease: 'none',
        duration: 2.5,
        onUpdate: () => renderFrame(playhead.frame)
      }, 'start');

      // Animate canvas scale and rotation in parallel
      tl.to(canvasRef.current, {
        scale: 1,
        rotation: -5,
        ease: 'power1.inOut',
        duration: 2.5
      }, 'start');

      // Dummy tween to keep it pinned while Section 3 scrolls over it
      tl.to({}, { duration: 1.0 });

      const handleResize = () => renderFrame(playhead.frame);
      window.addEventListener('resize', handleResize);
      
      return () => window.removeEventListener('resize', handleResize);
    }, containerRef);
    
    return () => ctx.revert();
  }, [loaded]);

  return (
    <div ref={containerRef} className="w-full h-[100dvh] bg-black relative flex items-center justify-center overflow-hidden z-20">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm tracking-widest uppercase z-10">
          Loading Visuals...
        </div>
      )}
      
      {/* mix-blend-screen makes the black background of the mockup frames completely transparent! */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none mix-blend-screen" />

      {/* FIX #1 & #6: Bounded right edge + responsive left offset. Removed scrollbar as requested. */}
      <div className="absolute left-4 right-4 sm:left-8 sm:right-auto md:left-32 lg:left-40 xl:left-[15%] max-w-xl z-10 text-white pointer-events-auto top-0 bottom-[25vh] md:bottom-0 box-border flex flex-col justify-center">

        {/* GAP AFTER HEADING — clamp: 16px on small screens → 30px on large */}
        <h2
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal"
          style={{ fontFamily: 'Lastik, serif', textShadow: '0 4px 20px rgba(0,0,0,0.8)', marginBottom: 'clamp(16px, 3vh, 30px)' }}
        >
          <FlipText delay={0.2} together={false} duration={10}>Trade Anywhere.</FlipText>
        </h2>
        
        {/* GAP AFTER PARAGRAPH — clamp: 16px on small screens → 32px on large */}
        <p
          className="text-zinc-400 text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)', marginBottom: 'clamp(16px, 3vh, 32px)' }}
        >
          Execute orders, receive intelligence, and manage risk directly from your <LineHoverLink variant="pulse">Telegram app</LineHoverLink>. No heavy UI required.
        </p>

        {/* GAP AFTER SUPERVISOR SECTION — clamp: 16px on small screens → 32px on large */}
        <div className="space-y-4" style={{ marginBottom: 'clamp(16px, 3vh, 32px)' }}>
            <h3 className="text-xs tracking-[0.2em] text-[#54A1FD] uppercase font-semibold">The Supervisor Agent</h3>
            <p className="text-zinc-300 text-sm leading-relaxed md:text-base">
              Powered exclusively by a <LineHoverLink variant="strike">monolithic</LineHoverLink> <LineHoverLink variant="sweep">Supervisor</LineHoverLink> architecture. 
              No fragile subagent handoffs. A single, omniscient intelligence handles everything from technical analysis to secure order execution.
            </p>
            <p className="text-zinc-500 text-[11px] md:text-xs mt-4 italic">
              Built on the ultra-low latency <LineHoverLink href="https://deepagents.io" target="_blank" variant="pulse" className="text-zinc-300 not-italic font-medium">DeepAgents framework</LineHoverLink>.
            </p>
        </div>

        {/* FIX #2: max-w-full on mobile, max-w-[460px] on sm+ */}
        <div className="bg-[#0a0a0a]/90 p-4 sm:p-6 md:p-8 border border-zinc-800/80 rounded-xl font-mono text-xs sm:text-sm md:text-base text-zinc-400 space-y-4 sm:space-y-5 backdrop-blur-md w-full max-w-full sm:max-w-[460px] shadow-2xl">
            <div className="text-white mb-2 relative inline-block">
              <span className="relative z-10 font-semibold tracking-wide ascii-glitch" data-text="~ % SYSTEM_COMMANDS">~ % SYSTEM_COMMANDS</span>
            </div>
            <div className="flex flex-col gap-2 sm:gap-3">
              <AsciiGlitchRipple as="div" className="text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 block select-none" dur={1000}>
                /analyse - Financial analysis
              </AsciiGlitchRipple>
              <AsciiGlitchRipple as="div" className="text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 block select-none" dur={1000}>
                /deepdive - In-depth research
              </AsciiGlitchRipple>
              <AsciiGlitchRipple as="div" className="text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 block select-none" dur={1000}>
                /sandbox - Simulated execution
              </AsciiGlitchRipple>
              <AsciiGlitchRipple as="div" className="text-[#FF4040] hover:text-[#FF5555] transition-colors cursor-pointer py-1 block select-none" dur={1000}>
                /live - Real market execution
              </AsciiGlitchRipple>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PhoneSequence;
