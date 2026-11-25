"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Fetch once on mount, with a `reload` for after a save. Errors become a
 * toast (a 401 has already sent the person to the login screen).
 *
 * ponytail: no cache or dedupe between pages; add SWR/React Query if pages
 * ever start sharing the same data in one view.
 */
export function useLoad<T>(load: () => Promise<T>): {
  data: T | undefined;
  error: boolean;
  reload: () => Promise<void>;
  set: (next: T) => void;
} {
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loader.current());
      setError(false);
    } catch (e) {
      setError(true);
      toast.error(e instanceof Error ? e.message : "Could not load this page");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload, set: setData };
}

/** Run a save, toast the outcome, and say whether it worked. */
export async function attempt<T>(run: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const result = await run();
    if (success) toast.success(success);
    return result;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Something went wrong");
    return undefined;
  }
}
