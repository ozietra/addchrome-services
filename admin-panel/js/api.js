/**
 * Admin Panel - API Client
 */
const AdminAPI = {
  // Use relative URL so the admin panel works wherever it's hosted.
  // When served from api.addchrome.com/admin, '/api' resolves to api.addchrome.com/api.
  BASE_URL: '/api',
  token: localStorage.getItem('admin_token') || '',

  setToken(token) {
    this.token = token;
    localStorage.setItem('admin_token', token);
  },
  clearToken() {
    this.token = '';
    localStorage.removeItem('admin_token');
  },
  isAuthenticated() {
    return !!this.token;
  },

  async request(endpoint, options = {}) {
    // Cache-busting param guarantees a unique URL per call, so the browser can
    // never serve a stale cached API response on a normal refresh.
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${this.BASE_URL}${endpoint}${sep}_=${Date.now()}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const method = (options.method || 'GET');
    const started = Date.now();
    console.log(`[AdminAPI] ${method} ${endpoint} ...`);

    let response, data;
    try {
      response = await fetch(url, {
        ...options,
        // Bypass the HTTP cache entirely: the admin panel must always show live
        // data. This is the fix for "users disappear on F5, come back on hard
        // refresh".
        cache: 'no-store',
        headers: { ...headers, ...options.headers }
      });
    } catch (netErr) {
      console.error(`[AdminAPI] ${method} ${endpoint} NETWORK ERROR (${Date.now() - started}ms)`, netErr);
      throw { status: 0, message: 'Sunucuya ula\u015f\u0131lam\u0131yor (backend \u00e7al\u0131\u015f\u0131yor mu?)' };
    }

    try { data = await response.json(); } catch (e) { data = {}; }

    if (!response.ok) {
      console.warn(`[AdminAPI] ${method} ${endpoint} -> ${response.status}`, data && data.message);
      if (response.status === 401) {
        this.clearToken();
        window.location.href = 'index.html';
      }
      throw { status: response.status, message: data.message || 'Hata olu\u015ftu' };
    }
    console.log(`[AdminAPI] ${method} ${endpoint} -> ${response.status} (${Date.now() - started}ms)`);
    return data;
  },

  // Auth
  login(email, password) {
    return this.request('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  // Dashboard
  getDashboard() { return this.request('/admin/dashboard'); },

  // Users
  getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/users?${q}`);
  },
  getUser(id) { return this.request(`/admin/users/${id}`); },
  updateUser(id, data) { return this.request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteUser(id) { return this.request(`/admin/users/${id}`, { method: 'DELETE' }); },

  // Payments
  getPayments(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/admin/payments?${q}`);
  },

  // Extensions
  getExtensions() { return this.request('/admin/extensions'); },
  updateExtension(id, data) { return this.request(`/admin/extensions/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },

  // Stats
  getStats(extensionId, days = 30) { return this.request(`/admin/stats/${extensionId}?days=${days}`); }
};
