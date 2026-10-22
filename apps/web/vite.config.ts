import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import desktopManifest from "../desktop/package.json";

export default defineConfig({
  // The desktop manifest is the version the installer and the About dialog share.
  define: { __APP_VERSION__: JSON.stringify(desktopManifest.version) },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react({ compiler: true }),
    tailwindcss(),
  ],
});
