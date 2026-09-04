/**
 * AVEKSHA NETRA — Tactical Surveillance Event Monitor
 * Complete chronological audit log of all YOLO detections and object tracks.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSystem } from "../context/SystemContext";
import { aiApi } from "../api";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import "./Events.css";

export function Events() {
  const { cameras } = useSystem();
  const [cameraEvents, setCameraEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [cameraFilter, setCameraFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch events from all cameras
  const fetchAllEvents = useCallback(async () => {
    if (!cameras || cameras.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const map = {};
      for (const cam of cameras) {
        try {
          const res = await aiApi.getCameraEvents(cam.id);
          map[cam.id] = Array.isArray(res?.events) ? res.events : [];
        } catch {
          map[cam.id] = [];
        }
      }
      setCameraEvents(map);
    } finally {
      setLoading(false);
    }
  }, [cameras]);

  useEffect(() => {
    fetchAllEvents();
    const timer = setInterval(fetchAllEvents, 4000);
    return () => clearInterval(timer);
  }, [fetchAllEvents]);

  // Flatten and normalize events
  const allEvents = useMemo(() => {
    const list = [];
    cameras.forEach((cam) => {
      const events = cameraEvents[cam.id] || [];
      events.forEach((ev, idx) => {
        const objType = String(ev.object_type || "unknown").toLowerCase().trim();
        const eventId = `EV-${String(cam.id).padStart(2, "0")}-${ev.track_id || idx + 1}`;

        let severity = "LOW";
        if (["person", "human"].includes(objType)) severity = "HIGH";
        else if (["car", "truck", "bus"].includes(objType)) severity = "MEDIUM";

        list.push({
          id: eventId,
          rawId: ev.id || idx,
          camera_id: cam.id,
          camera_name: cam.name,
          location: cam.location,
          object_type: objType,
          eventType: (ev.type || "DETECTION").replace(/_/g, " "),
          track_id: ev.track_id != null ? `#${ev.track_id}` : "--",
          confidence: ev.confidence ? `${Math.round(ev.confidence * 100)}%` : "--",
          timestamp: ev.timestamp || ev.first_seen || new Date().toISOString(),
          status: ev.status || "COMPLETED",
          severity,
        });
      });
    });

    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [cameras, cameraEvents]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (typeFilter !== "ALL" && ev.object_type !== typeFilter.toLowerCase()) {
        return false;
      }
      if (cameraFilter !== "ALL" && String(ev.camera_id) !== String(cameraFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ev.id.toLowerCase().includes(q) ||
          ev.object_type.toLowerCase().includes(q) ||
          ev.location.toLowerCase().includes(q) ||
          ev.camera_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allEvents, typeFilter, cameraFilter, searchQuery]);

  return (
    <div className="events-monitor-container">
      {/* 1. Header */}
      <div className="events-header">
        <div>
          <h1 className="command-title">SURVEILLANCE EVENT LOG</h1>
          <p className="command-subtitle">
            Chronological audit trail of all AI visual detections and object trajectories
          </p>
        </div>

        <div className="events-header-meta">
          <span className="total-events-tag tech-value">
            {allEvents.length} TOTAL EVENTS LOGGED
          </span>
          <button onClick={fetchAllEvents} className="btn btn-secondary btn-sm" title="Refresh Audit Log">
            REFRESH LOG
          </button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="events-filter-bar">
        <div className="events-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search by event ID, classification, or sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tactical-input"
          />
        </div>

        <div className="events-select-group">
          {/* Object Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="tactical-input events-select"
          >
            <option value="ALL">ALL DETECTIONS</option>
            <option value="PERSON">PERSONS ONLY</option>
            <option value="CAR">VEHICLES (CARS)</option>
            <option value="MOTORCYCLE">MOTORCYCLES</option>
          </select>

          {/* Camera Filter */}
          <select
            value={cameraFilter}
            onChange={(e) => setCameraFilter(e.target.value)}
            className="tactical-input events-select"
          >
            <option value="ALL">ALL CAMERAS</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                CAM-{String(c.id).padStart(3, "0")} ({c.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Event Log Table */}
      <div className="events-table-wrapper">
        {loading ? (
          <div className="events-loading-state">
            <div className="feed-radar-spinner"></div>
            <p>SYNCING EVENT DATABASE...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="NO EVENTS LOGGED"
            subtitle="The AI worker has not recorded any movement or object detections matching this filter."
            actionLabel="Reset Filters"
            onAction={() => {
              setTypeFilter("ALL");
              setCameraFilter("ALL");
              setSearchQuery("");
            }}
          />
        ) : (
          <div className="table-responsive">
            <table className="tactical-events-table">
              <thead>
                <tr>
                  <th>EVENT ID</th>
                  <th>TIMESTAMP</th>
                  <th>CAMERA / SECTOR</th>
                  <th>OBJECT CLASS</th>
                  <th>TRACK ID</th>
                  <th>CONFIDENCE</th>
                  <th>SEVERITY</th>
                  <th>LIFECYCLE</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev) => {
                  const formattedTime = new Date(ev.timestamp).toLocaleTimeString("en-US", {
                    hour12: false,
                  });

                  return (
                    <tr key={ev.id}>
                      <td className="tech-value event-id-cell">{ev.id}</td>

                      <td className="tech-value time-cell">{formattedTime}</td>

                      <td>
                        <div className="cam-name">{ev.camera_name}</div>
                        <div className="cam-location tech-value">
                          CAM-{String(ev.camera_id).padStart(3, "0")} // {ev.location}
                        </div>
                      </td>

                      <td>
                        <span className="object-chip tech-value">
                          {ev.object_type.toUpperCase()}
                        </span>
                      </td>

                      <td className="tech-value track-cell">{ev.track_id}</td>

                      <td className="tech-value conf-cell">{ev.confidence}</td>

                      <td>
                        <StatusBadge
                          status={ev.severity === "HIGH" ? "threat" : "info"}
                          label={ev.severity}
                          size="sm"
                          showDot={false}
                        />
                      </td>

                      <td>
                        <span className="status-lifecycle tech-value">{ev.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Events;
