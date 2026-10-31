import tailwindcss from "@tailwindcss/vite";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  // Tauri ждёт dev-сервер на фиксированном порту (devUrl в tauri.conf.json).
  server: { port: 1420, strictPort: true },
  // Ошибки Rust-сборки, которые печатает Tauri CLI, не должны затираться очисткой экрана.
  clearScreen: false,
});
