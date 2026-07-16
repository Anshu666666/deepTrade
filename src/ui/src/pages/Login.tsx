import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EXTERNAL_LANDING_URL = 'https://deeptrade.example.com'; // Replace with actual hosted URL

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'password') {
      navigate('/chat');
    } else {
      alert('Incorrect password');
    }
  };

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header with external link */}
      <header style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href={EXTERNAL_LANDING_URL} style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0, background: 'linear-gradient(to right, #818cf8 0%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 'bold' }}>
            DeepTrade
          </h1>
        </a>
        <a href={EXTERNAL_LANDING_URL} style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }}>
          About DeepTrade →
        </a>
      </header>

      {/* Main Login Content */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ 
          backgroundColor: 'rgba(24, 24, 27, 0.6)', 
          padding: '3rem 2rem', 
          borderRadius: '1rem', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          backdropFilter: 'blur(16px)', 
          width: '100%', 
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '600' }}>Terminal Access</h2>
          <p style={{ textAlign: 'center', color: '#a1a1aa', marginBottom: '2.5rem', fontSize: '0.95rem' }}>Enter your access key to continue</p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <input
              type="password"
              placeholder="Access Key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                padding: '1rem', 
                borderRadius: '0.5rem', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                color: 'white', 
                outline: 'none',
                fontSize: '1rem',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#818cf8'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
            <button 
              type="submit" 
              style={{ 
                padding: '1rem', 
                background: 'linear-gradient(to right, #4f46e5, #7c3aed)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '0.5rem', 
                cursor: 'pointer', 
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Authenticate
            </button>
          </form>
        </div>
      </main>

      {/* Footer with external link */}
      <footer style={{ padding: '2rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
        Powered by DeepAgents. <a href={EXTERNAL_LANDING_URL} style={{ color: '#a1a1aa', textDecoration: 'underline' }}>Discover the open-source project</a>.
      </footer>
    </div>
  );
};

export default Login;

