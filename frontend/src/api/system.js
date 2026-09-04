/**
 * AVEKSHA NETRA — System & Diagnostics API Module
 */

import { apiClient } from "./client";

export const systemApi = {
  /**
   * Health check to test backend connectivity
   */
  getHealth: () => apiClient.get("/api/health"),

  /**
   * Database connectivity verification
   */
  getDatabaseTest: () => apiClient.get("/api/database-test"),

  /**
   * High-level AI summary for dashboard (active_alerts, total_events, workers)
   */
  getDashboardSummary: () => apiClient.get("/api/dashboard/ai-summary"),
};

export default systemApi;
