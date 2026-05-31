import { defineConfig } from "vite";

// Vite 配置：开发服务器端口、自动打开浏览器
export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
});
