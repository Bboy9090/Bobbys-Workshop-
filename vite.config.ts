import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path';
import { backendAutoStart } from './vite-plugin-backend-auto-start';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  base: './', // Use relative paths for Electron (file:// protocol)
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
    // Auto-start backend server in dev mode
    backendAutoStart() as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  build: {
    // Ensure relative paths work with file:// protocol
    assetsDir: 'assets',
    rollupOptions: {
      external: [
        // Tauri APIs are only available at runtime, not during build
        '@tauri-apps/api/core',
        '@tauri-apps/api/tauri',
        '@tauri-apps/api/window',
        '@tauri-apps/api/fs',
        '@tauri-apps/api/path',
        '@tauri-apps/api/shell'
      ],
      output: {
        // Use relative paths for all assets
        format: 'es'
      }
    }
  }
});
