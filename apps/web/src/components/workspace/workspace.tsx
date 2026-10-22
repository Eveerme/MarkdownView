import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { ConfirmDialog } from "#src/components/workspace/confirm-dialog.tsx";
import { EditorPane } from "#src/components/workspace/editor-pane.tsx";
import type { EditorCursor } from "#src/components/workspace/editor-pane.tsx";
import { FileSidebar } from "#src/components/workspace/file-sidebar.tsx";
import { PreviewPane } from "#src/components/workspace/preview-pane.tsx";
import { StatusBar } from "#src/components/workspace/status-bar.tsx";
import { Toolbar } from "#src/components/workspace/toolbar.tsx";
import { useScrollSync } from "#src/lib/use-scroll-sync.ts";
import { useSettings } from "#src/lib/use-settings.tsx";
import { useWorkspace } from "#src/lib/use-workspace.ts";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The split minimums are px lengths in CSS, which Number() would read as NaN. */
const pixels = (styles: CSSStyleDeclaration, property: string) =>
  // oxlint-disable-next-line unicorn/prefer-number-coercion
  Number.parseFloat(styles.getPropertyValue(property)) || 0;

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

export const Workspace = () => {
  const workspace = useWorkspace();
  const { settings, update } = useSettings();
  const [ratio, setRatio] = useState(settings.splitRatio);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(
    null
  );

  const [cursor, setCursor] = useState<EditorCursor>({
    column: 1,
    line: 1,
    selectedWords: 0,
  });

  const panes = useRef<HTMLDivElement>(null);
  const ratioRef = useRef(settings.splitRatio);

  const split = workspace.mode === "split";

  useScrollSync({
    content: workspace.content,
    editorView,
    enabled: split && settings.syncScroll,
    preview: previewElement,
  });

  useEffect(() => {
    panes.current?.style.setProperty(
      "--split-ratio",
      `${Math.round(ratio * 1000) / 10}%`
    );
  }, [ratio]);

  const stageStyle: CustomProperties = {
    "--editor-font-size": `${settings.editorFontSize}px`,
    "--preview-font-size": `${settings.previewFontSize}px`,
    "--reading-measure": `${settings.readingWidth}ch`,
  };

  const applyRatio = (next: number) => {
    const rounded = Math.round(clamp(next, 0.28, 0.72) * 1000) / 1000;

    ratioRef.current = rounded;
    setRatio(rounded);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const container = panes.current;

    if (container === null) {
      return;
    }

    event.preventDefault();

    const bounds = container.getBoundingClientRect();
    const styles = getComputedStyle(container);
    const editorMin = pixels(styles, "--split-editor-min");
    const previewMin = pixels(styles, "--split-preview-min");
    const dividerWidth = event.currentTarget.getBoundingClientRect().width;
    // Dragging stops where the CSS floor stops, so the handle stays under the pointer.
    const lowest = Math.max(0.28, editorMin / bounds.width);

    const highest = Math.min(
      0.72,
      (bounds.width - dividerWidth - previewMin) / bounds.width
    );

    const move = (moveEvent: PointerEvent) => {
      const next = (moveEvent.clientX - bounds.left) / bounds.width;

      applyRatio(Math.min(Math.max(next, lowest), Math.max(lowest, highest)));
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("cursor-col-resize", "select-none");
      update({ splitRatio: ratioRef.current });
    };

    document.body.classList.add("cursor-col-resize", "select-none");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const handleImagePaste = async (file: File) => {
    const snippet = await workspace.actions.saveImage(file);

    return snippet;
  };

  return (
    <div
      className="grid h-svh grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
      style={stageStyle}
    >
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
        onExport={(format) => {
          void workspace.actions.exportDocument(format);
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

      <div className="flex min-h-0 min-w-0">
        {workspace.isDesktop && workspace.sidebarOpen ? (
          <FileSidebar
            activePath={workspace.filePath}
            expanded={workspace.expandedFolders}
            folders={workspace.folders}
            onClearRecent={() => {
              void workspace.actions.clearRecentFiles();
            }}
            onOpen={(path) => {
              workspace.actions.openPath(path);
            }}
            onOpenFile={() => {
              workspace.actions.openFile();
            }}
            onOpenFolder={() => {
              workspace.actions.openFolder();
            }}
            onRefresh={(folderPath) => {
              workspace.actions.refreshFolder(folderPath);
            }}
            onRemove={(folderPath) => {
              void workspace.actions.removeFolder(folderPath);
            }}
            onReveal={(item) => {
              workspace.actions.revealOutline(item);
            }}
            onToggleFolder={(key) => {
              workspace.actions.toggleFolder(key);
            }}
            onViewChange={(view) => {
              workspace.setSidebarView(view);
            }}
            outline={workspace.outline}
            recentFiles={workspace.recentFiles}
            view={workspace.sidebarView}
          />
        ) : null}

        <div
          className={`flex min-h-0 min-w-0 flex-1 ${split ? "split-panes" : ""}`}
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
                lineNumbers={settings.lineNumbers}
                onChange={(value) => {
                  workspace.setContent(value);
                }}
                onCursorChange={setCursor}
                onImagePaste={handleImagePaste}
                onViewChange={setEditorView}
                reveal={workspace.editorReveal}
                value={workspace.content}
                wordWrap={settings.wordWrap}
              />
            </div>
          )}

          {split ? (
            <button
              aria-label="调整分栏宽度"
              className="group relative w-1.5 shrink-0 cursor-col-resize border-0 bg-transparent p-0"
              onDoubleClick={() => {
                applyRatio(0.5);
                update({ splitRatio: ratioRef.current });
              }}
              onPointerDown={startResize}
              title="拖动调整宽度，双击恢复 50%"
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
                filePath={workspace.filePath}
                key={workspace.filePath ?? "scratch"}
                onOpenLink={(href) => {
                  void workspace.actions.openLink(href);
                }}
                onScrollContainerChange={setPreviewElement}
                onScrollHandled={() => {
                  workspace.actions.clearPreviewAnchor();
                }}
                onSelectLine={(line) => {
                  workspace.actions.focusLine(line);
                }}
                scrollTarget={workspace.previewAnchor}
              />
            </div>
          )}
        </div>
      </div>

      <StatusBar
        content={workspace.content}
        cursor={cursor}
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
