import { apiRequest } from "./client.js";

export const alertsApi = {
  async getAlerts(params = {}) {
    const query = new URLSearchParams();
    if (params.category) query.append("category", params.category);
    if (params.status) query.append("status", params.status);
    if (params.camera_id) query.append("camera_id", params.camera_id);
    if (params.limit) query.append("limit", params.limit);

    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/alerts${qs}`);
  },

  async acknowledge(alertId) {
    return apiRequest(`/api/alerts/${alertId}/acknowledge`, { method: "POST" });
  },

  async clearAll() {
    return apiRequest("/api/alerts", { method: "DELETE" });
  },
};
