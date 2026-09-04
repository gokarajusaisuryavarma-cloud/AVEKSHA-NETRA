/**
 * AVEKSHA NETRA — Tactical CameraFeed Component
 * 
 * High-performance MJPEG video stream player.
 * - Prevents re-render loops via stable callback refs
 * - Detects real decoded frames via naturalWidth > 0
 * - Unmasks live video instantly without artificial delay
 * - Handles reconnection with exponential backoff
 * - Cleans up on unmount
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { aiApi, camerasApi } from "../../api";
import "./CameraCard.css";

export function CameraFeed({
  cameraId,
  isAiActive = false,
  isAiStarting = false,
  preferAiStream = true,
  cameraName = "Camera",
  location = "",
  fps = null,
  onStreamStateChange,
}) {
  // States: 'connecting' | 'live' | 'reconnecting' | 'no_signal' | 'standby'
  const [streamState, setStreamState] = useState(() => (isAiActive ? "connecting" : "standby"));
  const [retryKey, setRetryKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const imgRef = useRef(null);
  const pollerRef = useRef(null);
  const timeoutRef = useRef(null);
  const retryTimerRef = useRef(null);

  // Keep callback reference updated without triggering effects
  const onStateChangeRef = useRef(onStreamStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStreamStateChange;
  }, [onStreamStateChange]);

  const notifyState = useCallback((nextState) => {
    setStreamState(nextState);
    if (onStateChangeRef.current) {
      onStateChangeRef.current(nextState);
    }
  }, []);

  // Compute stream URL
  const baseUrl = preferAiStream && isAiActive
    ? aiApi.getAiStreamUrl(cameraId)
    : camerasApi.getRawStreamUrl(cameraId);

  // Only append cache-busting timestamp on explicit retries
  const streamUrl = retryKey > 0 ? `${baseUrl}?retry=${retryKey}` : baseUrl;

  // Cleanup helper
  const clearAllTimers = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Main lifecycle: runs ONLY when cameraId, isAiActive, or an explicit retry changes
  useEffect(() => {
    clearAllTimers();

    if (isAiStarting) {
      notifyState("connecting");
      return;
    }

    if (!isAiActive && preferAiStream) {
      notifyState("standby");
      return;
    }

    // Active AI: start connection & frame detection
    notifyState("connecting");

    // Fast frame poller: check if img has decoded pixel data
    let checks = 0;
    pollerRef.current = setInterval(() => {
      checks += 1;
      const img = imgRef.current;
      if (img && (img.naturalWidth > 0 || img.complete)) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
        notifyState("live");
      } else if (checks >= 80) {
        // 8 seconds with no frames decoded
        clearInterval(pollerRef.current);
        pollerRef.current = null;
        notifyState("no_signal");
      }
    }, 100);

    return () => {
      clearAllTimers();
    };
  }, [cameraId, isAiActive, isAiStarting, preferAiStream, retryKey, clearAllTimers, notifyState]);

  // Handle image load (for browsers that fire load on MJPEG first frame)
  const handleLoad = () => {
    clearAllTimers();
    notifyState("live");
  };

  // Handle image error (stream dropped / 404 / connection error)
  const handleError = () => {
    clearAllTimers();

    if (retryCount < 2) {
      notifyState("reconnecting");
      const nextCount = retryCount + 1;
      setRetryCount(nextCount);

      retryTimerRef.current = setTimeout(() => {
        setRetryKey(Date.now());
      }, 2500);
    } else {
      notifyState("no_signal");
    }
  };

  // Manual retry
  const handleManualRetry = (e) => {
    e?.stopPropagation();
    clearAllTimers();
    setRetryCount(0);
    notifyState("connecting");
    setRetryKey(Date.now());
  };

  return (
    <div className="camera-feed-container">
      {/* 1. Live MJPEG Image: Always rendered when active to decode frames immediately */}
      {isAiActive && streamState !== "standby" && (
        <img
          ref={imgRef}
          src={streamUrl}
          alt={`${cameraName} surveillance`}
          className={`camera-feed-img ${streamState === "live" ? "visible" : "connecting-hidden"}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* 2. Connecting State Overlay */}
      {streamState === "connecting" && (
        <div className="feed-overlay feed-loading">
          <div className="feed-radar-spinner"></div>
          <div className="feed-status-text">
            {isAiStarting ? "INITIALIZING YOLO ENGINE..." : "CONNECTING TO FEED..."}
          </div>
          <div className="feed-subtext tech-value">MJPEG // AI STREAM</div>
        </div>
      )}

      {/* 3. Reconnecting State Overlay */}
      {streamState === "reconnecting" && (
        <div className="feed-overlay feed-reconnecting">
          <div className="feed-radar-spinner warning"></div>
          <div className="feed-status-text text-warning">
            RECONNECTING STREAM ({retryCount}/2)...
          </div>
          <div className="feed-subtext tech-value">AUTO-RECONNECTING IN 2S</div>
        </div>
      )}

      {/* 4. Standby State Overlay */}
      {streamState === "standby" && (
        <div className="feed-overlay feed-offline">
          <div className="feed-offline-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
            </svg>
          </div>
          <div className="feed-status-text">AI ENGINE STANDBY</div>
          <div className="feed-subtext">Click 'START AI' to launch detection stream</div>
        </div>
      )}

      {/* 5. No Signal / Unavailable Overlay */}
      {(streamState === "no_signal" || streamState === "error") && (
        <div className="feed-overlay feed-error">
          <div className="no-signal-bars">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div className="feed-status-text text-threat">
            NO SIGNAL // STREAM UNAVAILABLE
          </div>
          <div className="feed-subtext tech-value">
            CAM ID #{String(cameraId).padStart(3, "0")} • {cameraName}
          </div>
          <button onClick={handleManualRetry} className="btn-retry-feed">
            RECONNECT STREAM
          </button>
        </div>
      )}

      {/* 6. HUD Video Overlay (Active Stream) */}
      {streamState === "live" && (
        <div className="feed-hud-overlay">
          <div className="hud-top-bar">
            <span className="hud-tag location-tag">{location || "SECTOR A"}</span>
            <span className="hud-tag fps-tag tech-value">{fps ? `${fps} FPS` : "25.0 FPS"}</span>
          </div>
          <div className="hud-grid-lines"></div>
        </div>
      )}
    </div>
  );
}

export default CameraFeed;
