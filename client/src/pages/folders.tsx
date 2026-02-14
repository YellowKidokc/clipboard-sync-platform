import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

type Folder = { id: string; name: string; pathTemplate: string };

export default function FoldersPage(): JSX.Element {
  const folders = useQuery({ queryKey: ["folders"], queryFn: () => api<{ folders: Folder[] }>("/api/folders") });

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1>Folders & Collections</h1>
      <div style={{ display: "grid", gap: 8 }}>
        {(folders.data?.folders ?? []).map((folder) => (
          <article key={folder.id} style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 600 }}>{folder.name}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>{folder.pathTemplate}</div>
          </article>
        ))}
      </div>
    </main>
  );
}
