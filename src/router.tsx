import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

function getRequestCspNonce(): string | undefined {
  try {
    const context = getGlobalStartContext() as { nonce?: unknown } | undefined;
    return typeof context?.nonce === "string" && context.nonce.length > 0
      ? context.nonce
      : undefined;
  } catch {
    return undefined;
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient();
  const cspNonce = getRequestCspNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ssr: cspNonce ? { nonce: cspNonce } : undefined,
  });

  return router;
};
