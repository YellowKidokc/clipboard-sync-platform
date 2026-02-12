import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiFetch, buildApiUrl } from "./api";

function buildUrl(path: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return buildApiUrl(path);
  const url = new URL(buildApiUrl(path), window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  return apiFetch(url, {
    method,
    body: data ? JSON.stringify(data) : undefined,
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const [path, params] = queryKey as [string, Record<string, unknown> | undefined];
    try {
      const res = await apiFetch(buildUrl(path, params));
      return (await res.json()) as T;
    } catch (error) {
      if (unauthorizedBehavior === "returnNull" && String(error).includes("401")) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
