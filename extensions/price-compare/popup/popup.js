/**
 * Price Compare - Smart Shopping Assistant - Popup Controller
 */
(async function() {
  'use strict';

  const L = (typeof Logger !== 'undefined') ? Logger
    : { info(){}, warn(){}, error(){}, flush(){}, getAll: async () => [], formatText: () => '', clearAll: async () => {} };
  L.info('init', 'price-compare popup opened');

  let isAuthMode = 'login';
  let currentResults = [];
  let isPremium = false;
  let supportedSites = [];
  let selectedSites = [];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const siteColors = {
    trendyol: '#f27a1a', hepsiburada: '#ff6000', amazon: '#ff9900',
    n11: '#7b2d8e', gittigidiyor: '#4b0082', ciceksepeti: '#66cc00', akakce: '#e53935'
  };

  await apiClient.init();
  await i18n.init();

  if (apiClient.isAuthenticated()) {
    try {
      const res = await apiClient.getProfile();
      if (res.success) showMainScreen();
      else showAuthScreen();
    } catch(e) { showAuthScreen(); }
  } else { showAuthScreen(); }

  function showAuthScreen() {
    $('#authScreen').classList.add('active');
    $('#mainScreen').classList.remove('active');
  }

  function showMainScreen() {
    $('#authScreen').classList.remove('active');
    $('#mainScreen').classList.add('active');
    checkSubscription();
    loadSites();
  }

  async function checkSubscription() {
    try {
      const res = await apiClient.getSubscriptionStatus('price-compare');
      if (res.success) isPremium = res.data.isPremium;
    } catch(e) {}
  }

  // Sites shown if the backend list can't be fetched
  const FALLBACK_SITES = [
    { id: 'trendyol', name: 'Trendyol' },
    { id: 'hepsiburada', name: 'Hepsiburada' },
    { id: 'amazon', name: 'Amazon TR' },
    { id: 'n11', name: 'n11' },
    { id: 'ciceksepeti', name: '\u00C7i\u00E7eksepeti' },
    { id: 'akakce', name: 'Akak\u00E7e' }
  ];

  async function loadSites() {
    try {
      const res = await apiClient.getPriceSites();
      supportedSites = (res.success && res.data.sites && res.data.sites.length)
        ? res.data.sites
        : FALLBACK_SITES;
    } catch (e) {
      supportedSites = FALLBACK_SITES;
    }
    // Store selection removed: results come from a single aggregated source and
    // are presented under their real store names, so there is nothing to pick.
    selectedSites = [];
    renderSitePicker();
  }

  function renderSitePicker() {
    const wrap = $('#sitePicker');
    if (wrap) { wrap.innerHTML = ''; wrap.style.display = 'none'; }
  }

  function _unusedRenderSitePicker() {
    const wrap = $('#sitePicker');
    if (!wrap) return;
    wrap.innerHTML = '';
    supportedSites.forEach(site => {
      const checked = selectedSites.includes(site.id);
      const color = siteColors[site.id] || '#888';
      const label = document.createElement('label');
      label.className = 'site-chip';
      label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:14px;font-size:12px;cursor:pointer;border:1px solid ' +
        (checked ? color : 'var(--border, #333)') + ';background:' + (checked ? color + '1a' : 'transparent') +
        ';color:' + (checked ? color : 'var(--text-3, #888)') + ';';
      label.innerHTML = '<input type="checkbox" value="' + site.id + '"' + (checked ? ' checked' : '') + ' style="margin:0;"> ' + site.name;
      const cb = label.querySelector('input');
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!selectedSites.includes(site.id)) selectedSites.push(site.id);
        } else {
          selectedSites = selectedSites.filter(s => s !== site.id);
        }
        renderSitePicker();
      });
      wrap.appendChild(label);
    });
  }

  // Auth
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#inputEmail').value.trim();
    const password = $('#inputPassword').value;
    const name = $('#inputName').value.trim();
    const errorEl = $('#authError');
    const btn = $('#btnAuth');
    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = i18n.t('loading');
    try {
      let res;
      if (isAuthMode === 'register') res = await apiClient.register(email, password, name, i18n.getLang());
      else res = await apiClient.login(email, password);
      if (res.success) showMainScreen();
    } catch(err) {
      errorEl.textContent = err.message || i18n.t('error');
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = isAuthMode === 'login' ? i18n.t('login') : i18n.t('register');
    }
  });

  $('#switchAuth').addEventListener('click', (e) => {
    e.preventDefault();
    isAuthMode = isAuthMode === 'login' ? 'register' : 'login';
    const isLogin = isAuthMode === 'login';
    $('#authTitle').textContent = i18n.t(isLogin ? 'loginTitle' : 'registerTitle');
    $('#btnAuth span').textContent = i18n.t(isLogin ? 'login' : 'register');
    $('#switchText').textContent = i18n.t(isLogin ? 'noAccount' : 'hasAccount');
    $('#switchAuth').textContent = i18n.t(isLogin ? 'register' : 'login');
    $('#nameField').classList.toggle('hidden', isLogin);
  });

  // Search
  $('#btnSearch').addEventListener('click', performSearch);
  $('#searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  async function performSearch() {
    const query = $('#searchInput').value.trim();
    if (!query) return;
    L.info('search', `search "${query}" sites=[${selectedSites.join(',')}]`);

    $('#loadingSection').classList.remove('hidden');
    $('#resultsSection').classList.add('hidden');
    $('#emptyState').classList.add('hidden');
    $('#btnSearch').disabled = true;
    $('#btnSearch').textContent = i18n.t('searching');

    try {
      const res = await apiClient.searchPrices(query, selectedSites);

      if (res.success && res.data.results.length > 0) {
        L.info('search', `"${query}" -> ${res.data.totalResults} sonuç (${res.data.duration}ms) sites=[${(res.data.sites || []).join(',')}]`);
        currentResults = res.data.results;
        renderResults();
        const duration = (res.data.duration / 1000).toFixed(1);
        $('#resultsInfo').textContent = `${res.data.totalResults} ${i18n.t('results')} — ${duration}s`;
        $('#resultsSection').classList.remove('hidden');

        // Save state
        chrome.storage.local.set({
          lastSearchQuery: query,
          lastSearchResults: currentResults,
          lastSearchDuration: duration,
          lastSearchTotal: res.data.totalResults
        });
      } else {
        $('#emptyState').classList.remove('hidden');
        chrome.storage.local.remove(['lastSearchQuery', 'lastSearchResults', 'lastSearchDuration', 'lastSearchTotal']);
      }
    } catch(err) {
      if (err.status === 429) {
        L.warn('search', 'daily search limit reached (429)');
        $('#premiumPrompt').classList.remove('hidden');
      } else {
        console.error('[Search]', err);
        L.warn('search', 'search failed, showing demo data', err && err.message);
        // Demo data for testing
        generateDemoData(query);
        renderResults();
        $('#resultsSection').classList.remove('hidden');
      }
    } finally {
      $('#loadingSection').classList.add('hidden');
      $('#btnSearch').disabled = false;
      $('#btnSearch').textContent = i18n.t('search');
    }
  }

  // Restore state on load
  chrome.storage.local.get(['lastSearchQuery', 'lastSearchResults', 'lastSearchDuration', 'lastSearchTotal'], (data) => {
    if (data.lastSearchResults && data.lastSearchResults.length > 0) {
      $('#searchInput').value = data.lastSearchQuery || '';
      currentResults = data.lastSearchResults;
      renderResults();
      $('#resultsInfo').textContent = `${data.lastSearchTotal} ${i18n.t('results')} — ${data.lastSearchDuration}s`;
      $('#resultsSection').classList.remove('hidden');
    }
  });

  // Clear state
  $('#btnClearSearch').addEventListener('click', () => {
    chrome.storage.local.remove(['lastSearchQuery', 'lastSearchResults', 'lastSearchDuration', 'lastSearchTotal']);
    currentResults = [];
    $('#searchInput').value = '';
    $('#resultsSection').classList.add('hidden');
    $('#resultsList').innerHTML = '';
  });

  function generateDemoData(query) {
    const sites = ['store'];
    currentResults = [];
    sites.forEach(site => {
      for (let i = 1; i <= 4; i++) {
        currentResults.push({
          site,
          productName: `${query} - Örnek Sonuç #${i}`,
          price: Math.round(5000 + Math.random() * 20000),
          currency: 'TRY',
          imageUrl: '',
          productUrl: `#`,
          seller: 'Mağaza (Örnek)',
          rating: (3 + Math.random() * 2).toFixed(1)
        });
      }
    });
    currentResults.sort((a, b) => a.price - b.price);
    $('#resultsInfo').textContent = `${currentResults.length} ${i18n.t('results')}`;
  }

  function renderResults() {
    const list = $('#resultsList');
    list.innerHTML = '';

    const minPrice = Math.min(...currentResults.map(r => r.price));

    currentResults.forEach((product, index) => {
      const isBest = product.price === minPrice;
      const card = document.createElement('div');
      card.className = `product-card${isBest ? ' best-price' : ''}`;

      const formattedPrice = new Intl.NumberFormat('tr-TR').format(product.price);
      const siteColor = siteColors[product.site] || '#888';

      card.innerHTML = `
        <img class="product-img" src="${product.imageUrl || ''}" alt="">
        <div class="product-info">
          <div class="product-name">${product.productName}</div>
          <div class="product-meta">
            <span class="product-site" style="background: ${siteColor}15; color: ${siteColor}">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>
              ${product.seller || product.site}
            </span>
            ${isBest ? `<span class="best-badge">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6L9 17l-5-5"/></svg>
              ${i18n.t('bestPrice')}
            </span>` : ''}
          </div>
        </div>
        <div class="product-price-wrap">
          <div class="product-price">${formattedPrice} <span class="product-currency">${product.currency || 'TL'}</span></div>
          <a href="${product.productUrl}" target="_blank" class="btn-go" title="${i18n.t('goToSite')}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            ${i18n.t('goToSite')}
          </a>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // Sort
  $('#sortSelect').addEventListener('change', (e) => {
    const dir = e.target.value;
    if (dir === 'high') currentResults.sort((a, b) => b.price - a.price);
    else currentResults.sort((a, b) => a.price - b.price);
    renderResults();
  });

  // Premium
  $('#premiumPrompt').addEventListener('click', (e) => {
    if (e.target === $('#premiumPrompt')) $('#premiumPrompt').classList.add('hidden');
  });
  $('#btnUpgrade').addEventListener('click', async () => {
    try {
      const res = await apiClient.getPaymentLink('price-compare', 'monthly');
      if (res.success && res.data.vposLink) chrome.tabs.create({ url: res.data.vposLink });
    } catch(e) {}
  });

  // Settings
  $('#btnSettings').addEventListener('click', () => { $('#settingsModal').classList.remove('hidden'); $('#langSelect').value = i18n.getLang(); });
  $('#closeSettings').addEventListener('click', () => { $('#settingsModal').classList.add('hidden'); });
  $('#settingsModal').addEventListener('click', (e) => { if (e.target === $('#settingsModal')) $('#settingsModal').classList.add('hidden'); });
  $('#langSelect').addEventListener('change', async (e) => { await i18n.setLanguage(e.target.value); });
  $('#btnLang').addEventListener('click', async () => { const newLang = i18n.getLang() === 'tr' ? 'en' : 'tr'; await i18n.setLanguage(newLang); });
  $('#btnLogout').addEventListener('click', async () => { await apiClient.clearToken(); $('#settingsModal').classList.add('hidden'); showAuthScreen(); });

})();
