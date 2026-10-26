import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import Lesson from "./pages/Lesson";
import Articles from "./pages/Articles";
import Admin from "./pages/Admin";
import Masechet from "./pages/Masechet";
import MyLessons from "./pages/MyLessons";
import Login from "./pages/Login";
import Stats from "./pages/Stats";
import Playlists from "./pages/Playlists";
import CalendarPage from "./pages/CalendarPage";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";
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
          <ChatbotWidget />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
