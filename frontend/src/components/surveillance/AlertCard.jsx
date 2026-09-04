/**
 * AVEKSHA NETRA — AlertCard Component
 * High-visibility threat alert item for command center feed.
 */

import React from "react";
import StatusBadge from "../common/StatusBadge";
import "./AlertCard.css";

export function AlertCard({ alert, onSelect }) {
  if (!alert) return null;

  const severity = alert.severity || "MEDIUM";
  const title = alert.title || `${(alert.object_type || "OBJECT").toUpperCase()} DETECTED`;
  const location = alert.location || "Sector Unknown";
  const cameraLabel = alert.camera_name || `CAM-${String(alert.camera_id || 1).padStart(3, "0")}`;
  
  // Format time
  let timeDisplay = "--:--:--";
  const timestamp = alert.timestamp || alert.created_at || alert.first_seen;
  if (timestamp) {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        timeDisplay = date.toLocaleTimeString("en-US", { hour12: false });
      }
    } catch {
      timeDisplay = "--:--:--";
    }
  }

  const confidence = alert.confidence ? `${Math.round(alert.confidence * 100)}%` : null;

  return (
    <div
      className={`tactical-alert-card severity-${severity.toLowerCase()}`}
      onClick={() => onSelect && onSelect(alert)}
    >
      <div className="alert-card-header">
        <StatusBadge
          status={severity === "CRITICAL" || severity === "HIGH" ? "threat" : "warning"}
          label={severity}
          size="sm"
          showDot={true}
        />
        <span className="alert-time tech-value">{timeDisplay}</span>
      </div>

      <div className="alert-card-title">{title}</div>

      <div className="alert-card-meta">
        <div className="alert-source">
          <span className="source-cam tech-value">{cameraLabel}</span>
          <span className="source-sep">•</span>
          <span className="source-loc">{location}</span>
        </div>

        {confidence && (
          <span className="alert-confidence tech-value">{confidence} CONF</span>
        )}
      </div>
    </div>
  );
}

export default AlertCard;
