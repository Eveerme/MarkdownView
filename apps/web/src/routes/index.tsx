import { createFileRoute } from "@tanstack/react-router";

import { Workspace } from "#src/components/workspace/workspace.tsx";
import { SettingsProvider } from "#src/lib/use-settings.tsx";

const WorkspaceRoute = () => (
  <SettingsProvider>
    <Workspace />
  </SettingsProvider>
);

export const Route = createFileRoute("/")({
  component: WorkspaceRoute,
});
