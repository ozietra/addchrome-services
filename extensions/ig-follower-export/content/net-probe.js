/**
 * net-probe.js  (runs in the page's MAIN world, at document_start)
 *
 * Instagram's own web app always uses the CURRENT API endpoints. This script
 * wraps window.fetch and XMLHttpRequest so that whenever the Instagram page
 * itself calls an interesting /api/v1/... endpoint, we forward the URL (NOT the
 * response body, NOT any token) to our isolated content script via postMessage.
 *
 * The content script then logs it. So if Instagram changes an endpoint, you can
 * see the new one in the downloaded logs and compare it to what this extension
 * calls. This is observation only - it does not modify any request.
 */
(function () {
  const INTERESTING =
    /\/api\/v1\/(friendships|users\/web_profile_info|media\/[^/]+\/(likers|comments))|\/graphql\/query/;

  function report(method, url, status) {
    try {
      if (!url || !INTERESTING.test(url)) return;
      window.postMessage(
        {
          __igProbe: true,
          method: method || 'GET',
          path: url.split('?')[0],
          full: url,
          status: status
        },
        '*'
      );
    } catch (e) {}
  }

  // Patch fetch
  try {
    const origFetch = window.fetch;
    if (origFetch && !origFetch.__igPatched) {
      const patched = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = (init && init.method) || (input && input.method) || 'GET';
        const p = origFetch.apply(this, arguments);
        p.then((r) => report(method, url, r.status)).catch(() => report(method, url, 'error'));
        return p;
      };
      patched.__igPatched = true;
      window.fetch = patched;
    }
  } catch (e) {}

  // Patch XMLHttpRequest
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    if (origOpen && !origOpen.__igPatched) {
      const patchedOpen = function (method, url) {
        this.__igMethod = method;
        this.__igUrl = url;
        this.addEventListener('loadend', function () {
          report(this.__igMethod, this.__igUrl, this.status);
        });
        return origOpen.apply(this, arguments);
      };
      patchedOpen.__igPatched = true;
      XMLHttpRequest.prototype.open = patchedOpen;
    }
  } catch (e) {}
})();
