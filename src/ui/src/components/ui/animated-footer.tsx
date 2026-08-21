// Ported from VengeanceUI animated-footer — next-themes removed (always dark).
import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export interface AnimatedFooterLink {
  label: string;
  href: string;
}

export interface AnimatedFooterProps {
  /** Large display words rendered along the bottom edge */
  headingLines?: string[];
  /** Left image URL (same-origin or CORS-enabled) */
  leftImage?: string;
  /** Right image URL (same-origin or CORS-enabled) */
  rightImage?: string;

  /** Background colour. Default: #000 */
  background?: string;
  /** Heading / text colour. Default: #fff */
  textColor?: string;

  /** Character ramp dark → light for the ASCII art */
  asciiChars?: string;
  /** Colour of ASCII glyphs. Default: #803500 */
  charColor?: string;
  /** Highlight fill colour on hover. Default: #ff6a00 */
  hoverColor?: string;
  /** Glyph colour inside a highlighted cell. Default: #0f0f0f */
  hoverCharColor?: string;

  /** Columns the image is sampled into. Default: 80 */
  columns?: number;
  /** Pixel size of each ASCII cell. Default: 20 */
  cellSize?: number;
  /** Font size (px) of ASCII glyphs. Default: 18 */
  fontSize?: number;

  /** Parallax strength in px. Set 0 to disable. Default: 20 */
  parallaxStrength?: number;
  /** Cursor influence radius (cells). Default: 8 */
  hoverRadius?: number;

  /** Trigger reveal when scrolled into view. Default: true */
  revealOnScroll?: boolean;
  /** Externally controlled reveal (overrides scroll observer when set) */
  revealed?: boolean;

  /** Navigation links rendered in the bottom-left */
  links?: AnimatedFooterLink[];

  /** Copyright text. Default: current year + DeepTrade */
  copyright?: string;

  /** Extra class names for the root element */
  className?: string;
}

const DEFAULT_ASCII_CHARS = "........:::=+xX#0369";
const HIGHLIGHT_LIFETIME = 300;
const CLUSTER_SIZE = 10;
const PARALLAX_EASE = 0.05;

interface Cell {
  col: number;
  row: number;
  char: string;
  highlightEndTime: number;
}

interface Hand {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cells: Map<string, Cell>;
  cellList: Cell[];
  rows: number;
  columns: number;
  cellSize: number;
  baselineOffset: number;
  direction: 1 | -1;
}

function buildHandCells(
  image: HTMLImageElement,
  columns: number,
  asciiChars: string,
): { rows: number; cells: Map<string, Cell> } {
  const rows = Math.max(
    1,
    Math.round(columns / (image.naturalWidth / image.naturalHeight || 1)),
  );
  const sampler = document.createElement("canvas");
  sampler.width = columns;
  sampler.height = rows;
  const sampleCtx = sampler.getContext("2d");
  const cells = new Map<string, Cell>();
  if (!sampleCtx) return { rows, cells };

  sampleCtx.drawImage(image, 0, 0, columns, rows);
  const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
  const bgCharIdx = asciiChars.lastIndexOf(".");

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const offset = (row * columns + col) * 4;
      const brightness =
        (pixels[offset] * 0.299 +
          pixels[offset + 1] * 0.587 +
          pixels[offset + 2] * 0.114) /
        255;
      const charIndex = Math.min(
        asciiChars.length - 1,
        Math.floor((1 - brightness) * asciiChars.length),
      );
      if (charIndex <= bgCharIdx) continue;
      cells.set(`${col},${row}`, {
        col,
        row,
        char: asciiChars[charIndex],
        highlightEndTime: 0,
      });
    }
  }
  return { rows, cells };
}

function highlightCluster(cells: Map<string, Cell>, startCell: Cell) {
  const now = Date.now();
  startCell.highlightEndTime = now + HIGHLIGHT_LIFETIME;
  const steps = Math.floor(Math.random() * CLUSTER_SIZE) + 1;
  const litCells = [startCell];
  let current = startCell;
  for (let step = 0; step < steps; step++) {
    const neighbours: Cell[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = cells.get(`${current.col + dx},${current.row + dy}`);
        if (n && !litCells.includes(n)) neighbours.push(n);
      }
    }
    if (!neighbours.length) break;
    const next = neighbours[Math.floor(Math.random() * neighbours.length)];
    next.highlightEndTime = now + HIGHLIGHT_LIFETIME + step * 10;
    litCells.push(next);
    current = next;
  }
}

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") return el;
    el = el.parentElement;
  }
  return null;
}

