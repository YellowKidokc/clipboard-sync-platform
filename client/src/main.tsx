import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Router, useLocation } from "wouter";
import ClipboardPage from "./pages/clipboard";
import RulesPage from "./pages/rules";
import FoldersPage from "./pages/folders";
import PredictionsPage from "./pages/predictions";
import SettingsPage from "./pages/settings";

const queryClient = new QueryClient();

function App(): JSX.Element {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Clipboard" },
    { href: "/predictions", label: "Predictions" },
    { href: "/rules", label: "Rules" },
    { href: "/folders", label: "Folders" },
    { href: "/settings", label: "Settings" }
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <nav style={{ display: "flex", gap: 8, padding: 12, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#ffffff" }}>
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", background: location === link.href ? "#e2e8f0" : "transparent" }}>{link.label}</span>
          </Link>
        ))}
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
