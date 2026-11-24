import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
const Browse = lazy(() => import("./pages/Browse"));
import Lesson from "./pages/Lesson";
const Articles = lazy(() => import("./pages/Articles"));
const Admin = lazy(() => import("./pages/Admin"));
const Masechet = lazy(() => import("./pages/Masechet"));
const MyLessons = lazy(() => import("./pages/MyLessons"));
const Login = lazy(() => import("./pages/Login"));
const Stats = lazy(() => import("./pages/Stats"));
const Playlists = lazy(() => import("./pages/Playlists"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Messages = lazy(() => import("./pages/Messages"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { ChatbotWidget } from "@/components/ChatbotWidget";
import { AutoSyncTrigger } from "@/components/AutoSyncTrigger";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.message?.includes("Quota exceeded") || error?.code === "resource-exhausted") {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <AutoSyncTrigger />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/lesson/:youtubeId" element={<Lesson />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/masechet/:name" element={<Masechet />} />
            <Route path="/my-lessons" element={<MyLessons />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <ChatbotWidget />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
