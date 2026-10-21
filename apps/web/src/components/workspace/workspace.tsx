import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { ConfirmDialog } from "#src/components/workspace/confirm-dialog.tsx";
import { EditorPane } from "#src/components/workspace/editor-pane.tsx";
import { FileSidebar } from "#src/components/workspace/file-sidebar.tsx";
import { PreviewPane } from "#src/components/workspace/preview-pane.tsx";
import { StatusBar } from "#src/components/workspace/status-bar.tsx";
import { Toolbar } from "#src/components/workspace/toolbar.tsx";
import { useWorkspace } from "#src/lib/use-workspace.ts";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const Workspace = () => {
  const workspace = useWorkspace();
  const [ratio, setRatio] = useState(0.5);
  const panes = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panes.current?.style.setProperty("--split-ratio", `${ratio * 100}%`);
  }, [ratio]);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const container = panes.current;

    if (container === null) {
      return;
    }

    event.preventDefault();

    const bounds = container.getBoundingClientRect();

    const move = (moveEvent: PointerEvent) => {
      const next = (moveEvent.clientX - bounds.left) / bounds.width;
      setRatio(clamp(next, 0.28, 0.72));
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("cursor-col-resize", "select-none");
    };

    document.body.classList.add("cursor-col-resize", "select-none");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const split = workspace.mode === "split";

  return (
    <div className="grid h-svh grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
      <Toolbar
        dirty={workspace.dirty}
        fileName={workspace.fileName}
        isDesktop={workspace.isDesktop}
        mode={workspace.mode}
        onModeChange={(next) => {
          workspace.setMode(next);
        }}
        onNew={() => {
          workspace.actions.newDocument();
        }}
        onOpenFile={() => {
          workspace.actions.openFile();
        }}
        onOpenFolder={() => {
          workspace.actions.openFolder();
        }}
        onSave={() => {
          void workspace.actions.save();
        }}
        onSaveAs={() => {
          void workspace.actions.saveAs();
        }}
        onToggleSidebar={() => {
          workspace.setSidebarOpen(!workspace.sidebarOpen);
        }}
        saving={workspace.saving}
        sidebarOpen={workspace.sidebarOpen}
      />

      <div className="flex min-h-0">
        {workspace.isDesktop && workspace.sidebarOpen ? (
          <FileSidebar
            activePath={workspace.filePath}
            folder={workspace.folder}
            onOpen={(path) => {
              workspace.actions.openPath(path);
            }}
            onOpenFolder={() => {
              workspace.actions.openFolder();
            }}
            onRefresh={() => {
              if (workspace.folder !== null) {
                workspace.actions.refreshFolder(workspace.folder.path);
              }
            }}
          />
        ) : null}

        <div
          className={`flex min-h-0 flex-1 ${split ? "split-panes" : ""}`}
          ref={panes}
        >
          {workspace.mode === "preview" ? null : (
            <div
              className={
                split
                  ? "split-editor min-h-0 min-w-0"
                  : "min-h-0 min-w-0 flex-1"
              }
            >
              <EditorPane
                onChange={(value) => {
                  workspace.setContent(value);
                }}
                value={workspace.content}
              />
            </div>
          )}

          {split ? (
            <button
              aria-label="调整分栏宽度"
              className="group relative w-1.5 shrink-0 cursor-col-resize border-0 bg-transparent p-0"
              onPointerDown={startResize}
              type="button"
            >
              <span
                aria-hidden="true"
                className="bg-border group-hover:bg-primary/50 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors"
              />
            </button>
          ) : null}

          {workspace.mode === "edit" ? null : (
            <div
              className={
                split
                  ? "split-preview min-h-0 min-w-0"
                  : "min-h-0 min-w-0 flex-1"
              }
            >
              <PreviewPane
                content={workspace.content}
                key={workspace.filePath ?? "scratch"}
              />
            </div>
          )}
        </div>
      </div>

      <StatusBar
        content={workspace.content}
        dirty={workspace.dirty}
        fileName={workspace.fileName}
        filePath={workspace.filePath}
        isDesktop={workspace.isDesktop}
        savedAt={workspace.savedAt}
        saving={workspace.saving}
      />

      <ConfirmDialog
        message={workspace.confirmation.message}
        onCancel={() => {
          workspace.confirmation.settle(false);
        }}
        onConfirm={() => {
          workspace.confirmation.settle(true);
        }}
        open={workspace.confirmation.open}
      />
    </div>
  );
};
