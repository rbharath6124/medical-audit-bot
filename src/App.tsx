import { useState } from "react";
import { StoreProvider } from "./store";
import { Sidebar, type View } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { DashboardView } from "./views/DashboardView";
import { UploadView } from "./views/UploadView";
import { QueueView } from "./views/QueueView";
import { ResultsView } from "./views/ResultsView";
import { SettingsView } from "./views/SettingsView";

const meta: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Real-time overview of your chart audit pipeline" },
  upload: { title: "Upload Charts", subtitle: "Upload PDF medical charts for AI review" },
  queue: { title: "Processing Queue", subtitle: "Monitor batch processing across your charts" },
  results: { title: "Audit Results", subtitle: "Review discrepancies and export audit reports" },
  settings: { title: "Settings", subtitle: "Configure API, compliance, and processing preferences" },
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <StoreProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
        <Sidebar view={view} setView={setView} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar title={meta[view].title} subtitle={meta[view].subtitle} />
          <div className="flex-1 overflow-y-auto">
            {view === "dashboard" && <DashboardView />}
            {view === "upload" && <UploadView onStarted={() => setView("queue")} />}
            {view === "queue" && <QueueView />}
            {view === "results" && <ResultsView />}
            {view === "settings" && <SettingsView />}
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}
