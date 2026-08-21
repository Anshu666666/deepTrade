import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Terminal, ShieldCheck, Send, X, Copy, Check } from 'lucide-react';

interface LaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramUrl?: string;
  githubUrl?: string;
}

export const LaunchModal: React.FC<LaunchModalProps> = ({
  isOpen,
  onClose,
  telegramUrl = "https://t.me/DeepTrade_Master_Bot", // Replace or configure with your bot username
  githubUrl = "https://github.com/Anshu666666/deepTrade",
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  const cloneCommand = "git clone https://github.com/Anshu666666/deepTrade.git";

  const handleCopy = () => {
    navigator.clipboard.writeText(cloneCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e]/95 p-6 sm:p-8 shadow-2xl text-white backdrop-blur-xl"
            style={{
              boxShadow: "0 0 50px -10px rgba(84, 161, 253, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.9)"
            }}
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10 relative z-10">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#54A1FD]" />
                  Launch DeepTrade
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Choose how you want to interact with your personal trading assistant.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options */}
            <div className="space-y-4 py-6 relative z-10">
              {/* Option 1: Telegram Bot */}
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-start gap-4 p-4 rounded-xl border border-blue-500/30 bg-blue-500/[0.06] hover:bg-blue-500/[0.12] hover:border-blue-500/50 transition-all duration-200"
              >
                <div className="p-2.5 rounded-lg bg-[#54A1FD]/20 text-[#54A1FD] shrink-0 mt-0.5">
                  <Send className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white text-sm group-hover:text-[#54A1FD] transition-colors flex items-center gap-1.5">
                      Open in Telegram Bot
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-[#54A1FD] border border-blue-500/30">Instant</span>
                    </span>
                    <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Research stocks and place confirmed Upstox trades directly from Telegram. Zero setup required.
                  </p>
                </div>
              </a>

              {/* Option 2: Self-Host & Run Web UI */}
              <div className="relative flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-white/20 transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 mt-0.5">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white text-sm">Self-Host Locally (Full Web UI)</span>
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#54A1FD] hover:underline flex items-center gap-1"
                      >
                        GitHub Repo <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Run the complete FastAPI backend + React Vite terminal on your own laptop with your own API keys.
                    </p>
                  </div>
                </div>

                {/* Quick Clone Code snippet */}
                <div className="flex items-center justify-between bg-black/60 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300">
                  <span className="truncate mr-2 text-zinc-400">$ {cloneCommand}</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer / Direct Local Login Link */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500 relative z-10">
              <div className="flex items-center gap-1 text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span>100% Private & Open Source</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate('/login');
                }}
                className="text-[#54A1FD] hover:underline font-medium"
              >
                Direct Web Login →
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LaunchModal;
