import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  MarkdownDocument,
  MarkdownFolder,
  MarkdownSavedFile,
} from "@markdownview/electron";

import { desktop } from "#src/lib/desktop.ts";
import { welcomeDocument } from "#src/lib/welcome-document.ts";

export type ViewMode = "edit" | "split" | "preview";

interface PendingAction {
  message: string;
  run: () => void;
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

export const useWorkspace = () => {
  const bridge = desktop();
  const [content, setContent] = useState(welcomeDocument);
  const [savedContent, setSavedContent] = useState(welcomeDocument);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState("欢迎使用.md");
  const [folder, setFolder] = useState<MarkdownFolder | null>(null);
  const [mode, setMode] = useState<ViewMode>(storedMode);
  const [sidebarOpen, setSidebarOpen] = useState(bridge !== null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );

  // Autosave resolves after later keystrokes; it must not mark them saved.
  const latestContent = useRef(content);
  const dirty = content !== savedContent;

  useEffect(() => {
    latestContent.current = content;
  }, [content]);

  const guard = (run: () => void) => {
    if (dirty) {
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

  const loadDocument = (document: MarkdownDocument) => {
    setContent(document.content);
    setSavedContent(document.content);
    setFilePath(document.path);
    setFileName(document.name);
    setSavedAt(null);
  };

  const changeMode = (next: ViewMode) => {
    setMode(next);
    localStorage.setItem(modeStorageKey, next);
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

      if (listing === null) {
        return;
      }

      setFolder(listing);
      setSidebarOpen(true);

      const [first] = listing.files;

      if (first !== undefined && !dirty) {
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
      setFolder(await bridge.refreshFolder(folderPath));
    } catch (error) {
      if (error instanceof Error) {
        report("刷新文件夹失败", error);
      }
    }
  };

  const openPathFromDisk = async (path: string) => {
    if (!bridge || path === filePath) {
      return;
    }

    try {
      loadDocument(await bridge.readFile(path));
    } catch (error) {
      if (error instanceof Error) {
        report("打开文件失败", error);
      }
    }
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

    if (folder !== null) {
      await refreshFolderFromDisk(folder.path);
    }
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
      newDocument,
      openFile,
      openFolder,
      openPath,
      refreshFolder,
      save,
      saveAs,
    },
    confirmation: {
      message: pendingAction?.message ?? discardMessage,
      open: pendingAction !== null,
      settle: settleConfirmation,
    },
    content,
    dirty,
    fileName,
    filePath,
    folder,
    isDesktop: bridge !== null,
    mode,
    savedAt,
    saving,
    setContent,
    setMode: changeMode,
    setSidebarOpen,
    sidebarOpen,
  };
};
