(function() {
  'use strict';

  const form = document.getElementById('suivi-lookup');
  const errorEl = document.getElementById('suivi-error');
  const resultEl = document.getElementById('suivi-result');
  const lookupForm = document.getElementById('lookup-form');

  // Auto-fill from URL params
  const params = new URLSearchParams(window.location.search);
  const refParam = params.get('ref');
  const emailParam = params.get('email');
  if (refParam) document.getElementById('suivi-ref').value = refParam;
  if (emailParam) document.getElementById('suivi-email').value = emailParam;

  // Auto-search if both params present
  if (refParam && emailParam) {
    lookupOrder(refParam, emailParam);
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const ref = document.getElementById('suivi-ref').value.trim();
    const email = document.getElementById('suivi-email').value.trim();
    if (ref && email) lookupOrder(ref, email);
  });

  async function lookupOrder(ref, email) {
    const btn = document.getElementById('btn-lookup');
    btn.disabled = true;
    btn.textContent = 'Recherche en cours...';
    errorEl.style.display = 'none';
    resultEl.style.display = 'none';

    try {
      const response = await fetch('/.netlify/functions/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, email: email })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showError(data.error || 'Commande non trouvée');
        return;
      }

      displayOrder(data.order);

    } catch (err) {
      showError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Rechercher ma commande';
    }
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    resultEl.style.display = 'none';
  }

  function displayOrder(order) {
    errorEl.style.display = 'none';
    resultEl.style.display = 'block';
    lookupForm.style.display = 'none';

    // Header
    document.getElementById('result-ref').textContent = order.reference;
    document.getElementById('result-product').textContent = order.productName;
    document.getElementById('result-source').textContent = order.sourceLabel;

    // Timeline
    const timelineEl = document.getElementById('result-timeline');
    timelineEl.innerHTML = '';
    order.timeline.forEach(function(step) {
      const el = document.createElement('div');
      el.className = 'suivi-timeline__step suivi-timeline__step--' + step.status;
      el.innerHTML =
        '<div class="suivi-timeline__dot">' + (step.status === 'done' ? '\u2713' : step.icon) + '</div>' +
        '<div class="suivi-timeline__label">' + escapeHtml(step.label) + '</div>';
      timelineEl.appendChild(el);
    });

    // Payment
    document.getElementById('result-total').textContent = formatPrice(order.montantTotal);
    document.getElementById('result-paid').textContent = formatPrice(order.montantPaye);

    const remainingRow = document.getElementById('result-remaining-row');
    if (order.resteAPayer > 0) {
      remainingRow.style.display = '';
      document.getElementById('result-remaining').textContent = formatPrice(order.resteAPayer);
    } else {
      remainingRow.style.display = 'none';
    }

    // Payment badge
    const badge = document.getElementById('result-payment-badge');
    badge.textContent = order.statutPaiementLabel;
    badge.className = 'suivi-payment__badge';
    if (order.statutPaiement === 'paye') badge.classList.add('suivi-payment__badge--paye');
    else if (order.statutPaiement === 'partiel') badge.classList.add('suivi-payment__badge--partiel');
    else badge.classList.add('suivi-payment__badge--attente');

    // Tracking
    const trackingEl = document.getElementById('result-tracking');
    if (order.trackingNumber) {
      trackingEl.style.display = '';
      document.getElementById('result-tracking-number').textContent = order.trackingNumber;
    } else {
      trackingEl.style.display = 'none';
    }
  }

  window.resetLookup = function() {
    resultEl.style.display = 'none';
    lookupForm.style.display = '';
    errorEl.style.display = 'none';
  };

  // Bind reset button (CSP-safe, pas de onclick inline)
  const btnReset = document.getElementById('btn-reset-lookup');
  if (btnReset) btnReset.addEventListener('click', window.resetLookup);

  const formatPrice = MistralUtils.formatPrice;
  const escapeHtml  = MistralUtils.escapeHtml;
})();
