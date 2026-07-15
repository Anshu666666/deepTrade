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
        <div className="order-confirmation-box" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginTop: '8px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>⚠️ Order Confirmation</h4>
          <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', fontSize: '0.9rem' }}>
            <li><strong>Symbol:</strong> {orderData.preview.symbol}</li>
            <li><strong>Action:</strong> {orderData.preview.transaction_type}</li>
            <li><strong>Quantity:</strong> {orderData.preview.quantity}</li>
            <li><strong>Type:</strong> {orderData.preview.order_type}</li>
            <li><strong>Price:</strong> {orderData.preview.price}</li>
          </ul>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => handleOrderAction('confirm')} 
              disabled={orderStatus !== 'pending'}
              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: orderStatus === 'pending' ? 'pointer' : 'not-allowed', opacity: orderStatus === 'cancel' ? 0.5 : 1 }}
            >
              ✅ Confirm
            </button>
            <button 
              onClick={() => handleOrderAction('cancel')} 
              disabled={orderStatus !== 'pending'}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: orderStatus === 'pending' ? 'pointer' : 'not-allowed', opacity: orderStatus === 'confirm' ? 0.5 : 1 }}
            >
              ❌ Cancel
            </button>
          </div>
          {orderStatus !== 'pending' && <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#6b7280' }}>Action submitted: {orderStatus}</div>}
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
