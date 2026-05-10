import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ToxicFlowCandle, ToxicFlowSurface, ToxicFlowTerminal } from "@/lib/api";

type Interval = ToxicFlowTerminal["interval"];
type ChartPoint = ToxicFlowCandle;

const intervals: Interval[] = ["5m", "15m", "1h"];
const TERMINAL_ROUTE_LIMIT = 50;
const MIN_LEFT_WIDTH = 0;
const MAX_LEFT_WIDTH = 420;
const DEFAULT_LEFT_WIDTH = 260;
const MIN_RIGHT_WIDTH = 0;
const MAX_RIGHT_WIDTH = 500;
const DEFAULT_RIGHT_WIDTH = 316;
const MIN_GRAPH_WIDTH = 320;

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function actionLabel(action: ToxicFlowSurface["action"]) {
  if (action === "avoid") return "Block";
  if (action === "reroute") return "Reroute";
  if (action === "penalize") return "Penalize";
  if (action === "monitor") return "Monitor";
  return "Allow";
}

function actionTone(action: ToxicFlowSurface["action"]) {
  if (action === "avoid") return "border-red-500/50 bg-red-500/10 text-red-300";
  if (action === "reroute" || action === "penalize") return "border-yellow-500/45 bg-yellow-500/10 text-yellow-200";
  if (action === "allow") return "border-green-500/40 bg-green-500/10 text-green-300";
  return "border-primary/35 bg-primary/10 text-primary";
}

function surfaceEventCount(surface: ToxicFlowSurface) {
  return surface.candles.reduce((sum, candle) => sum + candle.attack_count, 0);
}

function surfaceObservedValue(surface: ToxicFlowSurface) {
  return surface.candles.reduce((sum, candle) => sum + candle.loss_at_risk_usd, 0);
}

function toChartPoint(candle: ToxicFlowCandle): ChartPoint {
  return candle;
}

function findNearestCandle(candles: ChartPoint[], timestamp: string) {
  if (candles.length === 0) return null;
  const eventTime = new Date(timestamp).getTime();
  if (!Number.isFinite(eventTime)) return null;

  return candles.reduce((nearest, candle) => {
    const nearestDistance = Math.abs(new Date(nearest.timestamp).getTime() - eventTime);
    const candleDistance = Math.abs(new Date(candle.timestamp).getTime() - eventTime);
    return candleDistance < nearestDistance ? candle : nearest;
  }, candles[0]);
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload.find((item: any) => item?.payload?.timestamp)?.payload as ToxicFlowCandle | undefined;
  if (!row) return null;

  return (
    <div className="border border-border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">{row.label}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 font-mono text-[11px]">
        <span className="text-muted-foreground">Observed value</span>
        <span className="text-right text-red-300">{formatUsd(row.loss_at_risk_usd)}</span>
        <span className="text-muted-foreground">Prevented</span>
        <span className="text-right text-primary">{formatUsd(row.prevented_loss_usd)}</span>
        <span className="text-muted-foreground">Events</span>
        <span className="text-right text-foreground">{row.attack_count}</span>
        <span className="text-muted-foreground">Observed bps</span>
        <span className="text-right text-primary">{row.markout_bps.toFixed(2)} bps</span>
        <span className="text-muted-foreground">Type</span>
        <span className="text-right text-foreground">{row.event_type ? row.event_type.replace(/_/g, " ") : "none"}</span>
      </div>
    </div>
  );
}

function TerminalSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex h-12 items-center border-b border-border/70 bg-card px-4 font-mono text-[12px] uppercase tracking-[0.16em] text-primary">
        Loading Flow Terminal
        <span className="ml-3 h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      </div>
      <div className="grid min-h-[calc(100vh-3rem)] lg:grid-cols-[260px_10px_minmax(0,1fr)_10px_316px]">
        <div className="animate-pulse border-r border-border/70 bg-card/60" />
        <div className="hidden animate-pulse bg-border/40 lg:block" />
        <div className="p-4">
          <div className="h-10 animate-pulse border border-border/70 bg-card/70" />
          <div className="mt-4 h-[58vh] animate-pulse border border-border/70 bg-card/40" />
        </div>
        <div className="hidden animate-pulse bg-border/40 lg:block" />
        <div className="hidden animate-pulse border-l border-border/70 bg-card/60 lg:block" />
      </div>
    </main>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
        <p className="data-label text-primary">// Flow Terminal</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">No route signal yet.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          QuickNode stream data will populate this surface as routes are observed.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 border border-primary/60 px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Retry feed
        </button>
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-start justify-center">
        <div className="w-full border border-red-500/40 bg-red-500/10 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-red-300">Feed error</p>
          <h1 className="mt-2 text-2xl font-semibold">Terminal unavailable.</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 border border-red-400/60 px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-red-200 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Retry
          </button>
        </div>
      </div>
    </main>
  );
}

function ChartLoadingOverlay({ interval }: { interval: Interval }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-2 z-10 grid place-items-center border border-primary/20 bg-background/72 backdrop-blur-sm"
    >
      <span className="sr-only">Loading {interval} toxic flow signal</span>
      <div className="flex items-center gap-3 border border-border/80 bg-card/90 px-4 py-3 shadow-2xl">
        <div className="relative grid h-10 w-10 place-items-center">
          <div className="absolute inset-0 border border-primary/35 motion-safe:animate-spin" />
          <img
            src="/intelleum-logo.png"
            alt=""
            aria-hidden="true"
            className="h-6 w-6 object-contain drop-shadow-[0_0_14px_hsl(var(--primary)/0.45)]"
          />
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Loading {interval} signal
        </div>
      </div>
    </div>
  );
}

