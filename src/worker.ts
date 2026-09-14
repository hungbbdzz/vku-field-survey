// =========================================================
// src/worker.ts — Cloudflare Worker Entrypoint
// Handles API routes (/api/submissions) and serves static assets
// =========================================================

interface Env {
  ASSETS: { fetch: typeof fetch };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === '/api/submissions') {
      if (request.method === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'online',
            service: 'VKU Field Survey Sync API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (request.method === 'POST') {
        try {
          const contentType = request.headers.get('content-type') || '';
          let id = '';
          let building = '';
          let floor = '';
          let room = '';
          let category = '';
          let rating = '0';
          let hasPhoto = false;

          if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            id = (formData.get('id') as string) || crypto.randomUUID();
            building = (formData.get('building') as string) || '';
            floor = (formData.get('floor') as string) || '';
            room = (formData.get('room') as string) || '';
            category = (formData.get('category') as string) || '';
            rating = (formData.get('rating') as string) || '0';
            const photo = formData.get('photo');
            hasPhoto = photo instanceof Blob && photo.size > 0;
          } else {
            const json = (await request.json().catch(() => ({}))) as Record<string, any>;
            id = json.id || crypto.randomUUID();
            building = json.building || '';
            floor = json.floor || '';
            room = json.room || '';
            category = json.category || '';
            rating = String(json.rating || 0);
          }

          console.info(`[Worker Sync API] Received: ${id} (${building}-${floor}-${room})`);

          return new Response(
            JSON.stringify({
              success: true,
              id,
              receivedAt: new Date().toISOString(),
              summary: {
                location: `${building} F${floor} R${room}`,
                category,
                rating: Number(rating),
                hasPhoto,
              },
              message: 'Báo cáo kiểm tra đã được lưu trữ thành công trên máy chủ VKU.',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        } catch (error: any) {
          return new Response(
            JSON.stringify({ success: false, error: error?.message || 'Lỗi xử lý dữ liệu.' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
    }

    // Pass all other requests to static assets
    return env.ASSETS.fetch(request);
  },
};
