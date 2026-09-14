import { defineConfig } from 'vite';

export default defineConfig({
  // Build the Service Worker as a separate entry point
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  // Ensure SW is copied from public/
  publicDir: 'public',
  server: {
    port: 5173,
    // Proxy for local API testing
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
