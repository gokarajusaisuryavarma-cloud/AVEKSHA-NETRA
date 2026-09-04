/**
 * AVEKSHA NETRA — Cameras API Module
 */

import { apiClient, getStreamUrl } from "./client";

export const camerasApi = {
  /**
   * Get list of all registered surveillance cameras
   */
  getCameras: () => apiClient.get("/api/cameras"),

  /**
   * Get single camera metadata
   */
  getCamera: (cameraId) => apiClient.get(`/api/cameras/${cameraId}`),

  /**
   * Add a new camera
   * @param {{ name: string, location: string, rtsp_url: string, source_type?: string }} camera
   */
  createCamera: (camera) => apiClient.post("/api/cameras", camera),

  /**
   * Update existing camera details
   */
  updateCamera: (cameraId, camera) =>
    apiClient.put(`/api/cameras/${cameraId}`, camera),

  /**
   * Delete camera and cleanup workers
   */
  deleteCamera: (cameraId) => apiClient.delete(`/api/cameras/${cameraId}`),

  /**
   * Test camera RTSP stream connection via OpenCV
   */
  testConnection: (camera) =>
    apiClient.post("/api/cameras/test-connection", camera),

  /**
   * Get URL for raw video stream (MJPEG)
   */
  getRawStreamUrl: (cameraId) =>
    getStreamUrl(`/api/cameras/${cameraId}/stream`),

  /**
   * Get URL for AI detection video stream (MJPEG)
   */
  getAiStreamUrl: (cameraId) =>
    getStreamUrl(`/api/cameras/${cameraId}/ai-stream`),
};

export default camerasApi;
