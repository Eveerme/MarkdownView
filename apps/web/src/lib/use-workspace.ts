import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  MarkdownDocument,
  MarkdownFolder,
  MarkdownSavedFile,
  RecentFile,
  ResolvedLink,
} from "@markdownview/electron";

import { desktop } from "#src/lib/desktop.ts";
import { rootKey } from "#src/lib/file-tree.ts";
import type { OutlineItem } from "#src/lib/outline.ts";
import { useDocumentOutline } from "#src/lib/use-outline.ts";
import { welcomeDocument } from "#src/lib/welcome-document.ts";

export type ViewMode = "edit" | "split" | "preview";

export type SidebarView = "recent" | "files" | "outline";

interface PendingAction {
  message: string;
  run: () => void;
}

interface PreviewAnchor {
  id: string;
  nonce: number;
}

interface EditorReveal {
  line: number;
  nonce: number;
}

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
  const [content, setContent] = useState(welcomeDocument);
  const [savedContent, setSavedContent] = useState(welcomeDocument);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState("欢迎使用.md");
  const [folders, setFolders] = useState<MarkdownFolder[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set()
  );

  const [mode, setMode] = useState<ViewMode>(storedMode);
  const [sidebarOpen, setSidebarOpen] = useState(bridge !== null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("recent");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [previewAnchor, setPreviewAnchor] = useState<PreviewAnchor | null>(
    null
  );

  const [editorReveal, setEditorReveal] = useState<EditorReveal | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );

  // Autosave resolves after later keystrokes; it must not mark them saved.
  const latestContent = useRef(content);
  const dirty = content !== savedContent;
  const dirtyRef = useRef(dirty);
  const revealNonce = useRef(0);
  const outline = useDocumentOutline(content, filePath);

  useEffect(() => {
    latestContent.current = content;
  }, [content]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

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
    setContent(document.content);
    setSavedContent(document.content);
    setFilePath(document.path);
    setFileName(document.name);
    setSavedAt(null);
    setPreviewAnchor(null);
    setEditorReveal(null);
    void refreshRecentFiles();
  };

  const changeMode = (next: ViewMode) => {
    setMode(next);
    localStorage.setItem(modeStorageKey, next);

    if (next === "edit") {
      setPreviewAnchor(null);
    }

    if (next === "preview") {
      setEditorReveal(null);
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

  const openPathFromDisk = async (path: string): Promise<boolean> => {
    if (!bridge || path === filePath) {
      return false;
    }

    try {
      loadDocument(await bridge.readFile(path));

      return true;
    } catch (error) {
      void refreshRecentFiles();

      if (error instanceof Error) {
        report("打开文件失败", error);
      }

      return false;
    }
  };

  const reveal = () => {
    revealNonce.current += 1;

    return revealNonce.current;
  };

  const openLinkedDocument = async (target: ResolvedLink) => {
    const opened = await openPathFromDisk(target.path);

    if (opened && target.anchor !== null) {
      setPreviewAnchor({ id: target.anchor, nonce: reveal() });
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
          setPreviewAnchor({ id: target.anchor, nonce: reveal() });
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
      setPreviewAnchor({ id: item.id, nonce });
    }

    if (mode !== "preview") {
      setEditorReveal({ line: item.line, nonce });
    }
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

    setFilePath(saved.path);
    setFileName(saved.name);
    setSavedContent(snapshot);
    setSavedAt(Date.now());
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
      setSavedContent(snapshot);
      setSavedAt(Date.now());
    } catch (error) {
      if (error instanceof Error) {
        report("保存失败", error);
      }
    }

    setSaving(false);
  };

  const newDocument = () => {
    guard(() => {
      setContent("");
      setSavedContent("");
      setFilePath(null);
      setFileName(untitledName);
      setSavedAt(null);
      setPreviewAnchor(null);
      setEditorReveal(null);
    });
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
          void openPathFromDisk(request.path);
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

  const clearPreviewAnchor = useCallback(() => {
    setPreviewAnchor(null);
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
          setSidebarView("files");
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

  // Autosave only touches a file that already exists on disk.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (bridge && filePath !== null && dirty) {
      const snapshot = content;

      timer = setTimeout(() => {
        void (async () => {
          setSaving(true);

          try {
            await bridge.saveFile({ content: snapshot, path: filePath });
            setSavedAt(Date.now());
            setSavedContent((current) =>
              latestContent.current === snapshot ? snapshot : current
            );
          } catch (error) {
            if (error instanceof Error) {
              report("自动保存失败", error);
            }
          }

          setSaving(false);
        })();
      }, autosaveDelay);
    }

    return () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [bridge, content, dirty, filePath]);

  useEffect(() => {
    document.title = `${dirty ? "• " : ""}${fileName} — MarkdownView`;
  }, [dirty, fileName]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  const actions = useRef({ newDocument, openFile, save, saveAs });

  useEffect(() => {
    actions.current = { newDocument, openFile, save, saveAs };
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
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return {
    actions: {
      clearPreviewAnchor,
      clearRecentFiles,
      newDocument,
      openFile,
      openFolder,
      openLink,
      openPath,
      refreshFolder,
      removeFolder,
      revealOutline,
      save,
      saveAs,
      toggleFolder,
    },
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
    previewAnchor,
    recentFiles,
    savedAt,
    saving,
    setContent,
    setMode: changeMode,
    setSidebarOpen,
    setSidebarView,
    sidebarOpen,
    sidebarView,
  };
};
