import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FlipText from '../ui/flip-text';
import LineHoverLink from '../ui/line-hover-link';
import AsciiGlitchRipple from '../ui/ascii-glitch-ripple';

gsap.registerPlugin(ScrollTrigger);

// Dynamically import all mockup frames in the directory (supports .png, .jpg, .jpeg, .webp)
const frameModules = import.meta.glob('../../assets/Mockups/IphoneMockup/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', { eager: true, query: '?url', import: 'default' });

// Extract and sort URLs numerically
const frameUrls = Object.keys(frameModules)
  .sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)\.[a-zA-Z0-9]+$/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/(\d+)\.[a-zA-Z0-9]+$/)?.[1] || '0', 10);
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

      // Handle HiDPI / Retina mobile displays (DPR 2x/3x) to eliminate pixelation
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const logicalWidth = window.innerWidth;
      const logicalHeight = window.innerHeight;

      const physicalWidth = Math.round(logicalWidth * dpr);
      const physicalHeight = Math.round(logicalHeight * dpr);

      if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const progress = index / (frameUrls.length - 1 || 1);
      const zoomFactor = 1.0 + (0.30 * progress);
      const isMobile = logicalWidth < 768;

      if (isMobile) {
        // MOBILE: Centered horizontally and vertically with generous top and bottom margins
        const textBlockBottom = 365; // bottom of centered text + commands card when top-28 is applied
        const availableHeight = Math.max(logicalHeight - textBlockBottom - 20, 200);
        const baseScale = Math.min((availableHeight * 0.90) / img.height, (logicalWidth * 0.94) / (img.width * 0.42));
        const scale = baseScale * zoomFactor;
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        // Centered horizontally
        const x = (logicalWidth / 2) - (drawWidth / 2);
        // Centered vertically in the available lower viewport
        const y = textBlockBottom + (availableHeight / 2) - (drawHeight / 2);
        
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
      } else {
        // DESKTOP: Shifted right — range [82%→68%] with progressive 1.0x -> 1.3x zoom
        const baseScale = Math.min(logicalWidth / img.width, (logicalHeight * 0.88) / img.height);
        const scale = baseScale * zoomFactor;
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        
        const startRatio = 0.82;
        const endRatio = 0.68;
        const currentRatio = startRatio - ((startRatio - endRatio) * progress);
        
        const x = (logicalWidth * currentRatio) - (drawWidth / 2);
        const y = (logicalHeight / 2) - (drawHeight / 2);
        
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
      }
      ctx.restore();
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
          anticipatePin: 1,
          invalidateOnRefresh: true,
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

      ScrollTrigger.refresh();

      const handleResize = () => {
        renderFrame(playhead.frame);
        ScrollTrigger.refresh();
      };
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

      {/* Content block: centered on mobile with generous top-28 margin, left-aligned on desktop */}
      <div className="absolute left-4 right-4 sm:left-8 sm:right-auto md:left-32 lg:left-40 xl:left-[15%] max-w-xl z-10 text-white pointer-events-auto top-28 sm:top-32 md:top-0 bottom-auto md:bottom-0 box-border flex flex-col items-center md:items-start text-center md:text-left justify-start md:justify-center">

        <h2
          className="font-normal mb-1 sm:mb-2 md:mb-4"
          style={{ fontFamily: 'Lastik, serif', fontSize: 'clamp(1.5rem, 3.2vw, 3.8rem)', textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}
        >
          <FlipText delay={0.2} together={false} duration={10}>Trade Anywhere.</FlipText>
        </h2>
        
        <p
          className="text-zinc-300 text-[11px] sm:text-sm md:text-base leading-snug sm:leading-relaxed mb-1 sm:mb-1.5"
          style={{ textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.95)' }}
        >
          Execute orders, receive intelligence, and manage risk directly from your <LineHoverLink variant="pulse">Telegram app</LineHoverLink>. 
        </p>

        <p
          className="text-zinc-400 text-[11px] sm:text-sm md:text-base leading-snug sm:leading-relaxed mb-2 sm:mb-3 md:mb-5"
          style={{ textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.95)' }}
        >
          Connects directly to your own Upstox account via secure OAuth — the same account you already trade on, no separate sign-up.
        </p>

        {/* Desktop supervisor description */}
        <div className="hidden md:block space-y-2 mb-5">
            <h3 className="text-xs tracking-[0.2em] text-[#54A1FD] uppercase font-semibold">The Supervisor Agent</h3>
            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.95)' }}>
              One agent, not a black box. Every reasoning step, market lookup, and tool call streams to you in real time — and every trade requires your explicit confirmation before a single order touches your account. Nothing executes without you seeing it first.
            </p>
        </div>

        {/* Compact SYSTEM_COMMANDS terminal box */}
        <div className="bg-[#0a0a0a]/90 p-2 sm:p-3 md:p-6 border border-zinc-800/80 rounded-lg sm:rounded-xl font-mono text-[10px] sm:text-xs md:text-sm text-zinc-400 space-y-1 sm:space-y-2 backdrop-blur-md w-full max-w-full sm:max-w-[420px] shadow-2xl text-left">
            <div className="text-white mb-0.5 sm:mb-1 relative inline-block text-[10px] sm:text-xs">
              <span className="relative z-10 font-semibold tracking-wide ascii-glitch" data-text="~ % SYSTEM_COMMANDS">~ % SYSTEM_COMMANDS</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:gap-1 text-[9.5px] sm:text-xs md:text-sm leading-tight sm:leading-snug">
              <AsciiGlitchRipple as="div" className="text-zinc-300 hover:text-white transition-colors cursor-pointer py-0.5 px-0.5 block select-none" dur={1000}>
                /analyse - Financial analysis
              </AsciiGlitchRipple>
              <AsciiGlitchRipple as="div" className="text-zinc-300 hover:text-white transition-colors cursor-pointer py-0.5 px-0.5 block select-none" dur={1000}>
                /deepdive - In-depth research
              </AsciiGlitchRipple>
              <AsciiGlitchRipple as="div" className="text-zinc-300 hover:text-white transition-colors cursor-pointer py-0.5 px-0.5 block select-none" dur={1000}>
                /sandbox - Simulated execution
              </AsciiGlitchRipple>
              <AsciiGlitchRipple as="div" className="text-[#FF4040] hover:text-[#FF5555] transition-colors cursor-pointer py-0.5 px-0.5 block select-none" dur={1000}>
                /live - Real market execution
              </AsciiGlitchRipple>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PhoneSequence;
