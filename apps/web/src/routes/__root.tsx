import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@markdownview/ui/components/sonner";

import { themeValues } from "#src/lib/themes.ts";

interface RouterContext {
  queryClient: QueryClient;
}

const RootLayout = () => (
  <ThemeProvider
    attribute="class"
    defaultTheme="white"
    disableTransitionOnChange
    scriptProps={{ type: "application/json" }}
    themes={[...themeValues]}
  >
    <HeadContent />
    <Outlet />
    <Toaster position="bottom-right" richColors />
    {import.meta.env.DEV ? (
      <ReactQueryDevtools buttonPosition="bottom-right" />
    ) : null}
  </ThemeProvider>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [{ title: "MarkdownView" }],
  }),
  component: RootLayout,
});
