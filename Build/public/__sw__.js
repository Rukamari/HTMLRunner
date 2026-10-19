/**
 * Service Worker for Mini WebContainers
 * Intercepts fetch requests and routes them to virtual servers
 * Version: 15 - cleanup: extract helpers, gate debug logs, remove test endpoints
 */

const DEBUG = false;

let mainPort = null;

const pendingRequests = new Map();
let requestId = 0;

const registeredPorts = new Set();

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  DEBUG && console.log('[SW] Received message:', type, 'hasPort in event.ports:', event.ports?.length > 0);

  if (type === 'init' && event.ports && event.ports[0]) {
    mainPort = event.ports[0];
    mainPort.onmessage = handleMainMessage;
    DEBUG && console.log('[SW] Initialized communication channel with transferred port');
    self.clients.claim();
  }

  if (type === 'server-registered' && data) {
    registeredPorts.add(data.port);
    DEBUG && console.log(`[SW] Server registered on port ${data.port}`);
  }

  if (type === 'server-unregistered' && data) {
    registeredPorts.delete(data.port);
    DEBUG && console.log(`[SW] Server unregistered from port ${data.port}`);
  }
});

function handleMainMessage(event) {
  const { type, id, data, error } = event.data;

  DEBUG && console.log('[SW] Received message from main:', type, 'id:', id);

  if (type === 'response') {
    const pending = pendingRequests.get(id);
    DEBUG && console.log('[SW] Looking for pending request:', id, 'found:', !!pending);

    if (pending) {
      pendingRequests.delete(id);

      if (error) {
        DEBUG && console.log('[SW] Response error:', error);
        pending.reject(new Error(error));
      } else {
        DEBUG && console.log('[SW] Response data:', {
          statusCode: data?.statusCode,
          statusMessage: data?.statusMessage,
          headers: data?.headers,
          bodyType: data?.body?.constructor?.name,
          bodyLength: data?.body?.length || data?.body?.byteLength,
        });
        pending.resolve(data);
      }
    }
  }

  if (type === 'stream-start') {
    DEBUG && console.log('[SW] stream-start received, id:', id);
    const pending = pendingRequests.get(id);
    if (pending && pending.streamController) {
      pending.streamData = data;
      pending.resolveHeaders(data);
      DEBUG && console.log('[SW] headers resolved for stream', id);
    } else {
      DEBUG && console.log('[SW] No pending request or controller for stream-start', id, !!pending, pending?.streamController);
    }
  }

  if (type === 'stream-chunk') {
    DEBUG && console.log('[SW] stream-chunk received, id:', id, 'size:', data?.chunkBase64?.length);
    const pending = pendingRequests.get(id);
    if (pending && pending.streamController) {
      try {
        if (data.chunkBase64) {
          const bytes = base64ToBytes(data.chunkBase64);
          pending.streamController.enqueue(bytes);
          DEBUG && console.log('[SW] chunk enqueued, bytes:', bytes.length);
        }
      } catch (e) {
        console.error('[SW] Error enqueueing chunk:', e);
      }
    } else {
      DEBUG && console.log('[SW] No pending request or controller for stream-chunk', id);
    }
  }

  if (type === 'stream-end') {
    DEBUG && console.log('[SW] stream-end received, id:', id);
    const pending = pendingRequests.get(id);
    if (pending && pending.streamController) {
      try {
        pending.streamController.close();
        DEBUG && console.log('[SW] stream closed');
      } catch (e) {
        DEBUG && console.log('[SW] stream already closed');
      }
      pendingRequests.delete(id);
    }
  }
}

async function sendRequest(port, method, url, headers, body) {
  DEBUG && console.log('[SW] sendRequest called, mainPort:', !!mainPort, 'url:', url);

  if (!mainPort) {
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      client.postMessage({ type: 'sw-needs-init' });
    }
    await new Promise(resolve => {
      const check = setInterval(() => { if (mainPort) { clearInterval(check); resolve(); } }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
    if (!mainPort) {
      throw new Error('Service Worker not initialized - no connection to main thread');
    }
  }

  const id = ++requestId;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);

    mainPort.postMessage({
      type: 'request',
      id,
      data: { port, method, url, headers, body },
    });
  });
}

