import { useCallback, useEffect, useState } from "react";

const BASE_KEY = "clipsync_api_base";
const TOKEN_KEY = "clipsync_auth_token";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(BASE_KEY) ?? import.meta.env.VITE_API_URL ?? "";
}

export function setApiBaseUrl(value: string): void {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(BASE_KEY, value);
  else window.localStorage.removeItem(BASE_KEY);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(value: string): void {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(TOKEN_KEY, value);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function buildApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = getApiBaseUrl();
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = buildApiUrl(path);
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export function useApiSettings() {
  const [apiBase, setApiBase] = useState(getApiBaseUrl());
  const [token, setToken] = useState(getAuthToken() ?? "");

  useEffect(() => {
    setApiBaseUrl(apiBase);
  }, [apiBase]);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const reset = useCallback(() => {
    setApiBase("");
    setToken("");
  }, []);

  return { apiBase, setApiBase, token, setToken, reset };
}
