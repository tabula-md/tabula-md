import { useEffect, useState } from "react";
import type { ConnectedLibrary } from "./libraryBundleModel";
import {
  readConnectedLibraries,
  subscribeToLibraries,
} from "./libraryRepository";

export const useConnectedLibraries = () => {
  const [libraries, setLibraries] = useState<ConnectedLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const nextLibraries = await readConnectedLibraries();
        if (active) {
          setLibraries(nextLibraries);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const unsubscribe = subscribeToLibraries(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { error, libraries, loading };
};