export function AnimatedFooter({
  headingLines = ["Think. Analyse. Trade."],
  leftImage,
  rightImage,
  background = "#000000",
  textColor = "#ffffff",
  charColor = "#803500",
  hoverColor = "#ff6a00",
  hoverCharColor = "#0f0f0f",
  asciiChars = DEFAULT_ASCII_CHARS,
  columns = 80,
  cellSize = 20,
  fontSize = 18,
  parallaxStrength = 20,
  hoverRadius = 8,
  revealOnScroll = true,
  revealed,
  links = [],
  copyright,
  className,
}: AnimatedFooterProps) {
  const rootRef = useRef<HTMLElement>(null);
  const leftWrapRef = useRef<HTMLDivElement>(null);
  const rightWrapRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  const animateInRef = useRef<() => void>(() => {});
  const animateOutRef = useRef<() => void>(() => {});

  const liveRef = useRef({ charColor, hoverColor, hoverCharColor, parallaxStrength, hoverRadius });
  useEffect(() => {
    liveRef.current = { charColor, hoverColor, hoverCharColor, parallaxStrength, hoverRadius };
  }, [charColor, hoverColor, hoverCharColor, parallaxStrength, hoverRadius]);

  const sig = useMemo(
    () =>
      JSON.stringify({ leftImage, rightImage, columns, cellSize, fontSize, asciiChars, revealOnScroll, headingLines }),
    [leftImage, rightImage, columns, cellSize, fontSize, asciiChars, revealOnScroll, headingLines],
  );

  useEffect(() => {
    const root = rootRef.current;
    const leftWrap = leftWrapRef.current;
    const rightWrap = rightWrapRef.current;
    if (!root || !leftWrap || !rightWrap) return;

    const hands: Hand[] = [];
    const wrappers = [leftWrap, rightWrap];

    const setupHand = (image: HTMLImageElement, canvas: HTMLCanvasElement, direction: 1 | -1) => {
      const { rows, cells } = buildHandCells(image, columns, asciiChars);
      if (cells.size === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = columns * cellSize * dpr;
      canvas.height = rows * cellSize * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const m = ctx.measureText("X");
      const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const baselineOffset = cellSize / 2 + glyphH / 2 - m.actualBoundingBoxDescent;
      hands.push({ canvas, ctx, cells, cellList: [...cells.values()], rows, columns, cellSize, baselineOffset, direction });
    };

    const loadHand = (src: string | undefined, canvas: HTMLCanvasElement, direction: 1 | -1) => {
      if (!src) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      let done = false;
      const init = () => { if (done) return; done = true; setupHand(img, canvas, direction); };
      img.onload = init;
      img.src = src;
      if (img.complete && img.naturalWidth) init();
    };

    if (leftCanvasRef.current) loadHand(leftImage, leftCanvasRef.current, 1);
    if (rightCanvasRef.current) loadHand(rightImage, rightCanvasRef.current, -1);

    const renderHand = (hand: Hand, now: number) => {
      const { ctx, cellList, cellSize: cs, baselineOffset, columns: cols, rows } = hand;
      const { charColor: cc, hoverColor: hc, hoverCharColor: hcc } = liveRef.current;
      ctx.clearRect(0, 0, cols * cs, rows * cs);
      for (const cell of cellList) {
        const x = cell.col * cs;
        const y = cell.row * cs;
        const lit = cell.highlightEndTime > now;
        if (lit) { ctx.fillStyle = hc; ctx.fillRect(x, y, cs, cs); }
        ctx.fillStyle = lit ? hcc : cc;
        ctx.fillText(cell.char, x + cs / 2, y + baselineOffset);
      }
    };

    const pointer = { x: 0, y: 0 };
    const drift = { x: 0, y: 0 };
    const curtain = { offset: revealOnScroll ? 125 : 0 };

    const hoverHand = (hand: Hand, clientX: number, clientY: number) => {
      const rect = hand.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const mCol = ((clientX - rect.left) / rect.width) * hand.columns;
      const mRow = ((clientY - rect.top) / rect.height) * hand.rows;
      let closest: Cell | null = null;
      let dist = Infinity;
      for (const cell of hand.cellList) {
        const d = Math.sqrt((mCol - cell.col) ** 2 + (mRow - cell.row) ** 2);
        if (d < dist) { dist = d; closest = cell; }
      }
      if (closest && dist <= liveRef.current.hoverRadius) highlightCluster(hand.cells, closest);
    };

    const onMouseMove = (e: MouseEvent) => {
      const str = liveRef.current.parallaxStrength;
      const rect = root.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / (rect.width || 1) - 0.5) * str * 2;
      pointer.y = ((e.clientY - rect.top) / (rect.height || 1) - 0.5) * str * 2;
      for (const hand of hands) hoverHand(hand, e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", onMouseMove);

    let rafId = 0;
    const frame = () => {
      const now = Date.now();
      for (const hand of hands) renderHand(hand, now);
      drift.x += (pointer.x - drift.x) * PARALLAX_EASE;
      drift.y += (pointer.y - drift.y) * PARALLAX_EASE;
      const str = liveRef.current.parallaxStrength;
      const scale = 1 + (str * 2) / 200;
      wrappers.forEach((w, i) => {
        const dir = i === 0 ? 1 : -1;
        const revX = i === 0 ? -curtain.offset : curtain.offset;
        w.style.transform = `translateX(${revX}%) translate(${drift.x * dir}px, ${-drift.y}px) scale(${scale})`;
      });
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    const chars = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-af-char]"));
    const animateIn = () => {
      gsap.to(curtain, { offset: 0, duration: 1, ease: "power3.out", overwrite: true });
      gsap.to(chars, { yPercent: 0, duration: 1, ease: "power3.out", stagger: { each: 0.04, from: "center" }, overwrite: true });
    };
    const animateOut = () => {
      gsap.to(curtain, { offset: 125, duration: 0.4, ease: "power2.in", overwrite: true });
      gsap.to(chars, { yPercent: 125, duration: 0.4, ease: "power2.in", stagger: { each: 0.01, from: "center" }, overwrite: true });
    };
    animateInRef.current = animateIn;
    animateOutRef.current = animateOut;

    const maskAll = () => gsap.set(chars, { yPercent: 125 });
    const showAll = () => gsap.set(chars, { yPercent: 0 });

    let observer: IntersectionObserver | null = null;

    if (revealed !== undefined) {
      curtain.offset = revealed ? 0 : 125;
      if (revealed) showAll(); else maskAll();
    } else if (revealOnScroll) {
      maskAll();
      let isRevealed = false;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !isRevealed) { isRevealed = true; animateIn(); }
            else if (!entry.isIntersecting && isRevealed) { isRevealed = false; animateOut(); }
          }
        },
        { root: getScrollParent(root), threshold: 0.05 },
      );
      observer.observe(root);
    } else {
      showAll();
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      observer?.disconnect();
      gsap.killTweensOf([curtain, ...chars]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (revealed === undefined) return;
    if (revealed) animateInRef.current(); else animateOutRef.current();
  }, [revealed]);

  const startsHidden = revealed !== undefined ? !revealed : revealOnScroll;
  const offEdge = startsHidden ? 125 : 0;
  const year = new Date().getFullYear();

  return (
    <footer
      ref={rootRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ backgroundColor: background, color: textColor, containerType: "inline-size" }}
    >
      {/* ASCII hands — positioned in lower-center, not true center */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[12%] top-0 flex items-end justify-between">
        <div
          ref={leftWrapRef}
          className="relative w-[52%] min-w-[140px] will-change-transform"
          style={{ transform: `translateX(-${offEdge}%)` }}
        >
          <canvas ref={leftCanvasRef} className="block h-auto w-full" />
        </div>
        <div
          ref={rightWrapRef}
          className="relative w-[52%] min-w-[140px] will-change-transform"
          style={{ transform: `translateX(${offEdge}%)` }}
        >
          <canvas ref={rightCanvasRef} className="block h-auto w-full" />
        </div>
      </div>

      {/* Display heading — sits above the links */}
      <div className="absolute inset-x-0 bottom-[72px] flex items-end justify-center gap-2 px-4 sm:px-8">
        {headingLines.map((word, wi) => (
          <h2
            key={`${word}-${wi}`}
            aria-label={word}
            className="overflow-hidden font-normal leading-none tracking-tight pb-[0.15em] -mb-[0.15em]"
            style={{ fontSize: 'clamp(1.4rem, 5vw, 5rem)', fontFamily: 'Lastik, serif' }}
          >
            {Array.from(word).map((ch, ci) => (
              <span key={ci} data-af-char aria-hidden="true" className="inline-block">
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </h2>
        ))}
      </div>

      {/* Bottom bar: centered links + copyright, with clear gap below heading */}
      {(links.length > 0 || copyright !== undefined) && (
        <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-2 px-12 z-10">
          <nav className="flex flex-wrap gap-x-8 gap-y-1 justify-center">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.65rem] tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: textColor }}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-[0.6rem] opacity-30" style={{ color: textColor }}>
            {copyright ?? `© ${year} DeepTrade`}
          </p>
        </div>
      )}
    </footer>
  );
}

export default AnimatedFooter;
