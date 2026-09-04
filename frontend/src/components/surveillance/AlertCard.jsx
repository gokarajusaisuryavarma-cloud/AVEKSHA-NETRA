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
  const alertType = String(alert.alert_type || "").toUpperCase();

  // Determine SIH category pill
  let categoryTag = null;
  if (alertType.includes("INTRUSION")) {
    categoryTag = { label: "PERIMETER BREACH", tone: "critical" };
  } else if (alertType === "ANPR_WATCHLIST") {
    categoryTag = { label: "WATCHLIST MATCH", tone: "critical" };
  } else if (alertType.includes("ANPR")) {
    categoryTag = { label: "ANPR PLATE", tone: "info" };
  } else if (alertType === "FACE_RECOGNIZED") {
    categoryTag = { label: "KNOWN PERSONNEL", tone: "success" };
  } else if (alertType === "FACE_UNKNOWN") {
    categoryTag = { label: "UNKNOWN VISITOR", tone: "warning" };
  } else if (alertType.includes("LOITERING")) {
    categoryTag = { label: "LOITERING DWELL", tone: "warning" };
  } else if (alertType.includes("STATIONARY")) {
    categoryTag = { label: "STATIONARY OBJECT", tone: "warning" };
  } else if (alertType.includes("CROWD")) {
    categoryTag = { label: "CROWD CLUSTER", tone: "warning" };
  } else if (alertType.includes("NIGHT")) {
    categoryTag = { label: "NIGHT PATROL", tone: "info" };
  }

  return (
    <div
      className={`tactical-alert-card severity-${severity.toLowerCase()}`}
      onClick={() => onSelect && onSelect(alert)}
    >
      <div className="alert-card-header">
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <StatusBadge
            status={severity === "CRITICAL" || severity === "HIGH" ? "threat" : "warning"}
            label={severity}
            size="sm"
            showDot={true}
          />
          {categoryTag && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                padding: "2px 6px",
                borderRadius: "3px",
                textTransform: "uppercase",
                background: categoryTag.tone === "critical" ? "rgba(239, 68, 68, 0.2)" : categoryTag.tone === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(6, 182, 212, 0.2)",
                color: categoryTag.tone === "critical" ? "#f87171" : categoryTag.tone === "success" ? "#34d399" : "#38bdf8",
                border: `1px solid ${categoryTag.tone === "critical" ? "rgba(239, 68, 68, 0.4)" : categoryTag.tone === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(6, 182, 212, 0.4)"}`,
              }}
            >
              {categoryTag.label}
            </span>
          )}
        </div>
        <span className="alert-time tech-value">{timeDisplay}</span>
      </div>

      <div className="alert-card-title">{title}</div>
      {alert.message && alert.message !== title && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", lineHeight: "1.4" }}>
          {alert.message}
        </div>
      )}

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
