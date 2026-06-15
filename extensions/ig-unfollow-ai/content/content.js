/**
 * Instagram Unfollow AI - Content Script
 *
 * Scans followers / following and performs unfollow actions on instagram.com
 * using Instagram's own private web API, authenticated by your existing
 * logged-in session cookies. No password is ever requested.
 *
 * NOTE: These endpoints are undocumented and change over time. Bulk unfollowing
 * also violates Instagram's Terms of Service and can get an account temporarily
 * action-blocked, so the popup's "slow" speed mode (long, randomized delays)
 * is the safe default.
 */
(function () {
  'use strict';

  const IG_APP_ID = '936619743392459';

  const L = (typeof Logger !== 'undefined')
    ? Logger
    : { info() {}, warn() {}, error() {}, flush() {} };

  // Capture the API calls the Instagram page itself makes (forwarded by
  // net-probe.js from the MAIN world). Each distinct endpoint is logged once,
  // so you can spot if Instagram starts using a newer endpoint than this code.
  const seenProbes = new Set();
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || !d.__igProbe) return;
    const key = d.method + ' ' + d.path;
    if (seenProbes.has(key)) return;
    seenProbes.add(key);
    L.info('net-probe', `Instagram used ${d.method} ${d.path} -> ${d.status}`, { full: d.full });
  });

  L.info('init', 'content script loaded on ' + location.pathname);

  function getCSRFToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  // The ds_user_id cookie is the logged-in user's numeric id
  function getLoggedInUserId() {
    const m = document.cookie.match(/ds_user_id=(\d+)/);
    if (m) return m[1];
    try {
      const bm =
        document.body.innerHTML.match(/"viewerId"\s*:\s*"(\d+)"/) ||
        document.body.innerHTML.match(/"user_id"\s*:\s*"(\d+)"/);
      if (bm) return bm[1];
    } catch (e) {}
    return null;
  }

  // Followers / following via the friendships endpoints, paginated by next_max_id
  async function fetchAllConnections(userId, type, onProgress) {
    const path = type === 'followers' ? 'followers' : 'following';
    const results = [];
    let maxId = '';

    while (true) {
      let url = `https://www.instagram.com/api/v1/friendships/${userId}/${path}/?count=50`;
      if (maxId) url += `&max_id=${encodeURIComponent(maxId)}`;

      let data;
      try {
        const res = await fetch(url, {
          headers: {
            'x-ig-app-id': IG_APP_ID,
            'x-csrftoken': getCSRFToken(),
            'x-requested-with': 'XMLHttpRequest'
          },
          credentials: 'include'
        });
        if (!res.ok) {
          console.error(`[Unfollow AI] HTTP ${res.status}`);
          L.error('scan', `${type} HTTP ${res.status}`, url);
          break;
        }
        data = await res.json();
      } catch (e) {
        console.error('[Unfollow AI] fetch error:', e);
        L.error('scan', `${type} fetch error`, e && e.message);
        break;
      }

      const pageCount = (data.users || []).length;
      (data.users || []).forEach((u) => {
        results.push({
          username: u.username,
          fullName: u.full_name || '',
          avatar: u.profile_pic_url || '',
          userId: u.pk || u.id,
          isVerified: u.is_verified || false
        });
      });

      if (onProgress) onProgress(results.length);
      L.info('scan', `${type} page ok: +${pageCount}, total ${results.length}, more=${!!data.next_max_id}`);

      maxId = data.next_max_id || '';
      if (!maxId) break;
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    }

    L.info('scan', `${type} finished: ${results.length} records`);
    return results;
  }

  async function performUnfollow(userId) {
    try {
      const res = await fetch(`https://www.instagram.com/api/v1/friendships/destroy/${userId}/`, {
        method: 'POST',
        headers: {
          'x-ig-app-id': IG_APP_ID,
          'x-csrftoken': getCSRFToken(),
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded'
        },
        credentials: 'include'
      });
      L.info('unfollow', `destroy ${userId} -> HTTP ${res.status}`);
      return res.ok;
    } catch (e) {
      console.error('[Unfollow AI] unfollow error:', e);
      L.error('unfollow', `destroy ${userId} error`, e && e.message);
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scanNonFollowers') {
      (async () => {
        try {
          L.info('scan', 'scanNonFollowers requested');
          const userId = getLoggedInUserId();
          if (!userId) {
            L.error('scan', 'could not determine logged-in user id');
            sendResponse({ success: false, error: 'Kullan\u0131c\u0131 kimli\u011fi bulunamad\u0131' });
            return;
          }

          const followers = await fetchAllConnections(userId, 'followers');
          const following = await fetchAllConnections(userId, 'following');

          const followerSet = new Set(followers.map((f) => f.username));
          const nonFollowers = following.filter((f) => !followerSet.has(f.username));

          L.info('scan', `done: followers=${followers.length}, following=${following.length}, nonFollowers=${nonFollowers.length}`);
          L.flush();

          sendResponse({
            success: true,
            followersCount: followers.length,
            followingCount: following.length,
            nonFollowers
          });
        } catch (error) {
          L.error('scan', 'scan failed', error && error.message);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    if (message.action === 'unfollow') {
      performUnfollow(message.userId).then((success) => sendResponse({ success }));
      return true;
    }

    if (message.action === 'checkInstagram') {
      sendResponse({ isInstagram: window.location.hostname.includes('instagram.com') });
      return true;
    }
  });
})();
