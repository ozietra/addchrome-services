/**
 * SubscriptionProxy — forwards auth/subscription checks to the shared
 * chrome-extensions-backend (the same one ig-follower-export, ig-unfollow-ai
 * and price-compare use). This service intentionally has no database of its
 * own: the shared backend's User/subscription data remains the single source
 * of truth, so a user who registered through another extension can use this
 * one immediately, and stays visible in the shared admin panel.
 */
const fetch = require('node-fetch');
const config = require('../config');

const EXTENSION_ID = 'ai-listing-writer';

class SubscriptionProxy {
  /**
   * @param {string} token - the bearer token the extension sent us
   * @returns {Promise<{isPremium: boolean, dailyUsage: number, limits: object}>}
   */
  async getStatus(token) {
    const response = await fetch(`${config.mainBackendUrl}/subscription/status/${EXTENSION_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(data.message || 'Could not verify subscription');
      err.statusCode = response.status;
      throw err;
    }

    return data.data;
  }

  /**
   * Tells the shared backend to increment today's usage counter for this user.
   * Non-fatal by design at the call site: the generated content is still
   * returned to the user even if this bookkeeping call fails.
   */
  async markUsage(token) {
    const response = await fetch(`${config.mainBackendUrl}/subscription/use/${EXTENSION_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(data.message || 'Could not record usage');
      err.statusCode = response.status;
      throw err;
    }

    return data;
  }
}

module.exports = new SubscriptionProxy();
