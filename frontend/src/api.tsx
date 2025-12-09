// src/api.ts
const API_URL = "https://localhost:8080/api/v1";

export interface HealthResponse {
  message: string;
  version: string;
  docs?: string;
  health?: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error("Сервер недоступен");
  }
  return res.json();
}
