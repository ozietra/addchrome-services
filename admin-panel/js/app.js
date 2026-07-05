/**
 * Admin Panel - Main Application Controller
 */
(function() {
  'use strict';

  // Auth check
  if (!AdminAPI.isAuthenticated()) {
    window.location.href = 'index.html';
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const extNames = {
    'ig-export': 'IG Takipçi Export',
    'ig-unfollow': 'IG Unfollow AI',
    'price-compare': 'Fiyat Karşılaştır',
    'ai-listing-writer': 'AI İlan Yazarı'
  };

  // Navigation
  let currentPage = 'dashboard';

  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  function navigateTo(page) {
    currentPage = page;
    $$('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    $(`.nav-item[data-page="${page}"]`).classList.add('active');
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page-${page}`).classList.add('active');

    const titles = { dashboard: 'Dashboard', users: 'Kullanıcılar', payments: 'Ödemeler', extensions: 'Eklenti Ayarları', stats: 'İstatistikler' };
    $('#pageTitle').textContent = titles[page] || 'Dashboard';

    loadPageData(page);
    // Close mobile sidebar
    $('#sidebar').classList.remove('open');
  }

  // Mobile menu
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // Logout
  $('#btnLogout').addEventListener('click', () => {
    AdminAPI.clearToken();
    window.location.href = 'index.html';
  });

  // Format helpers
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function formatMoney(amount) {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(amount || 0) + ' TL';
  }

  // Visible error banner so data-load failures are never silent.
  function showBanner(msg) {
    let el = document.getElementById('adminBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'adminBanner';
      el.style.cssText = 'position:sticky;top:0;z-index:60;background:#7f1d1d;color:#fff;padding:8px 14px;font-size:13px;';
      const main = document.querySelector('.main-content') || document.body;
      main.insertBefore(el, main.firstChild);
    }
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  // ===== PAGE DATA LOADERS =====

  async function loadPageData(page) {
    showBanner('');
    try {
      switch(page) {
        case 'dashboard': await loadDashboard(); break;
        case 'users': await loadUsers(); break;
        case 'payments': await loadPayments(); break;
        case 'extensions': await loadExtensions(); break;
        case 'stats': await loadStats(); break;
      }
    } catch(error) {
      console.error(`[Admin] ${page} load error:`, error);
    }
  }

  // ===== DASHBOARD =====
  async function loadDashboard() {
    try {
      const res = await AdminAPI.getDashboard();
      if (!res.success) return;
      const d = res.data;

      $('#dTotalUsers').textContent = d.stats.totalUsers.toLocaleString('tr-TR');
      $('#dPremiumUsers').textContent = d.stats.premiumUsers.toLocaleString('tr-TR');
      $('#dTotalRevenue').textContent = formatMoney(d.stats.totalRevenue);
      $('#dTotalPayments').textContent = d.stats.totalPayments.toLocaleString('tr-TR');

      // Recent Users
      const usersBody = $('#recentUsersTable tbody');
      usersBody.innerHTML = '';
      (d.recentRegistrations || []).forEach(u => {
        usersBody.innerHTML += `<tr><td>${u.email}</td><td>${formatDate(u.createdAt)}</td></tr>`;
      });
      if (!d.recentRegistrations?.length) usersBody.innerHTML = '<tr><td colspan="2" style="color:var(--text-3);text-align:center">Henüz kayıt yok</td></tr>';

      // Recent Payments
      const paysBody = $('#recentPaymentsTable tbody');
      paysBody.innerHTML = '';
      (d.recentPayments || []).forEach(p => {
        paysBody.innerHTML += `<tr><td>${p.userId?.email || '-'}</td><td>${extNames[p.extensionId] || p.extensionId}</td><td>${formatMoney(p.amount)}</td></tr>`;
      });
      if (!d.recentPayments?.length) paysBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-3);text-align:center">Henüz ödeme yok</td></tr>';

      // Extension Stats
      const extStatsEl = $('#extStats');
      extStatsEl.innerHTML = '';
      Object.entries(d.extensionStats || {}).forEach(([id, stat]) => {
        extStatsEl.innerHTML += `<div class="ext-stat-item"><div class="ext-name">${extNames[id] || id}</div><div class="ext-count">${stat.premium}</div></div>`;
      });
    } catch(e) {
      // Show placeholder data if API is not connected
      console.error('[Admin] dashboard load failed:', e && e.message, e);
      showBanner('Dashboard yüklenemedi: ' + ((e && (e.message || ('HTTP ' + e.status))) || 'bilinmeyen hata'));
      $('#dTotalUsers').textContent = '0';
      $('#dPremiumUsers').textContent = '0';
      $('#dTotalRevenue').textContent = '0,00 TL';
      $('#dTotalPayments').textContent = '0';
    }
  }

  // ===== USERS =====
  let usersPage = 1;

  async function loadUsers() {
    const params = { page: usersPage, limit: 15 };
    const search = $('#userSearch').value.trim();
    const ext = $('#filterExtension').value;
    const plan = $('#filterPlan').value;
    if (search) params.search = search;
    if (ext) params.extension = ext;
    if (plan) params.plan = plan;

    try {
      const res = await AdminAPI.getUsers(params);
      if (!res.success) return;

      const tbody = $('#usersTable tbody');
      tbody.innerHTML = '';

      res.data.users.forEach(u => {
        const subs = (u.subscriptions || []).map(s =>
          `<span class="badge badge-${s.plan}">${extNames[s.extensionId] || s.extensionId}: ${s.plan === 'premium' ? 'Premium' : 'Ücretsiz'}</span>`
        ).join(' ');

        tbody.innerHTML += `
          <tr>
            <td>${u.email}</td>
            <td>${u.name || '-'}</td>
            <td>${u.language || 'tr'}</td>
            <td>${formatDate(u.createdAt)}</td>
            <td>${subs || '<span class="badge badge-free">Ücretsiz</span>'}</td>
            <td><span class="badge ${u.isBlocked ? 'badge-blocked' : 'badge-active'}">${u.isBlocked ? 'Engellenmiş' : 'Aktif'}</span></td>
            <td>
              <button class="btn btn-sm" onclick="viewUser('${u._id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${u._id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </td>
          </tr>`;
      });

      if (!res.data.users.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-3);text-align:center;padding:24px">Kullanıcı bulunamadı</td></tr>';
      }

      renderPagination('usersPagination', res.data.pagination, (p) => { usersPage = p; loadUsers(); });
    } catch(e) {
      console.error('[Users]', e);
      showBanner('Kullanıcılar yüklenemedi: ' + ((e && (e.message || ('HTTP ' + e.status))) || 'bilinmeyen hata'));
    }
  }

  // Filters
  let userSearchTimeout;
  $('#userSearch').addEventListener('input', () => {
    clearTimeout(userSearchTimeout);
    userSearchTimeout = setTimeout(() => { usersPage = 1; loadUsers(); }, 300);
  });
  $('#filterExtension').addEventListener('change', () => { usersPage = 1; loadUsers(); });
  $('#filterPlan').addEventListener('change', () => { usersPage = 1; loadUsers(); });

  // User detail
  window.viewUser = async function(id) {
    try {
      const res = await AdminAPI.getUser(id);
      if (!res.success) return;
      const u = res.data.user;
      const payments = res.data.payments || [];

      const subs = (u.subscriptions || []).map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span>${extNames[s.extensionId] || s.extensionId}</span>
          <span class="badge badge-${s.plan}">${s.plan === 'premium' ? 'Premium' : 'Ücretsiz'}</span>
        </div>
      `).join('');

      const payRows = payments.map(p => `
        <tr><td>${extNames[p.extensionId] || p.extensionId}</td><td>${formatMoney(p.amount)}</td><td><span class="badge badge-${p.status}">${p.status}</span></td><td>${formatDate(p.completedAt || p.createdAt)}</td></tr>
      `).join('');

      $('#userModalBody').innerHTML = `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">E-POSTA</div>
          <div style="font-size:14px;font-weight:600">${u.email}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div><div style="font-size:11px;color:var(--text-3)">AD SOYAD</div><div>${u.name || '-'}</div></div>
          <div><div style="font-size:11px;color:var(--text-3)">DİL</div><div>${u.language || 'tr'}</div></div>
          <div><div style="font-size:11px;color:var(--text-3)">KAYIT TARİHİ</div><div>${formatDate(u.createdAt)}</div></div>
          <div><div style="font-size:11px;color:var(--text-3)">DURUM</div><div><span class="badge ${u.isBlocked ? 'badge-blocked' : 'badge-active'}">${u.isBlocked ? 'Engellenmiş' : 'Aktif'}</span></div></div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">ABONELİKLER</div>
          ${subs || '<span style="color:var(--text-3)">Abonelik yok</span>'}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button class="btn btn-primary" onclick="toggleBlockUser('${u._id}', ${!u.isBlocked})">${u.isBlocked ? 'Engeli Kaldır' : 'Engelle'}</button>
          <button class="btn" onclick="grantPremium('${u._id}')">Premium Ver</button>
        </div>
        ${payments.length ? `
          <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">ÖDEME GEÇMİŞİ</div>
          <table class="table"><thead><tr><th>Eklenti</th><th>Tutar</th><th>Durum</th><th>Tarih</th></tr></thead><tbody>${payRows}</tbody></table>
        ` : ''}
      `;
      $('#userModal').classList.remove('hidden');
    } catch(e) { console.error('[UserDetail]', e); }
  };

  window.toggleBlockUser = async function(id, block) {
    try {
      await AdminAPI.updateUser(id, { isBlocked: block });
      $('#userModal').classList.add('hidden');
      loadUsers();
    } catch(e) { console.error(e); }
  };

  window.grantPremium = async function(id) {
    const ext = prompt('Hangi eklenti için premium verilsin?\n\nig-export\nig-unfollow\nprice-compare');
    if (!ext) return;
    try {
      const userRes = await AdminAPI.getUser(id);
      const subs = userRes.data.user.subscriptions || [];
      const existingIdx = subs.findIndex(s => s.extensionId === ext);
      if (existingIdx >= 0) {
        subs[existingIdx].plan = 'premium';
        subs[existingIdx].isActive = true;
        const future = new Date(); future.setFullYear(future.getFullYear() + 1);
        subs[existingIdx].startDate = new Date();
        subs[existingIdx].endDate = future;
      } else {
        const future = new Date(); future.setFullYear(future.getFullYear() + 1);
        subs.push({ extensionId: ext, plan: 'premium', isActive: true, startDate: new Date(), endDate: future });
      }
      await AdminAPI.updateUser(id, { subscriptions: subs });
      alert('Premium üyelik verildi!');
      viewUser(id);
    } catch(e) { console.error(e); }
  };

  window.deleteUser = async function(id) {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    try {
      await AdminAPI.deleteUser(id);
      loadUsers();
    } catch(e) { console.error(e); }
  };

  // Modal close
  $('#userModal').addEventListener('click', (e) => {
    if (e.target === $('#userModal')) $('#userModal').classList.add('hidden');
  });

  // ===== PAYMENTS =====
  let paymentsPage = 1;

  async function loadPayments() {
    const params = { page: paymentsPage, limit: 15 };
    const status = $('#paymentStatus').value;
    const ext = $('#paymentExtension').value;
    if (status) params.status = status;
    if (ext) params.extension = ext;

    try {
      const res = await AdminAPI.getPayments(params);
      if (!res.success) return;

      // Revenue cards
      const revEl = $('#revenueCards');
      revEl.innerHTML = '';
      (res.data.revenueByExtension || []).forEach(r => {
        revEl.innerHTML += `<div class="revenue-card"><div class="rev-label">${extNames[r._id] || r._id}</div><div class="rev-amount">${formatMoney(r.total)}</div><div class="rev-count">${r.count} ödeme</div></div>`;
      });

      // Table
      const tbody = $('#paymentsTable tbody');
      tbody.innerHTML = '';
      res.data.payments.forEach(p => {
        tbody.innerHTML += `<tr>
          <td>${p.userId?.email || '-'}</td>
          <td>${extNames[p.extensionId] || p.extensionId}</td>
          <td style="font-weight:600">${formatMoney(p.amount)}</td>
          <td><span class="badge badge-${p.status}">${p.status === 'completed' ? 'Tamamlandı' : p.status === 'pending' ? 'Beklemede' : 'Başarısız'}</span></td>
          <td>${formatDate(p.completedAt || p.createdAt)}</td>
        </tr>`;
      });
      if (!res.data.payments.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-3);text-align:center;padding:24px">Ödeme bulunamadı</td></tr>';
      }

      renderPagination('paymentsPagination', res.data.pagination, (p) => { paymentsPage = p; loadPayments(); });
    } catch(e) { console.error('[Payments]', e); }
  }

  $('#paymentStatus').addEventListener('change', () => { paymentsPage = 1; loadPayments(); });
  $('#paymentExtension').addEventListener('change', () => { paymentsPage = 1; loadPayments(); });

  // ===== EXTENSIONS =====
  async function loadExtensions() {
    try {
      const res = await AdminAPI.getExtensions();
      if (!res.success) return;

      const container = $('#extensionCards');
      container.innerHTML = '';

      res.data.extensions.forEach(ext => {
        const card = document.createElement('div');
        card.className = 'ext-card';
        card.innerHTML = `
          <div class="ext-card-header">
            <h3>${ext.name?.tr || ext.extensionId}</h3>
            <span class="badge badge-active">${ext.isActive !== false ? 'Aktif' : 'Devre Dışı'}</span>
          </div>
          <div class="ext-card-grid">
            <div class="ext-field">
              <label>İsim (TR)</label>
              <input type="text" id="ext-name-tr-${ext.extensionId}" value="${ext.name?.tr || ''}">
            </div>
            <div class="ext-field">
              <label>İsim (EN)</label>
              <input type="text" id="ext-name-en-${ext.extensionId}" value="${ext.name?.en || ''}">
            </div>
            <div class="ext-field">
              <label>Aylık Fiyat (TL)</label>
              <input type="number" id="ext-monthly-${ext.extensionId}" value="${ext.premiumPriceMonthly || 0}" step="0.01">
            </div>
            <div class="ext-field">
              <label>Yıllık Fiyat (TL)</label>
              <input type="number" id="ext-yearly-${ext.extensionId}" value="${ext.premiumPriceYearly || 0}" step="0.01">
            </div>
            <div class="ext-field">
              <label>PayTR Ödeme Linki</label>
              <input type="text" id="ext-vpos-${ext.extensionId}" value="${ext.vposLink || ''}" placeholder="https://...">
            </div>
            <div class="ext-field" style="display:flex;align-items:flex-end">
              <button class="btn btn-primary" style="width:100%" onclick="saveExtension('${ext.extensionId}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Kaydet
              </button>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    } catch(e) { console.error('[Extensions]', e); }
  }

  window.saveExtension = async function(extId) {
    const data = {
      name: {
        tr: $(`#ext-name-tr-${extId}`).value,
        en: $(`#ext-name-en-${extId}`).value
      },
      premiumPriceMonthly: parseFloat($(`#ext-monthly-${extId}`).value) || 0,
      premiumPriceYearly: parseFloat($(`#ext-yearly-${extId}`).value) || 0,
      vposLink: $(`#ext-vpos-${extId}`).value
    };

    try {
      await AdminAPI.updateExtension(extId, data);
      alert('Eklenti ayarları kaydedildi!');
    } catch(e) {
      alert('Hata: ' + (e.message || 'Kayıt başarısız'));
    }
  };

  // ===== STATS =====
  async function loadStats() {
    const extId = $('#statsExtension').value;
    const days = parseInt($('#statsDays').value);

    try {
      const res = await AdminAPI.getStats(extId, days);
      if (!res.success) return;

      renderBarChart('registrationsChart', res.data.dailyRegistrations, 'count', 'blue');
      renderBarChart('revenueChart', res.data.dailyRevenue, 'revenue', 'green');
    } catch(e) {
      // Show empty chart placeholders
      renderEmptyChart('registrationsChart');
      renderEmptyChart('revenueChart');
    }
  }

  $('#statsExtension').addEventListener('change', loadStats);
  $('#statsDays').addEventListener('change', loadStats);

  function renderBarChart(containerId, data, valueKey, colorClass) {
    const container = $(`#${containerId}`);
    container.innerHTML = '';

    if (!data || data.length === 0) {
      renderEmptyChart(containerId);
      return;
    }

    const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);

    data.forEach(item => {
      const val = item[valueKey] || 0;
      const height = Math.max(4, (val / maxVal) * 160);
      const label = item._id ? item._id.slice(5) : '';

      const wrap = document.createElement('div');
      wrap.className = 'chart-bar-wrap';
      wrap.innerHTML = `
        <div class="chart-value">${valueKey === 'revenue' ? formatMoney(val) : val}</div>
        <div class="chart-bar ${colorClass}" style="height:${height}px" title="${item._id}: ${val}"></div>
        <div class="chart-label">${label}</div>
      `;
      container.appendChild(wrap);
    });
  }

  function renderEmptyChart(containerId) {
    const container = $(`#${containerId}`);
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;min-height:180px;color:var(--text-3)">Henüz veri yok</div>';
  }

  // ===== PAGINATION =====
  function renderPagination(containerId, pagination, onPageChange) {
    const container = $(`#${containerId}`);
    container.innerHTML = '';
    if (!pagination || pagination.pages <= 1) return;

    for (let i = 1; i <= pagination.pages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      if (i === pagination.page) btn.classList.add('active');
      btn.addEventListener('click', () => onPageChange(i));
      container.appendChild(btn);
    }
  }

  // ===== INIT =====
  navigateTo('dashboard');

})();
