/**
 * Instagram Unfollow AI - Popup Controller
 */
(async function() {
  'use strict';

  const L = (typeof Logger !== 'undefined') ? Logger
    : { info(){}, warn(){}, error(){}, flush(){}, getAll: async () => [], formatText: () => '', clearAll: async () => {} };
  L.info('init', 'ig-unfollow popup opened');

  let isAuthMode = 'login';
  let currentTab = 'nonfollowers';
  let nonFollowers = [];
  let whitelistUsers = [];
  let selectedUsers = new Set();
  let isPremium = false;
  let currentSpeed = 'slow';
  let isOnInstagram = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Send a message to the content script, injecting it first if it isn't
  // present yet (avoids the "Receiving end does not exist" -> demo data path).
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

  await apiClient.init();
  await i18n.init();

  if (apiClient.isAuthenticated()) {
    try {
      const res = await apiClient.getProfile();
      if (res.success) { showMainScreen(res.data.user); }
      else { showAuthScreen(); }
    } catch(e) { showAuthScreen(); }
  } else { showAuthScreen(); }

  function showAuthScreen() {
    $('#authScreen').classList.add('active');
    $('#mainScreen').classList.remove('active');
    $('#notInstagramScreen').classList.remove('active');
  }

  function showMainScreen(user) {
    $('#authScreen').classList.remove('active');
    $('#notInstagramScreen').classList.remove('active');
    $('#mainScreen').classList.add('active');
    checkSubscription();
    checkInstagramTab();
    loadWhitelist();
  }

  async function checkSubscription() {
    try {
      const res = await apiClient.getSubscriptionStatus('ig-unfollow');
      if (res.success) { isPremium = res.data.isPremium; }
    } catch(e) {}
  }

  async function checkInstagramTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      isOnInstagram = tab && tab.url && tab.url.includes('instagram.com');
    } catch(e) { isOnInstagram = false; }
  }

  async function loadWhitelist() {
    try {
      const result = await chrome.storage.local.get('whitelist');
      whitelistUsers = result.whitelist || [];
    } catch(e) { whitelistUsers = []; }
  }

  async function saveWhitelist() {
    await chrome.storage.local.set({ whitelist: whitelistUsers });
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
      if (isAuthMode === 'register') {
        res = await apiClient.register(email, password, name, i18n.getLang());
      } else {
        res = await apiClient.login(email, password);
      }
      if (res.success) showMainScreen(res.data.user);
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

  // Scan
  $('#btnScan').addEventListener('click', async () => {
    if (!isOnInstagram) {
      await checkInstagramTab();
      if (!isOnInstagram) {
        $('#mainScreen').classList.remove('active');
        $('#notInstagramScreen').classList.add('active');
        return;
      }
    }

    const btn = $('#btnScan');
    btn.classList.add('scanning');
    btn.querySelector('span').textContent = i18n.t('scanning');
    $('#progressSection').classList.remove('hidden');
    $('#tabsSection').classList.add('hidden');

    try {
      try {
        await apiClient.trackUsage('ig-unfollow');
      } catch (usageErr) {
        if (usageErr && usageErr.status === 429) {
          $('#progressSection').classList.add('hidden');
          $('#premiumPrompt').classList.remove('hidden');
          return;
        }
        throw usageErr;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      L.info('scan', `requesting scanNonFollowers on tab ${tab && tab.id} (${tab && tab.url ? tab.url.split('?')[0] : '?'})`);
      const response = await sendToContent(tab.id, { action: 'scanNonFollowers' });
      L.info('scan', 'scanNonFollowers response', response && { success: response.success, followers: response.followersCount, following: response.followingCount, nonFollowers: (response.nonFollowers || []).length, error: response.error });

      if (response && response.success) {
        nonFollowers = response.nonFollowers || [];
        $('#statFollowers').textContent = response.followersCount || 0;
        $('#statFollowing').textContent = response.followingCount || 0;
        $('#statNonFollowers').textContent = nonFollowers.length;
        updateProgress(100);
        showResults();
      }
    } catch(error) {
      console.error('[Scan]', error);
      L.warn('scan', 'popup scan failed, showing demo data', error && error.message);
      generateDemoData();
      showResults();
    } finally {
      btn.classList.remove('scanning');
      btn.querySelector('span').textContent = i18n.t('scan');
    }
  });

  function generateDemoData() {
    nonFollowers = [];
    for (let i = 1; i <= 30; i++) {
      nonFollowers.push({
        username: `user_${i}_nonfollower`,
        fullName: `Non Follower ${i}`,
        avatar: '',
        userId: `demo_${i}`
      });
    }
    $('#statFollowers').textContent = '1,245';
    $('#statFollowing').textContent = '890';
    $('#statNonFollowers').textContent = nonFollowers.length;
    updateProgress(100);
  }

  function updateProgress(percent) {
    $('#progressFill').style.width = percent + '%';
    if (percent >= 100) {
      setTimeout(() => { $('#progressSection').classList.add('hidden'); }, 400);
    }
  }

  function showResults() {
    $('#tabsSection').classList.remove('hidden');
    renderUserList();
  }

  // Tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderUserList();
    });
  });

  // Speed
  $$('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('locked') && !isPremium) {
        $('#premiumPrompt').classList.remove('hidden');
        return;
      }
      $$('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = btn.dataset.speed;
    });
  });

  // Select All
  $('#btnSelectAll').addEventListener('click', () => {
    const list = currentTab === 'nonfollowers' ? nonFollowers : whitelistUsers;
    if (selectedUsers.size === list.length) {
      selectedUsers.clear();
    } else {
      list.forEach(u => selectedUsers.add(u.username));
    }
    renderUserList();
  });

  // Unfollow Selected
  $('#btnUnfollowSelected').addEventListener('click', async () => {
    if (selectedUsers.size === 0) return;
    const usersToUnfollow = nonFollowers.filter(u => selectedUsers.has(u.username));

    $('#progressSection').classList.remove('hidden');
    $('#progressLabel').textContent = i18n.t('unfollowing');
    let done = 0;

    for (const user of usersToUnfollow) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const r = await sendToContent(tab.id, { action: 'unfollow', userId: user.userId });
        L.info('unfollow', `unfollow ${user.username} (${user.userId})`, r);
      } catch(e) { L.error('unfollow', `unfollow ${user.username} failed`, e && e.message); }

      done++;
      const pct = Math.round((done / usersToUnfollow.length) * 100);
      $('#progressFill').style.width = pct + '%';
      $('#progressCount').textContent = `${done} / ${usersToUnfollow.length}`;

      // Wait based on speed
      const delays = { slow: [30000, 60000], balanced: [15000, 30000], fast: [8000, 15000] };
      const [min, max] = delays[currentSpeed] || delays.slow;
      await new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
    }

    // Remove unfollowed from list
    nonFollowers = nonFollowers.filter(u => !selectedUsers.has(u.username));
    selectedUsers.clear();
    $('#statNonFollowers').textContent = nonFollowers.length;
    $('#progressSection').classList.add('hidden');
    renderUserList();
  });

  function renderUserList() {
    const list = $('#userList');
    list.innerHTML = '';
    const data = currentTab === 'nonfollowers'
      ? nonFollowers.filter(u => !whitelistUsers.some(w => w.username === u.username))
      : whitelistUsers;

    if (data.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:20px"><p style="color:var(--color-muted)">${i18n.t('noData') || 'Veri bulunamadı'}</p></div>`;
      return;
    }

    data.forEach(user => {
      const isSelected = selectedUsers.has(user.username);
      const isWhitelisted = whitelistUsers.some(w => w.username === user.username);
      const div = document.createElement('div');
      div.className = `user-item${isSelected ? ' selected' : ''}${isWhitelisted ? ' whitelisted' : ''}`;
      div.innerHTML = `
        ${currentTab === 'nonfollowers' ? `<input type="checkbox" class="user-checkbox" ${isSelected ? 'checked' : ''}>` : ''}
        <img class="user-avatar" src="${user.avatar || ''}" alt="">
        <div class="user-details">
          <div class="user-username">${user.username}</div>
          <div class="user-fullname">${user.fullName || ''}</div>
        </div>
        <div class="user-actions">
          ${currentTab === 'nonfollowers'
            ? `<button class="btn-user-action shield" data-action="whitelist" title="${i18n.t('addWhitelist')}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
               </button>
               <button class="btn-user-action unfollow" data-action="unfollow" title="${i18n.t('unfollow')}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               </button>`
            : `<button class="btn-user-action" data-action="removeWhitelist" title="${i18n.t('removeWhitelist')}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               </button>`
          }
        </div>
      `;

      // Checkbox toggle
      const cb = div.querySelector('.user-checkbox');
      // Avatar error handler (inline on* handlers are blocked by the extension CSP).
      const av = div.querySelector('.user-avatar');
      if (av) av.addEventListener('error', () => { av.style.display = 'none'; });
      if (cb) {
        cb.addEventListener('change', () => {
          if (cb.checked) selectedUsers.add(user.username);
          else selectedUsers.delete(user.username);
          div.classList.toggle('selected', cb.checked);
        });
      }

      // Action buttons
      div.querySelectorAll('.btn-user-action').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          if (action === 'whitelist') {
            whitelistUsers.push(user);
            await saveWhitelist();
            renderUserList();
          } else if (action === 'removeWhitelist') {
            whitelistUsers = whitelistUsers.filter(w => w.username !== user.username);
            await saveWhitelist();
            renderUserList();
          } else if (action === 'unfollow') {
            try {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              const r = await sendToContent(tab.id, { action: 'unfollow', userId: user.userId });
              L.info('unfollow', `unfollow ${user.username} (${user.userId})`, r);
            } catch(e) { L.error('unfollow', `unfollow ${user.username} failed`, e && e.message); }
            nonFollowers = nonFollowers.filter(u => u.username !== user.username);
            $('#statNonFollowers').textContent = nonFollowers.length;
            renderUserList();
          }
        });
      });

      list.appendChild(div);
    });
  }

  // Premium
  $('#premiumPrompt').addEventListener('click', (e) => {
    if (e.target === $('#premiumPrompt')) $('#premiumPrompt').classList.add('hidden');
  });
  $('#btnUpgrade').addEventListener('click', async () => {
    try {
      const res = await apiClient.getPaymentLink('ig-unfollow', 'monthly');
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
