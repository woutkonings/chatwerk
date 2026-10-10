import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The web app lives in web/. In development, Vite proxies the WebSocket to the
// server on port 8787. `npm run build` writes the app to dist/web.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  // Strudel is one large bundle (about 360 KB gzip), so the default warning limit is too low.
  build: { outDir: '../dist/web', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: {
    host: true,
    proxy: { '/ws': { target: 'http://localhost:8787', ws: true } },
  },
  // @strudel/web is one prebuilt bundle with its own worker asset; do not rebundle it.
  optimizeDeps: { exclude: ['@strudel/web'] },
});
