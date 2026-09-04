/**
 * AVEKSHA NETRA — Tactical Threat Alerts Center
 * Prioritized threat alert dashboard derived from live surveillance events.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSystem } from "../context/SystemContext";
import { aiApi, alertsApi } from "../api";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import CameraFeed from "../components/surveillance/CameraFeed";
import "./Alerts.css";

export function Alerts({ onNavigateToOverview }) {
  const { cameras, isOnline } = useSystem();

  // State
  const [cameraEvents, setCameraEvents] = useState({});
  const [backendAlerts, setBackendAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("ALL"); // 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  const [sihCategoryFilter, setSihCategoryFilter] = useState("ALL"); // 'ALL' | 'INTRUSIONS' | 'ANPR' | 'FACE' | 'BEHAVIOR' | 'NIGHT'
  const [selectedCameraFilter, setSelectedCameraFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(() => new Set());
  const [selectedAlertForInspection, setSelectedAlertForInspection] = useState(null);

  // ============================================================
  // FETCH EVENTS & ALERTS FROM ALL CAMERAS & BACKEND
  // ============================================================
  const fetchAllCameraEvents = useCallback(async () => {
    // 0. Fetch centralized live alerts
    try {
      const bRes = await alertsApi.getAlerts();
      if (Array.isArray(bRes?.alerts)) {
        setBackendAlerts(bRes.alerts);
      }
    } catch {}

    if (!cameras || cameras.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const eventsMap = {};
      for (const cam of cameras) {
        try {
          const res = await aiApi.getCameraEvents(cam.id);
          eventsMap[cam.id] = Array.isArray(res?.events) ? res.events : [];
        } catch {
          eventsMap[cam.id] = [];
        }
      }
      setCameraEvents(eventsMap);
    } finally {
      setLoading(false);
    }
  }, [cameras]);

  useEffect(() => {
    fetchAllCameraEvents();
    const interval = setInterval(fetchAllCameraEvents, 4000);
    return () => clearInterval(interval);
  }, [fetchAllCameraEvents]);

  // ============================================================
  // PROCESS EVENTS INTO STRUCTURED THREAT ALERTS
  // ============================================================
  const processedAlerts = useMemo(() => {
    const list = [];

    cameras.forEach((cam) => {
      const events = cameraEvents[cam.id] || [];
      events.forEach((ev) => {
        const objType = String(ev.object_type || "unknown").toLowerCase().trim();
        const alertId = `${cam.id}-${ev.track_id || ev.id || Math.random()}`;

        // Classify severity based on detection classification
        let severity = "LOW";
        let title = "SURVEILLANCE DETECTION";
        let threatCode = "TRK-01";

        if (["person", "human"].includes(objType)) {
          severity = "HIGH";
          title = "HUMAN PRESENCE IN SECTOR";
          threatCode = "THR-HUMAN";
        } else if (["car", "truck", "bus"].includes(objType)) {
          severity = "MEDIUM";
          title = "VEHICLE MOVEMENT DETECTED";
          threatCode = "THR-VEHICLE";
        } else if (["motorcycle", "bicycle"].includes(objType)) {
          severity = "MEDIUM";
          title = "TWO-WHEELER TRANSIT DETECTED";
          threatCode = "THR-TRANSIT";
        }

        const timestamp = ev.timestamp || ev.first_seen || new Date().toISOString();

        list.push({
          id: alertId,
          camera_id: cam.id,
          camera_name: cam.name,
          location: cam.location,
          object_type: objType,
          alert_type: ev.type,
          title: ev.title || title,
          message: ev.message,
          threatCode: ev.type || threatCode,
          severity: ev.severity || severity,
          confidence: ev.confidence,
          timestamp,
          isAcknowledged: acknowledgedAlerts.has(alertId),
        });
      });
    });

    // Merge backend AI engine alerts
    backendAlerts.forEach((ba) => {
      list.push({
        id: ba.id,
        camera_id: ba.camera_id,
        camera_name: ba.camera_name || `CAM-${String(ba.camera_id).padStart(3, "0")}`,
        location: ba.location || "Sector Monitored",
        object_type: ba.object_type || "Object",
        alert_type: ba.alert_type,
        title: ba.title || "THREAT ALERT",
        message: ba.message,
        threatCode: ba.alert_type || "THR-AI",
        severity: ba.severity || "HIGH",
        confidence: ba.confidence,
        timestamp: ba.timestamp || ba.created_at || new Date().toISOString(),
        isAcknowledged: ba.status === "ACKNOWLEDGED" || acknowledgedAlerts.has(ba.id),
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [cameras, cameraEvents, backendAlerts, acknowledgedAlerts]);

  // Filtered list
  const filteredAlerts = useMemo(() => {
    return processedAlerts.filter((alert) => {
      // 1. Severity filter
      if (severityFilter !== "ALL" && alert.severity !== severityFilter) {
        return false;
      }
      // 2. Camera filter
      if (selectedCameraFilter !== "ALL" && String(alert.camera_id) !== String(selectedCameraFilter)) {
        return false;
      }
      // 3. SIH Category filter
      if (sihCategoryFilter !== "ALL") {
        const t = String(alert.alert_type || alert.title || "").toUpperCase();
        if (sihCategoryFilter === "INTRUSIONS" && !t.includes("INTRUSION")) return false;
        if (sihCategoryFilter === "ANPR" && !t.includes("ANPR") && !t.includes("PLATE") && !t.includes("WATCHLIST")) return false;
        if (sihCategoryFilter === "FACE" && !t.includes("FACE") && !t.includes("PERSONNEL")) return false;
        if (sihCategoryFilter === "BEHAVIOR" && !t.includes("LOITERING") && !t.includes("STATIONARY") && !t.includes("CROWD")) return false;
        if (sihCategoryFilter === "NIGHT" && !t.includes("NIGHT")) return false;
      }
      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = alert.title.toLowerCase().includes(q);
        const matchLoc = alert.location.toLowerCase().includes(q);
        const matchCam = alert.camera_name.toLowerCase().includes(q);
        const matchObj = alert.object_type.toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchCam && !matchObj) return false;
      }
      return true;
    });
  }, [processedAlerts, severityFilter, sihCategoryFilter, selectedCameraFilter, searchQuery]);

  // Count summaries
  const counts = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    processedAlerts.forEach((a) => {
      if (a.severity === "CRITICAL") critical++;
      else if (a.severity === "HIGH") high++;
      else if (a.severity === "MEDIUM") medium++;
      else low++;
    });

    return { total: processedAlerts.length, critical, high, medium, low };
  }, [processedAlerts]);

  // Toggle acknowledge
  const handleAcknowledge = async (alertId, e) => {
    e?.stopPropagation();
    try {
      await alertsApi.acknowledge(alertId);
    } catch {}
    setAcknowledgedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  return (
    <div className="alerts-center-container">
      {/* 1. Header & Severity Summary Tabs */}
      <div className="alerts-header">
        <div>
          <h1 className="command-title">THREAT ALERTS CENTER</h1>
          <p className="command-subtitle">
            Real-time security alerts prioritized by risk level and object classification
          </p>
        </div>

        <div className="alerts-summary-chips">
          <div
            className={`summary-chip ${severityFilter === "ALL" ? "active" : ""}`}
            onClick={() => setSeverityFilter("ALL")}
          >
            <span className="chip-count tech-value">{counts.total}</span>
            <span className="chip-name">ALL ALERTS</span>
          </div>

          <div
            className={`summary-chip tone-high ${severityFilter === "HIGH" ? "active" : ""}`}
            onClick={() => setSeverityFilter("HIGH")}
          >
            <span className="chip-count tech-value">{counts.high}</span>
            <span className="chip-name">HIGH (HUMAN)</span>
          </div>

          <div
            className={`summary-chip tone-med ${severityFilter === "MEDIUM" ? "active" : ""}`}
            onClick={() => setSeverityFilter("MEDIUM")}
          >
            <span className="chip-count tech-value">{counts.medium}</span>
            <span className="chip-name">MEDIUM (VEHICLE)</span>
          </div>

          <div
            className={`summary-chip tone-low ${severityFilter === "LOW" ? "active" : ""}`}
            onClick={() => setSeverityFilter("LOW")}
          >
            <span className="chip-count tech-value">{counts.low}</span>
            <span className="chip-name">LOW RISK</span>
          </div>
        </div>
      </div>

      {/* 1.5 SIH Threat Category Filter Chips */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", overflowX: "auto", paddingBottom: "4px" }}>
        {[
          { id: "ALL", label: "ALL CATEGORIES" },
          { id: "INTRUSIONS", label: "🚫 PERIMETER BREACH" },
          { id: "ANPR", label: "🚗 ANPR & WATCHLIST" },
          { id: "FACE", label: "👤 FACE RECOGNITION" },
          { id: "BEHAVIOR", label: "⏳ SUSPICIOUS BEHAVIOR" },
          { id: "NIGHT", label: "🌙 NIGHT MOVEMENT" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSihCategoryFilter(cat.id)}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: "4px",
              border:
                sihCategoryFilter === cat.id
                  ? "1px solid var(--primary, #06b6d4)"
                  : "1px solid rgba(255,255,255,0.08)",
              background:
                sihCategoryFilter === cat.id
                  ? "rgba(6, 182, 212, 0.15)"
                  : "var(--card-bg, #0f172a)",
              color:
                sihCategoryFilter === cat.id
                  ? "var(--primary, #06b6d4)"
                  : "var(--text-muted, #94a3b8)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 2. Controls & Search Filter Bar */}
      <div className="alerts-filter-bar">
        <div className="filter-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search alerts by sector, object, or camera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tactical-input"
          />
        </div>

        <div className="filter-select-wrap">
          <select
            value={selectedCameraFilter}
            onChange={(e) => setSelectedCameraFilter(e.target.value)}
            className="tactical-input select-input"
          >
            <option value="ALL">ALL CAMERAS</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                CAM-{String(c.id).padStart(3, "0")} ({c.name})
              </option>
            ))}
          </select>
        </div>

        <button onClick={fetchAllCameraEvents} className="btn btn-secondary btn-sm" title="Refresh Feed">
          REFRESH
        </button>
      </div>

      {/* 3. Alerts List Feed */}
      <div className="alerts-feed-wrapper">
        {loading ? (
          <div className="alerts-loading">
            <div className="feed-radar-spinner"></div>
            <p>SYNCING SURVEILLANCE EVENTS...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState
            title="NO THREAT ALERTS DETECTED"
            subtitle="The YOLO AI vision worker has not reported any matching detections in this filter range."
            actionLabel="View All Feeds"
            onAction={() => {
              setSeverityFilter("ALL");
              setSelectedCameraFilter("ALL");
              setSearchQuery("");
            }}
          />
        ) : (
          <div className="alerts-table-container">
            <table className="tactical-alerts-table">
              <thead>
                <tr>
                  <th>SEVERITY</th>
                  <th>TIMESTAMP</th>
                  <th>THREAT TYPE</th>
                  <th>LOCATION / CAMERA</th>
                  <th>OBJECT</th>
                  <th>CONFIDENCE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => {
                  const timeFormatted = new Date(alert.timestamp).toLocaleTimeString("en-US", {
                    hour12: false,
                  });

                  return (
                    <tr
                      key={alert.id}
                      className={`alert-row ${alert.isAcknowledged ? "acknowledged" : ""}`}
                    >
                      <td>
                        <StatusBadge
                          status={alert.severity === "HIGH" ? "threat" : "warning"}
                          label={alert.severity}
                          size="sm"
                          showDot={!alert.isAcknowledged}
                          pulse={!alert.isAcknowledged && alert.severity === "HIGH"}
                        />
                      </td>

                      <td className="tech-value time-cell">{timeFormatted}</td>

                      <td className="title-cell">
                        <div className="alert-event-name">{alert.title}</div>
                        <div className="alert-code tech-value">{alert.threatCode}</div>
                      </td>

                      <td>
                        <div className="location-name">{alert.location}</div>
                        <div className="camera-tag tech-value">
                          CAM-{String(alert.camera_id).padStart(3, "0")} // {alert.camera_name}
                        </div>
                      </td>

                      <td>
                        <span className="object-chip tech-value">
                          {alert.object_type.toUpperCase()}
                        </span>
                      </td>

                      <td className="tech-value">
                        {alert.confidence ? (
                          <span className="confidence-chip">
                            {Math.round(alert.confidence * 100)}%
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>

                      <td>
                        <span className={`status-pill ${alert.isAcknowledged ? "ack" : "active"}`}>
                          {alert.isAcknowledged ? "ACKNOWLEDGED" : "ACTIVE"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button
                            onClick={() => setSelectedAlertForInspection(alert)}
                            className="btn-action-inspect"
                            title="Inspect Camera Feed"
                          >
                            VIEW CAM
                          </button>
                          <button
                            onClick={(e) => handleAcknowledge(alert.id, e)}
                            className={`btn-action-ack ${alert.isAcknowledged ? "is-ack" : ""}`}
                            title={alert.isAcknowledged ? "Mark as Active" : "Acknowledge Threat"}
                          >
                            {alert.isAcknowledged ? "ACKED" : "ACKNOWLEDGE"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Camera Feed Inspection Modal */}
      {selectedAlertForInspection && (
        <div className="tactical-modal-backdrop" onClick={() => setSelectedAlertForInspection(null)}>
          <div className="tactical-modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                LIVE THREAT FEED // CAM-{String(selectedAlertForInspection.camera_id).padStart(3, "0")} - {selectedAlertForInspection.camera_name}
              </div>
              <button onClick={() => setSelectedAlertForInspection(null)} className="btn-modal-close">
                ✕
              </button>
            </div>

            <div className="modal-viewport-wrap">
              <CameraFeed
                cameraId={selectedAlertForInspection.camera_id}
                isAiActive={true}
                cameraName={selectedAlertForInspection.camera_name}
                location={selectedAlertForInspection.location}
              />
            </div>

            <div className="modal-threat-details">
              <div className="threat-detail-col">
                <span className="detail-label">INCIDENT TYPE:</span>
                <strong>{selectedAlertForInspection.title}</strong>
              </div>
              <div className="threat-detail-col">
                <span className="detail-label">LOCATION:</span>
                <strong>{selectedAlertForInspection.location}</strong>
              </div>
              <div className="threat-detail-col">
                <span className="detail-label">SEVERITY:</span>
                <StatusBadge status={selectedAlertForInspection.severity === "HIGH" ? "threat" : "warning"} label={selectedAlertForInspection.severity} />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setSelectedAlertForInspection(null)} className="btn btn-secondary btn-sm">
                CLOSE FEED
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Alerts;