import React, { useEffect, useState } from 'react';

interface LandingLoaderProps {
  onComplete?: () => void;
  minDuration?: number;
  strict?: boolean;
}

export const LandingLoader: React.FC<LandingLoaderProps> = ({
  onComplete,
  minDuration = 1000,
  strict = true,
}) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('INITIALIZING ENVIRONMENT...');
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let hardTimeout: ReturnType<typeof setTimeout>;
    let startTime: number;

    const begin = () => {
      startTime = Date.now();

      // Wait for real asset readiness: fonts + window load (images, stylesheets, iframes)
      const waitForAssets = async () => {
        const tasks: Promise<void>[] = [];

        // 1. Fonts must be ready before we reveal text
        if (document.fonts) {
          tasks.push(
            document.fonts.ready.then(() => undefined).catch(() => undefined),
          );
        }

        // 2. All initial images, stylesheets, iframes fully loaded
        tasks.push(
          new Promise<void>((resolve) => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener(
                'load',
                () => resolve(),
                { once: true },
              );
            }
          }),
        );

        // 3. Embedded videos reach at least first frame metadata
        tasks.push(
          Promise.all(
            Array.from(document.querySelectorAll('video')).map((video) => {
              if (video.readyState >= 1) {
                return Promise.resolve();
              }
              return new Promise<void>((resolveVideo) => {
                video.addEventListener(
                  'loadedmetadata',
                  () => resolveVideo(),
                  { once: true },
                );
              });
            }),
          ).then(() => undefined),
        );

        await Promise.all(tasks);
        setAssetsReady(true);
      };

      waitForAssets();

      // Smooth simulated progress curve (never races ahead of reality)
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Real progress only counts once assets are actually ready
        const calculatedProgress = assetsReady
          ? Math.min(Math.round((elapsed / minDuration) * 100), 99)
          : 0;

        setProgress((prev) => Math.max(prev, calculatedProgress));

        if (calculatedProgress > 70) {
          setStatusText('CONNECTING BROKER RUNTIME...');
        } else if (calculatedProgress > 35) {
          setStatusText('SYNTHESIZING MARKET INTELLIGENCE...');
        }

        // Strict: only finish when minimum duration has passed AND assets are ready
        if (strict ? elapsed >= minDuration && assetsReady : elapsed >= minDuration) {
          setProgress(100);
          setStatusText('READY');
          clearInterval(interval);

          setTimeout(() => {
            setIsFading(true);
            setTimeout(() => {
              setIsVisible(false);
              if (document.body) {
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
              }
              onComplete?.();
            }, 600);
          }, 200);
        }
      }, 40);

      // Hard fallback so a hung asset never blocks forever
      hardTimeout = setTimeout(() => {
        setProgress(100);
        setStatusText('READY');
        clearInterval(interval);
        setAssetsReady(true);
        setTimeout(() => {
          setIsFading(true);
          setTimeout(() => {
            setIsVisible(false);
            if (document.body) {
              document.body.style.overflow = '';
              document.documentElement.style.overflow = '';
            }
            onComplete?.();
          }, 600);
        }, 150);
      }, minDuration + 8000);

      // Block all interaction while the strict loader is up
      if (strict && document.body) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
    };

    begin();

    return () => {
      clearInterval(interval);
      clearTimeout(hardTimeout);
      if (document.body) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [minDuration, strict, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] text-white select-none transition-all duration-700 ease-out ${
        isFading ? 'opacity-0 scale-[1.02] pointer-events-none' : 'pointer-events-auto'
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
