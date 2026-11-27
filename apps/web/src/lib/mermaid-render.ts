type Renderer = (id: string, chart: string) => Promise<{ svg: string }>;

let renderer: Renderer | null = null;
let sequence = 0;

/** Mermaid is large, so it is loaded only when a note actually has a chart. */
const loadRenderer = async (): Promise<Renderer> => {
  if (renderer !== null) {
    return renderer;
  }

  const loaded = await import("mermaid");

  loaded.default.initialize({
    securityLevel: "strict",
    startOnLoad: false,
  });

  renderer = async (id, chart) => await loaded.default.render(id, chart);

  return renderer;
};

/** Renders a Mermaid chart to a standalone SVG string for previews and export. */
export const renderMermaidSvg = async (chart: string) => {
  const render = await loadRenderer();

  sequence += 1;

  const { svg } = await render(`mermaid-view-${sequence}`, chart);

  return svg;
};