export default function FlowTerminal() {
  const [data, setData] = useState<ToxicFlowTerminal | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedCandleTs, setSelectedCandleTs] = useState<string | null>(null);
  const [copiedRoute, setCopiedRoute] = useState(false);
  const [interval, setSelectedInterval] = useState<Interval>("5m");
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [resizeTarget, setResizeTarget] = useState<"left" | "right" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTerminal = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.toxicFlowTerminal(TERMINAL_ROUTE_LIMIT, interval);
      setData(next);
      setSelectedKey((current) => current ?? next.surfaces[0]?.route_key ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terminal feed failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTerminal();
    const timer = window.setInterval(() => {
      void api.toxicFlowTerminal(TERMINAL_ROUTE_LIMIT, interval).then(setData).catch(() => {});
    }, 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  const selected = useMemo(() => {
    if (!data?.surfaces.length) return null;
    return data.surfaces.find((surface) => surface.route_key === selectedKey) ?? data.surfaces[0];
  }, [data, selectedKey]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return [...(selected?.candles ?? [])]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(toChartPoint);
  }, [selected]);

  const latest = chartData[chartData.length - 1] ?? null;
  const activeCandleIndex = useMemo(() => {
    if (chartData.length === 0) return -1;
    const selectedIndex = chartData.findIndex((candle) => candle.timestamp === selectedCandleTs);
    if (selectedIndex >= 0) return selectedIndex;
    if (!selectedCandleTs) return chartData.length - 1;

    const selectedTime = new Date(selectedCandleTs).getTime();
    if (!Number.isFinite(selectedTime)) return chartData.length - 1;

    return chartData.reduce((nearestIndex, candle, index) => {
      const nearestDistance = Math.abs(new Date(chartData[nearestIndex].timestamp).getTime() - selectedTime);
      const candleDistance = Math.abs(new Date(candle.timestamp).getTime() - selectedTime);
      return candleDistance < nearestDistance ? index : nearestIndex;
    }, 0);
  }, [chartData, selectedCandleTs]);
  const activeCandle = activeCandleIndex >= 0 ? chartData[activeCandleIndex] : null;
  const observedValueDomain = useMemo<[number, number]>(() => {
    const max = Math.max(1, ...chartData.map((candle) => candle.loss_at_risk_usd));
    return [0, Number((max * 1.18).toFixed(2))];
  }, [chartData]);
  const eventCountDomain = useMemo<[number, number]>(() => {
    const max = Math.max(1, ...chartData.map((candle) => candle.attack_count));
    return [0, max + 1];
  }, [chartData]);
  const eventBucketCount = useMemo(
    () => chartData.filter((candle) => candle.attack_count > 0).length,
    [chartData],
  );
  const totalEventCount = useMemo(
    () => chartData.reduce((sum, candle) => sum + candle.attack_count, 0),
    [chartData],
  );
  const observedValueUsd = useMemo(
    () => chartData.reduce((sum, candle) => sum + candle.loss_at_risk_usd, 0),
    [chartData],
  );
  const isBaselineOnly = data?.source === "chain" && chartData.length > 0 && totalEventCount === 0;
  const rawCandleCount = selected?.candles.length ?? 0;
  const gridStyle = {
    "--left-panel-width": `${leftWidth}px`,
    "--right-panel-width": `${rightWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    setSelectedCandleTs(null);
    setCopiedRoute(false);
  }, [selected?.route_key, interval]);

  const selectCandleByTimestamp = (timestamp: string) => {
    const candle = findNearestCandle(chartData, timestamp);
    setSelectedCandleTs(candle?.timestamp ?? timestamp);
  };

  const handleChartPointer = (state: any) => {
    const candle = state?.activePayload?.find((item: any) => item?.payload?.timestamp)?.payload as ChartPoint | undefined;
    if (candle?.timestamp) selectCandleByTimestamp(candle.timestamp);
  };

  const copyRouteKey = async () => {
    try {
      await navigator.clipboard.writeText(selected.route_key);
      setCopiedRoute(true);
      window.setTimeout(() => setCopiedRoute(false), 1200);
    } catch {
      setCopiedRoute(false);
    }
  };

  const leftMax = () => Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, window.innerWidth - rightWidth - MIN_GRAPH_WIDTH));
  const rightMax = () => Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, window.innerWidth - leftWidth - MIN_GRAPH_WIDTH));

  const setClampedLeftWidth = (value: number) => {
    setLeftWidth(clamp(value, MIN_LEFT_WIDTH, leftMax()));
  };

  const setClampedRightWidth = (value: number) => {
    setRightWidth(clamp(value, MIN_RIGHT_WIDTH, rightMax()));
  };

  useEffect(() => {
    if (!resizeTarget) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      if (resizeTarget === "left") {
        const max = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, window.innerWidth - rightWidth - MIN_GRAPH_WIDTH));
        setLeftWidth(clamp(event.clientX, MIN_LEFT_WIDTH, max));
      } else {
        const max = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, window.innerWidth - leftWidth - MIN_GRAPH_WIDTH));
        setRightWidth(clamp(window.innerWidth - event.clientX, MIN_RIGHT_WIDTH, max));
      }
    };

    const stopResize = () => setResizeTarget(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [resizeTarget, leftWidth, rightWidth]);

  if (loading && !data) return <TerminalSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={loadTerminal} />;
  if (!data || data.surfaces.length === 0) return <EmptyState onRetry={loadTerminal} />;
  if (!selected) return <EmptyState onRetry={loadTerminal} />;

  return (
    <main className="min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <TerminalTopbar
        data={data}
        selected={selected}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      <div
        style={gridStyle}
        className="grid min-h-[calc(100vh-3rem)] lg:grid-cols-[var(--left-panel-width)_10px_minmax(0,1fr)_10px_var(--right-panel-width)]"
      >
        <MarketRail
          data={data}
          selectedKey={selected.route_key}
          onSelect={setSelectedKey}
        />

        <ResizeHandle
          label="Resize routes and graph"
          onPointerDown={() => setResizeTarget("left")}
          onNudge={(delta) => setClampedLeftWidth(leftWidth + delta)}
        />

        <section className="min-w-0 bg-background">
          <div className="flex min-h-12 flex-col gap-2 border-b border-border/70 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={copyRouteKey}
                title={`Copy route key: ${selected.route_key}`}
                className="truncate text-left text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-xl"
              >
                {selected.pair}
              </button>
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                {selected.protocol ?? "mixed"} · flow risk
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                {copiedRoute ? "Copied route key" : "Click pair to copy"}
              </span>
              <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${actionTone(selected.action)}`}>
                {actionLabel(selected.action)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[12px]">
              <TapeValue label="T" value={activeCandle?.label ?? latest?.label ?? "Live"} tone="accent" />
              <TapeValue label="Observed" value={formatUsd(observedValueUsd)} tone={observedValueUsd > 0 ? "bad" : undefined} />
              <TapeValue label="Preventable" value={formatUsd(selected.prevented_loss_24h_usd)} tone="accent" />
              <TapeValue label="Event buckets" value={`${eventBucketCount}/${chartData.length}`} tone={eventBucketCount > 0 ? "accent" : undefined} />
              <TapeValue label="Events" value={String(totalEventCount)} tone={totalEventCount > 0 ? "bad" : undefined} />
              <TapeValue label="Route risk" value={selected.risk_score.toFixed(0)} tone={selected.risk_score >= 80 ? "bad" : "accent"} />
            </div>
          </div>

          <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-border/70 px-3 py-1">
            {intervals.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedInterval(value)}
                className={[
                  "min-h-10 px-3 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  interval === value
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
            <div className="mx-2 h-5 w-px bg-border" />
            <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="text-primary">Observed detections</span>
              <span>X axis: time</span>
              <span>Left Y: detected value USD</span>
              <span>Right Y: event count</span>
              <span className={isBaselineOnly ? "text-yellow-300" : "text-primary"}>
                Event buckets: {eventBucketCount}/{chartData.length}
              </span>
              {isBaselineOnly && <span>No matched events in this terminal window</span>}
            </div>
            <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
              Source: {data.source === "chain" ? "QuickNode / chain" : "fallback demo"}
            </span>
          </div>

          <div className="relative h-[calc(100vh-17.5rem)] min-h-[360px] border-b border-border/70 p-2">
            {loading && <ChartLoadingOverlay interval={interval} />}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 8, bottom: 26, left: 4 }}
                onClick={handleChartPointer}
                onMouseMove={handleChartPointer}
              >
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.58} />
                <XAxis
                  dataKey="label"
                  minTickGap={28}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                />
                <YAxis
                  yAxisId="value"
                  domain={observedValueDomain}
                  tickFormatter={(value) => formatUsd(Number(value)).replace("$", "")}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  width={52}
                />
                <YAxis
                  yAxisId="events"
                  orientation="right"
                  domain={eventCountDomain}
                  tickFormatter={(value) => `${Number(value).toFixed(0)}`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  width={34}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.16 }} />
                <Bar
                  yAxisId="value"
                  dataKey="loss_at_risk_usd"
                  fill="hsl(0 85% 62%)"
                  fillOpacity={0.72}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="events"
                  type="stepAfter"
                  dataKey="attack_count"
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.95}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  isAnimationActive={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <EventTape selected={selected} activeCandle={activeCandle} onSelectCandle={selectCandleByTimestamp} rawCandleCount={rawCandleCount} />
        </section>

        <ResizeHandle
          label="Resize graph and inspector"
          onPointerDown={() => setResizeTarget("right")}
          onNudge={(delta) => setClampedRightWidth(rightWidth - delta)}
        />

        <Inspector selected={selected} activeCandle={activeCandle} />
      </div>
    </main>
  );
}

