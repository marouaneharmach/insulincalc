/**
 * Cloudflare Worker — CORS Proxy for Clarifai API
 *
 * Deploy:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Name it "clarifai-proxy"
 *   3. Paste this code in the editor
 *   4. Add environment variable: CLARIFAI_PAT = your_token
 *   5. Deploy
 *   6. Your proxy URL: https://clarifai-proxy.<your-subdomain>.workers.dev
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const PAT = env.CLARIFAI_PAT;
    if (!PAT) {
      return new Response(JSON.stringify({ error: 'CLARIFAI_PAT not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const body = await request.text();

      const clarifaiResponse = await fetch(
        'https://api.clarifai.com/v2/models/food-item-recognition/versions/1d5fd481e0cf4826aa72ec3ff049e044/outputs',
        {
          method: 'POST',
          headers: {
            'Authorization': `Key ${PAT}`,
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      const data = await clarifaiResponse.text();

      return new Response(data, {
        status: clarifaiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
