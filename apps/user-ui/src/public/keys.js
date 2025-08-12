(() => {
  const form = document.querySelector('form[action="/keys"]');
  if (!form) return;

  const modal = document.getElementById('key-modal');
  const modalSecret = document.getElementById('key-modal-secret');
  const closeBtn = document.getElementById('key-modal-close');
  const copyBtn = document.getElementById('key-modal-copy');

  function showModal(secret) {
    if (!modal || !modalSecret) return;
    modalSecret.textContent = secret;
    modal.style.display = 'flex';
  }
  function hideModal() {
    if (!modal) return;
    modal.style.display = 'none';
  }
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); hideModal(); });
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
  if (copyBtn) copyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const text = modalSecret ? modalSecret.textContent || '' : '';
    try { await navigator.clipboard.writeText(text); copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); } catch {}
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new URLSearchParams();
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) data.append(k, String(v));
    try {
      const res = await fetch('/keys', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data.toString(),
        credentials: 'same-origin'
      });
      if (!res.ok) {
        // On validation error or CSRF miss, fallback to normal submission
        form.submit();
        return;
      }
      const json = await res.json();
      if (json && json.secret) {
        showModal(json.secret);
        // Clear input
        const input = form.querySelector('#usageDescription');
        if (input) input.value = '';
      } else {
        form.submit();
      }
    } catch {
      form.submit();
    }
  });
})();
