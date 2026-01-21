// sterowanie web push z zakładki "Wiadomości i powiadomienia"
(async function () {
  if (!('serviceWorker' in navigator)) return;

  // rejestracja na SW
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.error('SW register error:', e);
    return;
  }

  const btn = document.getElementById('btnPushToggle');
  const statusEl = document.getElementById('pushStatus');

  // jeśli ta strona nie ma tych elementów to nic sie nie dzieje
  if (!btn || !statusEl) return;

  function getUserId() {
    const v = sessionStorage.getItem('userId') || localStorage.getItem('userId');
    return v ? Number(v) : null;
  }

  async function getSub() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function refreshUI() {
    if (!('Notification' in window)) {
      statusEl.textContent = 'Przeglądarka nie wspiera powiadomień.';
      btn.disabled = true;
      btn.dataset.state = 'off';
      return;
    }

    const perm = Notification.permission;
    const sub = await getSub();

    if (perm === 'denied') {
      statusEl.textContent = 'Zablokowane w przeglądarce';
      btn.disabled = true;
      btn.dataset.state = 'off';
      return;
    }

    if (sub) {
      statusEl.textContent = 'Włączone';
      btn.disabled = false;
      btn.dataset.state = 'on';
    } else {
      statusEl.textContent = (perm === 'granted') ? 'Wyłączone' : 'Wymagana zgoda';
      btn.disabled = false;
      btn.dataset.state = 'off';
    }
  }

  function urlBase64ToUint8Array(s) {
    const p = '='.repeat((4 - s.length % 4) % 4);
    const b = (s + p).replace(/-/g, '+').replace(/_/g, '/');
    const r = atob(b);
    const a = new Uint8Array(r.length);
    for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i);
    return a;
  }

  async function enable() {
    const userId = getUserId();
    if (!userId) { alert('Brak ID użytkownika'); return; }

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { await refreshUI(); return; }
    }

    const { key } = await fetch('/push/public-key').then(r => r.json());
    const reg = await navigator.serviceWorker.ready;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    await fetch('/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: sub })
    });

    await refreshUI();
  }

  async function disable() {
    const userId = getUserId();
    if (!userId) { alert('Brak ID użytkownika'); return; }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch (_) {}
      await fetch('/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, endpoint })
      });
    }

    await refreshUI();
  }

  btn.addEventListener('click', async () => {
    if (btn.dataset.state === 'on') await disable();
    else await enable();
  });

  await refreshUI();
})();
