import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface FolderRecord {
  id: string;
  name: string;
  pathTemplate: string;
}

interface ClipRecord {
  id: string;
  textContent: string | null;
  createdAt: string | Date;
}

export default function FoldersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [pathTemplate, setPathTemplate] = useState("");
  const [selected, setSelected] = useState<FolderRecord | null>(null);
  const [editing, setEditing] = useState<FolderRecord | null>(null);

  const foldersQuery = useQuery({ queryKey: ["/api/folders"] });
  const folders = useMemo(() => (foldersQuery.data?.folders as FolderRecord[]) ?? [], [foldersQuery.data]);

  const clipsQuery = useQuery({
    queryKey: selected ? [`/api/folders/${selected.id}/clips`] : ["/api/folders"],
    enabled: !!selected
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson<FolderRecord>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name, path_template: pathTemplate })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setName("");
      setPathTemplate("");
      toast({ title: "Folder created" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (folder: FolderRecord) =>
      apiJson<FolderRecord>(`/api/folders/${folder.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: folder.name, path_template: folder.pathTemplate })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({ title: "Folder updated" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiJson(`/api/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setSelected(null);
      toast({ title: "Folder deleted" });
    }
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Folders</h1>
            <p className="text-sm text-muted-foreground">Manage collections and routing destinations.</p>
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

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Create Folder</h2>
            <Input placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              placeholder="Path template (e.g. Images/{YYYY}/{MM}/{DD})"
              value={pathTemplate}
              onChange={(e) => setPathTemplate(e.target.value)}
            />
            <Button onClick={() => createMutation.mutate()} disabled={!name || !pathTemplate}>
              Create
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Folder Clips</h2>
            {selected ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">{selected.name}</div>
                {(clipsQuery.data?.clips as ClipRecord[] | undefined)?.map((clip) => (
                  <div key={clip.id} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{clip.textContent?.split("\n")[0] || "Untitled"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(clip.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {!clipsQuery.isLoading && (clipsQuery.data?.clips as ClipRecord[] | undefined)?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No clips in this folder.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a folder to view clips.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Existing Folders</h2>
            <Badge variant="secondary">{folders.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Path Template</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <TableRow key={folder.id}>
                  <TableCell className="font-medium">{folder.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{folder.pathTemplate}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(folder)}>View</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(folder)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(folder.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input value={editing.pathTemplate} onChange={(e) => setEditing({ ...editing, pathTemplate: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => updateMutation.mutate(editing)}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
