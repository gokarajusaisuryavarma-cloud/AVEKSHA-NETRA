/**
 * AVEKSHA NETRA — Tactical Topbar Component
 * Real-time HUD command bar with live military clock, heartbeat status, and operator profile.
 */

import React, { useState, useEffect } from "react";
import { useSystem, SYSTEM_STATUS } from "../../context/SystemContext";
import StatusBadge from "../common/StatusBadge";
import "./Topbar.css";

export function Topbar({ activePage = "overview", user, onLogout }) {
  const { backendStatus, aiEngineStatus, cameras } = useSystem();
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  // Live HUD Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }).toUpperCase()
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const pageTitles = {
    overview: { title: "COMMAND CENTER", subtitle: "Real-Time AI Surveillance & Threat Overview" },
    cameras: { title: "LIVE CAMERA WALL", subtitle: "IP CCTV Infrastructure & RTSP Streams" },
    alerts: { title: "THREAT ALERTS", subtitle: "Geofence, Intrusion & High-Risk Detection Center" },
    events: { title: "SURVEILLANCE EVENT LOG", subtitle: "YOLO Tracking History & Audit Trail" },
    analytics: { title: "INTELLIGENCE ANALYTICS", subtitle: "Detection Telemetry & Object Breakdown" },
  };

  const currentInfo = pageTitles[activePage] || {
    title: "SURVEILLANCE COMMAND",
    subtitle: "Security Operations Center",
  };

  const username = user?.username || "OPERATOR";
  const role = user?.role || "DEFENSE_SOC";

  return (
    <header className="tactical-topbar">
      {/* Page Title & Breadcrumb */}
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          <span className="breadcrumb-root">AVEKSHA</span>
          <span className="breadcrumb-separator">//</span>
          <span className="breadcrumb-current">{currentInfo.title}</span>
        </div>
        <div className="topbar-subtitle">
          {currentInfo.subtitle}
          {cameras.length > 0 && (
            <span className="camera-count-badge">
              {cameras.length} CAMERA{cameras.length > 1 ? "S" : ""} CONFIGURED
            </span>
          )}
        </div>
      </div>

      {/* Real-time Telemetry & Live Clock */}
      <div className="topbar-right">
        {/* Live HUD Clock */}
        <div className="hud-clock-widget">
          <div className="hud-date">{dateStr}</div>
          <div className="hud-time tech-value">{timeStr || "--:--:--"}</div>
        </div>

        {/* System Health Indicators */}
        <div className="topbar-status-group">
          <StatusBadge
            status={backendStatus}
            label={backendStatus === SYSTEM_STATUS.ONLINE ? "SYS ONLINE" : "SYS OFFLINE"}
            showDot={true}
            pulse={backendStatus === SYSTEM_STATUS.ONLINE}
          />

          <StatusBadge
            status={aiEngineStatus}
            label={aiEngineStatus === SYSTEM_STATUS.ONLINE ? "AI ACTIVE" : "AI STANDBY"}
            showDot={true}
            pulse={aiEngineStatus === SYSTEM_STATUS.ONLINE}
          />
        </div>

        {/* Operator Session */}
        <div className="topbar-operator-badge">
          <div className="operator-avatar">
            {username.slice(0, 2).toUpperCase()}
          </div>
          <div className="operator-meta">
            <div className="operator-name">{username.toUpperCase()}</div>
            <div className="operator-role">{role}</div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="btn-operator-logout"
              title="End Session"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
