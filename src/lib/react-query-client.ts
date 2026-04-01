import { QueryClient } from "@tanstack/react-query";

const defaultOptions = {
  defaultOptions: {
    queries: {
      /** Базовый stale: списки/детали переопределяют через STALE_MS при необходимости. */
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
};

export function makeQueryClient() {
  return new QueryClient(defaultOptions);
}

let browserQueryClient: QueryClient | undefined;

export function getBrowserQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
