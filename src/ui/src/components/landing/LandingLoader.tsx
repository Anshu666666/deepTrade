import React, { useEffect, useState } from 'react';

interface LandingLoaderProps {
  onComplete?: () => void;
  minDuration?: number;
  maxDuration?: number;
}

export const LandingLoader: React.FC<LandingLoaderProps> = ({
  onComplete,
  minDuration = 600,
  maxDuration = 1600,
}) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('INITIALIZING ENVIRONMENT...');
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const startTime = Date.now();

    // Check if initial critical assets (fonts + DOM) are ready
    const checkAssetsReady = async () => {
      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore font loading error fallback
        }
      }
    };

    checkAssetsReady();

    // Smooth simulated realistic loader progress curve
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min(Math.round((elapsed / maxDuration) * 100), 99);

      setProgress((prev) => Math.max(prev, calculatedProgress));

      if (calculatedProgress > 70) {
        setStatusText('CONNECTING BROKER RUNTIME...');
      } else if (calculatedProgress > 35) {
        setStatusText('SYNTHESIZING MARKET INTELLIGENCE...');
      }

      if (elapsed >= minDuration && document.readyState === 'complete') {
        setProgress(100);
        setStatusText('READY');
        clearInterval(interval);

        setTimeout(() => {
          setIsFading(true);
          setTimeout(() => {
            setIsVisible(false);
            onComplete?.();
          }, 600);
        }, 200);
      }
    }, 40);

    // Hard fallback timeout
    const hardTimeout = setTimeout(() => {
      setProgress(100);
      setStatusText('READY');
      clearInterval(interval);
      setTimeout(() => {
        setIsFading(true);
        setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, 600);
      }, 150);
    }, maxDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(hardTimeout);
    };
  }, [minDuration, maxDuration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] text-white select-none transition-all duration-700 ease-out ${
        isFading ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Branding */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)] animate-pulse" />
          <span
            className="text-2xl sm:text-3xl tracking-tight text-white font-normal"
            style={{ fontFamily: 'Lastik, serif' }}
          >
            DeepTrade
          </span>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-48 sm:w-56 h-[1.5px] bg-zinc-800/80 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-400 transition-all duration-150 ease-out shadow-[0_0_8px_rgba(99,102,241,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress % and Ticker */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-[0.7rem] sm:text-xs text-zinc-400 tracking-widest font-medium">
            {progress < 10 ? `00${progress}` : progress < 100 ? `0${progress}` : progress}%
          </span>
          <span className="text-[0.62rem] sm:text-[0.68rem] text-zinc-500 uppercase tracking-[0.2em] font-normal text-center">
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
};
