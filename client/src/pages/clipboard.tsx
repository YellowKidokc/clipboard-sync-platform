import { useQuery } from "@tanstack/react-query";
import ClipCard from "../components/clip-card";
import AiChat from "../components/ai-chat";
import HotkeyIndicator from "../components/hotkey-indicator";
import { api } from "../lib/api";

type Clip = { id: string; textContent?: string; contentType: string };

export default function ClipboardPage(): JSX.Element {
  const clips = useQuery({ queryKey: ["clips"], queryFn: () => api<{ clips: Clip[] }>("/api/clips") });
  return (
    <main style={{ padding: 16 }}>
      <h1>Clipboard Stream</h1>
      <HotkeyIndicator />
      {clips.data?.clips.map((clip) => <ClipCard key={clip.id} clip={clip} />)}
      <AiChat />
    </main>
  );
}
