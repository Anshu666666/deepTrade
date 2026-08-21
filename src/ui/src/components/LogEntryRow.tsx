import { useState } from 'react';
import { type LogEntry, LOG_TYPE_CONFIG, TRUNCATE_LENGTH } from '../types';

export function LogEntryRow({ entry, index }: { entry: LogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = LOG_TYPE_CONFIG[entry.log_type] || LOG_TYPE_CONFIG.STATUS;

  let headline = '';
  if (entry.log_type === 'ROUTING') {
    headline = `→ ${entry.subagent || 'subagent'}`;
  } else if (entry.log_type === 'TOOL_CALL') {
    headline = `${entry.tool || 'tool'}`;
  } else if (entry.log_type === 'TOOL_RESULT') {
    headline = `from ${entry.tool || 'tool'}`;
  } else if (entry.log_type === 'TASK_RESULT') {
    headline = `${entry.tool || 'task'} completed`;
  } else if (entry.log_type === 'ARTIFACT') {
    headline = entry.path || 'file written';
  } else if (entry.log_type === 'REASONING') {
    const firstLine = entry.content.trim().split('\n')[0].replace(/^[#*\s]+/, '');
    headline = firstLine.substring(0, 80) + (firstLine.length > 80 ? '...' : '');
  } else if (entry.log_type === 'RESPONSE') {
    headline = 'Final response';
  } else {
    headline = entry.content.substring(0, 80);
  }

  const displayContent = entry.log_type === 'ARTIFACT'
    ? `File written to VFS: ${entry.path}`
    : ((!expanded && entry.content.length > TRUNCATE_LENGTH && entry.log_type !== 'ORDER_CONFIRMATION')
        ? entry.content.substring(0, TRUNCATE_LENGTH) + '...'
        : entry.content);

  const needsTruncation = entry.log_type !== 'ARTIFACT' && entry.log_type !== 'ORDER_CONFIRMATION' && entry.content.length > TRUNCATE_LENGTH;

  // Handle Order Confirmation
  const isOrderConfirmation = entry.log_type === 'ORDER_CONFIRMATION';
  let orderData = null;
  if (isOrderConfirmation) {
    try {
      orderData = JSON.parse(entry.content);
    } catch (e) {}
  }

  const [orderStatus, setOrderStatus] = useState<'pending' | 'confirm' | 'cancel'>('pending');

  const handleOrderAction = async (action: 'confirm' | 'cancel') => {
    if (!orderData?.confirmation_id) return;
    setOrderStatus(action);
    try {
      await fetch(`http://localhost:8000/orders/${action}/${orderData.confirmation_id}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to submit order action:', e);
    }
  };

  return (
    <div className="log-entry" style={{ '--log-accent': config.color } as React.CSSProperties}>
      <div className="log-entry-header">
        <span className="log-entry-index">{index + 1}.</span>
        <span className="log-entry-type" style={{ color: config.color, background: config.tagColor }}>
          {config.label}
        </span>
        <span className="log-entry-agent">{entry.agent}</span>
        <span className="log-entry-time">{entry.timestamp}</span>
      </div>
      {headline && <div className="log-entry-headline">{headline}</div>}
      
      {!isOrderConfirmation ? (
        <div className="log-entry-body" style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</div>
      ) : orderData ? (
        <div style={{
          position: 'relative',
          marginTop: '10px',
          borderRadius: '14px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(239, 68, 68, 0.18)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.35)',
        }}>
          {/* Top shimmer */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.18) 60%, transparent)',
            pointerEvents: 'none',
          }} />

          <div style={{ padding: '14px 16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#f87171', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.01em' }}>
              ⚠️ Order Confirmation
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.875rem', marginBottom: '14px' }}>
              {[
                ['Symbol', orderData.preview.symbol],
                ['Action', orderData.preview.transaction_type],
                ['Quantity', orderData.preview.quantity],
                ['Type', orderData.preview.order_type],
                ['Price', orderData.preview.price],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', minWidth: '72px' }}>{label}:</span>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Confirm — green glass */}
              <button
                onClick={() => handleOrderAction('confirm')}
                disabled={orderStatus !== 'pending'}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '7px 18px',
                  borderRadius: '20px',
                  border: '1px solid rgba(16,185,129,0.35)',
                  background: orderStatus === 'cancel'
                    ? 'rgba(16,185,129,0.06)'
                    : 'rgba(16,185,129,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: orderStatus === 'cancel' ? 'rgba(255,255,255,0.3)' : '#6ee7b7',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: orderStatus === 'pending' ? 'pointer' : 'not-allowed',
                  boxShadow: orderStatus !== 'cancel' ? '0 0 12px rgba(16,185,129,0.12) inset' : 'none',
                  transition: 'all 0.2s',
                  letterSpacing: '0.02em',
                }}
              >
                {/* inner shimmer */}
                <span style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                  pointerEvents: 'none',
                }} />
                ✓ Confirm
              </button>

              {/* Cancel — red glass */}
              <button
                onClick={() => handleOrderAction('cancel')}
                disabled={orderStatus !== 'pending'}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '7px 18px',
                  borderRadius: '20px',
                  border: '1px solid rgba(239,68,68,0.35)',
                  background: orderStatus === 'confirm'
                    ? 'rgba(239,68,68,0.06)'
                    : 'rgba(239,68,68,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: orderStatus === 'confirm' ? 'rgba(255,255,255,0.3)' : '#fca5a5',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: orderStatus === 'pending' ? 'pointer' : 'not-allowed',
                  boxShadow: orderStatus !== 'confirm' ? '0 0 12px rgba(239,68,68,0.1) inset' : 'none',
                  transition: 'all 0.2s',
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  pointerEvents: 'none',
                }} />
                ✕ Cancel
              </button>
            </div>

            {orderStatus !== 'pending' && (
              <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>
                Action submitted: {orderStatus}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {needsTruncation && (
        <button className="read-more-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
