import { useDeferredValue, useMemo } from "react";

import { useEditorCursor } from "#src/lib/editor-cursor.ts";
import { countLines, countWords } from "#src/lib/markdown-stats.ts";

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
  // The counts trail the text: a keystroke must not wait for a scan of the
  // whole document.
  const counted = useDeferredValue(content);
  const words = useMemo(() => countWords(counted), [counted]);
  const characters = counted.length;
  const lines = useMemo(() => countLines(counted), [counted]);

  return (
    <footer className="text-muted-foreground flex h-7 shrink-0 items-center gap-3 border-t px-3 text-xs">
      <span className="min-w-0 truncate font-mono">
        {isDesktop
          ? (filePath ?? fileName)
          : "浏览器预览 · 文件读写需在桌面版使用"}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3 font-mono tabular-nums">
        <span title="光标位置">
          {cursor.line}:{cursor.column}
        </span>
        {cursor.selectedWords > 0 ? (
          <span>选中 {cursor.selectedWords} 字</span>
        ) : null}
        <span>{words} 字</span>
        <span className="hidden sm:inline">{characters} 字符</span>
        <span>{lines} 行</span>
        <span aria-hidden="true" className="bg-border h-3 w-px" />
        <span>
          {saveState({ dirty, filePath, isDesktop, savedAt, saving })}
        </span>
      </span>
    </footer>
  );
};