async function sendStreamingRequest(port, method, url, headers, body) {
  DEBUG && console.log('[SW] sendStreamingRequest called, url:', url);

  if (!mainPort) {
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      client.postMessage({ type: 'sw-needs-init' });
    }
    await new Promise(resolve => {
      const check = setInterval(() => { if (mainPort) { clearInterval(check); resolve(); } }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
    if (!mainPort) {
      throw new Error('Service Worker not initialized');
    }
  }

  const id = ++requestId;

  let streamController;
  let resolveHeaders;
  const headersPromise = new Promise(resolve => { resolveHeaders = resolve; });

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;

      pendingRequests.set(id, {
        resolve: () => {},
        reject: (err) => controller.error(err),
        streamController: controller,
        resolveHeaders,
      });

      mainPort.postMessage({
        type: 'request',
        id,
        data: { port, method, url, headers, body, streaming: true },
      });
    },
    cancel() {
      pendingRequests.delete(id);
    }
  });

  return { stream, headersPromise, id };
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  DEBUG && console.log('[SW] Fetch:', url.pathname, 'mainPort:', !!mainPort);

  const match = url.pathname.match(/^\/__virtual__\/(\d+)(\/.*)?$/);

  if (!match) {
    const referer = event.request.referrer;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererMatch = refererUrl.pathname.match(/^\/__virtual__\/(\d+)/);
        if (refererMatch) {
          const virtualPrefix = refererMatch[0];
          const virtualPort = parseInt(refererMatch[1], 10);
          const targetPath = url.pathname + url.search;

          if (event.request.mode === 'navigate') {
            const redirectUrl = url.origin + virtualPrefix + targetPath;
            DEBUG && console.log('[SW] Redirecting navigation from virtual context:', url.pathname, '->', redirectUrl);
            event.respondWith(Response.redirect(redirectUrl, 302));
            return;
          } else {
            DEBUG && console.log('[SW] Forwarding resource from virtual context:', url.pathname);
            event.respondWith(handleVirtualRequest(event.request, virtualPort, targetPath));
            return;
          }
        }
      } catch (e) {
      }
    }
    return;
  }

  DEBUG && console.log('[SW] Virtual request:', url.pathname);

  const port = parseInt(match[1], 10);
  const path = match[2] || '/';

  event.respondWith(handleVirtualRequest(event.request, port, path + url.search));
});

async function handleVirtualRequest(request, port, path) {
  try {
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    const isStreamingCandidate = request.method === 'POST' && path.startsWith('/api/');

    if (isStreamingCandidate) {
      DEBUG && console.log('[SW] Using streaming mode for:', path);
      return handleStreamingRequest(port, request.method, path, headers, body);
    }
    DEBUG && console.log('[SW] Using non-streaming mode for:', request.method, path);

    const response = await sendRequest(port, request.method, path, headers, body);

    DEBUG && console.log('[SW] Got response from main thread:', {
      statusCode: response.statusCode,
      headersKeys: response.headers ? Object.keys(response.headers) : [],
      bodyBase64Length: response.bodyBase64?.length,
    });

    let finalResponse;
    if (response.bodyBase64 && response.bodyBase64.length > 0) {
      try {
        const bytes = base64ToBytes(response.bodyBase64);
        DEBUG && console.log('[SW] Decoded body length:', bytes.length);

        const blob = new Blob([bytes], { type: response.headers['Content-Type'] || 'application/octet-stream' });
        DEBUG && console.log('[SW] Created blob size:', blob.size);

        const respHeaders = new Headers(response.headers);
        respHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
        respHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        respHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
        respHeaders.delete('X-Frame-Options');

        finalResponse = new Response(blob, {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: respHeaders,
        });
      } catch (decodeError) {
        console.error('[SW] Failed to decode base64 body:', decodeError);
        finalResponse = new Response(`Decode error: ${decodeError.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    } else {
      finalResponse = new Response(null, {
        status: response.statusCode,
        statusText: response.statusMessage,
        headers: response.headers,
      });
    }

    DEBUG && console.log('[SW] Final Response created, status:', finalResponse.status);

    return finalResponse;
  } catch (error) {
    console.error('[SW] Error handling virtual request:', error);
    return new Response(`Service Worker Error: ${error.message}`, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function handleStreamingRequest(port, method, path, headers, body) {
  const { stream, headersPromise, id } = await sendStreamingRequest(port, method, path, headers, body);

  const responseData = await headersPromise;

  DEBUG && console.log('[SW] Streaming response started:', responseData?.statusCode);

  const respHeaders = new Headers(responseData?.headers || {});
  respHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
  respHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  respHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
  respHeaders.delete('X-Frame-Options');

  return new Response(stream, {
    status: responseData?.statusCode || 200,
    statusText: responseData?.statusMessage || 'OK',
    headers: respHeaders,
  });
}

self.addEventListener('install', (event) => {
  DEBUG && console.log('[SW] Installing...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  DEBUG && console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});
