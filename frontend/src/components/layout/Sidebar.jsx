/**
 * AVEKSHA NETRA — Tactical Sidebar Component
 * Professional defense & SOC command-center navigation with live system status.
 */

import React from "react";
import { useSystem, SYSTEM_STATUS } from "../../context/SystemContext";
import StatusBadge from "../common/StatusBadge";
import "./Sidebar.css";

const MENU_ITEMS = [
  {
    id: "overview",
    label: "Command Center",
    code: "01",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    ),
  },
  {
    id: "cameras",
    label: "Live Cameras",
    code: "02",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z"></path>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
    ),
  },
  {
    id: "alerts",
    label: "Threat Alerts",
    code: "03",
    badgeKey: "activeAlertsCount",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
  },
  {
    id: "events",
    label: "Event Log",
    code: "04",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    code: "05",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  },
];

export function Sidebar({ activePage, setActivePage, isCollapsed, toggleCollapse }) {
  const {
    backendStatus,
    databaseStatus,
    aiEngineStatus,
    activeAlertsCount,
    retryConnection,
  } = useSystem();

  return (
    <aside className={`tactical-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* Brand Header */}
      <div className="sidebar-brand-header">
        <div className="brand-reticle">
          <span className="reticle-ring"></span>
          <span className="reticle-core"></span>
        </div>
        <div className="brand-text-container">
          <div className="brand-title">
            AVEKSHA <span>NETRA</span>
          </div>
          <div className="brand-subtitle">AI SURVEILLANCE SOC</div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="sidebar-nav-section">
        <div className="sidebar-group-label">MONITORING MODULES</div>
        <nav className="sidebar-nav">
          {MENU_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const badgeValue = item.badgeKey === "activeAlertsCount" ? activeAlertsCount : null;

            return (
              <button
                key={item.id}
                className={`tactical-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setActivePage(item.id)}
                title={item.label}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                <span className="nav-item-code">{item.code}</span>
                {badgeValue > 0 && (
                  <span className="nav-item-badge">{badgeValue}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Live System Diagnostics (Derived from Backend) */}
      <div className="sidebar-system-footer">
        <div className="system-telemetry-header">
          <span className="sidebar-group-label">LIVE SYSTEM TELEMETRY</span>
          {backendStatus === SYSTEM_STATUS.OFFLINE && (
            <button
              onClick={retryConnection}
              className="btn-retry-ping"
              title="Retry Connection"
            >
              RETRY
            </button>
          )}
        </div>

        <div className="system-telemetry-panel">
          {/* Backend Status */}
          <div className="telemetry-row">
            <span className="telemetry-key">BACKEND API</span>
            <StatusBadge
              status={backendStatus}
              size="sm"
              showDot={true}
              pulse={backendStatus === SYSTEM_STATUS.ONLINE}
            />
          </div>

          {/* Database Status */}
          <div className="telemetry-row">
            <span className="telemetry-key">DATABASE</span>
            <StatusBadge
              status={databaseStatus}
              size="sm"
              showDot={true}
            />
          </div>

          {/* AI Engine Status */}
          <div className="telemetry-row">
            <span className="telemetry-key">YOLO ENGINE</span>
            <StatusBadge
              status={aiEngineStatus}
              size="sm"
              showDot={true}
              pulse={aiEngineStatus === SYSTEM_STATUS.ONLINE}
            />
          </div>
        </div>

        <div className="sidebar-version-tag">
          <span>NETRA CORE v1.0.0</span>
          <span className="tech-value">STABLE</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
