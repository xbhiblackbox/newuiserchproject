import { useEffect, useState } from "react";

/**
 * Returns a version number that increments whenever the active profile
 * username changes (or related data is refreshed). Use as a dependency
 * for useMemo hooks that read username-scoped data so they recompute.
 */
export const useActiveUsernameVersion = (): number => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("active-username-changed", bump);
    window.addEventListener("reel-insights-updated", bump);
    window.addEventListener("ig-account-cloned", bump);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("active-username-changed", bump);
      window.removeEventListener("reel-insights-updated", bump);
      window.removeEventListener("ig-account-cloned", bump);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  return version;
};
