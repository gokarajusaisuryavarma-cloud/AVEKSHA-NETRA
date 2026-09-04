/**
 * AVEKSHA NETRA — StatusBadge Component
 * Tactical pill badge with semantic color coding and optional pulse.
 */

import React from "react";

export function StatusBadge({
  status = "OFFLINE",
  label,
  showDot = true,
  pulse = false,
  className = "",
  size = "md",
}) {
  const normStatus = String(status || "offline").toLowerCase();

  // Map status variations to CSS classes
  let statusClass = "offline";
  if (["online", "active", "connected", "running", "ok"].includes(normStatus)) {
    statusClass = "online";
  } else if (["warning", "standby", "starting"].includes(normStatus)) {
    statusClass = "warning";
  } else if (["threat", "critical", "danger", "error", "failed"].includes(normStatus)) {
    statusClass = "threat";
  } else if (["info", "tracking", "detecting"].includes(normStatus)) {
    statusClass = "info";
  }

  const displayLabel = label || status;

  return (
    <span className={`status-badge ${statusClass} ${size === "sm" ? "text-xs" : ""} ${className}`}>
      {showDot && (
        <span
          className={`status-dot ${statusClass} ${pulse || statusClass === "online" ? "pulse" : ""}`}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
