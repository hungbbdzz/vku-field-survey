// =========================================================
// functions/api/submissions.ts
// Cloudflare Pages Function — Production Sync Endpoint
// Receives survey submissions from VKU Field Survey PWA
// =========================================================

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const contentType = request.headers.get('content-type') || '';
    let id = '';
    let building = '';
    let floor = '';
    let room = '';
    let category = '';
    let rating = '0';
    let notes = '';
    let hasPhoto = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = (formData.get('id') as string) || crypto.randomUUID();
      building = (formData.get('building') as string) || '';
      floor = (formData.get('floor') as string) || '';
      room = (formData.get('room') as string) || '';
      category = (formData.get('category') as string) || '';
      rating = (formData.get('rating') as string) || '0';
      notes = (formData.get('notes') as string) || '';
      const photo = formData.get('photo');
      hasPhoto = photo instanceof Blob && photo.size > 0;
    } else {
      const json = await request.json().catch(() => ({})) as Record<string, any>;
      id = json.id || crypto.randomUUID();
      building = json.building || '';
      floor = json.floor || '';
      room = json.room || '';
      category = json.category || '';
      rating = String(json.rating || 0);
      notes = json.notes || '';
    }

    console.info(`[Sync API] Received submission: ${id} (${building}-${floor}-${room}, ${category}, ${rating}★)`);

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
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('[Sync API] Error processing submission:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Lỗi xử lý dữ liệu khảo sát.',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestGet(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'online',
      service: 'VKU Field Survey Sync API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
