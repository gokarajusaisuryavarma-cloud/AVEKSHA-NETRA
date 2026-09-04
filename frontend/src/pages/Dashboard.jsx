/**
 * AVEKSHA NETRA — Rebuilt Tactical Command Center Dashboard
 * Real-time AI surveillance overview, multi-camera grid, and live threat feed.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSystem, SYSTEM_STATUS } from "../context/SystemContext";
import { aiApi, alertsApi } from "../api";
import StatCard from "../components/common/StatCard";
import CameraCard from "../components/surveillance/CameraCard";
import AlertCard from "../components/surveillance/AlertCard";
import EmptyState from "../components/common/EmptyState";
import StatusBadge from "../components/common/StatusBadge";
import "./Dashboard.css";

export function Dashboard({ onNavigateToCameras, cameras: propCameras, refreshCameras: propRefreshCameras }) {
  const system = useSystem();
  const cameras = propCameras || system.cameras || [];
  const refreshCameras = propRefreshCameras || system.refreshCameras;
  const {
    camerasLoading,
    backendStatus,
    activeWorkers,
    activeAlertsCount,
  } = system;

  // Local state for camera events and telemetry
  const [cameraEvents, setCameraEvents] = useState({}); // { [cameraId]: [events] }
  const [cameraStatusMap, setCameraStatusMap] = useState({}); // { [cameraId]: aiStatus }
  const [backendAlerts, setBackendAlerts] = useState([]);
  const [threatCategoryFilter, setThreatCategoryFilter] = useState("ALL");
  const [selectedCameraForModal, setSelectedCameraForModal] = useState(null);
  const [selectedAlertForModal, setSelectedAlertForModal] = useState(null);

  // ============================================================
  // POLL TELEMETRY & EVENTS FOR ALL CAMERAS
  // ============================================================
  const pollSurveillanceData = useCallback(async () => {
    // 0. Fetch Centralized Live Alerts
    try {
      const alertsRes = await alertsApi.getAlerts();
      if (Array.isArray(alertsRes?.alerts)) {
        setBackendAlerts(alertsRes.alerts);
      }
    } catch {}

    if (!cameras || cameras.length === 0) return;

    for (const cam of cameras) {
      const camId = cam.id;

      // 1. Fetch AI Status
      try {
        const status = await aiApi.getCameraStatus(camId);
        setCameraStatusMap((prev) => ({ ...prev, [camId]: status }));
      } catch {
        // AI worker might not be started
      }

      // 2. Fetch Recent Events
      try {
        const res = await aiApi.getCameraEvents(camId);
        const events = Array.isArray(res?.events) ? res.events : [];
        setCameraEvents((prev) => ({ ...prev, [camId]: events }));
      } catch {
        // Silently catch
      }
    }
  }, [cameras]);

  useEffect(() => {
    pollSurveillanceData();
    const interval = setInterval(pollSurveillanceData, 3500);
    return () => clearInterval(interval);
  }, [pollSurveillanceData]);

  // Update AI status locally when user clicks Start/Stop
  const handleCameraStatusChange = (camId, isRunning) => {
    setCameraStatusMap((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], running: isRunning },
    }));
    pollSurveillanceData();
  };

  // ============================================================
  // DERIVE METRICS & AGGREGATE STATS
  // ============================================================
  const { activeFeedsCount, totalDetections, personsCount, vehiclesCount, categoryCounts, aggregatedAlerts } =
    useMemo(() => {
      let activeFeeds = 0;
      let detections = 0;
      let persons = 0;
      let vehicles = 0;
      const alertsList = [];

      // Loop through cameras and their status
      cameras.forEach((cam) => {
        const status = cameraStatusMap[cam.id] || activeWorkers[cam.id];
        if (status?.running) activeFeeds++;
        if (status?.total_detections) detections += Number(status.total_detections);

        // Analyze events for this camera
        const events = cameraEvents[cam.id] || [];
        events.forEach((ev) => {
          const objType = String(ev.object_type || "").toLowerCase().trim();
          if (["person", "human"].includes(objType)) {
            persons++;
          } else if (["car", "truck", "bus", "motorcycle", "vehicle"].includes(objType)) {
            vehicles++;
          }

          // Build threat alert entry
          const severity =
            ["person", "human"].includes(objType)
              ? "HIGH"
              : ["car", "truck"].includes(objType)
              ? "MEDIUM"
              : "LOW";

          alertsList.push({
            id: `${cam.id}-${ev.track_id || ev.id || Math.random()}`,
            camera_id: cam.id,
            camera_name: cam.name,
            location: cam.location,
            object_type: objType || "Object",
            alert_type: ev.type,
            title: ev.title || `${(objType || "OBJECT").toUpperCase()} DETECTED`,
            message: ev.message,
            severity: ev.severity || severity,
            confidence: ev.confidence,
            timestamp: ev.timestamp || ev.first_seen || new Date().toISOString(),
          });
        });
      });

      // Incorporate structured alerts from backend engines
      backendAlerts.forEach((ba) => {
        alertsList.push({
          id: ba.id,
          camera_id: ba.camera_id,
          camera_name: ba.camera_name || `CAM-${String(ba.camera_id).padStart(3, "0")}`,
          location: ba.location || "Monitored Zone",
          object_type: ba.object_type || "Object",
          alert_type: ba.alert_type,
          title: ba.title || "AI THREAT ALERT",
          message: ba.message,
          severity: ba.severity || "HIGH",
          confidence: ba.confidence,
          timestamp: ba.timestamp || ba.created_at || new Date().toISOString(),
        });
      });

      // Sort alerts descending by timestamp
      alertsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Calculate category counts
      const counts = {
        ALL: alertsList.length,
        INTRUSIONS: alertsList.filter((a) => String(a.alert_type || a.title || "").toUpperCase().includes("INTRUSION")).length,
        ANPR: alertsList.filter((a) => {
          const t = String(a.alert_type || a.title || "").toUpperCase();
          return t.includes("ANPR") || t.includes("PLATE") || t.includes("WATCHLIST");
        }).length,
        FACE: alertsList.filter((a) => {
          const t = String(a.alert_type || a.title || "").toUpperCase();
          return t.includes("FACE") || t.includes("PERSONNEL");
        }).length,
        BEHAVIOR: alertsList.filter((a) => {
          const t = String(a.alert_type || a.title || "").toUpperCase();
          return t.includes("LOITERING") || t.includes("STATIONARY") || t.includes("CROWD");
        }).length,
        NIGHT: alertsList.filter((a) => String(a.alert_type || a.title || "").toUpperCase().includes("NIGHT")).length,
      };

      // Apply active filter
      let filtered = alertsList;
      if (threatCategoryFilter !== "ALL") {
        filtered = alertsList.filter((a) => {
          const t = String(a.alert_type || a.title || "").toUpperCase();
          if (threatCategoryFilter === "INTRUSIONS") return t.includes("INTRUSION");
          if (threatCategoryFilter === "ANPR") return t.includes("ANPR") || t.includes("PLATE") || t.includes("WATCHLIST");
          if (threatCategoryFilter === "FACE") return t.includes("FACE") || t.includes("PERSONNEL");
          if (threatCategoryFilter === "BEHAVIOR") return t.includes("LOITERING") || t.includes("STATIONARY") || t.includes("CROWD");
          if (threatCategoryFilter === "NIGHT") return t.includes("NIGHT");
          return true;
        });
      }

      return {
        activeFeedsCount: activeFeeds,
        totalDetections: detections,
        personsCount: persons,
        vehiclesCount: vehicles,
        categoryCounts: counts,
        aggregatedAlerts: filtered.slice(0, 30),
      };
    }, [cameras, cameraStatusMap, activeWorkers, cameraEvents, backendAlerts, threatCategoryFilter]);

  return (
    <div className="command-center-container">
      {/* 1. Header Section */}
      <div className="command-header">
        <div>
          <h1 className="command-title">COMMAND CENTER</h1>
          <p className="command-subtitle">
            Real-time AI surveillance overview & intelligent threat monitoring
          </p>
        </div>

        <div className="command-header-actions">
          <StatusBadge
            status={backendStatus}
            label={backendStatus === SYSTEM_STATUS.ONLINE ? "BACKEND CONNECTED" : "BACKEND OFFLINE"}
            showDot={true}
            pulse={backendStatus === SYSTEM_STATUS.ONLINE}
          />
          <button onClick={refreshCameras} className="btn btn-secondary btn-sm" title="Refresh Cameras">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            REFRESH
          </button>
        </div>
      </div>

      {/* 2. Tactical KPI Metric Cards */}
      <div className="kpi-grid">
        <StatCard
          label="MONITORED CAMERAS"
          value={cameras.length}
          subtext="IP CCTV & FILE SOURCES"
          code="SURV-01"
          tone="info"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z"></path>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          }
        />

        <StatCard
          label="AI ACTIVE FEEDS"
          value={activeFeedsCount}
          subtext="YOLO11 PIPELINE ONLINE"
          code="YOLO-02"
          tone={activeFeedsCount > 0 ? "online" : "default"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
          }
        />

        <StatCard
          label="ACTIVE THREAT ALERTS"
          value={activeAlertsCount || aggregatedAlerts.length}
          subtext="HIGH & MEDIUM PRIORITY"
          code="ALRT-03"
          tone={aggregatedAlerts.length > 0 ? "threat" : "default"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          }
        />

        <StatCard
          label="TOTAL DETECTIONS"
          value={totalDetections > 0 ? totalDetections : "--"}
          subtext="AI FRAMES PROCESSED"
          code="DET-04"
          tone="default"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          }
        />

        <StatCard
          label="PERSONS DETECTED"
          value={personsCount}
          subtext="CLASSIFIED BY YOLO"
          code="OBJ-HUMAN"
          tone={personsCount > 0 ? "online" : "default"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          }
        />

        <StatCard
          label="VEHICLES DETECTED"
          value={vehiclesCount}
          subtext="CARS / MOTORCYCLES"
          code="OBJ-VEHICLE"
          tone={vehiclesCount > 0 ? "warning" : "default"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="22" height="13" rx="2"></rect>
              <path d="M16 8h2"></path>
              <path d="M6 8h2"></path>
              <path d="M2 13h20"></path>
              <circle cx="7" cy="18" r="2"></circle>
              <circle cx="17" cy="18" r="2"></circle>
            </svg>
          }
        />
      </div>

      {/* 3. Main Command Grid: Cameras (Left) + Threat Feed (Right) */}
      <div className="surveillance-workspace">
        {/* Left: Surveillance Camera Grid */}
        <div className="camera-section">
          <div className="section-header-bar">
            <div className="section-header-title">
              <span className="section-dot"></span>
              <h2>LIVE SURVEILLANCE CAMERAS</h2>
              <span className="section-count-badge tech-value">
                {cameras.length} UNITS
              </span>
            </div>

            <div className="section-header-legend">
              <span className="legend-item">
                <span className="status-dot online pulse"></span> AI ACTIVE
              </span>
              <span className="legend-item">
                <span className="status-dot offline"></span> STANDBY
              </span>
            </div>
          </div>

          {camerasLoading ? (
            <div className="cameras-loading-state">
              <div className="feed-radar-spinner"></div>
              <p>INITIALIZING SURVEILLANCE MATRIX...</p>
            </div>
          ) : cameras.length === 0 ? (
            <EmptyState
              title="NO SURVEILLANCE CAMERAS CONFIGURED"
              subtitle="Connect an IP CCTV RTSP URL or add the demo file camera to begin AI surveillance."
              actionLabel="Configure Cameras"
              onAction={onNavigateToCameras}
            />
          ) : (
            <div className="cameras-matrix-grid">
              {cameras.map((camera) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  aiStatus={cameraStatusMap[camera.id] || activeWorkers[camera.id]}
                  onStatusChange={handleCameraStatusChange}
                  onOpenDetails={(cam) => setSelectedCameraForModal(cam)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Live Threat Alerts Feed */}
        <div className="threat-feed-section">
          <div className="section-header-bar">
            <div className="section-header-title">
              <span className="status-dot threat pulse"></span>
              <h2>LIVE THREAT FEED</h2>
              {aggregatedAlerts.length > 0 && (
                <span className="badge-threat-count tech-value">
                  {aggregatedAlerts.length}
                </span>
              )}
            </div>
          </div>

          {/* SIH Threat Category Filter Chips */}
          <div
            className="threat-category-bar"
            style={{
              display: "flex",
              gap: "4px",
              padding: "6px 12px",
              borderBottom: "1px solid var(--border-subtle, #1e293b)",
              overflowX: "auto",
              background: "rgba(10, 15, 22, 0.6)",
            }}
          >
            {[
              { id: "ALL", label: "ALL", count: categoryCounts?.ALL || 0 },
              { id: "INTRUSIONS", label: "INTRUSIONS", count: categoryCounts?.INTRUSIONS || 0 },
              { id: "ANPR", label: "ANPR / PLATES", count: categoryCounts?.ANPR || 0 },
              { id: "FACE", label: "FACE ID", count: categoryCounts?.FACE || 0 },
              { id: "BEHAVIOR", label: "BEHAVIOR", count: categoryCounts?.BEHAVIOR || 0 },
              { id: "NIGHT", label: "NIGHT", count: categoryCounts?.NIGHT || 0 },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setThreatCategoryFilter(cat.id)}
                style={{
                  fontSize: "10px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border:
                    threatCategoryFilter === cat.id
                      ? "1px solid var(--primary, #06b6d4)"
                      : "1px solid rgba(255,255,255,0.08)",
                  background:
                    threatCategoryFilter === cat.id
                      ? "rgba(6, 182, 212, 0.15)"
                      : "transparent",
                  color:
                    threatCategoryFilter === cat.id
                      ? "var(--primary, #06b6d4)"
                      : "var(--text-muted, #94a3b8)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 600,
                }}
              >
                <span>{cat.label}</span>
                <span style={{ fontSize: "9px", opacity: 0.8 }} className="tech-value">
                  ({cat.count})
                </span>
              </button>
            ))}
          </div>

          <div className="threat-feed-list">
            {aggregatedAlerts.length === 0 ? (
              <div className="empty-threat-feed">
                <div className="shield-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <polyline points="9 12 11 14 15 10"></polyline>
                  </svg>
                </div>
                <div className="empty-feed-title">ALL SECTORS SECURE</div>
                <div className="empty-feed-subtext">
                  AI threat detection engine active. No unauthorized intrusions or suspicious targets.
                </div>
              </div>
            ) : (
              aggregatedAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onSelect={(a) => setSelectedAlertForModal(a)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Diagnostics Modal (Camera Details) */}
      {selectedCameraForModal && (
        <div className="tactical-modal-backdrop" onClick={() => setSelectedCameraForModal(null)}>
          <div className="tactical-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                CAMERA DIAGNOSTICS // CAM-{String(selectedCameraForModal.id).padStart(3, "0")}
              </div>
              <button onClick={() => setSelectedCameraForModal(null)} className="btn-modal-close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-info-row">
                <span>CAMERA NAME:</span>
                <strong>{selectedCameraForModal.name}</strong>
              </div>
              <div className="modal-info-row">
                <span>LOCATION:</span>
                <strong>{selectedCameraForModal.location}</strong>
              </div>
              <div className="modal-info-row">
                <span>SOURCE TYPE:</span>
                <strong className="tech-value">{selectedCameraForModal.source_type}</strong>
              </div>
              <div className="modal-info-row">
                <span>RTSP / SOURCE URL:</span>
                <strong className="tech-value url-text">{selectedCameraForModal.rtsp_url}</strong>
              </div>
              <div className="modal-info-row">
                <span>AI STATUS:</span>
                <StatusBadge
                  status={cameraStatusMap[selectedCameraForModal.id]?.running ? "ONLINE" : "STANDBY"}
                  size="sm"
                />
              </div>
              <div className="modal-info-row">
                <span>FRAMES PROCESSED:</span>
                <strong className="tech-value">
                  {cameraStatusMap[selectedCameraForModal.id]?.frame_count || "--"}
                </strong>
              </div>
              <div className="modal-info-row">
                <span>TOTAL DETECTIONS:</span>
                <strong className="tech-value">
                  {cameraStatusMap[selectedCameraForModal.id]?.total_detections || "--"}
                </strong>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedCameraForModal(null)} className="btn btn-secondary btn-sm">
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
