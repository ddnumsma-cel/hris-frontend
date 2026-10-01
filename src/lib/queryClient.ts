import { QueryClient } from "@tanstack/react-query";
import { PEOPLE_STORE_KEY } from "./mockData";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Another tab saved the demo people store (e.g. someone applied through the shared job link, or an
// employee submitted Onboarding): mockData has already reloaded it, so refetch what's on screen.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    // The PSGC place lists never change; skip them.
    if (e.key === PEOPLE_STORE_KEY) queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "psgc" });
  });
}
