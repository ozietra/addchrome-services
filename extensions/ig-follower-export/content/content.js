/**
 * Instagram Follower Export - Content Script
 *
 * Runs on instagram.com and reads follower / following / likes / comments data
 * using Instagram's own private web API (the same endpoints the site itself
 * calls), authenticated by your existing logged-in session cookies. No password
 * is ever requested.
 *
 * NOTE: These endpoints are undocumented and change over time. If a request
 * starts returning empty results or a non-200 status, Instagram has likely
 * changed the response shape or rate-limited the session.
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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getCSRFToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  // Logged-in user's own numeric id (used as a fallback)
  function getSelfUserId() {
    const m = document.cookie.match(/ds_user_id=(\d+)/);
    return m ? m[1] : null;
  }

  // Resolve the numeric id of the profile currently being viewed
  async function getProfileUserId() {
    const username = window.location.pathname.split('/').filter(Boolean)[0];
    if (!username) return getSelfUserId();
    try {
      const res = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        { headers: { 'x-ig-app-id': IG_APP_ID, 'x-csrftoken': getCSRFToken() }, credentials: 'include' }
      );
      if (!res.ok) return getSelfUserId();
      const data = await res.json();
      return (data && data.data && data.data.user && data.data.user.id) || getSelfUserId();
    } catch (e) {
      return getSelfUserId();
    }
  }

  // Followers / following via the friendships endpoints, paginated by next_max_id
  async function fetchConnections(userId, type, onProgress) {
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
          console.error(`[IG Export] HTTP ${res.status}`);
          L.error('scrape', `${type} HTTP ${res.status}`, url);
          break;
        }
        data = await res.json();
      } catch (e) {
        console.error('[IG Export] fetch error:', e);
        L.error('scrape', `${type} fetch error`, e && e.message);
        break;
      }

      const pageCount = (data.users || []).length;
      (data.users || []).forEach((u) => {
        results.push({
          username: u.username,
          fullName: u.full_name || '',
          avatar: u.profile_pic_url || '',
          profileUrl: `https://www.instagram.com/${u.username}/`,
          isVerified: u.is_verified || false,
          isPrivate: u.is_private || false,
          userId: u.pk || u.id
        });
      });

      if (onProgress) onProgress(results.length, results.length);
      L.info('scrape', `${type} page ok: +${pageCount}, total ${results.length}, more=${!!data.next_max_id}`);

      maxId = data.next_max_id || '';
      if (!maxId) break;

      // Be gentle to avoid rate limits
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500));
    }

    L.info('scrape', `${type} finished: ${results.length} records`);
    L.flush();
    return results;
  }
  function shortcodeToMediaId(shortcode) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = 0n;
    for (const ch of shortcode) {
      const idx = alphabet.indexOf(ch);
      if (idx === -1) return null;
      id = id * 64n + BigInt(idx);
    }
    return id.toString();
  }

  function getMediaIdFromUrl() {
    const m = window.location.pathname.match(/\/(?:p|reel)\/([^/]+)/);
    return m ? shortcodeToMediaId(m[1]) : null;
  }

  // Likes of the post currently open. Instagram's likers endpoint does NOT
  // expose a reliable pagination cursor and is capped by the platform for
  // high-like posts (the app itself can't list all 22k either), so in practice
  // this returns the first page. We still follow next_max_id if it ever appears.
  async function fetchLikes() {
    const mediaId = getMediaIdFromUrl();
    L.info('scrape', `likes: mediaId=${mediaId} url=${location.pathname}`);
    if (!mediaId) return [];
    const all = [];
    const seen = new Set();
    let maxId = '';
    let page = 0;
    try {
      while (true) {
        let url = `https://www.instagram.com/api/v1/media/${mediaId}/likers/`;
        if (maxId) url += `?max_id=${encodeURIComponent(maxId)}`;
        const res = await fetch(url, {
          headers: {
            'x-ig-app-id': IG_APP_ID,
            'x-csrftoken': getCSRFToken(),
            'x-requested-with': 'XMLHttpRequest'
          },
          credentials: 'include'
        });
        if (!res.ok) {
          L.error('scrape', `likes HTTP ${res.status}`);
          break;
        }
        const data = await res.json();
        (data.users || []).forEach((u) => {
          const key = u.pk || u.id || u.username;
          if (seen.has(key)) return;
          seen.add(key);
          all.push({
            username: u.username,
            fullName: u.full_name || '',
            avatar: u.profile_pic_url || '',
            profileUrl: `https://www.instagram.com/${u.username}/`
          });
        });
        page++;
        maxId = data.next_max_id || '';
        L.info('scrape', `likes: page ${page} +${(data.users || []).length}, total ${all.length}, more=${!!maxId}`);
        if (!maxId) break;
        if (page >= 50) break; // safety cap
        await sleep(800 + Math.random() * 1000);
      }
    } catch (e) {
      console.error('[IG Export] likes error:', e);
      L.error('scrape', 'likes error', e && e.message);
    }
    L.info('scrape', `likes: finished ${all.length} (Instagram caps likers for high-like posts)`);
    return all;
  }

  // Comments of the post currently open. The comments endpoint paginates with
  // min_id/next_min_id (older pages), so we loop until there are no more.
  async function fetchComments() {
    const mediaId = getMediaIdFromUrl();
    L.info('scrape', `comments: mediaId=${mediaId} url=${location.pathname}`);
    if (!mediaId) return [];
    const all = [];
    const seen = new Set();
    let cursor = '';
    let param = 'min_id';
    let page = 0;
    try {
      while (true) {
        let url = `https://www.instagram.com/api/v1/media/${mediaId}/comments/?can_support_threading=true&permalink_enabled=false`;
        if (cursor) url += `&${param}=${encodeURIComponent(cursor)}`;
        const res = await fetch(url, {
          headers: {
            'x-ig-app-id': IG_APP_ID,
            'x-csrftoken': getCSRFToken(),
            'x-requested-with': 'XMLHttpRequest'
          },
          credentials: 'include'
        });
        if (!res.ok) {
          L.error('scrape', `comments HTTP ${res.status}`);
          break;
        }
        const data = await res.json();
        (data.comments || []).forEach((c) => {
          const key = c.pk || (c.user ? c.user.pk : '') + ':' + (c.created_at || '');
          if (seen.has(key)) return;
          seen.add(key);
          all.push({
            username: c.user ? c.user.username : '',
            fullName: c.text || '',
            avatar: c.user ? c.user.profile_pic_url || '' : '',
            profileUrl: c.user ? `https://www.instagram.com/${c.user.username}/` : ''
          });
        });
        page++;
        // Next older page: prefer next_min_id, fall back to next_max_id.
        if (data.next_min_id) { cursor = data.next_min_id; param = 'min_id'; }
        else if (data.next_max_id) { cursor = data.next_max_id; param = 'max_id'; }
        else cursor = '';
        const hasMore = !!cursor && (data.has_more_comments !== false);
        L.info('scrape', `comments: page ${page} +${(data.comments || []).length}, total ${all.length}, more=${hasMore}`);
        if (!hasMore) break;
        if (page >= 100) break; // safety cap
        await sleep(450 + Math.random() * 500);
      }
    } catch (e) {
      console.error('[IG Export] comments error:', e);
      L.error('scrape', 'comments error', e && e.message);
    }
    L.info('scrape', `comments: finished ${all.length}`);
    return all;
  }

  async function handleScrape(type) {
    L.info('scrape', `scan requested: ${type}`);
    try {
      if (type === 'likes' || type === 'comments') {
        // Likes & comments only exist on an open post/reel page.
        if (!getMediaIdFromUrl()) {
          return {
            success: false,
            error: 'Beğeni ve yorumlar için önce bir gönderi (post/reel) sayfası açın.'
          };
        }
        const data = type === 'likes' ? await fetchLikes() : await fetchComments();
        return { success: true, data };
      }

      const userId = await getProfileUserId();
      L.info('scrape', `resolved userId=${userId} for '${type}'`);
      if (!userId) return { success: false, error: 'Could not determine user ID' };
      const data = await fetchConnections(userId, type, null);
      return { success: true, data };
    } catch (error) {
      console.error('[IG Export] scrape error:', error);
      L.error('scrape', 'scan failed', error && error.message);
      return { success: false, error: error.message };
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      handleScrape(message.type).then(sendResponse);
      return true; // keep the channel open for the async response
    }
    if (message.action === 'checkInstagram') {
      sendResponse({ isInstagram: window.location.hostname.includes('instagram.com') });
      return true;
    }
  });
})();
