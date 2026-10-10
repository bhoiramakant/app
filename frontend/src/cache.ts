// Cache-first data hook (the app's "Room" equivalent): shows the last saved response instantly,
// refreshes in the background, and falls back to saved data when offline.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { api, ApiError } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type Cached<T> = T & { _offline?: boolean; _savedAt?: string };

const ck = (key: readonly unknown[]) => "cache:" + key.join(":");

export function useCached<T>(key: readonly unknown[], path: string, opts: { refetchInterval?: number; enabled?: boolean } = {}) {
  const qc = useQueryClient();
  const k = ck(key);

  useEffect(() => {
    let alive = true;
    storage.getItem(k, "").then((raw) => {
      if (!alive || !raw || qc.getQueryData(key)) return;
      try {
        qc.setQueryData(key, { ...JSON.parse(raw as string), _offline: true });
      } catch {}
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  return useQuery<Cached<T>>({
    queryKey: key,
    enabled: opts.enabled,
    refetchInterval: opts.refetchInterval,
    staleTime: 30_000,
    retry: (n, e) => !(e instanceof ApiError && e.status !== 0) && n < 1,
    queryFn: async () => {
      try {
        const data = await api<T>(path);
        const saved = { ...(data as object), _savedAt: new Date().toISOString() } as Cached<T>;
        storage.setItem(k, JSON.stringify(saved));
        return saved;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) {
          const raw = await storage.getItem(k, "");
          if (raw) return { ...JSON.parse(raw as string), _offline: true };
        }
        throw e;
      }
    },
  });
}
