import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router's classic <Routes> doesn't reset scroll on navigation like a
// traditional multi-page site would — without this, navigating from a
// scrolled-down page leaves the next page scrolled down too.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
