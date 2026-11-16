import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 루트 .env 하나로 백엔드·프런트엔드 환경 변수를 통합 관리한다 (VITE_ 접두사만 노출).
export default defineConfig({
  envDir: "..",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
