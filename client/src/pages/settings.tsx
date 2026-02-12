import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiJson, useApiSettings } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function SettingsRoutePage() {
  const { toast } = useToast();
  const { apiBase, setApiBase, token, setToken, reset } = useApiSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: (mode: "login" | "register") =>
      apiJson<{ token: string }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password })
      }),
    onSuccess: (data) => {
      if (data?.token) {
        setToken(data.token);
        toast({ title: "Authenticated" });
      }
    }
  });

  const testMutation = useMutation({
    mutationFn: () => apiJson("/api/me"),
    onSuccess: () => toast({ title: "Connection OK" })
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure server connection and authentication.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/">Back to Clipboard</Link>
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Server Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="API base URL (leave blank for same origin)"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
            />
            <Input
              placeholder="JWT token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => testMutation.mutate()}>Test Connection</Button>
              <Button variant="ghost" onClick={() => reset()}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex items-center gap-2">
              <Button onClick={() => loginMutation.mutate("login")} disabled={!email || !password}>
                Login
              </Button>
              <Button variant="outline" onClick={() => loginMutation.mutate("register")} disabled={!email || !password}>
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