function TerminalTopbar({
  data,
  selected,
  selectedKey,
  onSelect,
}: {
  data: ToxicFlowTerminal;
  selected: ToxicFlowSurface;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <header className="flex h-12 items-center border-b border-border/70 bg-card/80 font-mono backdrop-blur">
      <Link
        to="/"
        className="flex h-full items-center border-r border-border/70 px-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Intelleum
      </Link>
      <div className="hidden h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 md:flex">
        {data.surfaces.slice(0, 7).map((surface, index) => (
          <button
            key={surface.route_key}
            type="button"
            onClick={() => onSelect(surface.route_key)}
            className={[
              "flex h-9 shrink-0 items-center gap-2 px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selectedKey === surface.route_key
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            ].join(" ")}
          >
            <span className="text-muted-foreground">#{index + 1}</span>
            <span>{surface.pair}</span>
            <span className={surfaceEventCount(surface) > 0 ? "text-red-300" : "text-primary"}>
              {surfaceEventCount(surface)} evt
            </span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex h-full items-center border-l border-border/70 px-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {selected.pair}
      </div>
    </header>
  );
}

function MarketRail({
  data,
  selectedKey,
  onSelect,
}: {
  data: ToxicFlowTerminal;
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <aside className="min-w-0 overflow-hidden border-r border-border/70 bg-card/35 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="flex h-10 items-center justify-between border-b border-border/70 px-3 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-muted-foreground">Routes</span>
        <span className="text-primary">{data.summary.surfaces_tracked}</span>
      </div>
      <div className="divide-y divide-border/70">
        {data.surfaces.map((surface) => (
          <button
            key={surface.route_key}
            type="button"
            onClick={() => onSelect(surface.route_key)}
            className={[
              "grid min-h-16 w-full grid-cols-[1fr_auto] gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selectedKey === surface.route_key
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="truncate font-mono text-[13px] uppercase tracking-[0.12em] text-foreground">{surface.pair}</div>
              <div className="mt-1 truncate text-[12px]">{surface.protocol ?? "mixed route"}</div>
            </div>
            <div className="text-right font-mono">
              <div className={surfaceEventCount(surface) > 0 ? "text-red-300" : "text-primary"}>
                {surfaceEventCount(surface)}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {formatUsd(surfaceObservedValue(surface))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ResizeHandle({
  label,
  onPointerDown,
  onNudge,
}: {
  label: string;
  onPointerDown: () => void;
  onNudge: (delta: number) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        onPointerDown();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onNudge(-24);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onNudge(24);
        }
      }}
      className="group hidden cursor-col-resize border-x border-border/70 bg-card/30 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex lg:h-[calc(100vh-3rem)] lg:items-center lg:justify-center"
    >
      <span className="h-12 w-px bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
    </button>
  );
}

function Inspector({ selected, activeCandle }: { selected: ToxicFlowSurface; activeCandle: ChartPoint | null }) {
  const selectedEvents = surfaceEventCount(selected);
  const observedValue = surfaceObservedValue(selected);

  return (
    <aside className="overflow-hidden bg-card/35 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="border-b border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold tracking-tight">{selected.pair}</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {selected.protocol ?? "route"}
            </div>
          </div>
          <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${actionTone(selected.action)}`}>
            {actionLabel(selected.action)}
          </span>
        </div>

        <Link
          to="/protection"
          className="mt-4 block min-h-10 border border-primary/50 px-4 py-3 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Open Guard
        </Link>
      </div>

      <div className="divide-y divide-border/70 border-b border-border/70 font-mono">
        <StatRow label="Observed value" value={formatUsd(observedValue)} tone={observedValue > 0 ? "bad" : undefined} />
        <StatRow label="Preventable" value={formatUsd(selected.prevented_loss_24h_usd)} tone="accent" />
        <StatRow label="Events" value={String(selectedEvents)} tone={selectedEvents > 0 ? "bad" : undefined} />
        <StatRow label="Swap volume" value={formatUsd(selected.volume_24h_usd)} />
        <StatRow label="Risk" value={selected.risk_score.toFixed(0)} tone={selected.risk_score >= 80 ? "bad" : "accent"} />
        <StatRow label="Route markout" value={`${selected.markout_30s_bps.toFixed(2)} bps`} />
      </div>

      {activeCandle && (
        <div className="divide-y divide-border/70 border-b border-border/70 font-mono">
          <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Selected</span>
            <span className="text-primary">{activeCandle.label}</span>
          </div>
          <StatRow label="Events" value={String(activeCandle.attack_count)} />
          <StatRow label="Observed value" value={formatUsd(activeCandle.loss_at_risk_usd)} tone={activeCandle.loss_at_risk_usd > 0 ? "bad" : undefined} />
          <StatRow label="Preventable" value={formatUsd(activeCandle.prevented_loss_usd)} tone="accent" />
          <StatRow label="Observed bps" value={`${activeCandle.markout_bps.toFixed(2)} bps`} />
          <StatRow label="Bucket signal" value={`${activeCandle.toxic_flow_score.toFixed(1)} / 100`} tone={activeCandle.toxic_flow_score >= 75 ? "bad" : "accent"} />
        </div>
      )}

      <div className="border-b border-border/70 p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Signals</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.reason_codes.slice(0, 4).map((reason) => (
            <span
              key={reason}
              className="border border-border/70 bg-background/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground"
            >
              {reason.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Events</div>
        <div className="mt-3 divide-y divide-border/70 border border-border/70">
          {selected.overlays.slice(0, 5).map((event) => (
            <div key={`${event.timestamp}-${event.event_type}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 font-mono text-[11px]">
              <span className="truncate text-foreground">{event.event_type.replace(/_/g, " ")}</span>
              <span className={event.severity === "critical" ? "text-red-300" : "text-primary"}>
                {formatUsd(event.loss_usd)}
              </span>
            </div>
          ))}
          {selected.overlays.length === 0 && (
            <div className="px-3 py-3 font-mono text-[11px] text-muted-foreground">No event overlay.</div>
          )}
        </div>
      </div>
    </aside>
  );
}

function EventTape({
  selected,
  activeCandle,
  onSelectCandle,
  rawCandleCount,
}: {
  selected: ToxicFlowSurface;
  activeCandle: ChartPoint | null;
  onSelectCandle: (timestamp: string) => void;
  rawCandleCount: number;
}) {
  const events = selected.overlays.slice(0, 4);
  return (
    <div className="hidden h-28 grid-cols-[160px_1fr] border-b border-border/70 md:grid">
      <div className="border-r border-border/70 p-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <div>Recent events</div>
        {rawCandleCount > 0 && rawCandleCount < 24 && (
          <div className="mt-2 text-[10px] text-yellow-300">
            {rawCandleCount} raw points
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 divide-x divide-border/70">
        {events.map((event) => (
          <button
            key={`${event.timestamp}-${event.event_type}`}
            type="button"
            onClick={() => onSelectCandle(event.timestamp)}
            className={[
              "min-w-0 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeCandle?.timestamp === event.timestamp
                ? "bg-primary/10"
                : "hover:bg-card/70",
            ].join(" ")}
          >
            <div className="truncate font-mono text-[12px] uppercase tracking-[0.12em] text-foreground">
              {event.event_type.replace(/_/g, " ")}
            </div>
            <div className="mt-2 font-mono text-[12px] text-primary">{formatUsd(event.loss_usd)}</div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">{event.confidence.toFixed(0)} conf</div>
          </button>
        ))}
        {events.length === 0 && (
          <div className="col-span-4 p-3 font-mono text-[12px] text-muted-foreground">No recent overlay events.</div>
        )}
      </div>
    </div>
  );
}

function TapeValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "good" | "bad";
}) {
  const color = tone === "bad" ? "text-red-300" : tone === "good" || tone === "accent" ? "text-primary" : "text-foreground";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={color}>{value}</span>
    </span>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "bad";
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className={tone === "bad" ? "text-red-300" : tone === "accent" ? "text-primary" : "text-foreground"}>
        {value}
      </span>
    </div>
  );
}
