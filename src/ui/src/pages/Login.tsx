import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarsBackground } from '../components/animate-ui/components/backgrounds/stars';
import { CandyButton } from '../components/ui/candy-button';
import TotpSetupModal from '../components/landing/TotpSetupModal';
import { QrCode } from 'lucide-react';

const EXTERNAL_LANDING_URL = '/'; // links back to landing page

const Login: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTotpModalOpen, setIsTotpModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        credentials: 'include'
      });
      if (res.ok) {
        navigate('/chat');
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#000',
      minHeight: '100vh',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"SF Pro Display", system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Stars Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <StarsBackground starColor="#ffffff" speed={25} className="opacity-50" />
      </div>

      {/* Ambient glow */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '700px',
        height: '500px',
        background: 'radial-gradient(ellipse, rgba(84,161,253,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Header */}
      <header style={{
        position: 'relative',
        zIndex: 10,
        padding: 'clamp(16px, 2vh, 28px) clamp(20px, 4vw, 48px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}>
        <a href={EXTERNAL_LANDING_URL} style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'white',
          }}>
            DeepTrade
          </span>
        </a>
        <a
          href={EXTERNAL_LANDING_URL}
          style={{
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#54A1FD')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          About DeepTrade →
        </a>
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Glass card — hand-crafted, no library positioning issues */}
        <div style={{
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          /* Glass border via box-shadow inset */
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset, 0 32px 80px rgba(0,0,0,0.5)',
          /* SVG noise + glass bg */
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        }}>
          {/* Top shimmer highlight */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.2) 70%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* Inner glow on hover — purely decorative radial */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '24px',
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(84,161,253,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Card content */}
          <div style={{
            padding: 'clamp(2rem, 4vh, 3rem) clamp(1.5rem, 4vw, 2.5rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(84,161,253,0.12)',
              border: '1px solid rgba(84,161,253,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              fontSize: '1.4rem',
              color: '#54A1FD',
            }}>❖</div>

            <h1 style={{
              fontFamily: 'Lastik, serif',
              fontSize: 'clamp(1.6rem, 4vw, 2rem)',
              fontWeight: 'normal',
              textAlign: 'center',
              marginBottom: '0.5rem',
              textShadow: '0 4px 20px rgba(0,0,0,0.5)',
              letterSpacing: '-0.01em',
              margin: '0 0 0.5rem',
            }}>
              Terminal Access
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.875rem',
              textAlign: 'center',
              marginBottom: '2rem',
              letterSpacing: '0.01em',
              margin: '0 0 2rem',
            }}>
              Enter your access key to continue
            </p>

            <form
              onSubmit={handleLogin}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {/* OTP Input */}
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  outline: 'none',
                  fontSize: '1.75rem',
                  textAlign: 'center',
                  letterSpacing: '12px',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#54A1FD';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(84,161,253,0.12), 0 0 20px rgba(84,161,253,0.06)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                autoFocus
              />

              {/* Error */}
              {error && (
                <div style={{
                  color: '#ff6b6b',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,107,107,0.08)',
                  border: '1px solid rgba(255,107,107,0.2)',
                  borderRadius: '8px',
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
                <CandyButton disabled={isLoading} type="submit">
                  {isLoading ? 'Verifying...' : 'Authenticate'}
                </CandyButton>
              </div>
            </form>

            {/* Divider */}
            <div style={{
              width: '100%',
              height: '1px',
              background: 'rgba(255,255,255,0.06)',
              margin: '1.5rem 0 1rem',
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center',
                letterSpacing: '0.02em',
                margin: 0,
              }}>
                Your 6-digit rolling code from your Authenticator app
              </p>

              <button
                type="button"
                onClick={() => setIsTotpModalOpen(true)}
                style={{
                  background: 'rgba(84,161,253,0.08)',
                  border: '1px solid rgba(84,161,253,0.25)',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.9rem',
                  color: '#54A1FD',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(84,161,253,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(84,161,253,0.08)')}
              >
                <QrCode size={13} />
                <span>First time? Scan 2FA QR Code</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 2FA Setup Modal */}
      <TotpSetupModal
        isOpen={isTotpModalOpen}
        onClose={() => setIsTotpModalOpen(false)}
      />

      {/* Footer */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        padding: '1.5rem',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.2)',
        fontSize: '0.75rem',
        letterSpacing: '0.05em',
      }}>
        Powered by DeepAgents.{' '}
        <a
          href={EXTERNAL_LANDING_URL}
          style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#54A1FD')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          Discover the open-source project
        </a>.
      </footer>
    </div>
  );
};

export default Login;
