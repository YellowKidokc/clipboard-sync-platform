import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface RuleRecord {
  id: string;
  name: string;
  matchType: "mime" | "regex" | "contains" | "starts_with";
  pattern: string;
  action: "replace" | "route_folder" | "tag" | "webhook" | "ai_call";
  params: Record<string, unknown>;
  priority: number;
  enabled: boolean;
}

const matchTypes: RuleRecord["matchType"][] = ["mime", "regex", "contains", "starts_with"];
const actions: RuleRecord["action"][] = ["replace", "route_folder", "tag", "webhook", "ai_call"];

const emptyDraft = {
  name: "",
  matchType: "contains" as RuleRecord["matchType"],
  pattern: "",
  action: "tag" as RuleRecord["action"],
  params: "{}",
  priority: 100,
  enabled: true
};

export default function RulesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [editing, setEditing] = useState<RuleRecord | null>(null);
  const [testContent, setTestContent] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const rulesQuery = useQuery({ queryKey: ["/api/rules"] });
  const rules = useMemo(() => (rulesQuery.data?.rules as RuleRecord[]) ?? [], [rulesQuery.data]);

  const createRuleMutation = useMutation({
    mutationFn: (payload: RuleRecord) =>
      apiJson<RuleRecord>("/api/rules", {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          match_type: payload.matchType,
          pattern: payload.pattern,
          action: payload.action,
          params: payload.params,
          priority: payload.priority,
          enabled: payload.enabled
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      setDraft({ ...emptyDraft });
      toast({ title: "Rule created" });
    }
  });

  const updateRuleMutation = useMutation({
    mutationFn: (payload: RuleRecord) =>
      apiJson<RuleRecord>(`/api/rules/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: payload.name,
          match_type: payload.matchType,
          pattern: payload.pattern,
          action: payload.action,
          params: payload.params,
          priority: payload.priority,
          enabled: payload.enabled
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      setEditing(null);
      toast({ title: "Rule updated" });
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiJson(`/api/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: "Rule deleted" });
    }
  });

  const testRuleMutation = useMutation({
    mutationFn: (payload: RuleRecord) =>
      apiJson<{ matched: boolean; result: unknown }>("/api/rules/test", {
        method: "POST",
        body: JSON.stringify({
          rule: {
            name: payload.name,
            match_type: payload.matchType,
            pattern: payload.pattern,
            action: payload.action,
            params: payload.params,
            priority: payload.priority,
            enabled: payload.enabled
          },
          test_content: testContent,
          content_type: "text/plain"
        })
      })
  });

  const parseParams = (value: string) => {
    try {
      return JSON.parse(value || "{}");
    } catch {
      return null;
    }
  };

  const handleCreate = () => {
    const params = parseParams(draft.params);
    if (!params) {
      toast({ title: "Params must be valid JSON", variant: "destructive" });
      return;
    }
    createRuleMutation.mutate({
      id: "",
      name: draft.name,
      matchType: draft.matchType,
      pattern: draft.pattern,
      action: draft.action,
      params,
      priority: Number(draft.priority),
      enabled: draft.enabled
    });
  };

  const handleTest = async () => {
    if (!testContent.trim()) {
      toast({ title: "Enter test content", variant: "destructive" });
      return;
    }
    const params = parseParams(draft.params);
    if (!params) {
      toast({ title: "Params must be valid JSON", variant: "destructive" });
      return;
    }
    const result = await testRuleMutation.mutateAsync({
      id: "",
      name: draft.name,
      matchType: draft.matchType,
      pattern: draft.pattern,
      action: draft.action,
      params,
      priority: Number(draft.priority),
      enabled: draft.enabled
    });
    setTestResult(JSON.stringify(result, null, 2));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Rules</h1>
            <p className="text-sm text-muted-foreground">Define matching rules and automated actions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/">Back to Clipboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/predictions">Predictions</Link>
            </Button>
          </div>
        </header>

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Create Rule</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Input placeholder="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <Input placeholder="Pattern" value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} />
              <Select value={draft.matchType} onValueChange={(value) => setDraft({ ...draft, matchType: value as RuleRecord["matchType"] })}>
                <SelectTrigger><SelectValue placeholder="Match type" /></SelectTrigger>
                <SelectContent>
                  {matchTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={draft.action} onValueChange={(value) => setDraft({ ...draft, action: value as RuleRecord["action"] })}>
                <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Priority"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
              />
              <div className="flex items-center justify-between rounded-md border px-3">
                <span className="text-sm">Enabled</span>
                <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })} />
              </div>
            </div>
            <Textarea
              className="min-h-[140px] font-mono text-xs"
              value={draft.params}
              onChange={(e) => setDraft({ ...draft, params: e.target.value })}
              placeholder='Action params as JSON. Example: {"tags": ["work"]}'
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate}>Create Rule</Button>
              <Button variant="outline" onClick={handleTest}>Test Rule</Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Test Result</h2>
            <Textarea
              className="min-h-[200px] font-mono text-xs"
              placeholder="Paste content to test"
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
            />
            {testResult && (
              <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto">{testResult}</pre>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Existing Rules</h2>
            <Badge variant="secondary">{rules.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-xs text-muted-foreground">{rule.pattern}</div>
                  </TableCell>
                  <TableCell>{rule.matchType}</TableCell>
                  <TableCell>{rule.action}</TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) =>
                        updateRuleMutation.mutate({ ...rule, enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(rule)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteRuleMutation.mutate(rule.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input value={editing.pattern} onChange={(e) => setEditing({ ...editing, pattern: e.target.value })} />
              <Select value={editing.matchType} onValueChange={(value) => setEditing({ ...editing, matchType: value as RuleRecord["matchType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {matchTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={editing.action} onValueChange={(value) => setEditing({ ...editing, action: value as RuleRecord["action"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
              />
              <Textarea
                className="min-h-[140px] font-mono text-xs"
                value={JSON.stringify(editing.params, null, 2)}
                onChange={(e) => {
                  const parsed = parseParams(e.target.value);
                  if (parsed) setEditing({ ...editing, params: parsed });
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => updateRuleMutation.mutate(editing)}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
