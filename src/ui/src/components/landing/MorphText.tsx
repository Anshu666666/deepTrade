import React, { useEffect, useRef } from 'react';
import './MorphText.css';

interface MorphTextProps {
  texts: string[];
  className?: string;
}

const MorphText: React.FC<MorphTextProps> = ({ texts, className = '' }) => {
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    let textIndex = 0;
    let time = new Date();
    let morph = 0;
    let cooldown = 0.25;
    
    const morphTime = 1;
    const cooldownTime = 1.5;
    
    if (!text1Ref.current || !text2Ref.current) return;
    
    text1Ref.current.textContent = texts[textIndex % texts.length];
    text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
    
    function setMorph(fraction: number) {
      if (!text1Ref.current || !text2Ref.current) return;
      text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      
      fraction = 1 - fraction;
      text1Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      text1Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      
      text1Ref.current.textContent = texts[textIndex % texts.length];
      text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
    }
    
    function doMorph() {
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / morphTime;
      
      if (fraction > 1) {
        cooldown = cooldownTime;
        fraction = 1;
      }
      
      setMorph(fraction);
    }
    
    function doCooldown() {
      morph = 0;
      if (!text1Ref.current || !text2Ref.current) return;
      text2Ref.current.style.filter = '';
      text2Ref.current.style.opacity = '100%';
      text1Ref.current.style.filter = '';
      text1Ref.current.style.opacity = '0%';
    }
    
    let animationFrameId: number;
    
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      
      let newTime = new Date();
      let shouldIncrementIndex = cooldown > 0;
      let dt = (newTime.getTime() - time.getTime()) / 1000;
      time = newTime;
      
      cooldown -= dt;
      
      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          textIndex++;
        }
        doMorph();
      } else {
        doCooldown();
      }
    }
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [texts]);

  return (
    <>
      <div className={`morph-container ${className}`}>
        <span ref={text1Ref} className="morph-text"></span>
        <span ref={text2Ref} className="morph-text"></span>
      </div>
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="threshold">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 255 -140" />
          </filter>
        </defs>
      </svg>
    </>
  );
};

export default MorphText;
