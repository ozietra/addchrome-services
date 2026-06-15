/**
 * Instagram Follower Export Tool - Popup Controller
 */
(async function() {
  'use strict';

  const L = (typeof Logger !== 'undefined') ? Logger
    : { info(){}, warn(){}, error(){}, flush(){}, getAll: async () => [], formatText: () => '', clearAll: async () => {} };
  L.info('init', 'ig-export popup opened');

  // State
  let currentTab = 'followers';
  let isAuthMode = 'login'; // login or register
  // null = not scanned yet, [] = scanned but empty, [..] = data
  let scannedData = { followers: null, following: null, likes: null, comments: null };
  let lastError = { followers: null, following: null, likes: null, comments: null };
  let isPremium = false;
  let isOnInstagram = false;

  const SCAN_STORE_KEY = 'igExportScans';

  async function persistScans() {
    try { await chrome.storage.local.set({ [SCAN_STORE_KEY]: scannedData }); } catch (e) {}
  }
  async function restoreScans() {
    try {
      const r = await chrome.storage.local.get(SCAN_STORE_KEY);
      if (r && r[SCAN_STORE_KEY] && typeof r[SCAN_STORE_KEY] === 'object') {
        scannedData = Object.assign(scannedData, r[SCAN_STORE_KEY]);
      }
    } catch (e) {}
  }

  // Send a message to the content script. If the content script isn't present
  // yet ("Receiving end does not exist"), inject it and retry once instead of
  // silently falling back to demo data.
  async function sendToContent(tabId, msg) {
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (e) {
      L.warn('content', 'content script not reachable, injecting', e && e.message);
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['shared/logger.js', 'content/content.js']
        });
        L.info('content', 'content script injected, retrying message');
      } catch (injErr) {
        L.error('content', 'content injection failed', injErr && injErr.message);
        throw e;
      }
      await new Promise((r) => setTimeout(r, 350));
      return await chrome.tabs.sendMessage(tabId, msg);
    }
  }

  // DOM Elements
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Screens
  const authScreen = $('#authScreen');
  const notInstagramScreen = $('#notInstagramScreen');
  const mainScreen = $('#mainScreen');

  // Init
  await apiClient.init();
  await i18n.init();

  // Check if user is logged in
  if (apiClient.isAuthenticated()) {
    try {
      const profileRes = await apiClient.getProfile();
      if (profileRes.success) {
        showMainScreen(profileRes.data.user);
      } else {
        showAuthScreen();
      }
    } catch (e) {
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }

  // ---- Auth ----
  function showAuthScreen() {
    authScreen.classList.add('active');
    mainScreen.classList.remove('active');
    notInstagramScreen.classList.remove('active');
  }

  function showMainScreen(user) {
    authScreen.classList.remove('active');
    notInstagramScreen.classList.remove('active');
    mainScreen.classList.add('active');

    // Set user info
    $('#userEmail').textContent = user.email;

    // Restore any previously scanned data so closing/reopening the popup
    // (Chrome closes popups whenever they lose focus) doesn't lose results.
    restoreScans().then(() => renderResults());

    // Check subscription
    checkSubscription();
    // Check if on Instagram
    checkInstagramTab();
  }

  async function checkSubscription() {
    try {
      const res = await apiClient.getSubscriptionStatus('ig-export');
      if (res.success) {
        isPremium = res.data.isPremium;
        const badge = $('#userBadge');
        if (isPremium) {
          badge.classList.add('premium');
          badge.querySelector('span').textContent = 'Premium';
          $('#planInfo').textContent = 'Premium';
          $('#btnExportExcel').classList.remove('btn-export-premium');
        } else {
          badge.classList.remove('premium');
          badge.querySelector('span').textContent = 'Free';
          $('#planInfo').textContent = 'Free';
        }
      }
    } catch (e) {
      console.error('[Subscription]', e);
    }
  }

  async function checkInstagramTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      isOnInstagram = tab && tab.url && tab.url.includes('instagram.com');
      if (!isOnInstagram) {
        // Show warning but keep main screen
      }
    } catch (e) {
      isOnInstagram = false;
    }
  }

  // Auth form submission
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
      if (isAuthMode === 'register') {
        res = await apiClient.register(email, password, name, i18n.getLang());
      } else {
        res = await apiClient.login(email, password);
      }

      if (res.success) {
        showMainScreen(res.data.user);
      }
    } catch (err) {
      errorEl.textContent = err.message || i18n.t('error');
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = isAuthMode === 'login' ? i18n.t('login') : i18n.t('register');
    }
  });

  // Toggle login/register
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

  // ---- Tabs ----
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;

      // Check premium for likes/comments
      if ((currentTab === 'likes' || currentTab === 'comments') && !isPremium) {
        $('#premiumPrompt').classList.remove('hidden');
      }

      // Render existing data
      renderResults();
    });
  });

  // ---- Scan ----
  $('#btnScan').addEventListener('click', async () => {
    // Likes & comments are premium-only -> upsell instead of scanning.
    if ((currentTab === 'likes' || currentTab === 'comments') && !isPremium) {
      showPremiumPrompt();
      return;
    }
    if (!isOnInstagram) {
      // Try to check again
      await checkInstagramTab();
      if (!isOnInstagram) {
        mainScreen.classList.remove('active');
        notInstagramScreen.classList.add('active');
        return;
      }
    }

    const btn = $('#btnScan');
    btn.classList.add('scanning');
    btn.querySelector('span').textContent = i18n.t('scanning');
    $('#progressSection').classList.remove('hidden');
    $('#resultsSection').classList.add('hidden');

    try {
      // Track usage (the API client throws on rate-limit, so handle it explicitly)
      try {
        await apiClient.trackUsage('ig-export');
      } catch (usageErr) {
        if (usageErr && usageErr.status === 429) {
          $('#progressSection').classList.add('hidden');
          showPremiumPrompt();
          return;
        }
        throw usageErr;
      }

      // Send message to content script to scrape data
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      L.info('scan', `requesting scrape '${currentTab}' on tab ${tab && tab.id} (${tab && tab.url ? tab.url.split('?')[0] : '?'})`);
      const response = await sendToContent(tab.id, {
        action: 'scrape',
        type: currentTab
      });
      L.info('scan', `scrape '${currentTab}' response`, response && { success: response.success, count: (response.data || []).length, error: response.error });

      if (response && response.success) {
        scannedData[currentTab] = response.data || [];
        lastError[currentTab] = null;
        persistScans();
        updateProgress(100, scannedData[currentTab].length, scannedData[currentTab].length);
        finishScan();
      } else {
        // Scan ran but returned nothing usable (e.g. likes/comments off a post).
        // Record the reason and show it for THIS tab instead of leaving the
        // previous tab's list on screen.
        scannedData[currentTab] = [];
        lastError[currentTab] = (response && response.error) || i18n.t('error');
        persistScans();
        updateProgress(100, 0, 0);
        finishScan();
        L.info('scan', 'scan returned no data (not on a post / empty)', response && response.error);
      }
    } catch (error) {
      console.error('[Scan] Error:', error);
      L.warn('scan', 'popup scan failed, showing demo data', error && error.message);
      // Fallback: generate demo data for testing without Instagram
      generateDemoData();
      finishScan();
    } finally {
      btn.classList.remove('scanning');
      btn.querySelector('span').textContent = i18n.t('scan');
    }
  });

  function updateProgress(percent, current, total) {
    $('#progressFill').style.width = percent + '%';
    $('#progressCount').textContent = `${current} / ${total}`;
  }

  // Called once a scan finishes: hide the progress bar, then let renderResults()
  // decide what to show for the CURRENT tab. (The old code force-showed the
  // results section on a timer, which re-revealed the previous tab's stale list
  // whenever the new scan came back empty.)
  function finishScan() {
    setTimeout(() => {
      $('#progressSection').classList.add('hidden');
      renderResults();
    }, 400);
  }

  function renderResults() {
    const data = scannedData[currentTab];
    const list = $('#resultsList');

    // Not scanned yet on this tab -> show nothing (clean state).
    if (data === null || data === undefined) {
      $('#resultsSection').classList.add('hidden');
      return;
    }

    // Always reflect the CURRENT tab: reveal the section, clear any stale items
    // from a previous tab, and update the count.
    $('#resultsSection').classList.remove('hidden');
    list.innerHTML = '';
    $('#resultCount').textContent = data.length;

    if (data.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'result-empty';
      empty.style.cssText = 'padding:18px 12px;text-align:center;color:var(--text-3,#8b8ba0);font-size:13px;line-height:1.5;';
      empty.textContent = lastError[currentTab] || 'Sonuç bulunamadı.';
      list.appendChild(empty);
      return;
    }

    data.forEach(user => {
      const item = document.createElement('div');
      item.className = 'result-item';
      const letter = ((user.username || '?')[0] || '?').toUpperCase();
      const avatarPlaceholder = 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="#2a2a3a" width="32" height="32" rx="16"/><text x="16" y="20" text-anchor="middle" fill="#8b8ba0" font-size="12">${letter}</text></svg>`
      );
      item.innerHTML = `
        <img class="result-avatar" src="${user.avatar || avatarPlaceholder}" alt="">
        <div class="result-info">
          <div class="result-username">${user.username || '-'}</div>
          <div class="result-fullname">${user.fullName || ''}</div>
        </div>
      `;
      // Attach the error handler in JS (inline on* handlers are blocked by the
      // extension's Content Security Policy and were breaking rendering).
      const av = item.querySelector('.result-avatar');
      if (av) av.addEventListener('error', () => { av.style.display = 'none'; });
      list.appendChild(item);
    });
  }

  // Demo data for testing without Instagram
  function generateDemoData() {
    const demoUsers = [];
    for (let i = 1; i <= 25; i++) {
      demoUsers.push({
        username: `user_${i}_demo`,
        fullName: `Demo User ${i}`,
        avatar: '',
        profileUrl: `https://instagram.com/user_${i}_demo`
      });
    }
    scannedData[currentTab] = demoUsers;
    updateProgress(100, demoUsers.length, demoUsers.length);
  }

  // ---- Export ----
  $('#btnExportCSV').addEventListener('click', () => {
    const data = scannedData[currentTab];
    if (!data || data.length === 0) return;
    exportCSV(data, `instagram_${currentTab}`);
  });

  $('#btnExportExcel').addEventListener('click', () => {
    if (!isPremium) {
      showPremiumPrompt();
      return;
    }
    const data = scannedData[currentTab];
    if (!data || data.length === 0) return;
    // Excel export would use SheetJS library
    exportCSV(data, `instagram_${currentTab}`); // Fallback to CSV for now
  });

  function exportCSV(data, filename) {
    const headers = ['username', 'fullName', 'profileUrl'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Premium ----
  function showPremiumPrompt() {
    $('#premiumPrompt').classList.remove('hidden');
  }

  $('#premiumPrompt').addEventListener('click', (e) => {
    if (e.target === $('#premiumPrompt')) {
      $('#premiumPrompt').classList.add('hidden');
    }
  });

  $('#btnUpgrade').addEventListener('click', async () => {
    try {
      const res = await apiClient.getPaymentLink('ig-export', 'monthly');
      if (res.success && res.data.vposLink) {
        chrome.tabs.create({ url: res.data.vposLink });
      } else if (res.success) {
        // No VPOS configured yet — show inline notice instead of alert()
        // (alert can close the popup).
        const p = $('#premiumPrompt');
        if (p) {
          const desc = p.querySelector('p');
          if (desc) desc.textContent = 'Ödeme sistemi henüz yapılandırılıyor. Lütfen daha sonra tekrar deneyin.';
          p.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.error('[Payment]', e);
    }
  });

  // ---- Settings ----
  $('#btnSettings').addEventListener('click', () => {
    $('#settingsModal').classList.remove('hidden');
    $('#langSelect').value = i18n.getLang();
  });

  $('#closeSettings').addEventListener('click', () => {
    $('#settingsModal').classList.add('hidden');
  });

  $('#settingsModal').addEventListener('click', (e) => {
    if (e.target === $('#settingsModal')) {
      $('#settingsModal').classList.add('hidden');
    }
  });

  $('#langSelect').addEventListener('change', async (e) => {
    await i18n.setLanguage(e.target.value);
  });

  // Language toggle button
  $('#btnLang').addEventListener('click', async () => {
    const newLang = i18n.getLang() === 'tr' ? 'en' : 'tr';
    await i18n.setLanguage(newLang);
    if ($('#settingsModal').classList.contains('hidden') === false) {
      $('#langSelect').value = newLang;
    }
  });

  // Logout
  $('#btnLogout').addEventListener('click', async () => {
    await apiClient.clearToken();
    $('#settingsModal').classList.add('hidden');
    scannedData = { followers: null, following: null, likes: null, comments: null };
    lastError = { followers: null, following: null, likes: null, comments: null };
    try { await chrome.storage.local.remove(SCAN_STORE_KEY); } catch (e) {}
    showAuthScreen();
  });

})();
