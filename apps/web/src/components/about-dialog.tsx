import { ExternalLinkIcon, InfoIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { DesktopVersions } from "@markdownview/electron";
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

const repositoryLabel = "github.com/Eveerme/MarkdownView";

export const AboutDialog = () => {
  const [versions, setVersions] = useState<DesktopVersions | null>(null);

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
    <Dialog>
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
            Electron {versions.electron} · Chromium {versions.chrome} · Node{" "}
            {versions.node}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
