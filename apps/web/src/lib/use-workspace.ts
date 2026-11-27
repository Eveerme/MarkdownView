import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  ExportFormat,
  MarkdownDocument,
  MarkdownFolder,
  MarkdownSavedFile,
  RecentFile,
  ResolvedLink,
} from "@markdownview/desktop-contract";

import { desktop } from "#src/lib/desktop.ts";
import { createExportDocument } from "#src/lib/export-document.ts";
import { exportFileName } from "#src/lib/export-html.ts";
import { rootKey } from "#src/lib/file-tree.ts";
import type { OutlineItem } from "#src/lib/outline.ts";
import { useDocumentOutline } from "#src/lib/use-outline.ts";
import { useSettings } from "#src/lib/use-settings.tsx";
import { welcomeDocument } from "#src/lib/welcome-document.ts";

export type ViewMode = "edit" | "split" | "preview";

export type SidebarView = "recent" | "files" | "outline";

interface PendingAction {
  message: string;
  run: () => void;
}

/** A heading id, or the source line a mounted preview should show. */
export type PreviewTarget =
  | { id: string; kind: "id"; nonce: number }
  | { kind: "line"; line: number; nonce: number };

interface EditorReveal {
  /** False leaves the focus where it was, such as on the tab that was clicked. */
  focus?: boolean;
  line: number;
  nonce: number;
}

export interface DocumentTab {
  content: string;
  id: string;
  name: string;
  path: string | null;
  savedAt: number | null;
  savedContent: string;
}

const welcomeTabId = "tab-welcome";

let tabSequence = 0;

const newTabId = () => `tab-${(tabSequence += 1)}`;

const createTab = (
  content: string,
  name: string,
  path: string | null
): DocumentTab => ({
  content,
  id: newTabId(),
  name,
  path,
  savedAt: null,
  savedContent: content,
});

const modeStorageKey = "markdownview:mode";
const untitledName = "未命名.md";
const autosaveDelay = 900;
const discardMessage = "当前文档有未保存的修改，确定要放弃吗？";

const storedMode = (): ViewMode => {
  if (typeof localStorage === "undefined") {
    return "split";
  }

  const value = localStorage.getItem(modeStorageKey);

  return value === "edit" || value === "split" || value === "preview"
    ? value
    : "split";
};

const report = (title: string, error: Error) => {
  toast.error(title, { description: error.message });
};

const mergeFolders = (
  current: MarkdownFolder[],
  incoming: MarkdownFolder[]
) => {
  const folders = new Map(current.map((folder) => [folder.path, folder]));

  for (const folder of incoming) {
    folders.set(folder.path, folder);
  }

  return [...folders.values()];
};

