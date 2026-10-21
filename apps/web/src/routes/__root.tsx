import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@markdownview/ui/components/sonner";

interface RouterContext {
  queryClient: QueryClient;
}

const RootLayout = () => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    scriptProps={{ type: "application/json" }}
  >
    <HeadContent />
    <Outlet />
    <Toaster position="bottom-right" richColors />
    {import.meta.env.DEV ? (
      <>
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools buttonPosition="bottom-right" />
      </>
    ) : null}
  </ThemeProvider>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [{ title: "MarkdownView" }],
  }),
  component: RootLayout,
});
