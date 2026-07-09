import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  // Point the dashboard at a deployed market with e.g.
  //   ADMIN_API_URL=https://schwifty.up.railway.app npm run dev:dashboard
  server: { port: 5173, proxy: { "/admin": { target: process.env.ADMIN_API_URL ?? "http://localhost:4021", changeOrigin: true } } },
});
