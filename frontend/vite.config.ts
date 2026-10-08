import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/proxy/products": {
        target: "https://product-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/billing": {
        target: "https://billing-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/reports": {
        target: "https://billing-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/vendors": {
        target: "https://vendor-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/customers": {
        target: "https://vendor-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/broker": {
        target: "https://vendor-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/chit": {
        target: "https://vendor-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
      "/proxy/staff": {
        target: "https://staff-service-492955680725.asia-southeast1.run.app",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/proxy/, "/api"),
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
