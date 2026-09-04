/**
 * AVEKSHA NETRA — Surveillance Intelligence & Analytics
 * Operational telemetry, object classification breakdown, and camera health metrics.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSystem } from "../context/SystemContext";
import { aiApi, systemApi } from "../api";
import StatCard from "../components/common/StatCard";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import "./Analytics.css";

export function Analytics() {
  const { cameras, isOnline } = useSystem();

  const [cameraEvents, setCameraEvents] = useState({});
  const [cameraStatuses, setCameraStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch telemetry from backend
  const fetchAnalyticsData = useCallback(async () => {
    if (!cameras || cameras.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const statusMap = {};
      const eventsMap = {};

      for (const cam of cameras) {
        // Status
        try {
          const status = await aiApi.getCameraStatus(cam.id);
          statusMap[cam.id] = status;
        } catch {
          statusMap[cam.id] = null;
        }

        // Events
        try {
          const res = await aiApi.getCameraEvents(cam.id);
          eventsMap[cam.id] = Array.isArray(res?.events) ? res.events : [];
        } catch {
          eventsMap[cam.id] = [];
        }
      }

      setCameraStatuses(statusMap);
      setCameraEvents(eventsMap);
    } finally {
      setLoading(false);
    }
  }, [cameras]);

  useEffect(() => {
    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 5000);
    return () => clearInterval(interval);
  }, [fetchAnalyticsData]);

  // Aggregate Real Metrics
  const metrics = useMemo(() => {
    let totalFrames = 0;
    let totalDetections = 0;
    let activeAiCount = 0;

    const classCounts = {
      person: 0,
      car: 0,
      motorcycle: 0,
      other: 0,
    };

    cameras.forEach((cam) => {
      const status = cameraStatuses[cam.id];
      if (status?.running) activeAiCount++;
      if (status?.frame_count) totalFrames += Number(status.frame_count);
      if (status?.total_detections) totalDetections += Number(status.total_detections);

      const events = cameraEvents[cam.id] || [];
      events.forEach((ev) => {
        const type = String(ev.object_type || "").toLowerCase().trim();
        if (["person", "human"].includes(type)) {
          classCounts.person++;
        } else if (["car", "truck", "bus"].includes(type)) {
          classCounts.car++;
        } else if (["motorcycle", "bicycle"].includes(type)) {
          classCounts.motorcycle++;
        } else {
          classCounts.other++;
        }
      });
    });

    const totalTrackedObjects =
      classCounts.person + classCounts.car + classCounts.motorcycle + classCounts.other;

    return {
      totalFrames,
      totalDetections,
      activeAiCount,
      classCounts,
      totalTrackedObjects,
    };
  }, [cameras, cameraStatuses, cameraEvents]);

  const personPercent = metrics.totalTrackedObjects > 0
    ? Math.round((metrics.classCounts.person / metrics.totalTrackedObjects) * 100)
    : 0;

  const vehiclePercent = metrics.totalTrackedObjects > 0
    ? Math.round(((metrics.classCounts.car + metrics.classCounts.motorcycle) / metrics.totalTrackedObjects) * 100)
    : 0;

  return (
    <div className="analytics-page-container">
      {/* 1. Header */}
      <div className="analytics-header">
        <div>
          <h1 className="command-title">SURVEILLANCE ANALYTICS &amp; TELEMETRY</h1>
          <p className="command-subtitle">
            AI frame processing efficiency, detection classification ratios, and infrastructure health
          </p>
        </div>

        <div className="analytics-header-actions">
          <span className="live-engine-tag tech-value">
            YOLOv11 INFERENCE ENGINE // REAL-TIME
          </span>
          <button onClick={fetchAnalyticsData} className="btn btn-secondary btn-sm" title="Refresh Analytics">
            REFRESH
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="kpi-grid">
        <StatCard
          label="FRAMES PROCESSED"
          value={metrics.totalFrames > 0 ? metrics.totalFrames.toLocaleString() : "--"}
          subtext="OPENCV INGESTION"
          code="FPS-25.0"
          tone="info"
        />

        <StatCard
          label="YOLO DETECTIONS"
          value={metrics.totalDetections > 0 ? metrics.totalDetections.toLocaleString() : "--"}
          subtext="TARGETS IDENTIFIED"
          code="CONF-40%+"
          tone="online"
        />

        <StatCard
          label="HUMAN TARGETS"
          value={metrics.classCounts.person}
          subtext={`${personPercent}% OF DETECTIONS`}
          code="CLS-HUMAN"
          tone={metrics.classCounts.person > 0 ? "threat" : "default"}
        />

        <StatCard
          label="VEHICLE TARGETS"
          value={metrics.classCounts.car + metrics.classCounts.motorcycle}
          subtext={`${vehiclePercent}% OF DETECTIONS`}
          code="CLS-VEHICLE"
          tone="warning"
        />
      </div>

      {/* 3. Analytics Grid: Object Breakdown + Hourly Distribution */}
      <div className="analytics-grid">
        {/* Left Card: Object Classification Distribution */}
        <div className="tactical-card analytics-card">
          <div className="card-top-header">
            <span className="tech-value section-tag">OBJECT CLASSIFICATION DISTRIBUTION</span>
            <span className="tech-value text-xs text-muted">REAL DATA FROM CCTV</span>
          </div>

          <div className="analytics-card-body">
            {metrics.totalTrackedObjects === 0 ? (
              <EmptyState
                title="NO OBJECTS LOGGED YET"
                subtitle="Detections will populate this distribution graph as the YOLO worker processes incoming video frames."
              />
            ) : (
              <div className="distribution-bars space-y-4">
                {/* Humans */}
                <div className="dist-item">
                  <div className="dist-meta">
                    <span className="dist-label">HUMANS / PEDESTRIANS</span>
                    <span className="dist-val tech-value">
                      {metrics.classCounts.person} ({personPercent}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill bg-rose-500"
                      style={{ width: `${personPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Cars */}
                <div className="dist-item">
                  <div className="dist-meta">
                    <span className="dist-label">CARS &amp; AUTOMOBILES</span>
                    <span className="dist-val tech-value">
                      {metrics.classCounts.car} ({metrics.totalTrackedObjects > 0 ? Math.round((metrics.classCounts.car / metrics.totalTrackedObjects) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill bg-amber-400"
                      style={{ width: `${metrics.totalTrackedObjects > 0 ? Math.round((metrics.classCounts.car / metrics.totalTrackedObjects) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Motorcycles */}
                <div className="dist-item">
                  <div className="dist-meta">
                    <span className="dist-label">MOTORCYCLES &amp; BICYCLES</span>
                    <span className="dist-val tech-value">
                      {metrics.classCounts.motorcycle} ({metrics.totalTrackedObjects > 0 ? Math.round((metrics.classCounts.motorcycle / metrics.totalTrackedObjects) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill bg-sky-400"
                      style={{ width: `${metrics.totalTrackedObjects > 0 ? Math.round((metrics.classCounts.motorcycle / metrics.totalTrackedObjects) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Other */}
                <div className="dist-item">
                  <div className="dist-meta">
                    <span className="dist-label">OTHER CLASSIFICATIONS</span>
                    <span className="dist-val tech-value">{metrics.classCounts.other}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill bg-slate-500"
                      style={{ width: `${metrics.totalTrackedObjects > 0 ? Math.round((metrics.classCounts.other / metrics.totalTrackedObjects) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Surveillance Pipeline Diagnostics */}
        <div className="tactical-card analytics-card">
          <div className="card-top-header">
            <span className="tech-value section-tag">SURVEILLANCE PIPELINE HEALTH</span>
            <span className="tech-value text-xs text-emerald-400">TELEMETRY ACTIVE</span>
          </div>

          <div className="analytics-card-body">
            <div className="pipeline-specs-grid">
              <div className="spec-row">
                <span className="spec-name">DETECTION MODEL</span>
                <strong className="tech-value">YOLOv11 Nano (yolo11n.pt)</strong>
              </div>
              <div className="spec-row">
                <span className="spec-name">FRAME INGESTION RATE</span>
                <strong className="tech-value">25.0 FPS (REAL-TIME)</strong>
              </div>
              <div className="spec-row">
                <span className="spec-name">MIN CONFIDENCE THRESHOLD</span>
                <strong className="tech-value">0.40 (40%)</strong>
              </div>
              <div className="spec-row">
                <span className="spec-name">OBJECT TRACKING ALGORITHM</span>
                <strong className="tech-value">Centroid Distance Tracker</strong>
              </div>
              <div className="spec-row">
                <span className="spec-name">STREAM PROTOCOL</span>
                <strong className="tech-value">MJPEG over HTTP (Multipart)</strong>
              </div>
              <div className="spec-row">
                <span className="spec-name">ACTIVE AI WORKERS</span>
                <strong className="tech-value text-sky-400">{metrics.activeAiCount} / {cameras.length} CAMERAS</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Per-Camera Infrastructure Telemetry Table */}
      <div className="tactical-card camera-telemetry-card">
        <div className="card-top-header">
          <span className="tech-value section-tag">PER-CAMERA AI INGESTION HEALTH</span>
          <span className="tech-value text-xs text-muted">{cameras.length} UNITS MONITORED</span>
        </div>

        <div className="table-responsive">
          <table className="tactical-events-table">
            <thead>
              <tr>
                <th>UNIT ID</th>
                <th>CAMERA NAME</th>
                <th>SECTOR</th>
                <th>SOURCE</th>
                <th>FRAMES</th>
                <th>DETECTIONS</th>
                <th>TRACKS</th>
                <th>PIPELINE STATE</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((c) => {
                const status = cameraStatuses[c.id];
                const isRunning = status?.running;

                return (
                  <tr key={c.id}>
                    <td className="tech-value text-sky-400 font-bold">
                      CAM-{String(c.id).padStart(3, "0")}
                    </td>
                    <td className="font-semibold">{c.name}</td>
                    <td>{c.location}</td>
                    <td className="tech-value text-muted">{c.source_type}</td>
                    <td className="tech-value">{status?.frame_count || status?.frame_number || "--"}</td>
                    <td className="tech-value text-emerald-400 font-bold">{status?.total_detections ?? "--"}</td>
                    <td className="tech-value text-sky-400">{status?.active_tracks ?? 0}</td>
                    <td>
                      <StatusBadge
                        status={isRunning ? "ONLINE" : "STANDBY"}
                        label={isRunning ? "AI PROCESSING" : "STANDBY"}
                        size="sm"
                        showDot={true}
                        pulse={isRunning}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
