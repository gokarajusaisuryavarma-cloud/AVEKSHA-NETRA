import { apiRequest } from "./client.js";

export const watchlistApi = {
  async getWatchlist() {
    return apiRequest("/api/watchlist");
  },

  async addEntry(data) {
    return apiRequest("/api/watchlist", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteEntry(id) {
    return apiRequest(`/api/watchlist/${id}`, {
      method: "DELETE",
    });
  },
};
