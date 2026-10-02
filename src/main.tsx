import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./components/ui/ToastContext";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { queryClient } from "./lib/queryClient";
// Core HR applies saved organization and employee edits before any page reads the directory.
import "./lib/coreHr";
import { getStoredTheme } from "./lib/theme";

const storedTheme = getStoredTheme();
if (storedTheme) document.documentElement.dataset.theme = storedTheme;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
