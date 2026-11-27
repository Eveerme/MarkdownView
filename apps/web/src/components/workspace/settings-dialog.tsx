import { Settings2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@markdownview/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@markdownview/ui/components/dialog";
import { Slider } from "@markdownview/ui/components/slider";
import { Switch } from "@markdownview/ui/components/switch";

import { settingsRanges } from "#src/lib/settings.ts";
import { themeOptions } from "#src/lib/themes.ts";
import { useSettings } from "#src/lib/use-settings.tsx";

const Section = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <section className="border-border border-b pb-1 last:border-b-0">
    <h3 className="text-muted-foreground pt-2 pb-1 text-xs font-medium">
      {title}
    </h3>
    {children}
  </section>
);

const ToggleRow = ({
  description,
  label,
  onChange,
  value,
}: {
  description: string;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) => (
  <div className="flex items-start justify-between gap-6 py-2">
    <div className="min-w-0">
      <div className="font-medium">{label}</div>
      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
        {description}
      </p>
    </div>
    <Switch
      aria-label={label}
      checked={value}
      className="mt-0.5"
      onCheckedChange={onChange}
    />
  </div>
);

const SliderRow = ({
  description,
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  description: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) => (
  <div className="py-2">
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {description}
        </p>
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
    <Slider
      aria-label={label}
      className="mt-2"
      max={max}
      min={min}
      onValueChange={(next) => {
        const [first] = next;

        if (first !== undefined) {
          onChange(first);
        }
      }}
      step={1}
      value={[value]}
    />
  </div>
);

const ThemeSection = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-1.5 py-2 sm:grid-cols-3">
      {themeOptions.map(({ label, value }) => {
        const active = theme === value;

        return (
          <button
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
              active
                ? "border-primary/40 bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
            key={value}
            onClick={() => {
              setTheme(value);
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              className="border-border size-3.5 shrink-0 rounded-full border"
              data-swatch={value}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export const SettingsDialog = () => {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key === ","
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const editorSize = settingsRanges.editorFontSize;
  const previewSize = settingsRanges.previewFontSize;
  const measure = settingsRanges.readingWidth;
  const recentLimit = settingsRanges.recentFilesLimit;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label="设置"
            size="icon-sm"
            title="设置 (Ctrl+,)"
            variant="ghost"
          />
        }
      >
        <Settings2Icon />
      </DialogTrigger>
      <DialogContent
        className="max-h-[85svh] overflow-y-auto sm:max-w-xl"
        scrollbar="subtle"
      >
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>偏好保存在本机，改动立即生效。</DialogDescription>
        </DialogHeader>

        <div>
          <Section title="外观">
            <ThemeSection />
          </Section>

          <Section title="编辑">
            <ToggleRow
              description="在源码左侧显示行号。"
              label="显示行号"
              onChange={(lineNumbers) => {
                update({ lineNumbers });
              }}
              value={settings.lineNumbers}
            />
            <ToggleRow
              description="长段落折行显示；关闭后按原始宽度横向滚动。"
              label="自动换行"
              onChange={(wordWrap) => {
                update({ wordWrap });
              }}
              value={settings.wordWrap}
            />
            <ToggleRow
              description="淡化非当前段落，只突出正在写的内容。"
              label="专注模式"
              onChange={(focusMode) => {
                update({ focusMode });
              }}
              value={settings.focusMode}
            />
            <ToggleRow
              description="输入时把光标所在行保持在编辑区中央。"
              label="打字机模式"
              onChange={(typewriterMode) => {
                update({ typewriterMode });
              }}
              value={settings.typewriterMode}
            />
            <SliderRow
              description="源码的字号。"
              label="源码字号"
              max={editorSize.max}
              min={editorSize.min}
              onChange={(editorFontSize) => {
                update({ editorFontSize });
              }}
              suffix=" px"
              value={settings.editorFontSize}
            />
            <SliderRow
              description="每行容纳的字符数，编辑区与预览共用这一列宽。"
              label="正文宽度"
              max={measure.max}
              min={measure.min}
              onChange={(readingWidth) => {
                update({ readingWidth });
              }}
              suffix=" 字符"
              value={settings.readingWidth}
            />
          </Section>

          <Section title="分屏">
            <ToggleRow
              description="滚动一侧时，另一侧跟随到同一位置。"
              label="同步滚动"
              onChange={(syncScroll) => {
                update({ syncScroll });
              }}
              value={settings.syncScroll}
            />
          </Section>

          <Section title="预览">
            <ToggleRow
              description="在正文上方展示文档开头的 YAML 元信息。"
              label="显示元信息"
              onChange={(showFrontMatter) => {
                update({ showFrontMatter });
              }}
              value={settings.showFrontMatter}
            />
            <SliderRow
              description="预览正文的字号。"
              label="正文字号"
              max={previewSize.max}
              min={previewSize.min}
              onChange={(previewFontSize) => {
                update({ previewFontSize });
              }}
              suffix=" px"
              value={settings.previewFontSize}
            />
          </Section>

          <Section title="文件">
            <ToggleRow
              description="停止输入后自动写入磁盘；未保存到磁盘的新文档不受影响。"
              label="自动保存"
              onChange={(autoSave) => {
                update({ autoSave });
              }}
              value={settings.autoSave}
            />
            <SliderRow
              description={`最近列表显示的文件数。历史最多保留 ${recentLimit.max} 条。`}
              label="最近文件数量"
              max={recentLimit.max}
              min={recentLimit.min}
              onChange={(recentFilesLimit) => {
                update({ recentFilesLimit });
              }}
              suffix=" 条"
              value={settings.recentFilesLimit}
            />
          </Section>

          <Section title="更新">
            <ToggleRow
              description="每 6 小时检查一次新版本；检查清单不消耗 GitHub API 额度。"
              label="自动检查更新"
              onChange={(autoCheckUpdate) => {
                update({ autoCheckUpdate });
              }}
              value={settings.autoCheckUpdate}
            />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
