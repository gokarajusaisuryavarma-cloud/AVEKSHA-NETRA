/**
 * AVEKSHA NETRA — Tactical CameraCard Component
 * High-density surveillance monitor card matching defense SOC standards.
 * Displays separate AI Engine status vs. Live Video Stream status.
 */

import React, { useState } from "react";
import CameraFeed from "./CameraFeed";
import { aiApi } from "../../api";
import "./CameraCard.css";

export function CameraCard({
  camera,
  aiStatus,
  onOpenDetails,
  onStatusChange,
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Separate video stream state reported by CameraFeed: 'connecting' | 'live' | 'reconnecting' | 'no_signal' | 'standby'
  const [videoState, setVideoState] = useState("connecting");

  const handleStreamStateChange = React.useCallback((state) => {
    setVideoState((prev) => (prev === state ? prev : state));
  }, []);

  const cameraId = camera.id;
  const isAiActive = aiStatus?.running === true;
  const frameCount = aiStatus?.frame_count || aiStatus?.frame_number || 0;
  const activeTracks = aiStatus?.active_tracks || 0;

  // Handle Start AI
  const handleStartAi = async (e) => {
    e.stopPropagation();
    try {
      setActionLoading(true);
      setActionError(null);
      await aiApi.startAi(cameraId);
      if (onStatusChange) onStatusChange(cameraId, true);
    } catch (err) {
      console.error(`Failed to start AI on camera ${cameraId}:`, err);
      setActionError(err.message || "Failed to start AI");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Stop AI
  const handleStopAi = async (e) => {
    e.stopPropagation();
    try {
      setActionLoading(true);
      setActionError(null);
      await aiApi.stopAi(cameraId);
      if (onStatusChange) onStatusChange(cameraId, false);
    } catch (err) {
      console.error(`Failed to stop AI on camera ${cameraId}:`, err);
      setActionError(err.message || "Failed to stop AI");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Card Fullscreen
  const toggleFullscreen = (e) => {
    e.stopPropagation();
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`tactical-camera-card tactical-corner ${isFullscreen ? "fullscreen-mode" : ""}`}>
      {/* 1. Header Bar: Distinguishes AI Status from Video Stream Status */}
      <div className="camera-card-header">
        <div className="header-left">
          <span className="camera-id-badge tech-value">
            CAM-{String(cameraId).padStart(3, "0")}
          </span>
          <span className="source-type-tag tech-value">
            {camera.source_type || "RTSP"}
          </span>
        </div>

        <div className="header-right">
          {/* Status Badges: Separates Video Status and AI Engine Status */}
          <div className="status-badges-group">
            {/* Video Stream Status */}
            <span className={`status-pill video-pill ${videoState}`}>
              <span className={`status-dot ${
                videoState === "live"
                  ? "online pulse"
                  : videoState === "no_signal"
                  ? "threat"
                  : videoState === "reconnecting" || videoState === "connecting"
                  ? "warning"
                  : "offline"
              }`}></span>
              <span className="pill-text">
                VIDEO: {
                  videoState === "live"
                    ? "LIVE"
                    : videoState === "connecting"
                    ? "CONNECTING"
                    : videoState === "reconnecting"
                    ? "RETRYING"
                    : videoState === "no_signal"
                    ? "NO SIGNAL"
                    : "STANDBY"
                }
              </span>
            </span>

            {/* AI Engine Status */}
            <span className={`status-pill ai-pill ${isAiActive ? "active" : "idle"}`}>
              <span className={`status-dot ${isAiActive ? "online" : "offline"}`}></span>
              <span className="pill-text">AI: {isAiActive ? "ONLINE" : "STANDBY"}</span>
            </span>
          </div>

          <div className="card-controls">
            <button
              onClick={toggleFullscreen}
              className="btn-card-action"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <>
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </>
                )}
              </svg>
            </button>

            {onOpenDetails && (
              <button
                onClick={() => onOpenDetails(camera)}
                className="btn-card-action"
                title="Camera Diagnostics & Details"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Video Feed Viewport */}
      <div className="camera-card-viewport">
        <CameraFeed
          cameraId={cameraId}
          isAiActive={isAiActive}
          isAiStarting={actionLoading}
          preferAiStream={true}
          cameraName={camera.name}
          location={camera.location}
          fps={isAiActive && videoState === "live" ? "25.0" : null}
          onStreamStateChange={handleStreamStateChange}
        />
      </div>

      {/* 3. Card Footer */}
      <div className="camera-card-footer">
        {/* Name & Location */}
        <div className="footer-meta">
          <div className="camera-name" title={camera.name}>
            {camera.name}
          </div>
          <div className="camera-location">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>{camera.location}</span>
          </div>
        </div>

        {/* Telemetry Counter Chips */}
        <div className="footer-telemetry">
          <div className="telemetry-chip" title="Active Tracks in Scene">
            <span className="chip-icon">🎯</span>
            <span className="chip-value tech-value">{activeTracks}</span>
            <span className="chip-label">TRACKS</span>
          </div>

          <div className="telemetry-chip" title="Total Frame Count">
            <span className="chip-icon">🎞️</span>
            <span className="chip-value tech-value">{frameCount > 0 ? frameCount : "--"}</span>
            <span className="chip-label">FRAMES</span>
          </div>
        </div>

        {/* AI Action Control */}
        <div className="footer-actions">
          {actionError && (
            <span className="action-error-msg" title={actionError}>
              {actionError}
            </span>
          )}

          {isAiActive ? (
            <button
              onClick={handleStopAi}
              disabled={actionLoading}
              className="btn btn-sm btn-danger"
              title="Stop YOLO Detection Stream"
            >
              {actionLoading ? "STOPPING..." : "STOP AI"}
            </button>
          ) : (
            <button
              onClick={handleStartAi}
              disabled={actionLoading}
              className="btn btn-sm btn-success"
              title="Launch YOLO Detection Pipeline"
            >
              {actionLoading ? "INITIALIZING..." : "START AI"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CameraCard;
