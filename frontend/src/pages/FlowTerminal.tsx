import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ToxicFlowCandle, ToxicFlowSurface, ToxicFlowTerminal } from "@/lib/api";

type Interval = ToxicFlowTerminal["interval"];
type ChartPoint = ToxicFlowCandle & {
  body: [number, number];
  wick: [number, number];
};
type AttackMarkerPoint = {
  label: string;
  toxic_flow_score: number;
  timestamp: string;
  event_type: ToxicFlowSurface["overlays"][number]["event_type"];
  severity: ToxicFlowSurface["overlays"][number]["severity"];
  loss_usd: number;
  confidence: number;
};

const intervals: Interval[] = ["5m", "15m", "1h"];
const TERMINAL_ROUTE_LIMIT = 50;
const NAV_RAIL_WIDTH = 52;
const MIN_LEFT_WIDTH = 72;
const MAX_LEFT_WIDTH = 420;
const DEFAULT_LEFT_WIDTH = 260;
const MIN_RIGHT_WIDTH = 92;
const MAX_RIGHT_WIDTH = 500;
const DEFAULT_RIGHT_WIDTH = 316;
const MIN_GRAPH_WIDTH = 360;

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "0";
  return value.toFixed(digits);
}

function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0.00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
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

function priceFormatter(surface: ToxicFlowSurface | null, value: number) {
  if (!surface) return value.toFixed(2);
  if (surface.pair === "USDC/SOL") return value.toFixed(5);
  if (Math.abs(value) < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function candleColor(payload?: ToxicFlowCandle) {
  if (!payload) return "hsl(var(--muted-foreground))";
  return payload.close >= payload.open ? "hsl(var(--primary))" : "hsl(var(--destructive))";
}

function attackMarkerColor(eventType: string, severity?: string) {
  if (eventType === "sandwich") return "hsl(var(--destructive))";
  if (eventType === "jit") return "hsl(42 95% 58%)";
  if (eventType === "liquidation") return "hsl(204 94% 64%)";
  if (eventType === "arbitrage") return "hsl(156 72% 48%)";
  if (eventType === "backrun") return "hsl(282 75% 68%)";
  return severity === "critical" ? "hsl(var(--destructive))" : "hsl(var(--primary))";
}

function CandleWick(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const safeHeight = Math.max(1, Math.abs(height));
  return (
    <rect
      x={x + width / 2 - 0.5}
      y={height < 0 ? y + height : y}
      width={1}
      height={safeHeight}
      fill={candleColor(payload)}
      opacity={0.74}
    />
  );
}

function CandleBody(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const safeHeight = Math.max(2, Math.abs(height));
  const safeWidth = Math.max(3, Math.min(8, width * 0.72));
  return (
    <rect
      x={x + width / 2 - safeWidth / 2}
      y={height < 0 ? y + height : y - (safeHeight === 2 ? 1 : 0)}
      width={safeWidth}
      height={safeHeight}
      fill={candleColor(payload)}
      opacity={0.9}
    />
  );
}

function VolumeBar(props: any) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  return (
    <rect
      x={x}
      y={y}
      width={Math.max(1, width)}
      height={Math.max(1, height)}
      fill={candleColor(payload)}
      opacity={0.2}
    />
  );
}

function AttackMarkerShape(props: any) {
  const { cx = 0, cy = 0, payload } = props;
  const marker = payload as AttackMarkerPoint | undefined;
  const eventType = marker?.event_type ?? "attack";
  const color = attackMarkerColor(eventType, marker?.severity);
  const size = marker?.severity === "critical" ? 7 : 5;

  if (eventType === "sandwich") {
    return (
      <path
        d={`M ${cx} ${cy - size} L ${cx + size} ${cy + size} L ${cx - size} ${cy + size} Z`}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />
    );
  }

  if (eventType === "jit") {
    return (
      <rect
        x={cx - size}
        y={cy - size}
        width={size * 2}
        height={size * 2}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />
    );
  }

  if (eventType === "liquidation") {
    return (
      <path
        d={`M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />
    );
  }

  if (eventType === "backrun") {
    return (
      <path
        d={`M ${cx - size} ${cy - size} L ${cx + size} ${cy - size} L ${cx + size} ${cy + size} L ${cx - size} ${cy + size} Z M ${cx - size} ${cy} L ${cx + size} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={size}
      fill={color}
      stroke="hsl(var(--background))"
      strokeWidth={1.5}
    />
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload.find((item: any) => item?.payload?.open != null)?.payload as ToxicFlowCandle | undefined;
  if (!row) return null;
  const attack = payload.find((item: any) => item?.payload?.loss_usd)?.payload as AttackMarkerPoint | undefined;

  return (
    <div className="border border-border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">{row.label}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 font-mono text-[11px]">
        <span className="text-muted-foreground">O</span>
        <span className="text-right text-foreground">{row.open}</span>
        <span className="text-muted-foreground">H</span>
        <span className="text-right text-foreground">{row.high}</span>
        <span className="text-muted-foreground">L</span>
        <span className="text-right text-foreground">{row.low}</span>
        <span className="text-muted-foreground">C</span>
        <span className="text-right text-foreground">{row.close}</span>
        <span className="text-muted-foreground">Toxic</span>
        <span className="text-right text-primary">{row.toxic_flow_score.toFixed(1)}</span>
        <span className="text-muted-foreground">Saved</span>
        <span className="text-right text-primary">{formatUsd(row.prevented_loss_usd)}</span>
        {attack && (
          <>
            <span className="text-muted-foreground">Attack</span>
            <span className="text-right text-red-300">{attack.event_type.replace(/_/g, " ")}</span>
            <span className="text-muted-foreground">Attack loss</span>
            <span className="text-right text-red-300">{formatUsd(attack.loss_usd)}</span>
          </>
        )}
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
      <div className="grid min-h-[calc(100vh-3rem)] lg:grid-cols-[52px_260px_10px_minmax(0,1fr)_10px_316px]">
        <div className="hidden animate-pulse border-r border-border/70 bg-card/60 lg:block" />
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
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">No route candles yet.</h1>
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
    return (selected?.candles ?? []).map((candle) => ({
      ...candle,
      body: [Math.min(candle.open, candle.close), Math.max(candle.open, candle.close)],
      wick: [candle.low, candle.high],
    }));
  }, [selected]);

  const latest = chartData[chartData.length - 1] ?? null;
  const activeCandleIndex = useMemo(() => {
    if (chartData.length === 0) return -1;
    const selectedIndex = chartData.findIndex((candle) => candle.timestamp === selectedCandleTs);
    return selectedIndex >= 0 ? selectedIndex : chartData.length - 1;
  }, [chartData, selectedCandleTs]);
  const activeCandle = activeCandleIndex >= 0 ? chartData[activeCandleIndex] : null;
  const priceDomain = useMemo<[number, number]>(() => {
    const lows = chartData.map((candle) => candle.low);
    const highs = chartData.map((candle) => candle.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [0, 1];
    const padding = (max - min) * 0.08;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData]);
  const maxVolume = useMemo(
    () => Math.max(1, ...chartData.map((candle) => candle.volume_usd)),
    [chartData],
  );
  const attackMarkers = useMemo<AttackMarkerPoint[]>(() => {
    return selected?.overlays
      .map((event) => {
        const candle = chartData.find((entry) => entry.timestamp === event.timestamp);
        if (!candle) return null;
        return {
          label: candle.label,
          toxic_flow_score: candle.toxic_flow_score,
          timestamp: event.timestamp,
          event_type: event.event_type,
          severity: event.severity,
          loss_usd: event.loss_usd,
          confidence: event.confidence,
        };
      })
      .filter((marker): marker is AttackMarkerPoint => Boolean(marker)) ?? [];
  }, [chartData, selected?.overlays]);
  const gridStyle = {
    "--left-panel-width": `${leftWidth}px`,
    "--right-panel-width": `${rightWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    setSelectedCandleTs(null);
    setCopiedRoute(false);
  }, [selected?.route_key, interval]);

  const selectCandleByIndex = (index: number) => {
    const candle = chartData[clamp(index, 0, Math.max(0, chartData.length - 1))];
    if (candle) setSelectedCandleTs(candle.timestamp);
  };

  const handleChartPointer = (state: any) => {
    const candle = state?.activePayload?.find((item: any) => item?.payload)?.payload as ChartPoint | undefined;
    if (candle?.timestamp) setSelectedCandleTs(candle.timestamp);
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

  const leftMax = () => Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, window.innerWidth - NAV_RAIL_WIDTH - rightWidth - MIN_GRAPH_WIDTH));
  const rightMax = () => Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, window.innerWidth - NAV_RAIL_WIDTH - leftWidth - MIN_GRAPH_WIDTH));

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
        const max = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, window.innerWidth - NAV_RAIL_WIDTH - rightWidth - MIN_GRAPH_WIDTH));
        setLeftWidth(clamp(event.clientX - NAV_RAIL_WIDTH, MIN_LEFT_WIDTH, max));
      } else {
        const max = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, window.innerWidth - NAV_RAIL_WIDTH - leftWidth - MIN_GRAPH_WIDTH));
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
        className="grid min-h-[calc(100vh-3rem)] lg:grid-cols-[52px_var(--left-panel-width)_10px_minmax(0,1fr)_10px_var(--right-panel-width)]"
      >
        <NavRail />

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
              <TapeValue label="O" value={activeCandle ? priceFormatter(selected, activeCandle.open) : "0"} />
              <TapeValue label="H" value={activeCandle ? priceFormatter(selected, activeCandle.high) : "0"} tone="accent" />
              <TapeValue label="L" value={activeCandle ? priceFormatter(selected, activeCandle.low) : "0"} tone="bad" />
              <TapeValue label="C" value={activeCandle ? priceFormatter(selected, activeCandle.close) : "0"} />
              <TapeValue label="Move" value={formatPct(selected.price_change_pct)} tone={selected.price_change_pct >= 0 ? "good" : "bad"} />
              <TapeValue label="Toxic" value={formatNumber(activeCandle?.toxic_flow_score ?? selected.toxic_flow_score, 0)} tone={(activeCandle?.toxic_flow_score ?? selected.toxic_flow_score) >= 75 ? "bad" : "accent"} />
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
            <span className="font-mono text-[12px] text-muted-foreground">Price</span>
            <span className="font-mono text-[12px] text-primary">Toxicity</span>
            <ChartScrubber
              chartData={chartData}
              activeIndex={activeCandleIndex}
              onSelectIndex={selectCandleByIndex}
            />
            <AttackLegend />
            <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
              Source: {data.source}
            </span>
          </div>

          <div className="h-[calc(100vh-15.25rem)] min-h-[430px] border-b border-border/70 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 26, left: 0 }}
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
                  yAxisId="price"
                  domain={priceDomain}
                  tickFormatter={(value) => priceFormatter(selected, Number(value))}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  width={58}
                />
                <YAxis
                  yAxisId="risk"
                  orientation="right"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  width={42}
                />
                <YAxis yAxisId="volume" hide domain={[0, maxVolume * 4]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.16 }} />
                <ReferenceLine
                  yAxisId="price"
                  y={latest?.close}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.45}
                />
                <ReferenceLine
                  yAxisId="risk"
                  y={80}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.28}
                />
                {activeCandle && (
                  <>
                    <ReferenceLine
                      xAxisId={0}
                      yAxisId="price"
                      x={activeCandle.label}
                      stroke="hsl(var(--foreground))"
                      strokeDasharray="2 3"
                      strokeOpacity={0.32}
                    />
                    <ReferenceDot
                      yAxisId="risk"
                      x={activeCandle.label}
                      y={activeCandle.toxic_flow_score}
                      r={4}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                    />
                  </>
                )}
                <Bar yAxisId="volume" dataKey="volume_usd" barSize={5} shape={(props: any) => <VolumeBar {...props} />} />
                <Bar yAxisId="price" dataKey="wick" barSize={1} shape={(props: any) => <CandleWick {...props} />} />
                <Bar yAxisId="price" dataKey="body" barSize={7} shape={(props: any) => <CandleBody {...props} />} />
                <Line
                  yAxisId="risk"
                  type="monotone"
                  dataKey="toxic_flow_score"
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.76}
                  strokeWidth={1.4}
                  dot={false}
                  activeDot={false}
                />
                <Scatter
                  yAxisId="risk"
                  data={attackMarkers}
                  dataKey="toxic_flow_score"
                  shape={(props: any) => <AttackMarkerShape {...props} />}
                  isAnimationActive={false}
                />
                <Brush
                  dataKey="label"
                  height={22}
                  travellerWidth={8}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--card))"
                  tickFormatter={() => ""}
                  onChange={(range) => {
                    if (typeof range?.endIndex === "number") selectCandleByIndex(range.endIndex);
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <EventTape selected={selected} activeCandle={activeCandle} onSelectCandle={setSelectedCandleTs} />
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
            <span className={surface.risk_score >= 80 ? "text-red-300" : "text-primary"}>
              {surface.toxic_flow_score.toFixed(0)}
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

function NavRail() {
  return (
    <nav className="hidden border-r border-border/70 bg-card/70 lg:block">
      {[
        { to: "/", label: "H" },
        { to: "/dashboard", label: "D" },
        { to: "/protection", label: "G" },
        { to: "/intel-api", label: "A" },
      ].map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex h-12 items-center justify-center border-b border-border/70 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-background hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {item.label}
        </Link>
      ))}
    </nav>
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
    <aside className="min-w-0 border-r border-border/70 bg-card/35 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
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
              <div className={surface.risk_score >= 80 ? "text-red-300" : "text-primary"}>
                {surface.toxic_flow_score.toFixed(0)}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {actionLabel(surface.action)}
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

function AttackLegend() {
  return (
    <div className="hidden min-h-10 items-center gap-3 border-l border-border/70 pl-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground xl:flex">
      <span className="text-red-300">△ Sandwich</span>
      <span className="text-yellow-300">■ JIT</span>
      <span className="text-sky-300">◆ Liq</span>
      <span className="text-green-300">● Arb</span>
      <span className="text-purple-300">⊟ Backrun</span>
    </div>
  );
}

function ChartScrubber({
  chartData,
  activeIndex,
  onSelectIndex,
}: {
  chartData: ChartPoint[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
}) {
  if (chartData.length < 2) return null;

  return (
    <label className="hidden min-h-10 items-center gap-2 border-l border-border/70 pl-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground md:flex">
      <span>Candle</span>
      <input
        type="range"
        min={0}
        max={chartData.length - 1}
        value={Math.max(0, activeIndex)}
        aria-label="Select candle"
        onChange={(event) => onSelectIndex(Number(event.target.value))}
        className="h-10 w-28 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </label>
  );
}

function Inspector({ selected, activeCandle }: { selected: ToxicFlowSurface; activeCandle: ChartPoint | null }) {
  return (
    <aside className="bg-card/35 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
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
        <StatRow label="Prevented" value={formatUsd(selected.prevented_loss_24h_usd)} tone="accent" />
        <StatRow label="At risk" value={formatUsd(selected.loss_at_risk_24h_usd)} />
        <StatRow label="Volume" value={formatUsd(selected.volume_24h_usd)} />
        <StatRow label="Risk" value={selected.risk_score.toFixed(0)} tone={selected.risk_score >= 80 ? "bad" : "accent"} />
        <StatRow label="Markout" value={`${selected.markout_30s_bps.toFixed(2)} bps`} />
        <StatRow label="Liq stress" value={selected.liquidity_stress.toFixed(0)} />
      </div>

      {activeCandle && (
        <div className="divide-y divide-border/70 border-b border-border/70 font-mono">
          <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Selected</span>
            <span className="text-primary">{activeCandle.label}</span>
          </div>
          <StatRow label="Open" value={priceFormatter(selected, activeCandle.open)} />
          <StatRow label="High" value={priceFormatter(selected, activeCandle.high)} tone="accent" />
          <StatRow label="Low" value={priceFormatter(selected, activeCandle.low)} tone="bad" />
          <StatRow label="Close" value={priceFormatter(selected, activeCandle.close)} />
          <StatRow label="Volume" value={formatUsd(activeCandle.volume_usd)} />
          <StatRow label="Candle loss" value={formatUsd(activeCandle.loss_at_risk_usd)} tone={activeCandle.loss_at_risk_usd > 0 ? "bad" : undefined} />
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
}: {
  selected: ToxicFlowSurface;
  activeCandle: ChartPoint | null;
  onSelectCandle: (timestamp: string) => void;
}) {
  const events = selected.overlays.slice(0, 4);
  return (
    <div className="hidden h-28 grid-cols-[160px_1fr] border-b border-border/70 md:grid">
      <div className="border-r border-border/70 p-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Recent events
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
