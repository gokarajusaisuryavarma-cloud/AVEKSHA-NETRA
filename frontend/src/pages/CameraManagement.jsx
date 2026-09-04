/**
 * AVEKSHA NETRA — Tactical Camera Management Wall & Intelligence Registry
 * Multi-camera surveillance wall, Virtual Fence Zones, and Face/ANPR Registry.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useSystem } from "../context/SystemContext";
import { camerasApi, aiApi, zonesApi, facesApi, watchlistApi } from "../api";
import CameraCard from "../components/surveillance/CameraCard";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import "./CameraManagement.css";

const ZONE_PRESETS = {
  CENTER_BOX: {
    label: "Center Vault Area",
    points: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]],
  },
  PERIMETER_FENCE: {
    label: "Perimeter Boundary",
    points: [[0.05, 0.1], [0.95, 0.1], [0.95, 0.9], [0.05, 0.9]],
  },
  LEFT_CORRIDOR: {
    label: "Left Gateway Corridor",
    points: [[0.0, 0.2], [0.4, 0.2], [0.4, 0.8], [0.0, 0.8]],
  },
  RIGHT_ENTRY: {
    label: "Right Entrance Gate",
    points: [[0.6, 0.2], [1.0, 0.2], [1.0, 0.8], [0.6, 0.8]],
  },
};

export function CameraManagement() {
  const { cameras, camerasLoading, refreshCameras } = useSystem();

  // Mode: 'wall' | 'zones' | 'registry' | 'config'
  const [activeTab, setActiveTab] = useState("wall");

  // Camera Config Form State
  const [cameraName, setCameraName] = useState("");
  const [location, setLocation] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [editingCameraId, setEditingCameraId] = useState(null);

  // Form Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [formFeedback, setFormFeedback] = useState(null);

  // Telemetry map for camera wall
  const [cameraStatusMap, setCameraStatusMap] = useState({});

  // ============================================================
  // VIRTUAL FENCE ZONES STATE
  // ============================================================
  const [selectedZoneCamId, setSelectedZoneCamId] = useState(cameras[0]?.id || 1);
  const [zonesList, setZonesList] = useState([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneType, setNewZoneType] = useState("RESTRICTED");
  const [newZoneSeverity, setNewZoneSeverity] = useState("CRITICAL");
  const [newZonePoints, setNewZonePoints] = useState(
    JSON.stringify(ZONE_PRESETS.CENTER_BOX.points)
  );

  // ============================================================
  // FACE & ANPR REGISTRY STATE
  // ============================================================
  const [registrySubTab, setRegistrySubTab] = useState("faces"); // 'faces' | 'plates'
  const [facesList, setFacesList] = useState([]);
  const [newFaceName, setNewFaceName] = useState("");
  const [newFaceRole, setNewFaceRole] = useState("Security Officer");
  const [newFaceDept, setNewFaceDept] = useState("Surveillance");
  const [newFaceNotes, setNewFaceNotes] = useState("");
  const [newFaceImageB64, setNewFaceImageB64] = useState("");
  const [facePreview, setFacePreview] = useState(null);

  const [watchlist, setWatchlist] = useState([]);
  const [newPlateNum, setNewPlateNum] = useState("");
  const [newPlateCategory, setNewPlateCategory] = useState("SUSPICIOUS");
  const [newPlateOwner, setNewPlateOwner] = useState("");
  const [newPlateDesc, setNewPlateDesc] = useState("");
  const [newPlateNotes, setNewPlateNotes] = useState("");

  // Sync selected camera for zones when cameras load
  useEffect(() => {
    if (cameras.length > 0 && !selectedZoneCamId) {
      setSelectedZoneCamId(cameras[0].id);
    }
  }, [cameras, selectedZoneCamId]);

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

  // Fetch Zones for selected camera
  const loadZones = useCallback(async (camId) => {
    if (!camId) return;
    try {
      const data = await zonesApi.getZones(camId);
      setZonesList(Array.isArray(data) ? data : []);
    } catch {
      setZonesList([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "zones" && selectedZoneCamId) {
      loadZones(selectedZoneCamId);
    }
  }, [activeTab, selectedZoneCamId, loadZones]);

  // Fetch Faces & Watchlist
  const loadRegistry = useCallback(async () => {
    try {
      const [fData, wData] = await Promise.all([
        facesApi.getFaces(),
        watchlistApi.getWatchlist(),
      ]);
      setFacesList(Array.isArray(fData) ? fData : []);
      setWatchlist(Array.isArray(wData) ? wData : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === "registry") {
      loadRegistry();
    }
  }, [activeTab, loadRegistry]);

  // ============================================================
  // ZONE HANDLERS
  // ============================================================
  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!newZoneName.trim()) {
      setFormFeedback({ type: "error", message: "Zone name is required." });
      return;
    }
    try {
      JSON.parse(newZonePoints);
    } catch {
      setFormFeedback({ type: "error", message: "Invalid polygon points JSON." });
      return;
    }

    try {
      await zonesApi.createZone(selectedZoneCamId, {
        camera_id: Number(selectedZoneCamId),
        name: newZoneName.trim(),
        zone_type: newZoneType,
        polygon_points: newZonePoints,
        alert_severity: newZoneSeverity,
        is_active: true,
      });
      setFormFeedback({ type: "success", message: `Zone "${newZoneName}" created successfully!` });
      setNewZoneName("");
      loadZones(selectedZoneCamId);
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to create zone." });
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!window.confirm("Remove this virtual fence zone?")) return;
    try {
      await zonesApi.deleteZone(selectedZoneCamId, zoneId);
      loadZones(selectedZoneCamId);
      setFormFeedback({ type: "success", message: "Zone deleted successfully." });
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to delete zone." });
    }
  };

  // ============================================================
  // FACE HANDLERS
  // ============================================================
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setNewFaceImageB64(reader.result);
      setFacePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterFace = async (e) => {
    e.preventDefault();
    if (!newFaceName.trim()) {
      setFormFeedback({ type: "error", message: "Person name is required." });
      return;
    }
    if (!newFaceImageB64) {
      setFormFeedback({ type: "error", message: "Face photo is required for embedding extraction." });
      return;
    }

    try {
      setIsSubmitting(true);
      await facesApi.registerFace({
        name: newFaceName.trim(),
        role: newFaceRole.trim(),
        department: newFaceDept.trim(),
        image_base64: newFaceImageB64,
        notes: newFaceNotes.trim(),
      });
      setFormFeedback({ type: "success", message: `Face registered for ${newFaceName}!` });
      setNewFaceName("");
      setNewFaceNotes("");
      setNewFaceImageB64("");
      setFacePreview(null);
      loadRegistry();
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to register face." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFace = async (faceId) => {
    if (!window.confirm("Remove this person from the face recognition database?")) return;
    try {
      await facesApi.deleteFace(faceId);
      loadRegistry();
      setFormFeedback({ type: "success", message: "Personnel removed from face registry." });
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to delete face." });
    }
  };

  // ============================================================
  // ANPR WATCHLIST HANDLERS
  // ============================================================
  const handleAddWatchlist = async (e) => {
    e.preventDefault();
    if (!newPlateNum.trim()) {
      setFormFeedback({ type: "error", message: "License plate number is required." });
      return;
    }

    try {
      setIsSubmitting(true);
      await watchlistApi.addEntry({
        plate_number: newPlateNum.trim().toUpperCase(),
        category: newPlateCategory,
        owner_name: newPlateOwner.trim(),
        vehicle_description: newPlateDesc.trim(),
        notes: newPlateNotes.trim(),
      });
      setFormFeedback({ type: "success", message: `Plate ${newPlateNum.toUpperCase()} added to watchlist!` });
      setNewPlateNum("");
      setNewPlateOwner("");
      setNewPlateDesc("");
      setNewPlateNotes("");
      loadRegistry();
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to save watchlist entry." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWatchlist = async (entryId) => {
    if (!window.confirm("Remove vehicle from watchlist?")) return;
    try {
      await watchlistApi.deleteEntry(entryId);
      loadRegistry();
      setFormFeedback({ type: "success", message: "Entry removed from watchlist." });
    } catch (err) {
      setFormFeedback({ type: "error", message: err.message || "Failed to delete entry." });
    }
  };

  // ============================================================
  // CAMERA CRUD HANDLERS
  // ============================================================
  const handleStatusChange = (camId, isRunning) => {
    setCameraStatusMap((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], running: isRunning },
    }));
  };

  const resetForm = () => {
    setCameraName("");
    setLocation("");
    setRtspUrl("");
    setEditingCameraId(null);
    setTestResult(null);
    setFormFeedback(null);
  };

  const handleEdit = (camera) => {
    setEditingCameraId(camera.id);
    setCameraName(camera.name);
    setLocation(camera.location);
    setRtspUrl(camera.rtsp_url);
    setActiveTab("config");
    setTestResult(null);
    setFormFeedback(null);
  };

  const handleTestConnection = async () => {
    if (!rtspUrl.trim()) {
      setFormFeedback({ type: "error", message: "Please provide a valid RTSP URL or media path to test." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await camerasApi.testConnection(rtspUrl.trim());
      setTestResult(res);
    } catch (err) {
      setTestResult({
        connected: false,
        message: err.message || "Connection test failed.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmitCamera = async (e) => {
    e.preventDefault();
    if (!cameraName.trim() || !location.trim() || !rtspUrl.trim()) {
      setFormFeedback({ type: "error", message: "All fields are required." });
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
            IP CCTV infrastructure control, Virtual-Fence zones, and SIH AI registries
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
              onClick={() => setActiveTab("zones")}
              className={`view-tab-btn ${activeTab === "zones" ? "active" : ""}`}
            >
              <span>📐</span> VIRTUAL FENCE ZONES
            </button>
            <button
              onClick={() => setActiveTab("registry")}
              className={`view-tab-btn ${activeTab === "registry" ? "active" : ""}`}
            >
              <span>🗂️</span> FACE & ANPR REGISTRY
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`view-tab-btn ${activeTab === "config" ? "active" : ""}`}
            >
              <span>⚙️</span> CONFIGURE CAMERAS
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
              <p>LOADING CCTV NETWORK STREAMS...</p>
            </div>
          ) : cameras.length === 0 ? (
            <EmptyState
              title="NO SURVEILLANCE CAMERAS IN NETWORK"
              subtitle="Register your first IP camera or local test video to begin monitoring."
              actionLabel="Add Camera"
              onAction={() => setActiveTab("config")}
            />
          ) : (
            <div className="cameras-matrix-grid">
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

      {/* 4. TAB 2: VIRTUAL FENCE ZONES */}
      {activeTab === "zones" && (
        <div className="camera-config-layout">
          {/* Active Zones List */}
          <div className="tactical-card inventory-card">
            <div className="card-top-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="tech-value section-tag">ACTIVE RESTRICTED ZONES</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="text-xs text-muted">SELECT CAMERA:</span>
                <select
                  value={selectedZoneCamId}
                  onChange={(e) => setSelectedZoneCamId(Number(e.target.value))}
                  className="tactical-input select-input"
                  style={{ width: "auto", padding: "4px 8px" }}
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      CAM-{String(c.id).padStart(3, "0")} ({c.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ padding: "16px" }}>
              {zonesList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>📐</div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>NO VIRTUAL FENCE ZONES DEFINED</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    Configure polygonal perimeter boundaries using the form on the right.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {zonesList.map((z) => (
                    <div
                      key={z.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "6px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ color: "var(--text-main)", fontSize: "14px" }}>{z.name}</strong>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              background: z.alert_severity === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                              color: z.alert_severity === "CRITICAL" ? "#ef4444" : "#f59e0b",
                              fontWeight: 700,
                            }}
                          >
                            {z.alert_severity}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }} className="tech-value">
                          TYPE: {z.zone_type} | POINTS: {z.polygon_points?.slice(0, 40)}...
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteZone(z.id)}
                        className="btn btn-danger btn-sm"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Zone Form */}
          <div className="tactical-card camera-form-card">
            <div className="card-top-header">
              <span className="tech-value section-tag">DEFINE RESTRICTED BOUNDARY</span>
              <span className="tech-value text-muted text-xs">SHAPELY POLYGON</span>
            </div>

            <form onSubmit={handleCreateZone} className="tactical-form">
              <div className="form-field">
                <label className="field-label">ZONE NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Vault Perimeter North"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="tactical-input"
                  required
                />
              </div>

              <div className="form-field">
                <label className="field-label">ZONE BEHAVIOR TYPE</label>
                <select
                  value={newZoneType}
                  onChange={(e) => setNewZoneType(e.target.value)}
                  className="tactical-input select-input"
                >
                  <option value="RESTRICTED">RESTRICTED (General Perimeter)</option>
                  <option value="VIRTUAL_FENCE">VIRTUAL_FENCE (Tripwire / Boundary)</option>
                  <option value="NO_ENTRY">NO_ENTRY (High-Security Vault)</option>
                </select>
              </div>

              <div className="form-field">
                <label className="field-label">ALERT SEVERITY</label>
                <select
                  value={newZoneSeverity}
                  onChange={(e) => setNewZoneSeverity(e.target.value)}
                  className="tactical-input select-input"
                >
                  <option value="CRITICAL">CRITICAL (Immediate Threat)</option>
                  <option value="HIGH">HIGH (Standard Intrusion)</option>
                </select>
              </div>

              <div className="form-field">
                <label className="field-label">QUICK GEOMETRY PRESETS</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {Object.entries(ZONE_PRESETS).map(([k, p]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNewZonePoints(JSON.stringify(p.points))}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "10px", padding: "4px" }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">POLYGON COORDINATES (NORMALIZED [0.0, 1.0])</label>
                <textarea
                  value={newZonePoints}
                  onChange={(e) => setNewZonePoints(e.target.value)}
                  className="tactical-input"
                  style={{ height: "70px", fontFamily: "monospace", fontSize: "11px" }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                ACTIVATE VIRTUAL FENCE ZONE
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. TAB 3: FACE & ANPR REGISTRY */}
      {activeTab === "registry" && (
        <div className="camera-config-layout">
          {/* Sub-tab Navigation */}
          <div className="tactical-card inventory-card">
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", background: "rgba(10, 15, 22, 0.4)" }}>
              <button
                onClick={() => setRegistrySubTab("faces")}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontWeight: 600,
                  fontSize: "12px",
                  border: "none",
                  borderBottom: registrySubTab === "faces" ? "2px solid var(--primary, #06b6d4)" : "2px solid transparent",
                  background: "transparent",
                  color: registrySubTab === "faces" ? "var(--primary, #06b6d4)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                👤 PERSONNEL FACE ID ({facesList.length})
              </button>
              <button
                onClick={() => setRegistrySubTab("plates")}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontWeight: 600,
                  fontSize: "12px",
                  border: "none",
                  borderBottom: registrySubTab === "plates" ? "2px solid var(--primary, #06b6d4)" : "2px solid transparent",
                  background: "transparent",
                  color: registrySubTab === "plates" ? "var(--primary, #06b6d4)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                🚗 ANPR VEHICLE WATCHLIST ({watchlist.length})
              </button>
            </div>

            {/* Content for Faces */}
            {registrySubTab === "faces" ? (
              <div style={{ padding: "16px" }}>
                {facesList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>👤</div>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>NO REGISTERED PERSONNEL</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      Upload a facial photo on the right to extract SFace embeddings.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {facesList.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: "rgba(15, 23, 42, 0.6)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "6px",
                        }}
                      >
                        <div>
                          <strong style={{ color: "var(--text-main)" }}>{f.name}</strong>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }} className="tech-value">
                            ROLE: {f.role} | DEPT: {f.department}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFace(f.id)}
                          className="btn btn-danger btn-sm"
                        >
                          DELETE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Content for Plates */
              <div style={{ padding: "16px" }}>
                {watchlist.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🚗</div>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>NO WATCHLIST PLATES RECORDED</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      Register suspicious or authorized vehicle plates using the form.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {watchlist.map((w) => (
                      <div
                        key={w.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: "rgba(15, 23, 42, 0.6)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "6px",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong className="tech-value" style={{ color: "var(--primary, #06b6d4)", fontSize: "13px" }}>
                              {w.plate_number}
                            </strong>
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "3px",
                                background: w.category === "ALLOWED" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                color: w.category === "ALLOWED" ? "#10b981" : "#ef4444",
                                fontWeight: 700,
                              }}
                            >
                              {w.category}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {w.owner_name && <span>OWNER: {w.owner_name} | </span>}
                            {w.vehicle_description || "No description"}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteWatchlist(w.id)}
                          className="btn btn-danger btn-sm"
                        >
                          DELETE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form for Face or Watchlist */}
          <div className="tactical-card camera-form-card">
            {registrySubTab === "faces" ? (
              <>
                <div className="card-top-header">
                  <span className="tech-value section-tag">REGISTER KNOWN PERSON</span>
                  <span className="tech-value text-muted text-xs">YUNET + SFACE</span>
                </div>
                <form onSubmit={handleRegisterFace} className="tactical-form">
                  <div className="form-field">
                    <label className="field-label">FULL NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. Inspector Surya Varma"
                      value={newFaceName}
                      onChange={(e) => setNewFaceName(e.target.value)}
                      className="tactical-input"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">DESIGNATED ROLE</label>
                    <input
                      type="text"
                      placeholder="e.g. Surveillance Commander / Security Lead"
                      value={newFaceRole}
                      onChange={(e) => setNewFaceRole(e.target.value)}
                      className="tactical-input"
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">DEPARTMENT</label>
                    <input
                      type="text"
                      placeholder="e.g. Cyber Crime & Surveillance Unit"
                      value={newFaceDept}
                      onChange={(e) => setNewFaceDept(e.target.value)}
                      className="tactical-input"
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">FACIAL PHOTO (JPEG/PNG)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="tactical-input"
                      required
                    />
                    {facePreview && (
                      <div style={{ marginTop: "8px", textAlign: "center" }}>
                        <img
                          src={facePreview}
                          alt="Face preview"
                          style={{ maxHeight: "90px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    {isSubmitting ? "EXTRACTING EMBEDDING..." : "ENROLL FACIAL IDENTITY"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="card-top-header">
                  <span className="tech-value section-tag">ADD VEHICLE TO WATCHLIST</span>
                  <span className="tech-value text-muted text-xs">EASYOCR ANPR</span>
                </div>
                <form onSubmit={handleAddWatchlist} className="tactical-form">
                  <div className="form-field">
                    <label className="field-label">REGISTRATION PLATE NUMBER</label>
                    <input
                      type="text"
                      placeholder="e.g. DL01AB1234 or MH12DE5678"
                      value={newPlateNum}
                      onChange={(e) => setNewPlateNum(e.target.value)}
                      className="tactical-input"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">WATCHLIST CLASSIFICATION</label>
                    <select
                      value={newPlateCategory}
                      onChange={(e) => setNewPlateCategory(e.target.value)}
                      className="tactical-input select-input"
                    >
                      <option value="SUSPICIOUS">SUSPICIOUS (Alert upon detection)</option>
                      <option value="STOLEN">STOLEN (Critical Threat Alert)</option>
                      <option value="RESTRICTED">RESTRICTED (No Entry Zone)</option>
                      <option value="ALLOWED">ALLOWED (Authorized Access)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label">REGISTERED OWNER</label>
                    <input
                      type="text"
                      placeholder="e.g. Fleet Logistics / John Doe"
                      value={newPlateOwner}
                      onChange={(e) => setNewPlateOwner(e.target.value)}
                      className="tactical-input"
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">VEHICLE DESCRIPTION</label>
                    <input
                      type="text"
                      placeholder="e.g. White Toyota Fortuner / Blue Sedan"
                      value={newPlateDesc}
                      onChange={(e) => setNewPlateDesc(e.target.value)}
                      className="tactical-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    {isSubmitting ? "SAVING ENTRY..." : "ADD TO ANPR WATCHLIST"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 4: CONFIGURE CAMERAS */}
      {activeTab === "config" && (
        <div className="camera-config-layout">
          <div className="tactical-card camera-form-card">
            <div className="card-top-header">
              <span className="tech-value section-tag">
                {editingCameraId ? `EDIT CAM-${String(editingCameraId).padStart(3, "0")}` : "ADD NEW CAMERA"}
              </span>
              <span className="tech-value text-muted text-xs">RTSP / LOCAL FILE</span>
            </div>

            <form onSubmit={handleSubmitCamera} className="tactical-form">
              <div className="form-field">
                <label className="field-label">CAMERA IDENTIFIER / NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Entrance Gate Alpha"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  className="tactical-input"
                  required
                />
              </div>

              <div className="form-field">
                <label className="field-label">SECTOR / FACILITY LOCATION</label>
                <input
                  type="text"
                  placeholder="e.g. Perimeter Gate 2 - North Wing"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="tactical-input"
                  required
                />
              </div>

              <div className="form-field">
                <label className="field-label">RTSP STREAM OR FILE PATH</label>
                <input
                  type="text"
                  placeholder="rtsp://admin:pass@192.168.1.100:554/stream1 or test_media/test.mp4"
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                  className="tactical-input"
                  required
                />
              </div>

              <div className="test-stream-row">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn btn-secondary btn-sm"
                >
                  {isTesting ? "TESTING..." : "TEST FEED"}
                </button>

                {testResult && (
                  <div className={`test-badge ${testResult.connected ? "ok" : "fail"}`}>
                    {testResult.connected ? "✓ CONNECTED" : "✗ FAILED"}
                  </div>
                )}
              </div>

              <div className="form-actions">
                {editingCameraId && (
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    CANCEL
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? "SAVING..." : editingCameraId ? "UPDATE CONFIG" : "REGISTER CAMERA"}
                </button>
              </div>
            </form>
          </div>

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
