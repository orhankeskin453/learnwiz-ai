import type { DashboardData } from "@learwizai/types";
import { apiClient } from "./apiClient";

/** Dashboard + progress API wrappers (CLAUDE.md §10.2, §10.8). */

export interface ProgressTopic {
  topic: string;
  mastery: number;
  totalQuestions: number;
  correctQuestions: number;
}

export async function getDashboard(): Promise<DashboardData> {
  return apiClient.get<DashboardData>("/api/dashboard");
}

export async function getProgress(): Promise<{ topics: ProgressTopic[] }> {
  return apiClient.get<{ topics: ProgressTopic[] }>("/api/dashboard/progress");
}
