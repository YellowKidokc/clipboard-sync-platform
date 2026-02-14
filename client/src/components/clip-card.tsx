type Clip = {
  id: string;
  contentType: string;
  textContent?: string | null;
  tags?: string[];
  hotkeySlot?: number | null;
  createdAt?: string;
};

export default function ClipCard({ clip }: { clip: Clip }): JSX.Element {
  return (
    <article style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <small>{clip.contentType}</small>
        {clip.hotkeySlot ? <small>Slot {clip.hotkeySlot}</small> : null}
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{clip.textContent ?? "(binary clip)"}</div>
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(clip.tags ?? []).map((tag) => (
          <span key={tag} style={{ fontSize: 12, background: "#eef2ff", borderRadius: 999, padding: "2px 8px" }}>
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}