export const useWorkspace = () => {
  const bridge = desktop();
  const { settings } = useSettings();

  const [tabs, setTabs] = useState<DocumentTab[]>(() => [
    { ...createTab(welcomeDocument, "欢迎使用.md", null), id: welcomeTabId },
  ]);

  const [activeId, setActiveId] = useState(welcomeTabId);

  const [folders, setFolders] = useState<MarkdownFolder[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set()
  );

  const [mode, setMode] = useState<ViewMode>(storedMode);
  const [sidebarOpen, setSidebarOpen] = useState(bridge !== null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("recent");
  const [saving, setSaving] = useState(false);

  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(
    null
  );

  const [editorReveal, setEditorReveal] = useState<EditorReveal | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );

  // The panes and every action read the same active tab; unsaved tabs stay open.
  const activeTab = tabs.find((item) => item.id === activeId) ?? tabs[0];
  const tab = activeTab ?? createTab(welcomeDocument, "欢迎使用.md", null);

  const {
    content,
    name: fileName,
    path: filePath,
    savedAt,
    savedContent,
  } = tab;

  const dirty = content !== savedContent;
  const anyDirty = tabs.some((item) => item.content !== item.savedContent);
  const revealNonce = useRef(0);
  const outline = useDocumentOutline(content, filePath);

  const dirtyRef = useRef(dirty);
  const tabsRef = useRef(tabs);

  // The reading position of each tab, so mode and tab switches can come back to
  // it: a pane that unmounts takes its scroll offset with it.
  const readingLines = useRef(new Map<string, number>());
  const activeIdRef = useRef(activeId);
  const readPanes = useRef<() => number | null>(() => null);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const reveal = () => {
    revealNonce.current += 1;

    return revealNonce.current;
  };

  /**
   * Records where the tab that is on screen is being read. It measures the panes
   * as they stand, because a scroll report trails the reader by a frame and a
   * switch can happen inside that frame.
   */
  const rememberPosition = () => {
    const line = readPanes.current();

    if (line !== null) {
      readingLines.current.set(activeIdRef.current, line);
    }
  };

  /** The workspace registers the reader that measures its panes on demand. */
  const registerReader = useCallback((read: () => number | null) => {
    readPanes.current = read;
  }, []);

  const lineOf = (id: string) => readingLines.current.get(id) ?? 1;

  const patchActive = (
    update: (current: DocumentTab) => Partial<DocumentTab>
  ) => {
    const { id } = tab;

    setTabs((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...update(item) } : item
      )
    );
  };

  const activate = (id: string) => {
    if (id === activeId) {
      return;
    }

    rememberPosition();

    const line = lineOf(id);
    const nonce = reveal();

    setActiveId(id);
    // The preview is rebuilt for the new tab and the source keeps its scroll, so
    // both are given the line this tab was left on. The clicked tab keeps the
    // focus; the source pane only moves its caret.
    setPreviewTarget({ kind: "line", line, nonce });
    setEditorReveal({ focus: false, line, nonce });
  };

  const guard = (run: () => void) => {
    if (dirtyRef.current) {
      setPendingAction({ message: discardMessage, run });

      return;
    }

    run();
  };

  const settleConfirmation = (accepted: boolean) => {
    const action = pendingAction;

    setPendingAction(null);

    if (accepted) {
      action?.run();
    }
  };

  const refreshRecentFiles = async () => {
    if (!bridge) {
      return;
    }

    try {
      setRecentFiles(await bridge.recentFiles());
    } catch {
      // The recent list is a convenience; a failed read leaves the old list.
    }
  };

  const loadDocument = (document: MarkdownDocument) => {
    const existing = tabsRef.current.find(
      (item) => item.path === document.path
    );

    if (existing !== undefined) {
      activate(existing.id);
      void refreshRecentFiles();

      return;
    }

    const opened = createTab(document.content, document.name, document.path);

    rememberPosition();
    setTabs((current) => [...current, opened]);
    setActiveId(opened.id);
    setPreviewTarget(null);
    setEditorReveal(null);
    void refreshRecentFiles();
  };

  const changeMode = (next: ViewMode) => {
    const previous = mode;

    rememberPosition();

    const line = lineOf(activeId);

    setMode(next);
    localStorage.setItem(modeStorageKey, next);

    // Only a pane that the switch creates needs a target: one that stays mounted
    // is already where the reader left it.
    if (next === "edit") {
      // No preview to place, and a target left behind would move it on a later
      // mount.
      setPreviewTarget(null);
    } else if (previous === "edit") {
      setPreviewTarget({ kind: "line", line, nonce: reveal() });
    }

    if (next === "preview") {
      setEditorReveal(null);
    } else if (previous === "preview") {
      setEditorReveal({ focus: false, line, nonce: reveal() });
    }
  };

  const openFileFromDialog = async () => {
    if (!bridge) {
      return;
    }

    try {
      const document = await bridge.openFile();

      if (document !== null) {
        loadDocument(document);
      }
    } catch (error) {
      if (error instanceof Error) {
        report("打开文件失败", error);
      }
    }
  };

  const openFolderFromDialog = async () => {
    if (!bridge) {
      return;
    }

    try {
      const listing = await bridge.openFolder();

      if (listing === null || listing.length === 0) {
        return;
      }

      setFolders((current) => mergeFolders(current, listing));
      setExpandedFolders((current) => {
        const next = new Set(current);

        for (const folder of listing) {
          next.add(rootKey(folder.path));
        }

        return next;
      });
      setSidebarOpen(true);
      setSidebarView("files");

      const first = listing.flatMap((folder) => folder.files).at(0);

      if (first !== undefined && !dirty && content === welcomeDocument) {
        loadDocument(await bridge.readFile(first.path));
      }
    } catch (error) {
      if (error instanceof Error) {
        report("打开文件夹失败", error);
      }
    }
  };

  const refreshFolderFromDisk = async (folderPath: string) => {
    if (!bridge) {
      return;
    }

    try {
      const listing = await bridge.refreshFolder(folderPath);

      setFolders((current) =>
        current.map((folder) =>
          folder.path === listing.path ? listing : folder
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        report("刷新文件夹失败", error);
      }
    }
  };

  const refreshAllFolders = async () => {
    if (!bridge || folders.length === 0) {
      return;
    }

    const refreshed = await Promise.all(
      folders.map(async (folder) => {
        try {
          return await bridge.refreshFolder(folder.path);
        } catch {
          return null;
        }
      })
    );

    setFolders((current) =>
      current.map(
        (folder) =>
          refreshed.find((listing) => listing?.path === folder.path) ?? folder
      )
    );
  };

  const removeFolder = async (folderPath: string) => {
    if (!bridge) {
      return;
    }

    try {
      await bridge.closeFolder(folderPath);
      setFolders((current) =>
        current.filter((folder) => folder.path !== folderPath)
      );
    } catch (error) {
      if (error instanceof Error) {
        report("移出文件夹失败", error);
      }
    }
  };

  const showOutline = () => {
    setSidebarOpen(true);
    setSidebarView("outline");
  };

  const openPathFromDisk = async (
    path: string,
    options?: { outline: boolean }
  ): Promise<boolean> => {
    if (!bridge) {
      return false;
    }

    if (path === filePath) {
      if (options?.outline === true) {
        showOutline();
      }

      return false;
    }

    try {
      loadDocument(await bridge.readFile(path));

      if (options?.outline === true) {
        showOutline();
      }

      return true;
    } catch (error) {
      void refreshRecentFiles();

      if (error instanceof Error) {
        report("打开文件失败", error);
      }

      return false;
    }
  };

  const saveImage = async (file: File): Promise<string | null> => {
    if (!bridge) {
      toast.info("插入图片需在桌面版使用。");

      return null;
    }

    if (filePath === null) {
      toast.info("请先保存文档，再插入图片。");

      return null;
    }

    try {
      const saved = await bridge.saveImage({
        data: [...new Uint8Array(await file.arrayBuffer())],
        from: filePath,
        mimeType: file.type,
      });

      const alt =
        file.name
          .replace(/\.[^.]+$/u, "")
          .replaceAll(/[[\]]/gu, "")
          .trim() || "图片";

      return `![${alt}](${saved.relativePath})`;
    } catch (error) {
      if (error instanceof Error) {
        report("插入图片失败", error);
      }

      return null;
    }
  };

  const exportDocument = async (format: ExportFormat) => {
    if (!bridge) {
      toast.info("导出需在桌面版使用。");

      return;
    }

    try {
      const suggestedName = exportFileName(fileName);

      const html = await createExportDocument({
        content,
        filePath,
        title: suggestedName,
      });

      const saved = await bridge.exportDocument({
        format,
        html,
        suggestedName,
      });

      if (saved !== null) {
        toast.success(`已导出 ${saved.name}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        report("导出失败", error);
      }
    }
  };

  const openLinkedDocument = async (target: ResolvedLink) => {
    const opened = await openPathFromDisk(target.path);

    if (opened && target.anchor !== null) {
      setPreviewTarget({ id: target.anchor, kind: "id", nonce: reveal() });
    }
  };

  const openLink = async (href: string) => {
    if (href.trim() === "") {
      return;
    }

    if (!bridge) {
      toast.info("文件跳转需在桌面版使用。");

      return;
    }

    if (filePath === null) {
      toast.info("请先保存当前文档，再使用相对链接。");

      return;
    }

    try {
      const target = await bridge.resolveLink({ from: filePath, href });

      if (target === null) {
        toast.info("只支持 Markdown 文件链接。");

        return;
      }

      if (target.path === filePath) {
        if (target.anchor !== null) {
          setPreviewTarget({ id: target.anchor, kind: "id", nonce: reveal() });
        }

        return;
      }

      guard(() => {
        void openLinkedDocument(target);
      });
    } catch (error) {
      if (error instanceof Error) {
        report("打开链接失败", error);
      }
    }
  };

  const revealOutline = (item: OutlineItem) => {
    const nonce = reveal();

    if (mode !== "edit") {
      setPreviewTarget({ id: item.id, kind: "id", nonce });
    }

    if (mode !== "preview") {
      setEditorReveal({ line: item.line, nonce });
    }
  };

  /** A click in the preview asks the source pane to put the cursor on that block. */
  const focusLine = (line: number) => {
    if (mode === "preview") {
      return;
    }

    setEditorReveal({ line, nonce: reveal() });
  };

  const toggleFolder = (key: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const saveAs = async () => {
    if (!bridge) {
      return;
    }

    const snapshot = content;

    setSaving(true);

    let saved: MarkdownSavedFile | null = null;

    try {
      saved = await bridge.saveFileAs({
        content: snapshot,
        suggestedName: fileName,
      });
    } catch (error) {
      if (error instanceof Error) {
        report("另存为失败", error);
      }
    }

    setSaving(false);

    if (saved === null) {
      return;
    }

    patchActive(() => ({
      name: saved.name,
      path: saved.path,
      savedAt: Date.now(),
      savedContent: snapshot,
    }));
    void refreshRecentFiles();
    await refreshAllFolders();
  };

  const save = async () => {
    if (!bridge) {
      return;
    }

    if (filePath === null) {
      await saveAs();

      return;
    }

    const snapshot = content;

    setSaving(true);

    try {
      await bridge.saveFile({ content: snapshot, path: filePath });
      patchActive(() => ({ savedAt: Date.now(), savedContent: snapshot }));
    } catch (error) {
      if (error instanceof Error) {
        report("保存失败", error);
      }
    }

    setSaving(false);
  };

  const newDocument = () => {
    guard(() => {
      const draft = createTab("", untitledName, null);

      rememberPosition();
      setTabs((current) => [...current, draft]);
      setActiveId(draft.id);
      setPreviewTarget(null);
      setEditorReveal(null);
      setMode("edit");
      localStorage.setItem(modeStorageKey, "edit");
    });
  };

  const switchTab = (id: string) => {
    activate(id);
  };

  const cycleTab = (direction: 1 | -1) => {
    const items = tabsRef.current;
    const index = items.findIndex((item) => item.id === activeId);

    if (index === -1 || items.length < 2) {
      return;
    }

    const next = items[(index + direction + items.length) % items.length];

    if (next !== undefined) {
      activate(next.id);
    }
  };

  const closeTab = (id: string) => {
    const target = tabsRef.current.find((item) => item.id === id);

    if (target === undefined) {
      return;
    }

    const close = () => {
      setTabs((current) => {
        const remaining = current.filter((item) => item.id !== id);

        if (remaining.length === 0) {
          return [
            {
              ...createTab(welcomeDocument, "欢迎使用.md", null),
              id: welcomeTabId,
            },
          ];
        }

        return remaining;
      });

      if (id === activeId) {
        const position = tabsRef.current.findIndex((item) => item.id === id);

        const neighbor =
          tabsRef.current[position - 1] ?? tabsRef.current[position + 1];

        const next = neighbor?.id ?? welcomeTabId;
        const line = lineOf(next);
        const nonce = reveal();

        setActiveId(next);
        // The tab that takes over comes back to its own line, the same as a
        // click on the tab bar.
        setPreviewTarget({ kind: "line", line, nonce });
        setEditorReveal({ focus: false, line, nonce });
      }

      readingLines.current.delete(id);
    };

    if (target.content !== target.savedContent) {
      setPendingAction({ message: discardMessage, run: close });

      return;
    }

    close();
  };

  const closeActiveTab = () => {
    closeTab(activeId);
  };

  const openFile = () => {
    guard(() => {
      void openFileFromDialog();
    });
  };

  const openFolder = () => {
    void openFolderFromDialog();
  };

  const openPath = (path: string) => {
    if (path === filePath) {
      return;
    }

    guard(() => {
      void openPathFromDisk(path);
    });
  };

  const revealFile = async (path: string) => {
    if (!bridge) {
      return;
    }

    try {
      await bridge.revealFile(path);
    } catch (error) {
      if (error instanceof Error) {
        report("打开文件位置失败", error);
      }
    }
  };

  const revealFolder = async (folderPath: string) => {
    if (!bridge) {
      return;
    }

    try {
      await bridge.revealFolder(folderPath);
    } catch (error) {
      if (error instanceof Error) {
        report("打开文件夹失败", error);
      }
    }
  };

  const refreshFolder = (folderPath: string) => {
    void refreshFolderFromDisk(folderPath);
  };

  const clearRecentFiles = async () => {
    if (!bridge) {
      return;
    }

    try {
      await bridge.clearRecentFiles();
      setRecentFiles([]);
    } catch (error) {
      if (error instanceof Error) {
        report("清空历史失败", error);
      }
    }
  };

  const consumeOpenRequest = async () => {
    if (!bridge) {
      return;
    }

    try {
      const request = await bridge.takeOpenRequest();

      if (request !== null) {
        guard(() => {
          void openPathFromDisk(request.path, { outline: true });
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        report("打开文件失败", error);
      }
    }
  };

  // The operating system can ask for a file at any time; the ref keeps the
  // listener on the latest document state without resubscribing on every edit.
  const consumeOpenRequestRef = useRef(consumeOpenRequest);

  useEffect(() => {
    consumeOpenRequestRef.current = consumeOpenRequest;
  });

  const clearPreviewTarget = useCallback(() => {
    setPreviewTarget(null);
  }, []);

  useEffect(() => {
    let active = true;

    const loadRecentFiles = async () => {
      if (!bridge) {
        return;
      }

      try {
        const files = await bridge.recentFiles();

        if (active) {
          setRecentFiles(files);
        }
      } catch {
        // The recent list is a convenience; the editor works without it.
      }
    };

    void loadRecentFiles();

    return () => {
      active = false;
    };
  }, [bridge]);

  useEffect(() => {
    let active = true;

    const loadFolders = async () => {
      if (!bridge) {
        return;
      }

      try {
        const restored = await bridge.listFolders();

        if (!active) {
          return;
        }

        setFolders(restored);
        setExpandedFolders((current) => {
          const next = new Set(current);

          for (const folder of restored) {
            next.add(rootKey(folder.path));
          }

          return next;
        });

        if (restored.length > 0) {
          setSidebarView((current) =>
            current === "recent" ? "files" : current
          );
        }
      } catch {
        // Persisted folders are a convenience; the app opens without them.
      }
    };

    void loadFolders();

    return () => {
      active = false;
    };
  }, [bridge]);

  useEffect(() => {
    const requestOpen = () => {
      void consumeOpenRequestRef.current();
    };

    requestOpen();

    const unsubscribe = bridge?.onOpenRequest(requestOpen);

    return () => {
      unsubscribe?.();
    };
  }, [bridge]);

  useEffect(() => {
    if (!bridge || !settings.autoCheckUpdate) {
      return;
    }

    void (async () => {
      try {
        const info = await bridge.checkUpdate();

        if (info !== null) {
          toast.info(`发现新版本 ${info.version}`, {
            description: "在「关于」面板中下载并安装",
          });
        }
      } catch {
        // Update checks are best-effort; the app works fully offline.
      }
    })();
  }, [bridge, settings.autoCheckUpdate]);

  // Every tab autosaves independently; background edits must not be lost.
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    if (bridge && settings.autoSave) {
      for (const item of tabs) {
        if (item.path === null || item.content === item.savedContent) {
          continue;
        }

        const snapshot = item.content;
        const { path } = item;
        const { id } = item;

        timers.set(
          id,
          setTimeout(() => {
            void (async () => {
              setSaving(true);

              try {
                await bridge.saveFile({ content: snapshot, path });
                setTabs((current) =>
                  current.map((entry) =>
                    entry.id === id && entry.content === snapshot
                      ? {
                          ...entry,
                          savedAt: Date.now(),
                          savedContent: snapshot,
                        }
                      : entry
                  )
                );
              } catch (error) {
                if (error instanceof Error) {
                  report("自动保存失败", error);
                }
              }

              setSaving(false);
            })();
          }, autosaveDelay)
        );
      }
    }

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, [bridge, settings.autoSave, tabs]);

  // An update closes the app while the installer waits, so flush every dirty
  // tab immediately instead of waiting for the autosave debounce.
  useEffect(() => {
    const unsubscribe = bridge?.onAppSave(() => {
      for (const item of tabs) {
        if (item.path === null || item.content === item.savedContent) {
          continue;
        }

        const snapshot = item.content;
        const { path } = item;
        const { id } = item;

        void (async () => {
          try {
            await bridge.saveFile({ content: snapshot, path });
            setTabs((current) =>
              current.map((entry) =>
                entry.id === id && entry.content === snapshot
                  ? {
                      ...entry,
                      savedAt: Date.now(),
                      savedContent: snapshot,
                    }
                  : entry
              )
            );
          } catch (error) {
            if (error instanceof Error) {
              report("保存失败", error);
            }
          }
        })();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [bridge, tabs]);

  useEffect(() => {
    document.title = `${dirty ? "• " : ""}${fileName} — MarkdownView`;
  }, [dirty, fileName]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (anyDirty) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [anyDirty]);

  const actions = useRef({
    closeActiveTab,
    cycleTab,
    newDocument,
    openFile,
    save,
    saveAs,
    switchTab,
  });

  useEffect(() => {
    actions.current = {
      closeActiveTab,
      cycleTab,
      newDocument,
      openFile,
      save,
      saveAs,
      switchTab,
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.shiftKey) {
        if (key === "s") {
          event.preventDefault();
          void actions.current.saveAs();
        } else if (key === "tab") {
          event.preventDefault();
          actions.current.cycleTab(-1);
        }

        return;
      }

      if (key === "s") {
        event.preventDefault();
        void actions.current.save();
      } else if (key === "o") {
        event.preventDefault();
        actions.current.openFile();
      } else if (key === "n") {
        event.preventDefault();
        actions.current.newDocument();
      } else if (key === "w") {
        event.preventDefault();
        actions.current.closeActiveTab();
      } else if (key === "tab") {
        event.preventDefault();
        actions.current.cycleTab(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return {
    actions: {
      clearPreviewTarget,
      clearRecentFiles,
      closeTab,
      exportDocument,
      focusLine,
      newDocument,
      openFile,
      openFolder,
      openLink,
      openPath,
      refreshFolder,
      removeFolder,
      revealFile,
      revealFolder,
      revealOutline,
      save,
      saveAs,
      saveImage,
      switchTab,
      toggleFolder,
    },
    activeId,
    anyDirty,
    confirmation: {
      message: pendingAction?.message ?? discardMessage,
      open: pendingAction !== null,
      settle: settleConfirmation,
    },
    content,
    dirty,
    editorReveal,
    expandedFolders,
    fileName,
    filePath,
    folders,
    isDesktop: bridge !== null,
    mode,
    outline,
    previewTarget,
    recentFiles: recentFiles.slice(0, settings.recentFilesLimit),
    registerReader,
    savedAt,
    saving,
    setContent: (value: string) => {
      patchActive(() => ({ content: value }));
    },
    setMode: changeMode,
    setSidebarOpen,
    setSidebarView,
    sidebarOpen,
    sidebarView,
    tabs,
  };
};
