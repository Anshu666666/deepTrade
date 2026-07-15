import { useState } from 'react';
import type { ReferenceGroup } from '../types';

export function ReferencesPanel({ references }: { references: ReferenceGroup[] }) {
  if (!references || references.length === 0) return null;

  return (
    <div className="references-panel">
      {references.map((group, idx) => (
        <ReferenceGroupItem key={idx} group={group} />
      ))}
    </div>
  );
}

function ReferenceGroupItem({ group }: { group: ReferenceGroup }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = group.links.length > 2;
  const visibleLinks = expanded ? group.links : group.links.slice(0, 2);

  return (
    <div className="reference-group">
      <div className="reference-query">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span title={group.query}>{group.query}</span>
        <span className="reference-count">{group.links.length} results</span>
      </div>
      
      <div className={`reference-links ${!expanded && needsTruncation ? 'collapsed' : ''}`}>
        {visibleLinks.map((link, i) => {
          // Extract clean domain
          let domain = link.url;
          try {
            domain = new URL(link.url).hostname.replace(/^www\./, '');
          } catch (e) {
            // Ignore parse errors
          }

          return (
            <a key={i} href={link.url} target="_blank" rel="noreferrer" className="reference-link">
              <div className="reference-link-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, marginRight: '8px' }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span className="reference-link-title" title={link.title}>{link.title}</span>
              </div>
              <span className="reference-link-domain">{domain}</span>
            </a>
          );
        })}

        {!expanded && needsTruncation && (
          <div className="reference-blur-overlay">
            <button className="reference-read-more" onClick={() => setExpanded(true)}>
              Show {group.links.length - 2} more results
            </button>
          </div>
        )}
      </div>
      
      {expanded && needsTruncation && (
        <button className="reference-read-more minimal" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  );
}
