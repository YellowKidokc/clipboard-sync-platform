export default function ClipCard({ clip }: { clip: { textContent?: string; contentType: string } }): JSX.Element {
  return (
    <article style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}>
      <small>{clip.contentType}</small>
      <div>{clip.textContent ?? "(binary clip)"}</div>
    </article>
  );
}
