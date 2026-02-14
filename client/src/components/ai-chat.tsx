import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function AiChat(): JSX.Element {
  const [message, setMessage] = useState("");
  const chat = useMutation({
    mutationFn: (msg: string) => api<{ reply: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: msg }) })
  });

  return (
    <section style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12 }}>
      <h3>AI Assistant</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask AI to improve or summarize" style={{ flex: 1 }} />
        <button onClick={() => chat.mutate(message)} disabled={!message.trim() || chat.isPending}>
          Send
        </button>
      </div>
      {chat.data ? <p style={{ marginTop: 10 }}>{chat.data.reply}</p> : null}
    </section>
  );
}
