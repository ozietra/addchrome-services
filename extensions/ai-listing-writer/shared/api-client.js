/**
 * Shared API client for Chrome Extensions
 * Communicates with the backend API
 */
// Shared backend: auth, subscription status/usage, payment links — the same
// backend the other three extensions use, so accounts/admin visibility are unified.
const API_BASE = 'https://addchrome.com/api';
// Standalone AI Listing Writer backend: only the listing types/generate calls
// go here. It has no database of its own — it proxies subscription checks
// back to API_BASE above. Update this once the service is deployed on Render.
const LISTING_API_BASE = 'https://ai-listing-backend.onrender.com/api';

const apiClient = {
  token: null,

  async init() {
    try {
      const result = await chrome.storage.local.get('authToken');
      this.token = result.authToken || null;
    } catch (e) {
      this.token = null;
    }
  },

  async setToken(token) {
    this.token = token;
    await chrome.storage.local.set({ authToken: token });
  },

  async clearToken() {
    this.token = null;
    await chrome.storage.local.remove('authToken');
  },

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  },

  async request(method, endpoint, body = null, base = API_BASE) {
    const options = {
      method,
      headers: this.getHeaders()
    };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const _log = (typeof Logger !== 'undefined') ? Logger : null;
    const started = Date.now();
    if (_log) _log.info('api', `${method} ${endpoint}`);

    try {
      const response = await fetch(`${base}${endpoint}`, options);
      let data;
      try { data = await response.json(); } catch (e) { data = {}; }

      if (!response.ok) {
        throw { status: response.status, ...data };
      }

      if (_log) _log.info('api', `${method} ${endpoint} -> ${response.status} (${Date.now() - started}ms)`);
      return data;
    } catch (error) {
      if (error && error.status === 401) {
        await this.clearToken();
      }
      if (_log) {
        const detail = error && error.status
          ? ('HTTP ' + error.status + (error.message ? ' ' + error.message : ''))
          : (error && error.message ? error.message : 'network error');
        _log.error('api', `${method} ${endpoint} FAILED (${Date.now() - started}ms)`, detail);
      }
      throw error;
    }
  },

  // Auth
  async register(email, password, name, language) {
    const data = await this.request('POST', '/auth/register', { email, password, name, language });
    if (data.success && data.data.token) {
      await this.setToken(data.data.token);
    }
    return data;
  },

  async login(email, password) {
    const data = await this.request('POST', '/auth/login', { email, password });
    if (data.success && data.data.token) {
      await this.setToken(data.data.token);
    }
    return data;
  },

  async getProfile() {
    return this.request('GET', '/auth/me');
  },

  async updateProfile(updates) {
    return this.request('PUT', '/auth/profile', updates);
  },

  // Subscription
  async getSubscriptionStatus(extensionId) {
    return this.request('GET', `/subscription/status/${extensionId}`);
  },

  // Payment
  async getPaymentLink(extensionId, plan) {
    return this.request('GET', `/payment/link/${extensionId}?plan=${plan || 'monthly'}`);
  },

  // Listing (standalone ai-listing-backend, not the shared backend)
  async getListingTypes() {
    return this.request('GET', '/listing/types', null, LISTING_API_BASE);
  },

  async generateListing(payload) {
    return this.request('POST', '/listing/generate', payload, LISTING_API_BASE);
  },

  // Helpers
  isAuthenticated() {
    return !!this.token;
  }
};
