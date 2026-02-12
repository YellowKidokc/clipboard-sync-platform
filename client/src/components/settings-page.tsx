import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Keyboard,
  Puzzle,
  Link2,
  Workflow,
  User,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Monitor,
  EyeOff,
  Cloud,
  Database,
  HardDrive,
  Globe,
  Zap,
  Play,
  Bell,
  Copy,
  ClipboardPaste,
  MousePointer,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HotkeyItem {
  id: string;
  action: string;
  description: string;
  keys: string[];
  category: "global" | "paste" | "navigation" | "editing";
}

interface Connection {
  id: string;
  name: string;
  type: "google_drive" | "dropbox" | "onedrive" | "synology" | "cloudflare" | "custom_api";
  status: "connected" | "disconnected" | "error";
  accountId?: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  enabled: boolean;
  scope: "all" | "specific";
  triggers: string[];
  activities: string[];
}

interface IgnoredApp {
  id: string;
  name: string;
  path: string;
}

type SettingsSection = "application" | "ignored" | "keyboard" | "extensions" | "connections" | "workflows" | "account";

const defaultHotkeys: HotkeyItem[] = [
  { id: "h1", action: "Application hotkey", description: "Set the hotkey used to activate the application", keys: ["Ctrl", "Shift", "V"], category: "global" },
  { id: "h2", action: "Paste to current application", description: "Set the hotkey used to paste selected item to the current application", keys: [], category: "paste" },
  { id: "h3", action: "Paste as text to current application", description: "Set the hotkey used to paste selected item as text to the current application", keys: [], category: "paste" },
  { id: "h4", action: "Copy to system clipboard", description: "Set the hotkey used for copy selected item to the system clipboard", keys: ["Ctrl", "C"], category: "paste" },
  { id: "h5", action: "Copy to system clipboard as text", description: "Set the hotkey used for copy selected item as text to the system clipboard", keys: [], category: "paste" },
  { id: "h6", action: "Next item", description: "Navigate to the next clipboard item", keys: ["Down"], category: "navigation" },
  { id: "h7", action: "Previous item", description: "Navigate to the previous clipboard item", keys: ["Up"], category: "navigation" },
  { id: "h8", action: "Delete item", description: "Delete the selected clipboard item", keys: ["Del"], category: "editing" },
  { id: "h9", action: "Pin item", description: "Pin/unpin the selected item", keys: ["Ctrl", "P"], category: "editing" },
  { id: "h10", action: "Search", description: "Focus the search input", keys: ["Ctrl", "F"], category: "navigation" },
];

const defaultConnections: Connection[] = [
  { id: "c1", name: "Google Drive", type: "google_drive", status: "disconnected" },
];

const defaultWorkflows: WorkflowItem[] = [
  { 
    id: "wf1", 
    name: "Auto-format code snippets", 
    enabled: true, 
    scope: "all",
    triggers: ["On clipboard copy"],
    activities: ["Format as code", "Add syntax highlighting"]
  },
];

const defaultIgnoredApps: IgnoredApp[] = [
  { id: "i1", name: "KeePass", path: "C:\\Program Files\\KeePass\\KeePass.exe" },
  { id: "i2", name: "1Password", path: "C:\\Program Files\\1Password\\1Password.exe" },
];

const connectionTypes = [
  { value: "google_drive", label: "Google Drive", icon: Cloud },
  { value: "dropbox", label: "Dropbox", icon: Cloud },
  { value: "onedrive", label: "OneDrive", icon: Cloud },
  { value: "synology", label: "Synology NAS", icon: HardDrive },
  { value: "cloudflare", label: "Cloudflare R2", icon: Globe },
  { value: "custom_api", label: "Custom API", icon: Database },
];

const triggerOptions = [
  "On clipboard copy",
  "On paste",
  "On app activate",
  "On hotkey press",
  "On timer",
  "On text match",
];

