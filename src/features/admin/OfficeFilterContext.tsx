import { createContext, useContext, useState, type ReactNode } from "react";

export type OfficeFilter = "All offices" | "Cebu HQ" | "Manila" | "Davao";

interface OfficeFilterContextValue {
  office: OfficeFilter;
  setOffice: (office: OfficeFilter) => void;
}

const OfficeFilterContext = createContext<OfficeFilterContextValue | null>(null);

export function OfficeFilterProvider({ children }: { children: ReactNode }) {
  const [office, setOffice] = useState<OfficeFilter>("All offices");
  return <OfficeFilterContext.Provider value={{ office, setOffice }}>{children}</OfficeFilterContext.Provider>;
}

export function useOfficeFilter() {
  const ctx = useContext(OfficeFilterContext);
  if (!ctx) throw new Error("useOfficeFilter must be used within OfficeFilterProvider");
  return ctx;
}
