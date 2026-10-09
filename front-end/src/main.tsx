import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import AppClerkProvider from "@/components/AppClerkProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/routes/ProtectedRoute";
import Home from "@/routes/Home";
import Login from "@/routes/Login";
import Landing from "@/routes/Landing";
import Templates from "@/routes/Templates";
import Profile from "@/routes/Profile";
import Settings from "@/routes/Settings";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <Toaster richColors position="bottom-right" />
    <LanguageProvider>
      <BrowserRouter>
        <AppClerkProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ChatProvider>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  {/* Splat routes: Clerk's flows use nested paths (e.g. /sign-up/verify-email-address) */}
                  <Route path="/login/*" element={<Login mode="sign-in" />} />
                  <Route path="/sign-up/*" element={<Login mode="sign-up" />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/chat" element={<Home />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Routes>
              </ChatProvider>
            </AuthProvider>
          </QueryClientProvider>
        </AppClerkProvider>
      </BrowserRouter>
    </LanguageProvider>
  </ThemeProvider>
);
