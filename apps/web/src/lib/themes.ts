export const themeValues = [
  "light",
  "sepia",
  "forest",
  "white",
  "dark",
  "midnight",
] as const;

export type AppTheme = (typeof themeValues)[number];

export const themeOptions: readonly {
  label: string;
  value: AppTheme | "system";
}[] = [
  { label: "纯白", value: "white" },
  { label: "暖纸", value: "light" },
  { label: "羊皮纸", value: "sepia" },
  { label: "松林", value: "forest" },
  { label: "墨夜", value: "dark" },
  { label: "午夜蓝", value: "midnight" },
  { label: "跟随系统", value: "system" },
];
