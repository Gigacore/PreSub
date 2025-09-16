type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Try to serve a static asset first
    let response = await env.ASSETS.fetch(request);

    // SPA fallback: for GET HTML navigations that 404, serve index.html
    if (response.status === 404 && request.method === 'GET') {
      const accept = request.headers.get('Accept') || '';
      if (accept.includes('text/html')) {
        const url = new URL(request.url);
        url.pathname = '/index.html';
        response = await env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }));
      }
    }

    return response;
  },
};

