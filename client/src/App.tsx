import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ClipboardPage from "@/pages/clipboard";
import RulesPage from "@/pages/rules";
import FoldersPage from "@/pages/folders";
import PredictionsPage from "@/pages/predictions";
import SettingsRoutePage from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClipboardPage}/>
      <Route path="/rules" component={RulesPage} />
      <Route path="/folders" component={FoldersPage} />
      <Route path="/predictions" component={PredictionsPage} />
      <Route path="/settings" component={SettingsRoutePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
