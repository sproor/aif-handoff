import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Moon,
  Sun,
  Command,
  ChartColumn,
  Map,
  Loader2,
  Settings,
  Check,
  X as XIcon,
} from "lucide-react";
import type { AifConfig } from "@/lib/api";
import { ConfigEditor } from "@/components/settings/ConfigEditor";
import { useTheme } from "@/hooks/useTheme";
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  useNotificationSettings,
} from "@/hooks/useNotificationSettings";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import type { Project } from "@aif/shared/browser";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaskMetricsSummary } from "@/lib/taskMetrics";
import { api } from "@/lib/api";

export interface RoadmapImportResult {
  roadmapAlias: string;
  created: number;
  skipped: number;
  taskIds: string[];
}

interface Props {
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onDeselectProject: () => void;
  onOpenCommandPalette: () => void;
  density: "comfortable" | "compact";
  onDensityChange: (density: "comfortable" | "compact") => void;
  viewMode: "kanban" | "list";
  onViewModeChange: (mode: "kanban" | "list") => void;
  taskMetrics: TaskMetricsSummary;
  onRoadmapImportComplete?: (result: RoadmapImportResult) => void;
}

export function Header({
  selectedProject,
  onSelectProject,
  onDeselectProject,
  onOpenCommandPalette,
  density,
  onDensityChange,
  viewMode,
  onViewModeChange,
  taskMetrics,
  onRoadmapImportComplete,
}: Props) {
  const { theme, toggleTheme } = useTheme();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const h = `${el.offsetHeight}px`;
    document.documentElement.style.setProperty("--header-height", h);
  }, [density]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [roadmapAlias, setRoadmapAlias] = useState("");
  const [roadmapVision, setRoadmapVision] = useState("");
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [roadmapResult, setRoadmapResult] = useState<RoadmapImportResult | null>(null);
  const [roadmapExists, setRoadmapExists] = useState<boolean | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [mcpInstalled, setMcpInstalled] = useState<boolean | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [configExists, setConfigExists] = useState<boolean | null>(null);
  const [configData, setConfigData] = useState<AifConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const { settings, setSettings } = useNotificationSettings();
  const permission = getDesktopNotificationPermission();
  const isCompact = density === "compact";
  const integerFormatter = new Intl.NumberFormat("en-US");
  const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatInteger = (value: number) => integerFormatter.format(Math.round(value));
  const formatUsd = (value: number) => usdFormatter.format(value);
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const handleDesktopNotificationsToggle = useCallback(async () => {
    const next = !settings.desktop;
    if (!next) {
      setSettings({ desktop: false });
      return;
    }

    const result = await requestDesktopNotificationPermission();
    if (result === "granted") {
      setSettings({ desktop: true });
      return;
    }

    setSettings({ desktop: false });
  }, [setSettings, settings.desktop]);

  const handleSoundToggle = useCallback(() => {
    setSettings({ sound: !settings.sound });
  }, [setSettings, settings.sound]);

  const handleRoadmapGenerate = useCallback(async () => {
    if (!selectedProject || !roadmapAlias.trim()) return;
    setRoadmapLoading(true);
    setRoadmapError(null);
    setRoadmapResult(null);
    try {
      console.debug("[roadmap] Starting generation with alias:", roadmapAlias);
      await api.generateRoadmap(
        selectedProject.id,
        roadmapAlias.trim(),
        roadmapVision.trim() || undefined,
      );
      // Server returns 202 immediately — result comes via WebSocket
      console.debug("[roadmap] Generation started, waiting for WS event...");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[roadmap] Failed to start generation:", message);
      setRoadmapError(message);
      setRoadmapLoading(false);
    }
  }, [selectedProject, roadmapAlias, roadmapVision]);

  const handleRoadmapImport = useCallback(async () => {
    if (!selectedProject || !roadmapAlias.trim()) return;
    setImportLoading(true);
    setRoadmapError(null);
    setRoadmapResult(null);
    try {
      console.debug("[roadmap] Starting import with alias:", roadmapAlias);
      const result = await api.importRoadmap(selectedProject.id, roadmapAlias.trim());
      console.debug("[roadmap] Import complete:", result);
      setRoadmapResult(result);
      setImportLoading(false);
      onRoadmapImportComplete?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[roadmap] Import failed:", message);
      setRoadmapError(message);
      setImportLoading(false);
    }
  }, [selectedProject, roadmapAlias, onRoadmapImportComplete]);

  // Listen for roadmap WS events
  useEffect(() => {
    const handleComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (selectedProject && detail.projectId === selectedProject.id) {
        console.debug("[roadmap] Generation complete:", detail);
        setRoadmapResult(detail);
        setRoadmapLoading(false);
        onRoadmapImportComplete?.(detail);
      }
    };
    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (selectedProject && detail.projectId === selectedProject.id) {
        console.error("[roadmap] Generation error:", detail);
        setRoadmapError(detail.error);
        setRoadmapLoading(false);
      }
    };

    window.addEventListener("roadmap:complete", handleComplete);
    window.addEventListener("roadmap:error", handleError);
    return () => {
      window.removeEventListener("roadmap:complete", handleComplete);
      window.removeEventListener("roadmap:error", handleError);
    };
  }, [selectedProject, onRoadmapImportComplete]);

  return (
    <header ref={headerRef} className="sticky top-0 z-60 border-b border-border bg-background">
      <div
        className={`mx-auto flex w-full max-w-420 items-center ${isCompact ? "h-14 px-4 md:px-5" : "h-16 px-6 md:px-8"}`}
      >
        <div className="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-auto text-foreground"
            viewBox="110 -62 1150 1150"
            aria-label="Logo"
          >
            <path
              fill="currentColor"
              transform="translate(292.2076721191406,242.98760986328125)"
              d="M304.79233 7.01239l3.5 1.60001c13.12152 5.47189 24.57171 14.30096 33.20001 25.6 5 6.79999 8.70001 14.20001 12.29999 21.79999l1.29999 2.79999 20 43.29999 1 2.39999c9.83435 21.55914 19.86816 43.02673 30.10003 64.40002l15.70001 33.4 1 2.29999 3.20002 6.70001 1 2 6.69995 13.70001q-8.59998 6.29999-17.90003 11.5-9.30005 5.20001-18.09997 10.79999l-3 1.79999-3 1.70001-2.59998 1.6c-2.30121 1.62726-4.41418 3.5055-6.30005 5.60001l-1.20001-2.79999c-9.48712-21.57745-19.22107-43.04553-29.19995-64.40002l-4.79999-10.5-1.70001-3.60001c-1.20001-2.69998-1.20001-2.69998-1.20001-4.69998l-2-1-2-6q-1.59998-4-3.59998-8l-1-2.20001-5.40002-11.79999-1-2.29999-6.29999-13.6c-2.59998-5.79999-2.59998-5.79999-2.59998-8l-3-1 2 0-1-2.29999-5-10.60001-0.90002-1.89999q-6-12.70001-11.5-25.5-2.70001-6.20001-6.40002-11.79999c-1.20002-1.89999-1.20002-1.89999-2.20002-4-1.29998-2.5-2.5-2.89999-5-3.89999l-1.79998-1c-7.58136-4.14392-16.48554-5.14923-24.79999-2.80005-9.31189 3.69611-16.78742 10.92004-20.79999 20.1l-2.20001 4.79999-1.20001 2.70001q-8 17.29999-15.40003 34.79999l-9.39999 21.4c-14.29999 32.20001-14.29999 32.20001-27.9 64.70001q-3.20001 7.70001-6.70001 15.20001-6.5 14-12.6 28l-17.29996 39-1.20001 2.79999-1 2.29999c-1 1.90002-1 1.90002-0.79999 3.90002 45.25894 19.76428 95.26861 26.0155 144 18l2.40002-0.40002c18.90003-3.09998 54.90003-10.90003 68.59998-24.59998l4.09997-1.59998q8.20002-3.20001 15.70002-7.90002 5.79998-3.29999 11.90002-6.29999 9.90002-5 19.20001-10.79999l7.20001-4.29998 1.79999-1q12.90003-7.79999 26.09998-15.10001l2.20001-1.29999c28.10889-16.21713 57.46906-30.16153 87.80002-41.70004l3.19995-1.20001c70.40002-26.10001 135.6001-29 209.40002-28.79999l35.5-0.10001 2.5 0c4 0 7.5 0.10001 11.40003 1.10001l1-2 3.69995 0.5q9 0.89999 18.30005 0.5c1 3.20001 1 6 1 9.20001l0 3.20001-0.09998 3.4-0.90002 40.20001-171.59998 1-4 0.10001c-3 0-5.5-0.4-8.40002-1.10001l0 1.70001c1.29993 24.29999 1.19995 48.69998 1.09997 73.00003l0 18.09998c0.10315 24.16772-0.06347 48.33588-0.5 72.49994-0.40002 21.79999-0.40002 21.79999-2.59997 30.70001l-2 1-0.40003 3c-2.5 17.40002-15.20007 33.5-28.59997 44-18.70191 13.0799-41.79444 18.28741-64.30005 14.5-23.69995-4.29999-40.49997-16.70001-55.89999-34.40002-1.70002-2-1.70002-2-3.5-3.79999-1.59998-1.59998-2.29999-3.29999-3.29999-5.29999l-1.29999-1.70001q-3-4.40003-5.5-9.09998l-1-2c-2.84357-5.41247-5.51166-10.91534-8-16.5-0.94012-2.4906-2.36804-4.76843-4.20001-6.70001l-0.79999-2.5q-2.59998-7-6.09998-13.40002l-11.40002-23.20002q-7.5-15.5-15.20001-30.79998l-1.70001-3.5-1.59998-3c-1.20001-2.59998-1.20001-2.59998-2.20001-5.59998l-1.79999 1c-2.20001 1-2.20001 1-5.20001 2l-6.20001 3.59998q-11.70002 6.59997-23.79999 12.40002l-2.20001 1.09998c-29.2674 14.63415-60.64856 24.58844-93 29.5-13.79999 2.09997-27.79999 1.59997-41.70002 1.5l-10.59997 0-20.5-0.09998 0-2-1.70001 0c-7.28165 0.06213-14.54108-0.81171-21.59998-2.59998l-3.70001-0.79998c-22.10001-5-43.60001-11.70002-64-21.59998l-0.79999 2.59998q-1.79999 5-4 10l-0.89999 2-2.60001 5.79998q-5.89999 13.5-11.29999 27.20002-2.1 5.20001-4.6 10.20001-4.60001 9.79999-8.70002 19.79999l-1.39999 3.29998-14 33.70002-3 7.09997-0.89999 2.20001c-0.79999 2-0.79999 2-2.79999 5.09998-3 1-3 1-6 1l-5.60001 0c-3.60001 0-6.79999 0.29999-10.39999 1l-4-1-1.70001 0.40002q-6.20001 1.5-12.5 0.09998c-4-0.70001-8.20001-0.59998-12.4-0.59998l-7.29999 0q-3 0.20002-6.1 1.09998c-0.79999-2.29999-1.10001-3.59998-0.4-6l1.10001-2.09998 1.20001-2.40002q0.60001-1.40002 1.4-2.70001l2.79998-5.79999 1.5-3 6.4-14.20001 1.29999-3.09998 9-20.29999 1-2.5 88.49997-200.90002 11.20001-25c15.19833-34.50821 30.56515-68.94196 46.1-103.29999l1-2.20001q4.79999-10.79999 9.29999-21.79999c10-24.70001 25.9-43.60001 50.69998-54.19999 20.79999-8.3 51.40003-11.39999 71.90003-0.5m265.90005 233.99998l-2.20007 0.89999-12 5.10001c-16.82361 7.09863-33.40002 14.76978-49.69998 23l-2.20001 1.09998q-18 9.20001-34.79999 19.90002l1.5 3.20001 10.40002 22q9.59998 21 19.70001 41.5 7.39997 15.29999 14.4 30.5c8.79993 22.40003 8.79993 22.40003 25.79993 37.70001 8.14929 2.76178 17.01818 2.51349 25-0.70001 6.5-3.79999 9.70007-11.20001 11.70007-18.20001 1.79993-8 1.69995-15.79999 1.59997-24l0-31-0.09997-54.40002-0.09998-59.60001c-3.30005 0-6.20007 1.70001-9.09997 3"
            />
            <path
              fill="currentColor"
              transform="translate(491.9999694824219,245.8822021484375)"
              d="M476.70004 0.01779l49.60001 0 142.69995 0.10001q1.19995 4.3 1.09998 8.89999l0 9.20001-0.09998 33.9c-2.80005 1.39999-5.19995 1.10001-8.40002 1.1l-39.80005 0-114.7999-0.1-1 2-2-2q-4.40002-0.20001-8.70001-0.20001l-2.59998 0-7.70001 0.20001-4 0c-10.37579-0.14636-20.53015 3.005-29 9l-3 2c-8.59998 7.39999-9.90002 18.39999-11 29q-0.20001 7-0.20001 14l0 14 0.09997 10.20001 0.09998 19.89999c-2.59998 0.9-4.59998 1.29999-7.29999 1.60001-12.71252 1.58865-25.33069 3.85858-37.79993 6.79999q-6.5 1.39999-12.90002 2.6l0-84 2 0 0.20001-3.6c3.29175-21.03055 14.26599-40.09302 30.79999-53.5 18.20807-14.08756 40.6825-21.53198 63.70001-21.10001m-373.70001 185.10001c2.90002 1.39999 4.70001 3.70001 7 6l2.79999 2.89999 1.5 1.5q6.59997 6.79999 14 13 3.5 3.29999 6.90002 6.79999 4.79999 4.60001 9.79999 8.79999c-3.4602 4.28051-7.31006 8.23077-11.5 11.80002l-9.90002 9q-7.70002 7.39999-15.5 14.29998l-4.20002 4.10001c-1.89996 1.80002-1.89996 1.80002-3.89996 1.80002-4-4.5-4-4.5-4-7l-2 0 0-2-1.90002-0.70001c-2.5-1.5-3-2.70002-4.09998-5.29999 6.94958-7.20252 14.29425-14.013 22-20.4l3-2.6c-0.5-3.9-2-5.20001-5-7.60001l-4-3.39999 0-2-1.70001-0.70001c-2.55524-1.52649-4.85071-3.45063-6.79999-5.69999-2.07074-2.30206-4.3468-4.41079-6.79999-6.30001l-1.70001-1.29999 0-2c5.5-5 5.5-5 8-5l0.79999-1.70001c3.40002-6.20002 3.40002-6.20002 7.09997-6.4m-60.90002 0.10001l1.29999 1.1 9 7.60001q3 2.5 5.70001 5.29999l-2.59998 1.6c-3.09815 2.18277-5.94843 4.69773-8.49993 7.5q-3 3-5.90003 5.4-5.79999 5-11 10.5c9.40002 9.5 9.40002 9.5 19.29999 18.5q4 3.70001 7.70001 7.5c-1.29999 3.6-3.5 5.29999-6.40002 7.6-2.59998 2.20002-4.5 4.79999-6.59998 7.4-8.28333-7.01813-16.28943-14.35703-24-22l-4.70001-4.20001-2.60001-2.4-2.70001-2.39999-5.60001-5-2.6-2.29999-1.79999-1.70001c1.29999-3.79999 3-4.70001 6-7.20001q6.5-5 12.10001-10.9 3.79999-3.70001 8-7.20001 3.70001-3.39999 7.20001-7 4.09998-4 8.70001-7.70001"
            />
          </svg>
          <div className="h-5 w-px bg-border" />
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={onSelectProject}
            onDeselect={onDeselectProject}
          />
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <button
            onClick={onOpenCommandPalette}
            className="hidden h-8 items-center gap-1 border border-border bg-card px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/70 hover:text-foreground md:inline-flex"
            aria-label="Open command palette"
            type="button"
          >
            <Command className="h-3.5 w-3.5" />K
          </button>

          <div className="hidden h-8 border border-border bg-card md:flex">
            <button
              onClick={() => onViewModeChange("kanban")}
              className={`h-full px-2 text-[10px] font-mono transition-colors ${
                viewMode === "kanban"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
              type="button"
            >
              KANBAN
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={`h-full border-l border-border px-2 text-[10px] font-mono transition-colors ${
                viewMode === "list"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
              type="button"
            >
              LIST
            </button>
          </div>

          <div className="hidden h-8 border border-border bg-card md:flex">
            <button
              onClick={() => onDensityChange("comfortable")}
              className={`h-full px-2 text-[10px] font-mono transition-colors ${
                density === "comfortable"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
              type="button"
            >
              COMFY
            </button>
            <button
              onClick={() => onDensityChange("compact")}
              className={`h-full border-l border-border px-2 text-[10px] font-mono transition-colors ${
                density === "compact"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
              type="button"
            >
              COMPACT
            </button>
          </div>

          <button
            onClick={() => {
              if (roadmapOpen) {
                setRoadmapOpen(false);
                return;
              }
              setRoadmapAlias("");
              setRoadmapVision("");
              setRoadmapError(null);
              setRoadmapResult(null);
              setRoadmapExists(null);
              setImportLoading(false);
              setRoadmapOpen(true);
              if (selectedProject) {
                api.checkRoadmapStatus(selectedProject.id).then(
                  ({ exists }) => setRoadmapExists(exists),
                  () => setRoadmapExists(false),
                );
              }
            }}
            disabled={!selectedProject}
            className="inline-flex h-8 items-center gap-1 border border-border bg-card px-2 text-[10px] font-mono text-foreground transition-colors hover:border-primary/70 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Generate roadmap tasks"
            type="button"
          >
            <Map className="h-3.5 w-3.5" />
            <span className="hidden md:inline">ROADMAP</span>
          </button>
          <button
            onClick={() => setMetricsOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1 border border-border bg-card px-2 text-[10px] font-mono text-foreground transition-colors hover:border-primary/70 hover:bg-accent"
            aria-label="Task metrics"
            type="button"
          >
            <ChartColumn className="h-3.5 w-3.5" />
            <span className="hidden md:inline">METRICS</span>
          </button>
          <button
            onClick={() => {
              if (globalSettingsOpen) {
                setGlobalSettingsOpen(false);
                return;
              }
              setGlobalSettingsOpen(true);
              setMcpError(null);
              setMcpInstalled(null);
              setMcpLoading(false);
              api.getMcpStatus().then(
                (res) => setMcpInstalled(res.installed),
                () => setMcpInstalled(null),
              );
              setConfigData(null);
              api.getConfigStatus().then(
                (res) => {
                  setConfigExists(res.exists);
                  if (res.exists) {
                    setConfigLoading(true);
                    api.getConfig().then(
                      (r) => {
                        setConfigData(r.config);
                        setConfigLoading(false);
                      },
                      () => setConfigLoading(false),
                    );
                  }
                },
                () => setConfigExists(false),
              );
            }}
            className="inline-flex h-8 w-8 items-center justify-center border border-border bg-card text-foreground transition-colors hover:border-primary/70 hover:bg-accent"
            aria-label="Global settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center border border-border bg-card text-foreground transition-colors hover:border-primary/70 hover:bg-accent"
            aria-label="Notification settings"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center border border-border bg-card text-foreground transition-colors hover:border-primary/70 hover:bg-accent"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogClose onClose={() => setSettingsOpen(false)} />
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between border border-border bg-card/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Desktop notifications</p>
                <p className="text-xs text-muted-foreground">
                  Browser and OS alerts when a task changes status
                </p>
              </div>
              <button
                onClick={() => void handleDesktopNotificationsToggle()}
                className="min-w-16 border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/70"
              >
                {settings.desktop ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex items-center justify-between border border-border bg-card/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Sound</p>
                <p className="text-xs text-muted-foreground">
                  Play a short sound on task status change
                </p>
              </div>
              <button
                onClick={handleSoundToggle}
                className="min-w-16 border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/70"
              >
                {settings.sound ? "ON" : "OFF"}
              </button>
            </div>

            {permission === "unsupported" && (
              <p className="text-xs text-amber-400">
                This browser does not support desktop notifications.
              </p>
            )}
            {permission === "denied" && (
              <p className="text-xs text-amber-400">
                Desktop notifications are blocked in browser settings.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={metricsOpen} onOpenChange={setMetricsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogClose onClose={() => setMetricsOpen(false)} />
          <DialogHeader>
            <DialogTitle>Task Metrics</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Completed tasks</p>
              <p className="text-lg font-semibold">{formatInteger(taskMetrics.completedTasks)}</p>
              <p className="text-xs text-muted-foreground">
                {formatPercent(taskMetrics.completionRate)} of{" "}
                {formatInteger(taskMetrics.totalTasks)}
              </p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Total token usage</p>
              <p className="text-lg font-semibold">{formatInteger(taskMetrics.totalTokenTotal)}</p>
              <p className="text-xs text-muted-foreground">
                in {formatInteger(taskMetrics.totalTokenInput)} / out{" "}
                {formatInteger(taskMetrics.totalTokenOutput)}
              </p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Total cost</p>
              <p className="text-lg font-semibold">{formatUsd(taskMetrics.totalCostUsd)}</p>
              <p className="text-xs text-muted-foreground">
                avg {formatUsd(taskMetrics.averageCostPerTaskUsd)} per task
              </p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Average tokens per task</p>
              <p className="text-lg font-semibold">
                {formatInteger(taskMetrics.averageTokensPerTask)}
              </p>
              <p className="text-xs text-muted-foreground">across all tracked tasks</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-base font-medium">{formatInteger(taskMetrics.activeTasks)}</p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Blocked</p>
              <p className="text-base font-medium">{formatInteger(taskMetrics.blockedTasks)}</p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Backlog</p>
              <p className="text-base font-medium">{formatInteger(taskMetrics.backlogTasks)}</p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Verified</p>
              <p className="text-base font-medium">{formatInteger(taskMetrics.verifiedTasks)}</p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Auto mode tasks</p>
              <p className="text-base font-medium">{formatInteger(taskMetrics.autoModeTasks)}</p>
            </div>
            <div className="border border-border bg-card/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Fix tasks / Retries</p>
              <p className="text-base font-medium">
                {formatInteger(taskMetrics.fixTasks)} / {formatInteger(taskMetrics.totalRetries)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={roadmapOpen} onOpenChange={setRoadmapOpen}>
        <DialogContent>
          <DialogClose onClose={() => setRoadmapOpen(false)} />
          <DialogHeader>
            <DialogTitle>Generate Roadmap Tasks</DialogTitle>
          </DialogHeader>
          {roadmapResult ? (
            <div className="space-y-3">
              <div className="border border-green-500/30 bg-green-500/10 px-3 py-2">
                <p className="text-sm font-medium text-green-400">Roadmap generated</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {roadmapResult.created} task{roadmapResult.created !== 1 ? "s" : ""}
                  {roadmapResult.skipped > 0 &&
                    `, skipped ${roadmapResult.skipped} duplicate${roadmapResult.skipped !== 1 ? "s" : ""}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Alias:{" "}
                  <span className="font-mono text-foreground">{roadmapResult.roadmapAlias}</span>
                </p>
              </div>
              <button
                onClick={() => setRoadmapOpen(false)}
                className="w-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Generate a project roadmap from DESCRIPTION.md, then create backlog tasks
                automatically.
              </p>
              <div>
                <label htmlFor="roadmap-alias" className="block text-xs font-medium mb-1">
                  Roadmap alias
                </label>
                <input
                  id="roadmap-alias"
                  type="text"
                  value={roadmapAlias}
                  onChange={(e) => setRoadmapAlias(e.target.value)}
                  placeholder="e.g. v1.0, sprint-1, mvp"
                  className="w-full border border-border bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary/70 focus:outline-none"
                  disabled={roadmapLoading || importLoading}
                />
              </div>
              <div>
                <label htmlFor="roadmap-vision" className="block text-xs font-medium mb-1">
                  Vision / requirements{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="roadmap-vision"
                  value={roadmapVision}
                  onChange={(e) => setRoadmapVision(e.target.value)}
                  placeholder="Describe what you want to build, priorities, or constraints..."
                  rows={3}
                  className="w-full border border-border bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary/70 focus:outline-none resize-none"
                  disabled={roadmapLoading || importLoading}
                />
              </div>
              {roadmapError && <p className="text-xs text-destructive">{roadmapError}</p>}
              <div className={`grid gap-2 ${roadmapExists ? "grid-cols-2" : "grid-cols-1"}`}>
                <button
                  onClick={() => void handleRoadmapGenerate()}
                  disabled={roadmapLoading || importLoading || !roadmapAlias.trim()}
                  className="w-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {roadmapLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Roadmap"
                  )}
                </button>
                {roadmapExists && (
                  <button
                    onClick={() => void handleRoadmapImport()}
                    disabled={roadmapLoading || importLoading || !roadmapAlias.trim()}
                    className="w-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import Existing"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={globalSettingsOpen} onOpenChange={setGlobalSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogClose onClose={() => setGlobalSettingsOpen(false)} />
          <DialogHeader>
            <DialogTitle>Global Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between border border-border bg-card/50 px-3 py-2">
              <div className="flex-1 mr-3">
                <p className="text-sm font-medium">MCP Handoff Server</p>
                <p className="text-xs text-muted-foreground">
                  Enables Claude Code to read and sync tasks via MCP tools
                </p>
                {mcpInstalled === null && !mcpError && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking...
                  </p>
                )}
                {mcpInstalled === true && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Installed in ~/.claude.json
                  </p>
                )}
                {mcpInstalled === false && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <XIcon className="h-3 w-3" />
                    Not configured
                  </p>
                )}
                {mcpError && <p className="text-xs text-destructive mt-1">{mcpError}</p>}
              </div>
              <div>
                {mcpInstalled === false && (
                  <button
                    onClick={async () => {
                      setMcpLoading(true);
                      setMcpError(null);
                      try {
                        await api.installMcp();
                        setMcpInstalled(true);
                      } catch (err) {
                        setMcpError(err instanceof Error ? err.message : "Failed to install");
                      } finally {
                        setMcpLoading(false);
                      }
                    }}
                    disabled={mcpLoading}
                    className="min-w-20 border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/70 disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    {mcpLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Install"}
                  </button>
                )}
                {mcpInstalled === true && (
                  <button
                    onClick={async () => {
                      setMcpLoading(true);
                      setMcpError(null);
                      try {
                        await api.removeMcp();
                        setMcpInstalled(false);
                      } catch (err) {
                        setMcpError(err instanceof Error ? err.message : "Failed to remove");
                      } finally {
                        setMcpLoading(false);
                      }
                    }}
                    disabled={mcpLoading}
                    className="min-w-20 border border-border bg-background px-2 py-1 text-xs text-destructive transition-colors hover:border-destructive/70 disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    {mcpLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                  </button>
                )}
              </div>
            </div>

            {configExists && (
              <div className="border border-border bg-card/50 px-3 py-2">
                <p className="text-sm font-medium mb-0.5">AI Factory Config</p>
                <p className="text-xs text-muted-foreground mb-3">.ai-factory/config.yaml</p>
                {configLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : configData ? (
                  <ConfigEditor config={configData} onConfigChange={setConfigData} />
                ) : null}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
