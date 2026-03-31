import type { LogEntry, LogStats, Settings } from "@/types";

const API_BASE = "/api";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || error.message || "Request failed");
  }
  return response.json();
}

export const api = {
  logs: {
    list: async (params?: {
      limit?: number;
      offset?: number;
      path?: string;
      method?: string;
      provider?: string;
      model?: string;
      is_stream?: boolean;
      start_date?: string;
      end_date?: string;
    }): Promise<LogEntry[]> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());
      if (params?.path) searchParams.set("path", params.path);
      if (params?.method) searchParams.set("method", params.method);
      if (params?.provider) searchParams.set("provider", params.provider);
      if (params?.model) searchParams.set("model", params.model);
      if (params?.is_stream !== undefined) searchParams.set("is_stream", params.is_stream.toString());
      if (params?.start_date) searchParams.set("start_date", params.start_date);
      if (params?.end_date) searchParams.set("end_date", params.end_date);

      const response = await fetch(`${API_BASE}/logs?${searchParams}`);
      return handleResponse<LogEntry[]>(response);
    },

    listTracings: async (params?: {
      limit?: number;
      offset?: number;
    }): Promise<LogEntry[]> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());

      const response = await fetch(`${API_BASE}/logs/tracings?${searchParams}`);
      return handleResponse<LogEntry[]>(response);
    },

    get: async (id: number): Promise<LogEntry> => {
      const response = await fetch(`${API_BASE}/logs/${id}`);
      return handleResponse<LogEntry>(response);
    },

    delete: async (id: number): Promise<{ message: string }> => {
      const response = await fetch(`${API_BASE}/logs/${id}`, { method: "DELETE" });
      return handleResponse<{ message: string }>(response);
    },

    deleteMany: async (ids: number[]): Promise<{ deleted: number }> => {
      const searchParams = new URLSearchParams();
      ids.forEach((id) => searchParams.append("log_ids", id.toString()));
      const response = await fetch(`${API_BASE}/logs?${searchParams}`, { method: "DELETE" });
      return handleResponse<{ deleted: number }>(response);
    },

    getStats: async (): Promise<LogStats> => {
      const response = await fetch(`${API_BASE}/logs/stats`);
      return handleResponse<LogStats>(response);
    },
  },

  settings: {
    get: async (): Promise<Settings> => {
      const response = await fetch(`${API_BASE}/settings`);
      return handleResponse<Settings>(response);
    },

    set: async (settings: Settings): Promise<Settings> => {
      const response = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      return handleResponse<Settings>(response);
    },

    delete: async (): Promise<void> => {
      const response = await fetch(`${API_BASE}/settings`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete settings");
      }
    },
  },
};
