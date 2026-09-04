import { apiRequest } from "./client.js";

export const facesApi = {
  async getFaces() {
    return apiRequest("/api/faces");
  },

  async registerFace(data) {
    return apiRequest("/api/faces", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteFace(id) {
    return apiRequest(`/api/faces/${id}`, {
      method: "DELETE",
    });
  },
};
