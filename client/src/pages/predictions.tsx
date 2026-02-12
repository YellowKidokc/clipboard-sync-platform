import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PredictionRecord {
  id: string;
  predictedContent: string;
  actualContent: string | null;
  confidence: number;
  wasCorrect: boolean | null;
  createdAt: string | Date;
}

export default function PredictionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actualContent, setActualContent] = useState("");

  const currentQuery = useQuery({ queryKey: ["/api/predictions/current"] });
  const statsQuery = useQuery({ queryKey: ["/api/predictions/stats"] });

  const stats = statsQuery.data ?? { accuracy: 0, total: 0, correct: 0, streak: 0, recent_predictions: [] };
  const recent = useMemo(() => (stats.recent_predictions as PredictionRecord[]) ?? [], [stats]);

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiJson("/api/predictions/resolve", {
        method: "POST",
        body: JSON.stringify({ actual_content: actualContent })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/stats"] });
      setActualContent("");
      toast({ title: "Prediction resolved" });
    }
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Predictions</h1>
            <p className="text-sm text-muted-foreground">Track AI clipboard predictions and accuracy.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/">Back to Clipboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/rules">Rules</Link>
            </Button>
          </div>
        </header>

        <section className="grid lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold">{Math.round((stats.accuracy ?? 0) * 100)}%</div>
              <Progress value={(stats.accuracy ?? 0) * 100} className="mt-4" />
              <div className="text-xs text-muted-foreground mt-2">
                {stats.correct} correct out of {stats.total} predictions
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Current Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Confidence: {Math.round((currentQuery.data?.confidence ?? 0) * 100)}%</div>
              <p className="mt-3 text-sm whitespace-pre-wrap">
                {currentQuery.data?.prediction ?? "No prediction yet."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold">{stats.streak ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Consecutive correct predictions.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Predictions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recent.map((prediction) => (
                <div key={prediction.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{prediction.predictedContent}</div>
                    <Badge variant={prediction.wasCorrect ? "secondary" : "destructive"}>
                      {prediction.wasCorrect ? "Correct" : prediction.wasCorrect === false ? "Wrong" : "Pending"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Confidence: {Math.round(prediction.confidence * 100)}%
                  </div>
                </div>
              ))}
              {recent.length === 0 && <p className="text-sm text-muted-foreground">No predictions yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resolve Prediction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="What did you actually copy?"
                value={actualContent}
                onChange={(e) => setActualContent(e.target.value)}
              />
              <Button onClick={() => resolveMutation.mutate()} disabled={!actualContent.trim()}>
                Resolve
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
