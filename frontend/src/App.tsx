import { Suspense, lazy, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import IntelleumPageLoader from "@/components/IntelleumPageLoader";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EntityExplorer = lazy(() => import("./pages/EntityExplorer"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const History = lazy(() => import("./pages/History"));
const IntelApi = lazy(() => import("./pages/IntelApi"));
const FlowTerminal = lazy(() => import("./pages/FlowTerminal"));
const Protection = lazy(() => import("./pages/Protection"));
const DexIntelligence = lazy(() => import("./pages/DexIntelligence"));
const DexGateway = lazy(() => import("./pages/DexGateway"));
const RaydiumDeepDive = lazy(() => import("./pages/RaydiumDeepDive"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
const ROUTE_FALLBACK_DELAY_MS = 180;

function DelayedRouteFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), ROUTE_FALLBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return visible ? <IntelleumPageLoader /> : null;
}

function AppRoutes() {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <Suspense fallback={<DelayedRouteFallback key={`route-fallback-${routeKey}`} />}>
      <Routes>
        <Route path="/"               element={<Index />} />
        <Route path="/dashboard"      element={<Dashboard />} />
        <Route path="/protection"     element={<Protection />} />
        <Route path="/flow-terminal"  element={<FlowTerminal />} />
        <Route path="/dex-intelligence" element={<DexGateway />} />
        <Route path="/dex-intelligence/raydium" element={<DexIntelligence />} />
        <Route path="/dex-intelligence/raydium/pools"      element={<RaydiumDeepDive section="pools" />} />
        <Route path="/dex-intelligence/raydium/jit"        element={<RaydiumDeepDive section="jit" />} />
        <Route path="/dex-intelligence/raydium/launchlab"  element={<RaydiumDeepDive section="launchlab" />} />
        <Route path="/dex-intelligence/raydium/lp"         element={<RaydiumDeepDive section="lp" />} />
        <Route path="/dex-intelligence/raydium/detections" element={<RaydiumDeepDive section="detections" />} />
        <Route path="/dex-intelligence/raydium/savings"    element={<RaydiumDeepDive section="savings" />} />
        <Route path="/dex-intelligence/raydium/extraction" element={<RaydiumDeepDive section="extraction" />} />
        <Route path="/intel-api"      element={<IntelApi />} />
        <Route path="/history"        element={<History />} />
        <Route path="/entities"       element={<EntityExplorer />} />
        <Route path="/entities/:id"   element={<EntityDetail />} />
        <Route path="*"               element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Analytics />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
