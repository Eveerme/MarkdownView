import { useDeferredValue, useMemo } from "react";

import { useEditorCursor } from "#src/lib/editor-cursor.ts";
import {
  countCharacters,
  countLines,
  countWords,
} from "#src/lib/markdown-stats.ts";
import { useSelectionCount } from "#src/lib/use-selection-count.ts";

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
});

interface StatusBarProps {
  content: string;
  dirty: boolean;
  fileName: string;
  filePath: string | null;
  isDesktop: boolean;
  savedAt: number | null;
  saving: boolean;
}

const saveState = ({
  dirty,
  filePath,
  isDesktop,
  savedAt,
  saving,
}: Pick<
  StatusBarProps,
  "dirty" | "filePath" | "isDesktop" | "savedAt" | "saving"
>) => {
  if (saving) {
    return "保存中…";
  }

  if (dirty) {
    return "未保存";
  }

  if (savedAt !== null) {
    return `已保存 ${timeFormat.format(savedAt)}`;
  }

  if (!isDesktop) {
    return "浏览器预览";
  }

  return filePath === null ? "未保存到磁盘" : "已保存";
};

const saveTone = ({
  dirty,
  saving,
}: Pick<StatusBarProps, "dirty" | "saving">) => {
  if (saving) {
    return "bg-primary/10 text-primary";
  }

  if (dirty) {
    return "bg-accent text-accent-foreground";
  }

  return "bg-success/10 text-success";
};

export const StatusBar = ({
  content,
  dirty,
  fileName,
  filePath,
  isDesktop,
  savedAt,
  saving,
}: StatusBarProps) => {
  const cursor = useEditorCursor();
  const selected = useSelectionCount();
  // The counts trail the text: a keystroke must not wait for a scan of the
  // whole document.
  const counted = useDeferredValue(content);
  const words = useMemo(() => countWords(counted), [counted]);
  const characters = countCharacters(counted);
  const lines = useMemo(() => countLines(counted), [counted]);

  return (
    <footer className="workspace-status text-muted-foreground flex h-full shrink-0 items-center gap-2 px-2 text-xs">
      <span className="max-w-[45%] min-w-0 truncate font-mono">
        {isDesktop
          ? (filePath ?? fileName)
          : "浏览器预览 · 文件读写需在桌面版使用"}
      </span>
      <span
        className={`shrink-0 rounded-md px-1.5 py-0.5 ${saveTone({
          dirty,
          saving,
        })}`}
      >
        {saveState({ dirty, filePath, isDesktop, savedAt, saving })}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1 font-mono tabular-nums">
        <span className="bg-muted/60 rounded-md px-1.5 py-0.5" title="光标位置">
          {cursor.line}:{cursor.column}
        </span>
        {selected > 0 ? (
          <span className="bg-muted/60 rounded-md px-1.5 py-0.5">
            选中 {selected} 字符
          </span>
        ) : null}
        <span className="bg-muted/60 rounded-md px-1.5 py-0.5">{words} 字</span>
        <span className="bg-muted/60 hidden rounded-md px-1.5 py-0.5 sm:inline">
          {characters} 字符
        </span>
        <span className="bg-muted/60 rounded-md px-1.5 py-0.5">{lines} 行</span>
      </span>
    </footer>
  );
};
