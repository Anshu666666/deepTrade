import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ArtifactEntry } from '../types';

export function ArtifactPanel({ artifacts }: { artifacts: ArtifactEntry[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawerArtifact, setDrawerArtifact] = useState<ArtifactEntry | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(50); // percentage of viewport
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = ((window.innerWidth - ev.clientX) / window.innerWidth) * 100;
      setDrawerWidth(Math.max(25, Math.min(80, newWidth)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  if (artifacts.length === 0) return null;

  const active = artifacts[Math.min(activeIdx, artifacts.length - 1)];

  return (
    <>
      <div className="artifact-panel">
        <div className="artifact-panel-header">
          <span className="artifact-panel-icon">📄</span>
          <span className="artifact-panel-title">DeepTrade Files</span>
          <span className="artifact-panel-count">{artifacts.length}</span>
        </div>
        {artifacts.length > 1 && (
          <div className="artifact-tabs">
            {artifacts.map((a, i) => {
              const name = a.path.split('/').pop() || a.path;
              return (
                <button
                  key={a.path}
                  className={`artifact-tab${i === activeIdx ? ' active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                  title={a.path}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
        <div className="artifact-meta">
          <span className="artifact-path">{active.path}</span>
          <span className="artifact-agent">by {active.agent}</span>
          <span className="artifact-time">{active.timestamp}</span>
        </div>
        <div className="artifact-content">
          <ReactMarkdown>{active.content}</ReactMarkdown>
        </div>
        <div className="artifact-read-more">
          <button onClick={() => setDrawerArtifact(active)}>
            Read Full Report →
          </button>
        </div>
      </div>

      {/* Slide-in Drawer */}
      <div
        className={`artifact-drawer-overlay ${drawerArtifact ? 'open' : ''}`}
        onClick={() => setDrawerArtifact(null)}
      />
      <div
        className={`artifact-drawer ${drawerArtifact ? 'open' : ''}`}
        style={{ width: `${drawerWidth}vw` }}
      >
        {/* Drag handle on left edge */}
        <div
          className="artifact-drawer-resizer"
          onMouseDown={handleMouseDown}
        />
        {drawerArtifact && (
          <>
            <div className="artifact-drawer-header">
              <h3>📄 {drawerArtifact.path.split('/').pop()}</h3>
              <button
                className="artifact-drawer-close"
                onClick={() => setDrawerArtifact(null)}
              >
                ✕
              </button>
            </div>
            <div className="artifact-drawer-meta">
              {drawerArtifact.path} &middot; by {drawerArtifact.agent} &middot; {drawerArtifact.timestamp}
            </div>
            <div className="artifact-drawer-body">
              <ReactMarkdown>{drawerArtifact.content}</ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </>
  );
}