const activityOptions = [
  "Copy to clipboard",
  "Paste content",
  "Format as code",
  "Add syntax highlighting",
  "Run script",
  "Send notification",
  "Sync to cloud",
  "Add tags",
];

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("application");
  const [hotkeys, setHotkeys] = useState<HotkeyItem[]>(defaultHotkeys);
  const [connections, setConnections] = useState<Connection[]>(defaultConnections);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(defaultWorkflows);
  const [ignoredApps, setIgnoredApps] = useState<IgnoredApp[]>(defaultIgnoredApps);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [editingHotkey, setEditingHotkey] = useState<string | null>(null);
  const [newConnection, setNewConnection] = useState<Partial<Connection>>({ type: "google_drive", name: "" });
  const [newWorkflow, setNewWorkflow] = useState<Partial<WorkflowItem>>({ name: "", enabled: true, scope: "all", triggers: [], activities: [] });
  const { toast } = useToast();

  const sidebarItems: { id: SettingsSection; icon: typeof Settings; label: string }[] = [
    { id: "application", icon: Monitor, label: "Application" },
    { id: "ignored", icon: EyeOff, label: "Ignored applications" },
    { id: "keyboard", icon: Keyboard, label: "Keyboard shortcuts" },
    { id: "extensions", icon: Puzzle, label: "Extensions" },
    { id: "connections", icon: Link2, label: "Connections" },
    { id: "workflows", icon: Workflow, label: "Workflows" },
    { id: "account", icon: User, label: "User account" },
  ];

  const handleEditHotkey = (id: string) => {
    setEditingHotkey(id);
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keys: string[] = [];
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.shiftKey) keys.push("Shift");
      if (e.altKey) keys.push("Alt");
      if (e.key !== "Control" && e.key !== "Shift" && e.key !== "Alt") {
        keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      if (keys.length > 0) {
        setHotkeys(hotkeys.map(h => h.id === id ? { ...h, keys } : h));
        setEditingHotkey(null);
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
  };

  const handleClearHotkey = (id: string) => {
    setHotkeys(hotkeys.map(h => h.id === id ? { ...h, keys: [] } : h));
  };

  const handleAddConnection = () => {
    if (!newConnection.name) {
      toast({ title: "Connection name is required", variant: "destructive" });
      return;
    }
    const connection: Connection = {
      id: Date.now().toString(),
      name: newConnection.name,
      type: newConnection.type as Connection["type"],
      status: "disconnected",
    };
    setConnections([...connections, connection]);
    setShowConnectionDialog(false);
    setNewConnection({ type: "google_drive", name: "" });
    toast({ title: "Connection added" });
  };

  const handleConnectService = (id: string) => {
    setConnections(connections.map(c => 
      c.id === id ? { ...c, status: "connected", accountId: "user@example.com" } : c
    ));
    toast({ title: "Connected successfully" });
  };

  const handleAddWorkflow = () => {
    if (!newWorkflow.name) {
      toast({ title: "Workflow name is required", variant: "destructive" });
      return;
    }
    const workflow: WorkflowItem = {
      id: Date.now().toString(),
      name: newWorkflow.name,
      enabled: newWorkflow.enabled ?? true,
      scope: newWorkflow.scope ?? "all",
      triggers: newWorkflow.triggers ?? [],
      activities: newWorkflow.activities ?? [],
    };
    setWorkflows([...workflows, workflow]);
    setShowWorkflowDialog(false);
    setNewWorkflow({ name: "", enabled: true, scope: "all", triggers: [], activities: [] });
    toast({ title: "Workflow created" });
  };

  const renderHotkeyButton = (hotkey: HotkeyItem) => {
    const isEditing = editingHotkey === hotkey.id;
    
    return (
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/20 border border-primary rounded-md animate-pulse">
            <span className="text-sm text-primary">Press keys...</span>
          </div>
        ) : hotkey.keys.length > 0 ? (
          <div className="flex items-center gap-1">
            {hotkey.keys.map((key, i) => (
              <kbd key={i} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium">
                {key}
              </kbd>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not set</span>
        )}
        <Select
          value=""
          onValueChange={(value) => {
            if (value === "edit") handleEditHotkey(hotkey.id);
            if (value === "clear") handleClearHotkey(hotkey.id);
          }}
        >
          <SelectTrigger className="w-10 h-8 p-0 border-none">
            <ChevronDown className="w-4 h-4" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="edit">Edit</SelectItem>
            <SelectItem value="clear">Clear</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border/50 bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                data-testid={`settings-nav-${item.id}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-3xl">
            {activeSection === "application" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">Application</h1>
                <p className="text-muted-foreground mb-8">General application settings</p>

                <div className="space-y-6">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Start with Windows</p>
                      <p className="text-sm text-muted-foreground">Launch ClipSync when your computer starts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Start minimized</p>
                      <p className="text-sm text-muted-foreground">Start the application minimized to system tray</p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Show in taskbar</p>
                      <p className="text-sm text-muted-foreground">Display application icon in the taskbar</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Theme</p>
                      <p className="text-sm text-muted-foreground">Choose the application theme</p>
                    </div>
                    <Select defaultValue="dark">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Clipboard history limit</p>
                      <p className="text-sm text-muted-foreground">Maximum number of items to keep in history</p>
                    </div>
                    <Select defaultValue="500">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 items</SelectItem>
                        <SelectItem value="250">250 items</SelectItem>
                        <SelectItem value="500">500 items</SelectItem>
                        <SelectItem value="1000">1000 items</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "ignored" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">Ignored applications</h1>
                <p className="text-muted-foreground mb-8">Clipboard activity from these applications will not be recorded</p>

                <div className="space-y-3">
                  {ignoredApps.map(app => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-card rounded-lg border">
                      <div>
                        <p className="font-medium">{app.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{app.path}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIgnoredApps(ignoredApps.filter(a => a.id !== app.id))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add application
                  </Button>
                </div>
              </motion.div>
            )}

            {activeSection === "keyboard" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">Keyboard shortcuts</h1>
                <p className="text-muted-foreground mb-8">Manage application keyboard shortcuts</p>

                <div className="space-y-8">
                  {/* Global shortcuts */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Global shortcuts
                    </h3>
                    <div className="bg-card rounded-lg border divide-y">
                      {hotkeys.filter(h => h.category === "global").map(hotkey => (
                        <div key={hotkey.id} className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <Keyboard className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{hotkey.action}</p>
                              <p className="text-sm text-muted-foreground">{hotkey.description}</p>
                            </div>
                          </div>
                          {renderHotkeyButton(hotkey)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Paste window shortcuts */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <ClipboardPaste className="w-5 h-5" />
                      Paste window shortcuts
                    </h3>
                    <div className="bg-card rounded-lg border divide-y">
                      {hotkeys.filter(h => h.category === "paste").map(hotkey => (
                        <div key={hotkey.id} className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium">{hotkey.action}</p>
                            <p className="text-sm text-muted-foreground">{hotkey.description}</p>
                          </div>
                          {renderHotkeyButton(hotkey)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Navigation shortcuts */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <MousePointer className="w-5 h-5" />
                      Navigation shortcuts
                    </h3>
                    <div className="bg-card rounded-lg border divide-y">
                      {hotkeys.filter(h => h.category === "navigation").map(hotkey => (
                        <div key={hotkey.id} className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium">{hotkey.action}</p>
                            <p className="text-sm text-muted-foreground">{hotkey.description}</p>
                          </div>
                          {renderHotkeyButton(hotkey)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "extensions" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">Extensions</h1>
                <p className="text-muted-foreground mb-8">Extend ClipSync functionality with plugins</p>

                <div className="space-y-4">
                  <div className="p-6 bg-card rounded-lg border">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">AI Assistant</h4>
                          <p className="text-sm text-muted-foreground">AI-powered text processing and suggestions</p>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">Built-in</Badge>
                      <Badge variant="outline">v1.2.0</Badge>
                    </div>
                  </div>

                  <div className="p-6 bg-card rounded-lg border">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-medium">URL Preview</h4>
                          <p className="text-sm text-muted-foreground">Preview URLs and links in clipboard</p>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">Built-in</Badge>
                      <Badge variant="outline">v1.0.0</Badge>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Browse extensions
                  </Button>
                </div>
              </motion.div>
            )}

            {activeSection === "connections" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">Connections</h1>
                <p className="text-muted-foreground mb-8">Connect to external services for sync and backup</p>

                <div className="space-y-4">
                  {connections.map(conn => (
                    <div key={conn.id} className="p-4 bg-card rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            {connectionTypes.find(t => t.value === conn.type)?.icon && (
                              <Cloud className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{conn.name}</h4>
                            <p className="text-xs text-muted-foreground capitalize">{conn.type.replace("_", " ")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conn.status === "connected" ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Connected</Badge>
                          ) : conn.status === "error" ? (
                            <Badge variant="destructive">Error</Badge>
                          ) : (
                            <Badge variant="secondary">Disconnected</Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setConnections(connections.filter(c => c.id !== conn.id))}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {conn.status === "connected" && conn.accountId && (
                        <p className="text-sm text-muted-foreground mb-3">
                          External account: <span className="text-green-500">{conn.accountId}</span>
                        </p>
                      )}
                      {conn.status !== "connected" && (
                        <div className="bg-muted/50 rounded-md p-3 mb-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm">
                              <p>Connecting requires authentication via OAuth2.</p>
                              <a href="#" className="text-primary hover:underline flex items-center gap-1 mt-1">
                                https://accounts.google.com <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                      {conn.status !== "connected" && (
                        <Button onClick={() => handleConnectService(conn.id)} size="sm">
                          <Link2 className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button variant="outline" className="w-full" onClick={() => setShowConnectionDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add connection
                  </Button>
                </div>
              </motion.div>
            )}

            {activeSection === "workflows" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">Workflows</h1>
                <p className="text-muted-foreground mb-8">Automate clipboard actions with custom workflows</p>

                <div className="space-y-4">
                  {workflows.map(wf => (
                    <Collapsible key={wf.id}>
                      <div className="bg-card rounded-lg border">
                        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              wf.enabled ? "bg-primary/10" : "bg-muted"
                            )}>
                              <Workflow className={cn("w-5 h-5", wf.enabled ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="text-left">
                              <h4 className="font-medium">{wf.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {wf.triggers.length} trigger{wf.triggers.length !== 1 ? "s" : ""} • 
                                {wf.activities.length} action{wf.activities.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={wf.enabled} 
                              onCheckedChange={(checked) => {
                                setWorkflows(workflows.map(w => 
                                  w.id === wf.id ? { ...w, enabled: checked } : w
                                ));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-2 border-t space-y-4">
                            <div>
                              <p className="text-sm font-medium mb-2">Application scope</p>
                              <Select value={wf.scope}>
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">In all applications</SelectItem>
                                  <SelectItem value="specific">Specific applications</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">Triggers</p>
                              <div className="flex flex-wrap gap-2">
                                {wf.triggers.map((t, i) => (
                                  <Badge key={i} variant="secondary">{t}</Badge>
                                ))}
                                <Button variant="outline" size="sm">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add trigger
                                </Button>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">Activities</p>
                              <div className="flex flex-wrap gap-2">
                                {wf.activities.map((a, i) => (
                                  <Badge key={i} variant="outline">{a}</Badge>
                                ))}
                                <Button variant="outline" size="sm">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add activity
                                </Button>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}

                  <Button variant="outline" className="w-full" onClick={() => setShowWorkflowDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create workflow
                  </Button>
                </div>
              </motion.div>
            )}

            {activeSection === "account" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-semibold text-primary mb-2">User account</h1>
                <p className="text-muted-foreground mb-8">Manage your account and sync settings</p>

                <div className="bg-card rounded-lg border p-6 mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Guest User</h3>
                      <p className="text-sm text-muted-foreground">Not signed in</p>
                    </div>
                  </div>
                  <Button>
                    <User className="w-4 h-4 mr-2" />
                    Sign in to sync
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Cloud sync</p>
                      <p className="text-sm text-muted-foreground">Sync clipboard across all your devices</p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Backup history</p>
                      <p className="text-sm text-muted-foreground">Automatically backup clipboard history</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Add Connection Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Define external connection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select connector type</label>
              <Select 
                value={newConnection.type} 
                onValueChange={(v) => setNewConnection({ ...newConnection, type: v as Connection["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectionTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Connection name</label>
              <Input 
                placeholder="My Connection"
                value={newConnection.name}
                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
              />
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                <p className="text-sm">
                  Connecting requires authentication via OAuth2. You will be redirected to grant the necessary permissions.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <div className="flex items-center gap-2 mr-auto text-sm text-amber-500">
              <AlertCircle className="w-4 h-4" />
              You have unsaved changes
            </div>
            <Button variant="outline" onClick={() => setShowConnectionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddConnection}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Workflow Dialog */}
      <Dialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Workflow name</label>
                <Input 
                  placeholder="My Workflow"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                />
                {!newWorkflow.name && (
                  <p className="text-xs text-amber-500 mt-1">The Workflow name field is required.</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch 
                  checked={newWorkflow.enabled} 
                  onCheckedChange={(checked) => setNewWorkflow({ ...newWorkflow, enabled: checked })}
                />
                <span className="text-sm">On</span>
              </div>
            </div>
            
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                <span className="text-sm font-medium">Application scope:</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Select 
                  value={newWorkflow.scope}
                  onValueChange={(v) => setNewWorkflow({ ...newWorkflow, scope: v as "all" | "specific" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">In all applications</SelectItem>
                    <SelectItem value="specific">Specific applications</SelectItem>
                  </SelectContent>
                </Select>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                <span className="text-sm font-medium">Trigger by any of the following events:</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Select onValueChange={(v) => setNewWorkflow({ 
                  ...newWorkflow, 
                  triggers: [...(newWorkflow.triggers || []), v] 
                })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newWorkflow.triggers?.map((t, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {t}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => setNewWorkflow({
                          ...newWorkflow,
                          triggers: newWorkflow.triggers?.filter((_, idx) => idx !== i)
                        })}
                      />
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                <span className="text-sm font-medium">Activities:</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Select onValueChange={(v) => setNewWorkflow({ 
                  ...newWorkflow, 
                  activities: [...(newWorkflow.activities || []), v] 
                })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityOptions.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newWorkflow.activities?.map((a, i) => (
                    <Badge key={i} variant="outline" className="gap-1">
                      {a}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => setNewWorkflow({
                          ...newWorkflow,
                          activities: newWorkflow.activities?.filter((_, idx) => idx !== i)
                        })}
                      />
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter className="mt-4">
            <div className="flex items-center gap-2 mr-auto text-sm text-amber-500">
              <AlertCircle className="w-4 h-4" />
              You have unsaved changes (new item)
            </div>
            <Button variant="outline" onClick={() => setShowWorkflowDialog(false)}>Cancel</Button>
            <Button onClick={handleAddWorkflow}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}