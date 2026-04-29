import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@radix-ui/')) return 'radix';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts';
          if (id.includes('/exceljs/') || id.includes('/jspdf/')) return 'excel-pdf';
          if (id.includes('/html2canvas/')) return 'html2canvas';
          if (
            id.includes('/convex/') ||
            id.includes('/convex-helpers/') ||
            id.includes('/@convex-dev/')
          ) return 'convex-vendor';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/scheduler/')
          ) return 'react-vendor';
        },
      },
    },
  },
}));
