/**
 * ConfigProvider — fetches the Groq key pool + model the admin configured in
 * the shared backend's admin panel (GET /listing-config, protected by a
 * shared secret), caching the result for a few minutes so we don't hit the
 * shared backend on every single generation request.
 *
 * Falls back to the local GROQ_API_KEYS/GROQ_MODEL env vars if the remote
 * fetch fails or the admin hasn't saved any keys in the panel yet — this
 * service still works standalone even without the panel integration.
 */
const fetch = require('node-fetch');
const config = require('../config');

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null; // { apiKeys, model }
let cacheExpiresAt = 0;

class ConfigProvider {
  async getGroqConfig() {
    const now = Date.now();
    if (cache && now < cacheExpiresAt) {
      return cache;
    }

    const fallback = { apiKeys: config.groq.apiKeys, model: config.groq.model };

    if (!config.listingConfigSecret) {
      cache = fallback;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return cache;
    }

    try {
      const response = await fetch(`${config.mainBackendUrl}/listing-config`, {
        headers: { 'X-Service-Key': config.listingConfigSecret },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`listing-config returned ${response.status}`);
      }

      const data = await response.json();
      const remoteKeys = (data && data.data && data.data.groqApiKeys) || [];
      const remoteModel = data && data.data && data.data.groqModel;

      cache = {
        apiKeys: remoteKeys.length ? remoteKeys : fallback.apiKeys,
        model: remoteModel || fallback.model
      };
      cacheExpiresAt = now + CACHE_TTL_MS;
      return cache;
    } catch (error) {
      console.warn('[ConfigProvider] Could not fetch /listing-config, using env fallback:', error.message);
      // Cache the fallback too, but only briefly, so a transient outage
      // doesn't lock us out of the admin-managed keys for the full TTL.
      cache = fallback;
      cacheExpiresAt = now + 30000;
      return cache;
    }
  }
}

module.exports = new ConfigProvider();
