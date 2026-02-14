import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

type Rule = { id: string; name: string; matchType: string; pattern: string; action: string; enabled: boolean; priority: number };

export default function RulesPage(): JSX.Element {
  const rules = useQuery({ queryKey: ["rules"], queryFn: () => api<{ rules: Rule[] }>("/api/rules") });

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1>Rules Manager</h1>
      <div style={{ display: "grid", gap: 8 }}>
        {(rules.data?.rules ?? []).map((rule) => (
          <article key={rule.id} style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 600 }}>{rule.name}</div>
            <div style={{ fontSize: 13 }}>{rule.matchType} • {rule.pattern} • {rule.action}</div>
            <div style={{ fontSize: 12 }}>{rule.enabled ? "Enabled" : "Disabled"} • Priority {rule.priority}</div>
          </article>
        ))}
      </div>
    </main>
  );
}
