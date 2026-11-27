import { useEffect, useRef, useState } from "react";

import { renderMermaidSvg } from "#src/lib/mermaid-render.ts";

interface MermaidBlockProps {
  chart: string;
}

interface RenderState {
  chart: string;
  failed: boolean;
  svg: string | null;
}

export const MermaidBlock = ({ chart }: MermaidBlockProps) => {
  const container = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<RenderState>({
    chart,
    failed: false,
    svg: null,
  });

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const svg = await renderMermaidSvg(chart);

        if (active) {
          setState({ chart, failed: false, svg });
        }
      } catch {
        if (active) {
          setState({ chart, failed: true, svg: null });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [chart]);

  const svg = state.chart === chart ? state.svg : null;
  const failed = state.chart === chart ? state.failed : false;

  useEffect(() => {
    const node = container.current;

    if (node === null || svg === null) {
      return;
    }

    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");

    if (parsed.documentElement.nodeName !== "svg") {
      return;
    }

    node.replaceChildren(document.importNode(parsed.documentElement, true));
  }, [svg]);

  if (failed) {
    return (
      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
        <code>{chart}</code>
      </pre>
    );
  }

  if (svg === null) {
    return <p className="text-muted-foreground text-sm">正在渲染图表…</p>;
  }

  // Mermaid runs with securityLevel "strict"; the SVG is generated locally and
  // contains no scripts from the note.
  return (
    <div
      className="max-w-full [&>svg]:h-auto [&>svg]:max-w-full"
      ref={container}
    />
  );
};
