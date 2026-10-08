import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { landingPath } from "@/features/settings/landing";
import { settingsFor, settingsKeyFor } from "@/lib/settings/store";
import type { Role } from "@/lib/types";

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;

  return <>{children}</>;
}

export function RootRedirect() {
  const { user } = useAuth();
  // Signed in: their chosen landing page (Settings > Appearance), or the workspace Home.
  return <Navigate to={user ? landingPath(user.role, settingsFor(settingsKeyFor(user)).appearance.landing) : "/login"} replace />;
}
