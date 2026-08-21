import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Copy, Check, RefreshCw, Key, QrCode, Smartphone, ExternalLink } from 'lucide-react';
import CandyButton from '../ui/candy-button';

interface TotpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TotpData {
  secret: string;
  provisioning_uri: string;
  qr_code: string;
  current_code?: string;
}

export const TotpSetupModal: React.FC<TotpSetupModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<TotpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  const fetchTotpSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/totp-setup');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        // Fallback for static promo or offline demo
        setData({
          secret: 'DEEPTRADE2FASECRETKEYSAMPLE',
          provisioning_uri: 'otpauth://totp/DeepTrade:admin@deeptrade.ai?secret=DEEPTRADE2FASECRETKEYSAMPLE&issuer=DeepTrade',
          qr_code: '',
          current_code: '849201'
        });
      }
    } catch {
      // Offline fallback
      setData({
        secret: 'DEEPTRADE2FASECRETKEYSAMPLE',
        provisioning_uri: 'otpauth://totp/DeepTrade:admin@deeptrade.ai?secret=DEEPTRADE2FASECRETKEYSAMPLE&issuer=DeepTrade',
        qr_code: '',
        current_code: '849201'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetTotp = async () => {
    if (!window.confirm("Generate a new 2FA secret key? This will invalidate your previous authenticator entry and require re-scanning.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/totp-reset', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to reset TOTP:", e);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTotpSetup();
    }
  }, [isOpen]);

  // Rolling 30s timer
  useEffect(() => {
    const updateTimer = () => {
      const epoch = Math.floor(Date.now() / 1000);
      const rem = 30 - (epoch % 30);
      setSecondsRemaining(rem);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopySecret = () => {
    if (!data?.secret) return;
    navigator.clipboard.writeText(data.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUri = () => {
    if (!data?.provisioning_uri) return;
    navigator.clipboard.writeText(data.provisioning_uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e]/95 p-6 sm:p-7 shadow-2xl text-white backdrop-blur-xl my-auto"
            style={{
              boxShadow: "0 0 50px -10px rgba(84, 161, 253, 0.18), 0 25px 50px -12px rgba(0, 0, 0, 0.95)"
            }}
          >
            {/* Ambient Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[#54A1FD] text-[11px] font-medium tracking-wide uppercase mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> 7-Day TOTP Security
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
                  Authenticator 2FA Setup
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Scan the QR code in Google Authenticator, Apple Passwords, or 1Password to link your session.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="py-4 space-y-4 relative z-10">
              {/* QR Code Card */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl bg-white p-2 flex items-center justify-center shrink-0 shadow-lg border border-zinc-200">
                  {loading ? (
                    <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                      <span>Generating QR...</span>
                    </div>
                  ) : data?.qr_code ? (
                    <img
                      src={data.qr_code}
                      alt="TOTP 2FA QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-700 text-center p-2">
                      <QrCode className="w-10 h-10 mb-1 opacity-50" />
                      <span className="text-[10px] font-mono">Scan via App</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between self-stretch text-xs space-y-2.5">
                  <div>
                    <span className="text-zinc-400 text-[11px] font-medium block mb-1">
                      Manual Secret Key
                    </span>
                    <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[#54A1FD] break-all">
                      <Key className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span className="select-all tracking-wider font-semibold">
                        {data?.secret || 'Loading...'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySecret}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200 text-[11px] transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied Key!" : "Copy Key"}</span>
                    </button>
                    <button
                      onClick={handleCopyUri}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200 text-[11px] transition-colors"
                    >
                      {copiedUri ? <Check className="w-3.5 h-3.5 text-green-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      <span>{copiedUri ? "Copied URL!" : "Copy URL"}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-zinc-500" /> Refresh Interval:
                    </span>
                    <span className="font-mono text-zinc-300 font-semibold">{secondsRemaining}s</span>
                  </div>
                </div>
              </div>

              {/* Instructions Pill */}
              <div className="text-[11.5px] text-zinc-400 leading-relaxed bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <p className="m-0">
                  1. Open <b>Google Authenticator</b> or your password manager on your phone.<br />
                  2. Tap <b>+</b> and scan the QR code above.<br />
                  3. Enter the 6-digit code on the login page to authenticate.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center relative z-10">
              <CandyButton
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 text-xs py-2.5 px-6"
              >
                <span>Done · Return to Login</span>
              </CandyButton>

              <button
                onClick={handleResetTotp}
                disabled={resetting}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[9999px] border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-medium transition-colors"
                title="Generate a new secret key if your authenticator was lost or removed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>{resetting ? "Resetting..." : "Reset Secret Key"}</span>
              </button>
            </div>

            {/* Footer Notice */}
            <div className="pt-3 mt-3 border-t border-white/10 text-center text-[10.5px] text-zinc-500 relative z-10">
              <span>Encrypted locally in SQLite & memory · Never transmitted to external clouds</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TotpSetupModal;
