/**
 * AVEKSHA NETRA — Tactical Camera Management Wall
 * Multi-camera surveillance wall and IP CCTV infrastructure configuration.
 */

import React, { useState, useEffect } from "react";
import { useSystem } from "../context/SystemContext";
import { camerasApi, aiApi } from "../api";
import CameraCard from "../components/surveillance/CameraCard";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import "./CameraManagement.css";

export function CameraManagement() {
  const { cameras, camerasLoading, refreshCameras } = useSystem();

  // Mode: 'wall' (Surveillance Grid) | 'config' (Camera CRUD & RTSP Testing)
  const [activeTab, setActiveTab] = useState("wall");

  // Form State
  const [cameraName, setCameraName] = useState("");
  const [location, setLocation] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [editingCameraId, setEditingCameraId] = useState(null);

  // Form Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [formFeedback, setFormFeedback] = useState(null); // { type: 'success' | 'error', message }

  // Telemetry map for camera wall
  const [cameraStatusMap, setCameraStatusMap] = useState({});

  // Poll camera statuses for the wall
  useEffect(() => {
    let isMounted = true;
    const updateStatuses = async () => {
      if (!cameras || cameras.length === 0) return;
      for (const cam of cameras) {
        try {
          const status = await aiApi.getCameraStatus(cam.id);
          if (isMounted) {
            setCameraStatusMap((prev) => ({ ...prev, [cam.id]: status }));
          }
        } catch {}
      }
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [cameras]);

  // Handle AI status toggle on camera card
  const handleStatusChange = (camId, isRunning) => {
    setCameraStatusMap((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], running: isRunning },
    }));
  };

  // Reset Form
  const resetForm = () => {
    setCameraName("");
    setLocation("");
    setRtspUrl("");
    setEditingCameraId(null);
    setTestResult(null);
    setFormFeedback(null);
  };

  // Pre-fill Form for Edit
  const handleEdit = (camera) => {
    setEditingCameraId(camera.id);
    setCameraName(camera.name);
    setLocation(camera.location);
    setRtspUrl(camera.rtsp_url || "");
    setActiveTab("config");
    setTestResult(null);
    setFormFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Test RTSP Connection via OpenCV
  const handleTestConnection = async () => {
    if (!rtspUrl.trim()) {
      setFormFeedback({ type: "error", message: "Please provide an RTSP Stream URL to test." });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setFormFeedback(null);

    try {
      const res = await camerasApi.testConnection({
        name: cameraName || "Test Stream",
        location: location || "Test Sector",
        rtsp_url: rtspUrl.trim(),
      });

      setTestResult(res);
      if (res.connected) {
        setFormFeedback({
          type: "success",
          message: `Stream Verified! Resolution: ${res.width} × ${res.height}`,
        });
      } else {
        setFormFeedback({
          type: "error",
          message: res.message || "Failed to establish OpenCV video capture from this source.",
        });
      }
    } catch (err) {
      setFormFeedback({
        type: "error",
        message: err.message || "Network error while validating RTSP stream.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Submit Add / Edit Camera
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cameraName.trim() || !location.trim() || !rtspUrl.trim()) {
      setFormFeedback({ type: "error", message: "All camera metadata fields are required." });
      return;
    }

    setIsSubmitting(true);
    setFormFeedback(null);

    try {
      const payload = {
        name: cameraName.trim(),
        location: location.trim(),
        rtsp_url: rtspUrl.trim(),
      };

      if (editingCameraId) {
        await camerasApi.updateCamera(editingCameraId, payload);
        setFormFeedback({ type: "success", message: `Camera #${editingCameraId} updated successfully!` });
      } else {
        await camerasApi.createCamera(payload);
        setFormFeedback({ type: "success", message: "New surveillance camera registered into network!" });
      }

      await refreshCameras();
      resetForm();
      setActiveTab("wall");
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to save camera." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Camera
  const handleDelete = async (camera) => {
    const confirmDelete = window.confirm(
      `Confirm Decommission: Remove "${camera.name}" (CAM-${String(camera.id).padStart(3, "0")})?\n\nThis stops any active AI pipeline on this camera.`
    );
    if (!confirmDelete) return;

    try {
      await camerasApi.deleteCamera(camera.id);
      await refreshCameras();
      if (editingCameraId === camera.id) resetForm();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div className="camera-management-container">
      {/* 1. Header & View Toggle */}
      <div className="cameras-page-header">
        <div>
          <h1 className="command-title">SURVEILLANCE CAMERAS</h1>
          <p className="command-subtitle">
            IP CCTV infrastructure control, live video matrix, and stream testing
          </p>
        </div>

        <div className="cameras-header-controls">
          <div className="view-mode-tabs">
            <button
              onClick={() => setActiveTab("wall")}
              className={`view-tab-btn ${activeTab === "wall" ? "active" : ""}`}
            >
              <span>▣</span> CAMERA WALL ({cameras.length})
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`view-tab-btn ${activeTab === "config" ? "active" : ""}`}
            >
              <span>⚙️</span> CONFIGURE INFRASTRUCTURE
            </button>
          </div>

          <button onClick={refreshCameras} className="btn btn-secondary btn-sm" title="Refresh List">
            REFRESH
          </button>
        </div>
      </div>

      {/* 2. Feedback Banners */}
      {formFeedback && (
        <div className={`tactical-banner ${formFeedback.type}`}>
          <div className="banner-icon">
            {formFeedback.type === "success" ? "✓" : "⚠"}
          </div>
          <div className="banner-text">{formFeedback.message}</div>
          <button onClick={() => setFormFeedback(null)} className="btn-banner-close">✕</button>
        </div>
      )}

      {/* 3. TAB 1: CAMERA WALL (Live Video Matrix) */}
      {activeTab === "wall" && (
        <div className="camera-wall-view">
          {camerasLoading ? (
            <div className="cameras-loading-state">
              <div className="feed-radar-spinner"></div>
              <p>CONNECTING TO SURVEILLANCE STREAMS...</p>
            </div>
          ) : cameras.length === 0 ? (
            <EmptyState
              title="NO ACTIVE SURVEILLANCE STREAMS"
              subtitle="The surveillance matrix is currently empty. Register an IP camera or demo file source."
              actionLabel="Add First Camera"
              onAction={() => setActiveTab("config")}
            />
          ) : (
            <div className="camera-wall-grid">
              {cameras.map((camera) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  aiStatus={cameraStatusMap[camera.id]}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: CONFIGURE INFRASTRUCTURE (Form + Table) */}
      {activeTab === "config" && (
        <div className="camera-config-view">
          {/* Registration / Edit Form */}
          <div className="tactical-card form-card">
            <div className="card-top-header">
              <span className="tech-value section-tag">
                {editingCameraId ? `EDITING CAM-${String(editingCameraId).padStart(3, "0")}` : "NEW CAMERA REGISTRATION"}
              </span>
              {editingCameraId && (
                <button onClick={resetForm} className="btn btn-secondary btn-sm">
                  CANCEL EDIT
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="tactical-form">
              <div className="form-grid">
                <div className="form-field">
                  <label>CAMERA IDENTIFIER / NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. Test Camera 01, Perimeter Alpha"
                    value={cameraName}
                    onChange={(e) => setCameraName(e.target.value)}
                    className="tactical-input"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>SECTOR / PHYSICAL LOCATION</label>
                  <input
                    type="text"
                    placeholder="e.g. Demo Gate, Northern Border Sector 4"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="tactical-input"
                    required
                  />
                </div>

                <div className="form-field full-width">
                  <label>RTSP STREAM URL OR VIDEO SOURCE</label>
                  <div className="input-with-action">
                    <input
                      type="text"
                      placeholder="e.g. rtsp://admin:pass@192.168.1.100:554/stream1 or FILE"
                      value={rtspUrl}
                      onChange={(e) => setRtspUrl(e.target.value)}
                      className="tactical-input tech-value"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !rtspUrl.trim()}
                      className="btn btn-secondary btn-sm btn-test-rtsp"
                    >
                      {isTesting ? "TESTING..." : "TEST OPENCV"}
                    </button>
                  </div>
                  <span className="field-hint">
                    Supports live RTSP IP CCTV feeds or local media stream.
                  </span>
                </div>
              </div>

              {testResult && (
                <div className={`rtsp-test-badge ${testResult.connected ? "success" : "failed"}`}>
                  <span className="badge-dot"></span>
                  <span className="mono">
                    {testResult.connected
                      ? `SIGNAL VERIFIED // RESOLUTION ${testResult.width}x${testResult.height}`
                      : `SIGNAL FAILED // ${testResult.message}`}
                  </span>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting
                    ? "SAVING..."
                    : editingCameraId
                    ? "UPDATE CAMERA CONFIGURATION"
                    : "REGISTER CAMERA TO NETWORK"}
                </button>
              </div>
            </form>
          </div>

          {/* Registered Cameras Table */}
          <div className="tactical-card inventory-card">
            <div className="card-top-header">
              <span className="tech-value section-tag">SURVEILLANCE CAMERA INVENTORY</span>
              <span className="tech-value text-muted text-xs">{cameras.length} UNITS CONFIGURED</span>
            </div>

            <div className="table-responsive">
              <table className="tactical-events-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>CAMERA NAME</th>
                    <th>LOCATION</th>
                    <th>SOURCE TYPE</th>
                    <th>STREAM URL</th>
                    <th>AI ENGINE</th>
                    <th style={{ textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.map((c) => (
                    <tr key={c.id}>
                      <td className="tech-value text-sky-400 font-bold">
                        CAM-{String(c.id).padStart(3, "0")}
                      </td>
                      <td className="font-semibold">{c.name}</td>
                      <td>{c.location}</td>
                      <td className="tech-value text-muted">{c.source_type}</td>
                      <td className="tech-value text-muted url-cell">{c.rtsp_url}</td>
                      <td>
                        <StatusBadge
                          status={cameraStatusMap[c.id]?.running ? "ONLINE" : "STANDBY"}
                          size="sm"
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button
                            onClick={() => handleEdit(c)}
                            className="btn btn-secondary btn-sm"
                            title="Edit Camera Metadata"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="btn btn-danger btn-sm"
                            title="Remove Camera"
                          >
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraManagement;