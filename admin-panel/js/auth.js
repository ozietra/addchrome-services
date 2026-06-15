/**
 * Admin Panel - Auth Controller
 */
(function() {
  'use strict';

  if (AdminAPI.isAuthenticated()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = form.querySelector('.btn-login');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Giriş yapılıyor...';

    try {
      const res = await AdminAPI.login(email, password);
      if (res.success) {
        AdminAPI.setToken(res.data.token);
        window.location.href = 'dashboard.html';
      }
    } catch(err) {
      errorEl.textContent = err.message || 'Geçersiz giriş bilgileri';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Giriş Yap';
    }
  });
})();
