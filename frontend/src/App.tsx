import { Suspense, lazy } from "react";
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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <Suspense fallback={<IntelleumPageLoader key={`route-fallback-${routeKey}`} />}>
      <Routes>
        <Route path="/"               element={<Index />} />
        <Route path="/dashboard"      element={<Dashboard />} />
        <Route path="/protection"     element={<Protection />} />
        <Route path="/flow-terminal"  element={<FlowTerminal />} />
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
