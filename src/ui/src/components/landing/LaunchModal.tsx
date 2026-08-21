import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Terminal, ShieldCheck, X, Copy, Check, Key, PlayCircle, BookOpen } from 'lucide-react';
import CandyButton from '../ui/candy-button';

interface LaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubUrl?: string;
}

export const LaunchModal: React.FC<LaunchModalProps> = ({
  isOpen,
  onClose,
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
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e]/95 p-6 sm:p-8 shadow-2xl text-white backdrop-blur-xl"
            style={{
              boxShadow: "0 0 50px -10px rgba(84, 161, 253, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.95)"
            }}
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between pb-5 border-b border-white/10 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[#54A1FD] text-[11px] font-medium tracking-wide uppercase mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Self-Hosted Software
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
                  Run DeepTrade on Your Machine
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed max-w-md">
                  To keep your Upstox broker credentials 100% private and execute trades with zero latency, DeepTrade runs locally on your computer or private cloud.
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

            {/* Step-by-Step Setup Guide */}
            <div className="py-5 space-y-3.5 relative z-10">
              
              {/* Step 1: Clone */}
              <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#54A1FD]/20 text-[#54A1FD] text-[10px] font-bold">1</span>
                    Clone the Repository
                  </span>
                  <span className="text-[11px] text-zinc-500">Terminal</span>
                </div>
                <div className="flex items-center justify-between bg-black/70 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300">
                  <span className="truncate mr-2 text-zinc-400">$ {cloneCommand}</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 text-[11px]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Keys */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#54A1FD]/20 text-[#54A1FD] text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block mb-0.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#54A1FD]" /> Configure API Keys in <code className="text-[#54A1FD] bg-blue-500/10 px-1 py-0.5 rounded">.env</code>
                  </span>
                  <p className="text-zinc-400 leading-relaxed text-[11px] sm:text-xs">
                    Add your Upstox API keys, OpenRouter LLM key, and create your own private Telegram bot token via <span className="text-zinc-300 font-mono">@BotFather</span>.
                  </p>
                </div>
              </div>

              {/* Step 3: Run */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#54A1FD]/20 text-[#54A1FD] text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-zinc-200 block mb-0.5 flex items-center gap-1.5">
                    <PlayCircle className="w-3.5 h-3.5 text-green-400" /> Start Backend & Web UI
                  </span>
                  <p className="text-zinc-400 font-mono text-[11px] leading-relaxed">
                    <span className="text-zinc-300">python main.py</span> &nbsp;·&nbsp; <span className="text-zinc-300">npm run dev</span>
                  </p>
                </div>
              </div>

            </div>

            {/* Primary Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center relative z-10">
              <CandyButton
                onClick={() => window.open(githubUrl, '_blank')}
                className="flex-1 flex items-center justify-center gap-2 text-xs sm:text-sm py-2.5 px-6"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>View on GitHub & Setup</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-0.5 opacity-90" />
              </CandyButton>

              <a
                href={`${githubUrl}/blob/master/docs/setup_instructions.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[9999px] border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs sm:text-sm font-medium transition-colors no-underline"
              >
                <BookOpen className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Documentation</span>
              </a>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-center text-xs text-zinc-500 relative z-10">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#54A1FD]" /> DeepTrade Autonomous Financial Analyst · MIT License
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LaunchModal;
