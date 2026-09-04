/**
 * AVEKSHA NETRA — StatCard Component
 * High-precision tactical KPI card for surveillance metrics.
 */

import React from "react";
import "./StatCard.css";

export function StatCard({
  label,
  value,
  subtext,
  icon,
  tone = "default", // 'default' | 'online' | 'threat' | 'warning' | 'info'
  code = "",
}) {
  return (
    <div className={`tactical-stat-card tactical-corner tone-${tone}`}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value tech-value">
          {value !== undefined && value !== null ? value : "--"}
        </div>
      </div>

      <div className="stat-card-footer">
        <span className="stat-card-subtext">{subtext}</span>
        {code && <span className="stat-card-code tech-value">{code}</span>}
      </div>
    </div>
  );
}

export default StatCard;
