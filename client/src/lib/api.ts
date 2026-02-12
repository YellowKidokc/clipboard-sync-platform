const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
      authorization: `Bearer ${localStorage.getItem("token") ?? ""}`
    }
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
