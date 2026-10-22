export const themeValues = [
  "light",
  "sepia",
  "forest",
  "dark",
  "midnight",
] as const;

export type AppTheme = (typeof themeValues)[number];

export const themeOptions: readonly {
  label: string;
  value: AppTheme | "system";
}[] = [
  { label: "Light", value: "light" },
  { label: "Sepia", value: "sepia" },
  { label: "Forest", value: "forest" },
  { label: "Dark", value: "dark" },
  { label: "Midnight", value: "midnight" },
  { label: "System", value: "system" },
];
