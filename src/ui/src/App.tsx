import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './index.css';

import { Sidebar } from './components/Sidebar';
import { ArtifactPanel } from './components/ArtifactPanel';
import { LogEntryRow } from './components/LogEntryRow';
import { ReferencesPanel } from './components/ReferencesPanel';
import { NexusReasoning } from './components/NexusReasoning';
import { type Message, type Thread, COMMANDS, type LogEntry, type ReferenceEntry } from './types';

function App() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(COMMANDS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<typeof COMMANDS[0] | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Fetch Threads ──────────────────────────────────────────────────────────
  
  const fetchThreads = async () => {
    try {
      const res = await fetch('http://localhost:8000/threads');
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) {
      console.error("Failed to fetch threads", e);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    const font = import.meta.env.VITE_APP_FONT || 'Hubot Sans';
    if (font) {
      document.documentElement.style.setProperty('--font-family', `"${font}", system-ui, -apple-system, sans-serif`);
    }
  }, []);

  // ─── Routing & Thread Selection ─────────────────────────────────────────────

  useEffect(() => {
    const hash = window.location.hash.replace('#/thread/', '');
    if (hash) {
      handleSelectThread(hash);
    }
  }, []);

  const handleNewThread = async () => {
    try {
      const res = await fetch('http://localhost:8000/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New DeepTrade Chat' })
      });
      const data = await res.json();
      await fetchThreads();
      window.location.hash = `#/thread/${data.thread_id}`;
      setActiveThreadId(data.thread_id);
      setMessages([]);
    } catch (e) {
      console.error("Failed to create thread", e);
    }
  };

  const handleSelectThread = async (threadId: string) => {
    if (threadId === activeThreadId) return;
    setActiveThreadId(threadId);
    window.location.hash = `#/thread/${threadId}`;
    setMessages([]);
    
    try {
      const res = await fetch(`http://localhost:8000/threads/${threadId}`);
      const data = await res.json();
      
      const loadedMessages = data.messages.map((m: any, i: number) => ({
        role: m.role,
        content: m.content,
        id: `loaded-${i}`,
        logs: m.logs || [],
        artifacts: m.artifacts || [],
        references: m.references || []
      }));
      setMessages(loadedMessages);
    } catch (e) {
      console.error("Failed to load thread", e);
    }
  };

  // ─── Chat Logic ─────────────────────────────────────────────────────────────

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      // If no thread, create one named after the query
      try {
        const title = input.trim().substring(0, 30) + "...";
        const res = await fetch('http://localhost:8000/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        const data = await res.json();
        currentThreadId = data.thread_id;
        window.location.hash = `#/thread/${currentThreadId}`;
        setActiveThreadId(currentThreadId);
        await fetchThreads();
      } catch (err) {
        console.error(err);
      }
    }

    const cmdMatch = selectedCommand || COMMANDS.find(c => input.trim().startsWith(c.name));
    const hidden_instruction = cmdMatch ? cmdMatch.instruction : undefined;
    const finalContent = selectedCommand ? `${selectedCommand.name} ${input}`.trim() : input;

    const userMessage: Message = { role: 'user', content: finalContent, id: Date.now().toString(), logs: [], artifacts: [] };
    const agentMessage: Message = { role: 'agent', content: '', id: (Date.now() + 1).toString(), logs: [], artifacts: [] };

    setMessages((prev) => [...prev, userMessage, agentMessage]);
    setInput('');
    setSelectedCommand(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, hidden_instruction, thread_id: currentThreadId }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const events = chunk.split('\n\n').filter(Boolean);

          for (const ev of events) {
            if (ev.startsWith('data: ')) {
              try {
                const data = JSON.parse(ev.slice(6));

                if (data.type === 'done') continue;

                setMessages((prev) => prev.map((msg, i) => {
                  if (i !== prev.length - 1) return msg;

                  const updatedMsg = {
                    ...msg,
                    logs: msg.logs ? [...msg.logs] : [],
                    artifacts: msg.artifacts ? [...msg.artifacts] : [],
                  };

                  if (data.type === 'log') {
                    const logs = updatedMsg.logs;

                    if (
                      data.log_type === 'REASONING' &&
                      data.id &&
                      logs.length > 0 &&
                      logs[logs.length - 1].log_type === 'REASONING' &&
                      logs[logs.length - 1].id === data.id
                    ) {
                      logs[logs.length - 1] = {
                        ...logs[logs.length - 1],
                        content: logs[logs.length - 1].content + (data.content || ''),
                      };
                    } else {
                      if (data.log_type === 'ARTIFACT') {
                        const alreadyExists = updatedMsg.artifacts.some(a => a.path === data.path);
                        if (!alreadyExists) {
                          updatedMsg.artifacts = [...updatedMsg.artifacts, {
                            path: data.path,
                            content: data.content || '',
                            agent: data.agent || 'Agent',
                            timestamp: formatTime(),
                          }];
                        }
                      }

                      if (data.log_type === 'TOOL_RESULT' && (data.tool === 'search_web' || data.tool === 'search_financial_data')) {
                        const content = data.content || '';
                        const lines = content.split('\n');
                        const links: ReferenceEntry[] = [];
                        for (const line of lines) {
                          const titleMatch = line.match(/^Title:\s*(.*?)\s*\|\s*URL:/);
                          const urlMatch = line.match(/\|\s*URL:\s*(https?:\/\/[^\s|]+)/);
                          if (titleMatch && urlMatch) {
                            links.push({ title: titleMatch[1].trim(), url: urlMatch[1].trim() });
                          }
                        }

                        if (links.length > 0) {
                          const lastCall = [...updatedMsg.logs].reverse().find(l => l.log_type === 'TOOL_CALL' && l.tool === data.tool && l.agent === data.agent);
                          let queryStr = 'Search Results';
                          if (lastCall) {
                            try {
                              const args = JSON.parse(lastCall.content);
                              queryStr = args.query || queryStr;
                            } catch (e) {}
                          }

                          updatedMsg.references = [...(updatedMsg.references || []), {
                            query: queryStr,
                            tool: data.tool,
                            links
                          }];
                        }
                      }

                      let displayContent = data.content || '';
                      if (data.log_type === 'ORDER_CONFIRMATION' && typeof data.content === 'object') {
                        displayContent = JSON.stringify(data.content);
                      }

                      const logEntry: LogEntry = {
                        log_type: data.log_type,
                        agent: data.agent || 'System',
                        content: displayContent,
                        tool: data.tool,
                        subagent: data.subagent,
                        path: data.path,
                        timestamp: formatTime(),
                        id: data.id,
                      };
                      logs.push(logEntry);
                    }

                    updatedMsg.logs = [...logs];

                    if (data.log_type === 'RESPONSE') {
                      updatedMsg.content = data.content;
                    }
                  } else if (data.type === 'status') {
                    const logEntry: LogEntry = {
                      log_type: 'STATUS',
                      agent: 'System',
                      content: data.content || '',
                      timestamp: formatTime(),
                    };
                    updatedMsg.logs = [...(updatedMsg.logs || []), logEntry];
                  }

                  return updatedMsg;
                }));
              } catch (err) {
                console.error("Error parsing JSON", err, ev);
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setMessages((prev) => {
        const newMsgs = [...prev];
        if (e.name === 'AbortError') {
          if (!newMsgs[newMsgs.length - 1].content) {
            newMsgs[newMsgs.length - 1].content = "Stopped by user.";
          }
        } else {
          newMsgs[newMsgs.length - 1].content = "Connection error. Make sure PG_DATABASE_URL is set in backend.";
        }
        return newMsgs;
      });
    } finally {
      setIsStreaming(false);
      fetchThreads(); // refresh threads list (updated_at changed)
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.startsWith('/')) {
      const query = val.split(' ')[0].toLowerCase();
      const filtered = COMMANDS.filter(c => c.name.startsWith(query));
      setFilteredCommands(filtered);
      setShowMenu(filtered.length > 0);
      setActiveIndex(0);
    } else {
      setShowMenu(false);
    }
  };

  const selectCommand = (cmd: typeof COMMANDS[0]) => {
    setSelectedCommand(cmd);
    const parts = input.split(' ');
    setInput(parts.slice(1).join(' '));
    setShowMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCommand(filteredCommands[activeIndex]);
      } else if (e.key === 'Escape') {
        setShowMenu(false);
      }
    }
  };

  return (
    <div className="app-layout">
      <Sidebar 
        threads={threads} 
        activeThreadId={activeThreadId} 
        onSelectThread={handleSelectThread} 
        onNewThread={handleNewThread} 
      />
      <div className="app-container">
        <header>
          <h1>DeepTrade</h1>
          <div className="subtitle">Stock Market &amp; Financial Analyst</div>
        </header>

        <main>
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>What would you like to research?</h2>
              <p>Try predefined commands: <code>/news NVDA</code>, <code>/analyze AAPL</code>, <code>/deep-dive TSLA</code></p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  <div className={`avatar ${msg.role}-avatar`}>
                    {msg.role === 'user' ? 'A' : '❖'}
                  </div>
                  <div className="message-content">
                    {msg.role === 'user' ? (
                      (() => {
                        const match = msg.content.match(/^(\/[a-zA-Z0-9_-]+)\s*(.*)$/s);
                        if (match) {
                          return (
                            <div className="user-text" style={{ whiteSpace: 'pre-wrap' }}>
                              <span style={{ 
                                display: 'inline-block', 
                                background: 'rgba(129, 140, 248, 0.2)', 
                                color: '#818cf8', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.9rem',
                                fontWeight: 600, 
                                marginRight: '6px' 
                              }}>
                                {match[1]}
                              </span>
                              {match[2]}
                            </div>
                          );
                        }
                        return <div className="user-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>;
                      })()
                    ) : (
                      <>
                        {/* Process Logs */}
                        {msg.logs && msg.logs.length > 0 && (
                          <div className="process-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(() => {
                              const elements = [];
                              let currentGroup: { entry: LogEntry; originalIndex: number }[] = [];
                              
                              for (let i = 0; i < msg.logs.length; i++) {
                                const entry = msg.logs[i];
                                if (entry.log_type === 'REASONING') {
                                  if (currentGroup.length > 0) {
                                    elements.push(
                                      <details className="process-details" key={`group-${i}`}>
                                        <summary>Process Steps ({currentGroup.length})</summary>
                                        <div className="process-content">
                                          {currentGroup.map(g => <LogEntryRow key={g.originalIndex} entry={g.entry} index={g.originalIndex} />)}
                                        </div>
                                      </details>
                                    );
                                    currentGroup = [];
                                  }
                                  const isActiveStream = isStreaming && idx === messages.length - 1 && i === msg.logs.length - 1;
                                  elements.push(<NexusReasoning key={i} content={entry.content} isStreaming={isActiveStream} />);
                                } else {
                                  currentGroup.push({ entry, originalIndex: i });
                                }
                              }
                              
                              if (currentGroup.length > 0) {
                                elements.push(
                                  <details className="process-details" open={isStreaming && idx === messages.length - 1 ? true : undefined} key="group-end">
                                    <summary>Process Steps ({currentGroup.length})</summary>
                                    <div className="process-content">
                                      {currentGroup.map(g => <LogEntryRow key={g.originalIndex} entry={g.entry} index={g.originalIndex} />)}
                                    </div>
                                  </details>
                                );
                              }
                              
                              return elements;
                            })()}
                          </div>
                        )}

                        {/* References Panel */}
                        {msg.references && msg.references.length > 0 && (
                          <ReferencesPanel references={msg.references} />
                        )}

                        {/* Research Artifacts Panel */}
                        {msg.artifacts && msg.artifacts.length > 0 && (
                          <ArtifactPanel artifacts={msg.artifacts} />
                        )}

                        {/* Final Answer */}
                        {msg.content && (
                          <div className="final-answer">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}

                        {isStreaming && !msg.content && (
                          <div className="streaming-indicator">
                            <div className="bar" />
                            <div className="bar" />
                            <div className="bar" />
                            <div className="bar" />
                            <div className="bar" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <footer>
          <div className="input-container">
            {showMenu && (
              <div className="command-menu">
                {filteredCommands.map((cmd, idx) => (
                  <div
                    key={cmd.name}
                    className={`command-item ${idx === activeIndex ? 'active' : ''}`}
                    onClick={() => selectCommand(cmd)}
                  >
                    <div className="command-name">{cmd.name}</div>
                    <div className="command-desc">{cmd.desc}</div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex' }}>
              <div className="input-wrapper">
                {selectedCommand && (
                  <div className="command-badge" style={{ display: 'flex', alignItems: 'center', background: 'rgba(129, 140, 248, 0.2)', color: '#818cf8', padding: '4px 10px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 500, marginRight: '8px', whiteSpace: 'nowrap' }}>
                    {selectedCommand.name}
                    <button type="button" onClick={() => setSelectedCommand(null)} style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: '6px', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>&times;</button>
                  </div>
                )}
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedCommand ? "Enter arguments..." : "Message DeepTrade..."}
                  className="chat-input"
                />
              </div>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="stop-btn"
                  title="Stop Generating"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="send-btn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
              )}
            </form>
          </div>
          <div className="disclaimer">
            AI can make mistakes. Verify important financial data independently.
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
