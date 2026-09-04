/**
 * AVEKSHA NETRA — System & Surveillance Context
 * 
 * Provides centralized live telemetry, backend heartbeat,
 * AI engine status, and camera synchronization across the application.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { systemApi, camerasApi, aiApi } from "../api";

const SystemContext = createContext(null);

export const SYSTEM_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  CONNECTING: "CONNECTING",
  STANDBY: "STANDBY",
  ERROR: "ERROR",
};

export function SystemProvider({ children }) {
  // Backend & System Connectivity
  const [backendStatus, setBackendStatus] = useState(SYSTEM_STATUS.CONNECTING);
  const [databaseStatus, setDatabaseStatus] = useState(SYSTEM_STATUS.CONNECTING);
  const [aiEngineStatus, setAiEngineStatus] = useState(SYSTEM_STATUS.STANDBY);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Cameras State
  const [cameras, setCameras] = useState([]);
  const [camerasLoading, setCamerasLoading] = useState(true);
  const [camerasError, setCamerasError] = useState(null);

  // Global AI Summary & Telemetry
  const [aiSummary, setAiSummary] = useState({
    active_alerts: 0,
    total_events: 0,
    workers: {},
  });

  // ============================================================
  // FETCH CAMERAS
  // ============================================================
  const fetchCameras = useCallback(async () => {
    try {
      setCamerasLoading(true);
      const data = await camerasApi.getCameras();
      const cameraList = Array.isArray(data) ? data : [];
      setCameras(cameraList);
      setCamerasError(null);
      return cameraList;
    } catch (err) {
      console.error("[SystemContext] Failed to load cameras:", err.message);
      setCamerasError(err.message);
      return [];
    } finally {
      setCamerasLoading(false);
    }
  }, []);

  // ============================================================
  // HEARTBEAT / HEALTH CHECK
  // ============================================================
  const checkHealth = useCallback(async () => {
    try {
      // 1. Health Ping
      const healthData = await systemApi.getHealth();
      if (healthData?.status === "ok") {
        setBackendStatus(SYSTEM_STATUS.ONLINE);
        setLastHeartbeat(new Date());
        setConnectionError(null);
      } else {
        setBackendStatus(SYSTEM_STATUS.OFFLINE);
      }

      // 2. Database Ping (silent error catch)
      try {
        const dbData = await systemApi.getDatabaseTest();
        if (dbData?.status === "ok" && dbData?.database === "connected") {
          setDatabaseStatus(SYSTEM_STATUS.ONLINE);
        } else {
          setDatabaseStatus(SYSTEM_STATUS.OFFLINE);
        }
      } catch {
        setDatabaseStatus(SYSTEM_STATUS.OFFLINE);
      }

      // 3. AI Summary & Workers Check
      try {
        const summaryData = await systemApi.getDashboardSummary();
        if (summaryData?.status === "ok") {
          const rawWorkers = summaryData.workers;
          const workersMap = {};
          let workerList = [];

          if (Array.isArray(rawWorkers)) {
            workerList = rawWorkers;
            rawWorkers.forEach((w) => {
              if (w && w.camera_id != null) {
                workersMap[w.camera_id] = w;
              }
            });
          } else if (rawWorkers && typeof rawWorkers === "object") {
            workerList = Object.values(rawWorkers);
            Object.assign(workersMap, rawWorkers);
          }

          setAiSummary({
            active_alerts: summaryData.active_alerts ?? 0,
            total_events: summaryData.total_events ?? 0,
            workers: workersMap,
          });

          // Derive AI Engine Status
          const anyRunning = workerList.some((w) => w?.running === true);
          const anyError = workerList.some((w) => w?.status === "ERROR");

          if (anyRunning) {
            setAiEngineStatus(SYSTEM_STATUS.ONLINE);
          } else if (anyError) {
            setAiEngineStatus(SYSTEM_STATUS.ERROR);
          } else {
            setAiEngineStatus(SYSTEM_STATUS.STANDBY);
          }
        }
      } catch (aiErr) {
        console.warn("[SystemContext] AI summary poll warning:", aiErr.message);
      }
    } catch (err) {
      setBackendStatus(SYSTEM_STATUS.OFFLINE);
      setDatabaseStatus(SYSTEM_STATUS.OFFLINE);
      setAiEngineStatus(SYSTEM_STATUS.OFFLINE);
      setConnectionError(err.message || "Surveillance backend connection lost.");
    }
  }, []);

  // ============================================================
  // POLLING LIFECYCLE
  // ============================================================
  useEffect(() => {
    // Initial health check & camera fetch
    checkHealth();
    fetchCameras();

    // Heartbeat interval: every 8 seconds
    const heartbeatTimer = setInterval(() => {
      checkHealth();
    }, 8000);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [checkHealth, fetchCameras]);

  // Public context value
  const value = {
    // Connectivity
    backendStatus,
    databaseStatus,
    aiEngineStatus,
    lastHeartbeat,
    connectionError,
    isOnline: backendStatus === SYSTEM_STATUS.ONLINE,

    // Cameras
    cameras,
    camerasLoading,
    camerasError,
    refreshCameras: fetchCameras,

    // AI Telemetry
    aiSummary,
    activeAlertsCount: aiSummary.active_alerts,
    totalEventsCount: aiSummary.total_events,
    activeWorkers: aiSummary.workers,

    // Actions
    retryConnection: () => {
      setBackendStatus(SYSTEM_STATUS.CONNECTING);
      checkHealth();
      fetchCameras();
    },
  };

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error("useSystem must be used within a SystemProvider");
  }
  return context;
}

export default SystemContext;
