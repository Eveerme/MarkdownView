import { Settings2Icon } from "lucide-react";
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
import { useSettings } from "#src/lib/use-settings.tsx";

const Section = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <section className="border-border border-b pb-2 last:border-b-0">
    <h3 className="text-muted-foreground pt-3 pb-1 text-xs font-medium">
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
  <div className="flex items-start justify-between gap-6 py-2.5">
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
  <div className="py-2.5">
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
      className="mt-3"
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
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>偏好保存在本机，改动立即生效。</DialogDescription>
        </DialogHeader>

        <div>
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
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
