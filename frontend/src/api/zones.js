import { apiRequest } from "./client.js";

export const zonesApi = {
  async getZones(cameraId) {
    return apiRequest(`/api/cameras/${cameraId}/zones`);
  },

  async createZone(cameraId, data) {
    return apiRequest(`/api/cameras/${cameraId}/zones`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteZone(cameraId, zoneId) {
    return apiRequest(`/api/cameras/${cameraId}/zones/${zoneId}`, {
      method: "DELETE",
    });
  },
};
