import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (isExcelDependency(id)) {
            return "excel";
          }
        },
      },
    },
  },
});

function isExcelDependency(id: string): boolean {
  return [
    "/node_modules/xlsx/",
    "/node_modules/cfb/",
    "/node_modules/codepage/",
    "/node_modules/crc-32/",
    "/node_modules/ssf/",
    "/node_modules/wmf/",
    "/node_modules/word/",
    "/node_modules/adler-32/",
    "/node_modules/frac/",
  ].some((dependencyPath) => id.includes(dependencyPath));
}
