import { ExternalLinkIcon, InfoIcon, LinkIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type {
  DesktopVersions,
  UpdateInfo,
} from "@markdownview/desktop-contract";
import { Button } from "@markdownview/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@markdownview/ui/components/dialog";

import { LogoMark } from "#src/components/logo-mark.tsx";
import {
  appVersion,
  issuesUrl,
  releasesUrl,
  repositoryUrl,
} from "#src/lib/app-info.ts";
import { desktop } from "#src/lib/desktop.ts";
import { useSettings } from "#src/lib/use-settings.tsx";

const repositoryLabel = "github.com/Eveerme/MarkdownView";

export const AboutDialog = () => {
  const { settings } = useSettings();
  const [versions, setVersions] = useState<DesktopVersions | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    const bridge = desktop();

    if (bridge === null) {
      return;
    }

    setBusy(true);

    try {
      setUpdate(await bridge.checkUpdate());
      setChecked(true);
    } catch (error) {
      toast.error("检查更新失败", {
        description: error instanceof Error ? error.message : undefined,
      });
    }

    setBusy(false);
  }, []);

  const install = async () => {
    const bridge = desktop();

    if (bridge === null || update === null) {
      return;
    }

    setBusy(true);

    try {
      const downloaded = await bridge.downloadUpdate(update);
      await bridge.installUpdate(downloaded.path);
      toast.success("安装程序已打开，完成后请重启应用");
    } catch (error) {
      toast.error("更新失败", {
        description: error instanceof Error ? error.message : undefined,
      });
    }

    setBusy(false);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);

    if (next && settings.autoCheckUpdate) {
      void check();
    }
  };

  useEffect(() => {
    let active = true;

    const loadVersions = async () => {
      const bridge = desktop();

      if (bridge === null) {
        return;
      }

      try {
        const value = await bridge.versions();

        if (active) {
          setVersions(value);
        }
      } catch {
        // Runtime versions are extra detail; the dialog works without them.
      }
    };

    void loadVersions();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger
        render={<Button size="icon-sm" variant="ghost" />}
        aria-label="关于 MarkdownView"
        title="关于"
      >
        <InfoIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2.5">
              <span className="bg-background grid size-8 place-items-center rounded-lg">
                <LogoMark className="text-foreground size-8" />
              </span>
              MarkdownView
            </span>
          </DialogTitle>
          <DialogDescription>
            专注写作的本地 Markdown 编辑器，文件只保存在你的磁盘上。
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">版本</dt>
          <dd className="font-mono tabular-nums">{appVersion}</dd>
          <dt className="text-muted-foreground">仓库</dt>
          <dd className="min-w-0">
            <a
              className="inline-flex max-w-full items-center gap-1 truncate font-medium underline-offset-4 hover:underline"
              href={repositoryUrl}
              rel="noreferrer"
              target="_blank"
            >
              <LinkIcon className="size-3 shrink-0" />
              <span className="truncate">{repositoryLabel}</span>
            </a>
          </dd>
        </dl>

        <div className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs">
          <div className="min-w-0">
            {update === null ? (
              <span className="text-muted-foreground">
                {checked ? "已是最新版本" : "尚未检查更新"}
              </span>
            ) : (
              <div className="min-w-0">
                <span className="font-medium">发现新版本 {update.version}</span>
                <p className="text-muted-foreground mt-0.5 line-clamp-2">
                  {update.notes}
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              disabled={busy}
              onClick={() => {
                void check();
              }}
              size="sm"
              variant="outline"
            >
              检查
            </Button>
            {update === null ? null : (
              <Button
                disabled={busy}
                onClick={() => {
                  void install();
                }}
                size="sm"
              >
                下载并安装
              </Button>
            )}
          </div>
        </div>

        <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs">
          <a
            className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
            href={releasesUrl}
            rel="noreferrer"
            target="_blank"
          >
            下载最新版本
            <ExternalLinkIcon className="size-3" />
          </a>
          <a
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            href={issuesUrl}
            rel="noreferrer"
            target="_blank"
          >
            问题反馈
          </a>
        </div>

        {versions === null ? null : (
          <p className="text-muted-foreground font-mono text-xs leading-relaxed">
            Tauri {versions.tauri} · WebView {versions.webview} ·{" "}
            {versions.platform}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
