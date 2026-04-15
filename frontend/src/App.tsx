import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EntityExplorer = lazy(() => import("./pages/EntityExplorer"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const History = lazy(() => import("./pages/History"));
const IntelApi = lazy(() => import("./pages/IntelApi"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-background px-6 py-16 font-mono text-xs uppercase tracking-[0.22em] text-primary">
              loading intelleum…
            </div>
          }
        >
          <Routes>
            <Route path="/"               element={<Index />} />
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/intel-api"      element={<IntelApi />} />
            <Route path="/history"        element={<History />} />
            <Route path="/entities"       element={<EntityExplorer />} />
            <Route path="/entities/:id"   element={<EntityDetail />} />
            <Route path="*"               element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
