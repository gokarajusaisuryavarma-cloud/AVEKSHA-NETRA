/**
 * AVEKSHA NETRA — Authentication API Module
 */

import { apiClient } from "./client";

export const authApi = {
  /**
   * Login operator with username & password
   * @param {{ username: string, password: string }} credentials
   */
  login: (credentials) => apiClient.post("/api/auth/login", credentials),

  /**
   * Register a new operator account
   * @param {{ username: string, password: string }} credentials
   */
  register: (credentials) => apiClient.post("/api/auth/register", credentials),

  /**
   * Local storage token helpers
   */
  saveSession: (token, user) => {
    try {
      if (token) localStorage.setItem("aveksha_token", token);
      if (user) localStorage.setItem("aveksha_user", JSON.stringify(user));
    } catch (e) {
      console.error("Failed to save auth session:", e);
    }
  },

  clearSession: () => {
    try {
      localStorage.removeItem("aveksha_token");
      localStorage.removeItem("aveksha_user");
    } catch (e) {
      console.error("Failed to clear auth session:", e);
    }
  },

  getStoredUser: () => {
    try {
      const data = localStorage.getItem("aveksha_user");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getStoredToken: () => {
    try {
      return localStorage.getItem("aveksha_token");
    } catch {
      return null;
    }
  },
};

export default authApi;
