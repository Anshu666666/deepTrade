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
    name: '/news',
    desc: 'Quick market news brief + sentiment  (e.g. /news NVDA)',
    instruction: 'The user wants a quick news brief. Use the /news workflow: delegate to DataCollector to fetch recent news (last 48h), write findings to /research/news_<TICKER>.md, then summarize for the user.',
  },
  {
    name: '/analyze',
    desc: 'Structured fundamental analysis report  (e.g. /analyze AAPL)',
    instruction: 'The user wants a structured analysis. Use the /analyze workflow: delegate DataCollector to gather financials + news and write to /research/data_<TICKER>.md, then delegate FinancialAnalyst to read it and produce a full report.',
  },
  {
    name: '/deep-dive',
    desc: 'Exhaustive multi-angle research report  (e.g. /deep-dive TSLA)',
    instruction: 'The user wants a comprehensive deep-dive. Use the /deep-dive workflow: launch TWO DataCollector tasks in parallel (one for news/sentiment, one for financials/SEC), then have FinancialAnalyst synthesize both into a full deep-dive report.',
  },
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
