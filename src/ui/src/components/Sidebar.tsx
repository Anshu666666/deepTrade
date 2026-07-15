import { type Thread } from '../types';

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

export function Sidebar({ threads, activeThreadId, onSelectThread, onNewThread }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="new-thread-btn" onClick={onNewThread}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Chat
        </button>
      </div>
      <div className="thread-list">
        {threads.map(t => (
          <div 
            key={t.id} 
            className={`thread-item ${t.id === activeThreadId ? 'active' : ''}`}
            onClick={() => onSelectThread(t.id)}
          >
            <div className="thread-title">{t.title}</div>
            <div className="thread-date">{new Date(t.updated_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
