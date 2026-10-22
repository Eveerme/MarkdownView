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
  { label: "Light", value: "light" },
  { label: "Sepia", value: "sepia" },
  { label: "Forest", value: "forest" },
  { label: "Pure white", value: "white" },
  { label: "Dark", value: "dark" },
  { label: "Midnight", value: "midnight" },
  { label: "System", value: "system" },
];
