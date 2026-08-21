export interface LogEntry {
  log_type: 'REASONING' | 'ROUTING' | 'TOOL_CALL' | 'TOOL_RESULT' | 'TASK_RESULT' | 'RESPONSE' | 'ARTIFACT' | 'STATUS' | 'ORDER_CONFIRMATION';
  agent: string;
  content: string;
  tool?: string;
  subagent?: string;
  path?: string;
  timestamp: string;
  id?: string;
}

export interface Message {
  role: 'user' | 'agent';
  content: string;
  id: string;
  logs: LogEntry[];
  artifacts: ArtifactEntry[];
  references?: ReferenceGroup[];
}

export interface ArtifactEntry {
  path: string;
  content: string;
  agent: string;
  timestamp: string;
}

export interface ReferenceEntry {
  title: string;
  url: string;
}

export interface ReferenceGroup {
  query: string;
  tool: string;
  links: ReferenceEntry[];
}

export interface Thread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const COMMANDS = [
  {
    name: '/analyse',
    desc: 'Deep fundamental & equity analysis (e.g. /analyse TATAMOTORS)',
    instruction: 'Perform a comprehensive financial analysis using live web intelligence (Exa) and financial filings/fundamentals (Valyu).',
  },
  {
    name: '/news',
    desc: 'Latest market news & sentiment (e.g. /news RELIANCE)',
    instruction: 'Fetch and summarize the latest financial and market news using Exa web search.',
  },
  {
    name: '/deepdive',
    desc: 'Exhaustive equity research report (e.g. /deepdive INFY)',
    instruction: 'Conduct a comprehensive deep-dive research report synthesizing fundamentals, filings, news, and market performance.',
  },
  {
    name: '/holdings',
    desc: 'View your live long-term Upstox portfolio holdings',
    instruction: 'Check and display my current Upstox holdings.',
  },
  {
    name: '/positions',
    desc: 'View open intraday and F&O positions',
    instruction: 'Check and display my open Upstox intraday positions.',
  },
  {
    name: '/orders',
    desc: 'View today\'s Upstox order book and status',
    instruction: 'Fetch and display my today\'s Upstox order book.',
  },
  {
    name: '/funds',
    desc: 'Check available trading margin and cash balance',
    instruction: 'Check my available Upstox funds, cash balance, and margin.',
  },
  {
    name: '/toggle',
    desc: 'Toggle between Sandbox (Paper) and LIVE trading mode',
    instruction: '',
  }
];

export const LOG_TYPE_CONFIG: Record<string, { label: string; color: string; tagColor: string }> = {
  REASONING:   { label: 'REASONING',   color: '#f59e0b', tagColor: 'rgba(245, 158, 11, 0.15)' },
  ROUTING:     { label: 'DELEGATING',  color: '#a78bfa', tagColor: 'rgba(167, 139, 250, 0.15)' },
  TOOL_CALL:   { label: 'TOOL CALL',   color: '#38bdf8', tagColor: 'rgba(56, 189, 248, 0.15)' },
  TOOL_RESULT: { label: 'TOOL RESULT', color: '#34d399', tagColor: 'rgba(52, 211, 153, 0.15)' },
  TASK_RESULT: { label: 'TASK RESULT', color: '#818cf8', tagColor: 'rgba(129, 140, 248, 0.15)' },
  ARTIFACT:    { label: 'ARTIFACT',    color: '#fb923c', tagColor: 'rgba(251, 146, 60, 0.15)' },
  RESPONSE:    { label: 'RESPONSE',    color: '#f472b6', tagColor: 'rgba(244, 114, 182, 0.15)' },
  STATUS:      { label: 'STATUS',      color: '#94a3b8', tagColor: 'rgba(148, 163, 184, 0.15)' },
  ORDER_CONFIRMATION: { label: 'ACTION REQ', color: '#ef4444', tagColor: 'rgba(239, 68, 68, 0.15)' },
};

export const TRUNCATE_LENGTH = 200;
