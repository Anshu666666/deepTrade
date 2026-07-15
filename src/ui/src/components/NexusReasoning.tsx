import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";

type ReasoningProps = {
  isStreaming?: boolean;
  content: string;
};

export function NexusReasoning({ isStreaming = false, content }: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(isStreaming);
  const [durationLabel, setDurationLabel] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      startedAtRef.current = Date.now();
      setInternalOpen(true);
    }
  }, [isStreaming]);

  // Track transitions from streaming to non-streaming
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (!prevStreaming.current && isStreaming) {
      startedAtRef.current = Date.now();
      setDurationLabel(null);
      setInternalOpen(true);
    }
    if (prevStreaming.current && !isStreaming) {
      const startedAt = startedAtRef.current;
      const elapsedSeconds = startedAt != null ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : null;
      setDurationLabel(elapsedSeconds != null ? String(elapsedSeconds) : "a few");
      startedAtRef.current = null;
      setInternalOpen(false);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming]);

  const label = useMemo(() => {
    if (isStreaming) return "Thinking...";
    if (durationLabel != null) {
      const unit = durationLabel === "1" ? "second" : "seconds";
      return `Thought for ${durationLabel} ${unit}`;
    }
    // If it was never streaming (historical message)
    return "Thought process";
  }, [durationLabel, isStreaming]);

  const handleOpenChange = useCallback(() => {
    setInternalOpen((prev) => (isStreaming ? true : !prev));
  }, [isStreaming]);

  return (
    <div className="nexus-reasoning" data-state={internalOpen ? "open" : "closed"}>
      <div className="nexus-reasoning-trigger" onClick={handleOpenChange}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
        </svg>
        <span 
          className="nexus-reasoning-shimmer" 
          data-streaming={isStreaming ? "true" : "false"}
        >
          {label}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.0" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="nexus-reasoning-chevron" 
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      
      {internalOpen && (
        <div className="nexus-reasoning-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
