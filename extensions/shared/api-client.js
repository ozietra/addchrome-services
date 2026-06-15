/**
 * Shared API client for Chrome Extensions
 * Communicates with the backend API
 */
const API_BASE = 'https://addchrome.com/api';

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

  async request(method, endpoint, body = null) {
    const options = {
      method,
      headers: this.getHeaders()
    };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, ...data };
      }

      return data;
    } catch (error) {
      if (error.status === 401) {
        await this.clearToken();
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

  async trackUsage(extensionId) {
    return this.request('POST', `/subscription/use/${extensionId}`);
  },

  // Payment
  async getPaymentLink(extensionId, plan) {
    return this.request('GET', `/payment/link/${extensionId}?plan=${plan || 'monthly'}`);
  },

  // Price
  async searchPrices(query, sites) {
    return this.request('POST', '/price/search', { query, sites });
  },

  async getPriceSites() {
    return this.request('GET', '/price/sites');
  },

  async getPriceHistory(page) {
    return this.request('GET', `/price/history?page=${page || 1}`);
  },

  // Helpers
  isAuthenticated() {
    return !!this.token;
  }
};
