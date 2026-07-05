/**
 * AI Listing Writer - Popup Controller
 */
(async function() {
  'use strict';

  const L = (typeof Logger !== 'undefined') ? Logger
    : { info(){}, warn(){}, error(){}, flush(){}, getAll: async () => [], formatText: () => '', clearAll: async () => {} };
  L.info('init', 'ai-listing-writer popup opened');

  let isAuthMode = 'login';
  let typesData = { categories: [], types: [] };
  let lastResult = null;

  const $ = (sel) => document.querySelector(sel);

  // Small offline fallback if the backend can't be reached (one type per category)
  const FALLBACK_CATEGORIES = [
    { id: 'real-estate', label: { en: 'Real Estate', tr: 'Emlak' } },
    { id: 'vehicle', label: { en: 'Vehicles', tr: 'Vasıta' } },
    { id: 'ecommerce', label: { en: 'E-commerce Product', tr: 'E-ticaret Ürünü' } },
    { id: 'job', label: { en: 'Job Posting', tr: 'İş İlanı' } },
    { id: 'service', label: { en: 'Service / Freelance', tr: 'Hizmet / Serbest Çalışma' } },
    { id: 'seo', label: { en: 'SEO Meta', tr: 'SEO Meta' } },
    { id: 'secondhand', label: { en: 'Second-hand Item', tr: 'İkinci El Eşya' } }
  ];
  const FALLBACK_TYPES = [
    { id: 'sale-apartment', category: 'real-estate', label: { en: 'Apartment for Sale', tr: 'Satılık Daire' } },
    { id: 'sale-car', category: 'vehicle', label: { en: 'Car for Sale', tr: 'Satılık Otomobil' } },
    { id: 'product-electronics', category: 'ecommerce', label: { en: 'Electronics', tr: 'Elektronik' } },
    { id: 'job-fulltime', category: 'job', label: { en: 'Full-Time Job Posting', tr: 'Tam Zamanlı İş İlanı' } },
    { id: 'service-cleaning', category: 'service', label: { en: 'Cleaning Service', tr: 'Temizlik Hizmeti' } },
    { id: 'seo-blog', category: 'seo', label: { en: 'Blog Post SEO Title & Meta', tr: 'Blog Yazısı SEO Başlık & Açıklama' } },
    { id: 'secondhand-electronics', category: 'secondhand', label: { en: 'Second-hand Electronics', tr: 'İkinci El Elektronik' } }
  ];

  function pickLabel(labelObj) {
    const lang = i18n.getLang();
    return (labelObj && (labelObj[lang] || labelObj.en)) || '';
  }

  await apiClient.init();
  await i18n.init();

  if (apiClient.isAuthenticated()) {
    try {
      const res = await apiClient.getProfile();
      if (res.success) showMainScreen();
      else showAuthScreen();
    } catch(e) {
      if (e && e.status === 401) {
        showAuthScreen();
      } else {
        console.warn('[AIListingWriter] Profile check failed due to network/server error, keeping session.', e);
        showMainScreen();
      }
    }
  } else {
    showAuthScreen();
  }

  function showAuthScreen() {
    $('#authScreen').classList.add('active');
    $('#mainScreen').classList.remove('active');
  }

  function showMainScreen() {
    $('#authScreen').classList.remove('active');
    $('#mainScreen').classList.add('active');
    loadTypes();
    restoreLastResult();
  }

  async function loadTypes() {
    try {
      const res = await apiClient.getListingTypes();
      if (res.success && res.data.types && res.data.types.length) {
        typesData = res.data;
      } else {
        typesData = { categories: FALLBACK_CATEGORIES, types: FALLBACK_TYPES };
      }
    } catch (e) {
      typesData = { categories: FALLBACK_CATEGORIES, types: FALLBACK_TYPES };
    }
    renderCategorySelect();
  }

  function renderCategorySelect() {
    const sel = $('#categorySelect');
    sel.innerHTML = '';
    typesData.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = pickLabel(cat.label);
      sel.appendChild(opt);
    });
    renderTypeSelect();
  }

  function renderTypeSelect() {
    const categoryId = $('#categorySelect').value;
    const sel = $('#typeSelect');
    sel.innerHTML = '';
    typesData.types
      .filter(t => t.category === categoryId)
      .forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = pickLabel(t.label);
        sel.appendChild(opt);
      });
  }

  $('#categorySelect').addEventListener('change', renderTypeSelect);

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

  // Generate
  $('#genForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await performGenerate();
  });

  async function performGenerate() {
    const type = $('#typeSelect').value;
    const subject = $('#inputSubject').value.trim();
    const details = $('#inputDetails').value.trim();
    const city = $('#inputCity').value.trim();
    const referenceId = $('#inputReferenceId').value.trim();
    const tone = $('#toneSelect').value;
    const outputLanguage = $('#outputLangSelect').value;
    const errorEl = $('#genError');
    const btn = $('#btnGenerate');

    errorEl.classList.add('hidden');

    if (!type || !subject || !details) {
      errorEl.textContent = i18n.t('fillRequired');
      errorEl.classList.remove('hidden');
      return;
    }

    $('#loadingSection').classList.remove('hidden');
    $('#resultSection').classList.add('hidden');
    $('#emptyState').classList.add('hidden');
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = i18n.t('generating');

    try {
      const res = await apiClient.generateListing({ type, subject, details, city, referenceId, tone, outputLanguage });
      if (res.success) {
        lastResult = res.data;
        renderResult();
        chrome.storage.local.set({ lastListingResult: lastResult });
      }
    } catch (err) {
      if (err && err.status === 429) {
        $('#premiumPrompt').classList.remove('hidden');
        $('#emptyState').classList.remove('hidden');
      } else {
        errorEl.textContent = (err && err.message) || i18n.t('error');
        errorEl.classList.remove('hidden');
        $('#emptyState').classList.remove('hidden');
      }
    } finally {
      $('#loadingSection').classList.add('hidden');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  function renderResult() {
    if (!lastResult) return;
    $('#resultTitleText').textContent = lastResult.title;
    $('#resultDescriptionText').textContent = lastResult.description;
    $('#resultSection').classList.remove('hidden');
    $('#emptyState').classList.add('hidden');
  }

  function restoreLastResult() {
    chrome.storage.local.get(['lastListingResult'], (data) => {
      if (data.lastListingResult) {
        lastResult = data.lastListingResult;
        renderResult();
      }
    });
  }

  // Copy buttons
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-copy');
    if (!btn) return;
    const targetId = btn.getAttribute('data-copy-target');
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent);
      flashCopied(btn);
    } catch (err) {
      console.error('[AIListingWriter] Clipboard write failed:', err);
    }
  });

  $('#btnCopyAll').addEventListener('click', async () => {
    if (!lastResult) return;
    const combined = `${lastResult.title}\n\n${lastResult.description}`;
    try {
      await navigator.clipboard.writeText(combined);
      flashCopied($('#btnCopyAll'));
    } catch (err) {
      console.error('[AIListingWriter] Clipboard write failed:', err);
    }
  });

  function flashCopied(btn) {
    const original = btn.textContent;
    btn.textContent = i18n.t('copied');
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1500);
  }

  // Premium
  $('#premiumPrompt').addEventListener('click', (e) => {
    if (e.target === $('#premiumPrompt')) $('#premiumPrompt').classList.add('hidden');
  });
  $('#btnUpgrade').addEventListener('click', async () => {
    try {
      const res = await apiClient.getPaymentLink('ai-listing-writer', 'monthly');
      if (res.success && res.data.vposLink) chrome.tabs.create({ url: res.data.vposLink });
    } catch(e) {}
  });

  // Settings
  $('#btnSettings').addEventListener('click', () => { $('#settingsModal').classList.remove('hidden'); $('#langSelect').value = i18n.getLang(); });
  $('#closeSettings').addEventListener('click', () => { $('#settingsModal').classList.add('hidden'); });
  $('#settingsModal').addEventListener('click', (e) => { if (e.target === $('#settingsModal')) $('#settingsModal').classList.add('hidden'); });
  $('#langSelect').addEventListener('change', async (e) => {
    await i18n.setLanguage(e.target.value);
    renderCategorySelect();
  });
  $('#btnLang').addEventListener('click', async () => {
    const newLang = i18n.getLang() === 'tr' ? 'en' : 'tr';
    await i18n.setLanguage(newLang);
    renderCategorySelect();
  });
  $('#btnLogout').addEventListener('click', async () => { await apiClient.clearToken(); $('#settingsModal').classList.add('hidden'); showAuthScreen(); });

})();
