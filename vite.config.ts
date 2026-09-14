import { defineConfig, Plugin } from 'vite';

// Plugin cung cấp endpoint /api/submissions trực tiếp cho Vite Dev Server
// Đảm bảo hoạt động tương thích 100% với Cloudflare Pages Function (functions/api/submissions.ts)
function vkuDevApiPlugin(): Plugin {
  return {
    name: 'vku-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/submissions')) {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(
                JSON.stringify({
                  success: true,
                  receivedAt: new Date().toISOString(),
                  message: 'Dữ liệu khảo sát đã được đồng bộ thành công (Dev Server).',
                })
              );
            });
            return;
          }

          if (req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                status: 'online',
                environment: 'Vite Dev Server',
                timestamp: new Date().toISOString(),
              })
            );
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [vkuDevApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: false,
  },
});

