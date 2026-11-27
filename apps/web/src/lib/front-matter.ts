import { parse as parseYaml } from "yaml";
import { z } from "zod";

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const dataSchema = z.record(z.string(), z.union([scalar, z.array(scalar)]));

export type FrontMatterData = z.infer<typeof dataSchema>;

type Value = FrontMatterData[string];

export interface FrontMatter {
  body: string;
  data: FrontMatterData;
  /** Lines removed from the top, used to keep preview source-line mapping. */
  lineOffset: number;
  raw: string | null;
}

const empty = (markdown: string): FrontMatter => ({
  body: markdown,
  data: {},
  lineOffset: 0,
  raw: null,
});

/** Reads only a leading `---` block; malformed YAML is ignored as plain text. */
export const parseFrontMatter = (markdown: string): FrontMatter => {
  const lines = markdown.split("\n");

  if (lines[0]?.trim() !== "---") {
    return empty(markdown);
  }

  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );

  if (end === -1) {
    return empty(markdown);
  }

  const raw = lines.slice(1, end).join("\n");

  const result = (() => {
    try {
      return dataSchema.safeParse(parseYaml(raw));
    } catch {
      return null;
    }
  })();

  return {
    body: lines.slice(end + 1).join("\n"),
    data: result?.success === true ? result.data : {},
    lineOffset: end + 1,
    raw,
  };
};

const displayValue = (value: Value): string => {
  if (value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(displayValue).join(", ");
  }

  return String(value);
};

export const frontMatterEntries = (data: FrontMatterData) =>
  Object.entries(data).map(([key, value]) => ({
    key,
    value: displayValue(value),
  }));
