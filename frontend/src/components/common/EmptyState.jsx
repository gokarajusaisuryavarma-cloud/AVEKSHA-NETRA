/**
 * AVEKSHA NETRA — EmptyState Component
 * Professional tactical empty state for feeds, tables, and lists.
 */

import React from "react";

export function EmptyState({
  title = "NO DATA AVAILABLE",
  subtitle = "Surveillance sensors currently report no active records in this sector.",
  icon,
  actionLabel,
  onAction,
}) {
  return (
    <div className="tactical-empty-state">
      <div className="empty-state-icon">
        {icon || (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        )}
      </div>
      <div className="empty-state-title tech-value">{title}</div>
      <div className="empty-state-subtitle">{subtitle}</div>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-secondary btn-sm" style={{ marginTop: "12px" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
