const defaultApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = localStorage.getItem("apiUrl") ?? defaultApiUrl;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
      authorization: `Bearer ${localStorage.getItem("token") ?? ""}`
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
