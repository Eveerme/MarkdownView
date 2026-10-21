import { createFileRoute } from "@tanstack/react-router";

import { Workspace } from "#src/components/workspace/workspace.tsx";

export const Route = createFileRoute("/")({
  component: Workspace,
});
