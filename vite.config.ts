import { defineConfig } from "vite";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [
    viteStaticCopy({
      targets: [
        // {
        //   src: 'node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm',
        //   dest: './' 
        // }
      ]
    })
  ],

  optimizeDeps: {
    // exclude: ['@babylonjs/havok']
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    mimeTypes: {
      'application/wasm': ['wasm']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@Log': path.resolve(__dirname, 'src/Services/Framework/Log/Log.js'),
      '@Tauri': path.resolve(__dirname, 'src/Services/Framework/Tauri/Tauri.js'),
      '@Globals': path.resolve(__dirname, 'src/Services/Framework/Globals/Globals.js'),
    },
  },
}));