/**
 * Shared i18n module for Chrome Extensions
 * Uses chrome.i18n API + manual language override via storage
 */
const i18n = {
  currentLang: 'tr',
  translations: {},

  async init() {
    // Try to get saved language preference
    try {
      const result = await chrome.storage.local.get('language');
      if (result.language) {
        this.currentLang = result.language;
      } else {
        // Detect browser language
        const browserLang = chrome.i18n.getUILanguage();
        this.currentLang = browserLang.startsWith('tr') ? 'tr' : 'en';
      }
    } catch (e) {
      this.currentLang = 'tr';
    }

    // Load translations
    await this.loadTranslations();
    this.applyTranslations();
  },

  async loadTranslations() {
    try {
      const url = chrome.runtime.getURL(`_locales/${this.currentLang}/messages.json`);
      const response = await fetch(url);
      this.translations = await response.json();
    } catch (e) {
      console.error('[i18n] Failed to load translations:', e);
      this.translations = {};
    }
  },

  t(key, ...args) {
    const entry = this.translations[key];
    if (!entry) return key;
    let message = entry.message || key;
    // Replace $1, $2, etc. placeholders
    args.forEach((arg, index) => {
      message = message.replace(`$${index + 1}`, arg);
    });
    return message;
  },

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });
  },

  async setLanguage(lang) {
    this.currentLang = lang;
    await chrome.storage.local.set({ language: lang });
    await this.loadTranslations();
    this.applyTranslations();
  },

  getLang() {
    return this.currentLang;
  }
};
