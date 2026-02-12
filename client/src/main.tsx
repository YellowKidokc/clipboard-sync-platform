import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Router } from "wouter";
import ClipboardPage from "./pages/clipboard";
import RulesPage from "./pages/rules";
import FoldersPage from "./pages/folders";
import PredictionsPage from "./pages/predictions";
import SettingsPage from "./pages/settings";

const queryClient = new QueryClient();

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <nav style={{ display: "flex", gap: 12, padding: 12 }}>
        <Link href="/">Clipboard</Link>
        <Link href="/rules">Rules</Link>
        <Link href="/folders">Folders</Link>
        <Link href="/predictions">Predictions</Link>
        <Link href="/settings">Settings</Link>
      </nav>
      <Router>
        <Route path="/" component={ClipboardPage} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/folders" component={FoldersPage} />
        <Route path="/predictions" component={PredictionsPage} />
        <Route path="/settings" component={SettingsPage} />
      </Router>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
