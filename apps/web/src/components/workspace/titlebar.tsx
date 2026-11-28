import { Maximize2Icon, Minimize2Icon, MinusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoMark } from "#src/components/logo-mark.tsx";
import { desktop } from "#src/lib/desktop.ts";

const WindowControls = () => {
  const bridge = desktop();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (bridge === null) {
      return () => {
        // The browser preview has no native window.
      };
    }

    let active = true;

    void (async () => {
      try {
        const value = await bridge.isWindowMaximized();

        if (active) {
          setMaximized(value);
        }
      } catch {
        // The browser preview has no native window.
      }
    })();

    return () => {
      active = false;
    };
  }, [bridge]);

  if (bridge === null) {
    return null;
  }

  return (
    <div className="window-controls">
      <button
        aria-label="最小化"
        onClick={() => {
          void bridge.minimizeWindow();
        }}
        type="button"
      >
        <MinusIcon />
      </button>
      <button
        aria-label={maximized ? "还原" : "最大化"}
        onClick={() => {
          void (async () => {
            setMaximized(await bridge.toggleMaximizeWindow());
          })();
        }}
        type="button"
      >
        {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
      </button>
      <button
        aria-label="关闭"
        className="window-close"
        onClick={() => {
          void bridge.closeWindow();
        }}
        type="button"
      >
        <XIcon />
      </button>
    </div>
  );
};

interface TitlebarProps {
  dirty: boolean;
  fileName: string;
}

export const Titlebar = ({ dirty, fileName }: TitlebarProps) => (
  <header className="app-titlebar" data-tauri-drag-region>
    <div className="titlebar-brand" data-tauri-drag-region>
      <span className="titlebar-mark">
        <LogoMark className="size-5" />
      </span>
      <span>MarkdownView</span>
    </div>

    <div className="titlebar-center" data-tauri-drag-region>
      <span className="titlebar-document" data-tauri-drag-region>
        <span className="titlebar-document-name">{fileName}</span>
        {dirty ? (
          <span aria-label="未保存" className="titlebar-dirty" title="未保存" />
        ) : (
          <span className="titlebar-saved">已保存</span>
        )}
      </span>
    </div>

    <WindowControls />
  </header>
);
