// ===== LOCATION RENTAL AUTOMATION =====
var LocationRental = (function() {
  var selectedInstrument = null;
  var instruments = [];

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getAvailableInstruments() {
    if (typeof MistralSync === 'undefined' || !MistralSync.isReady()) return [];
    var allInstruments = MistralSync.getData('mistral_gestion_instruments') || [];
    return allInstruments.filter(function(i) {
      return i.disponible_location && i.statut !== 'vendu' && i.statut !== 'en_location';
    });
  }

  function getConfig() {
    if (typeof MistralGestion !== 'undefined') {
      return MistralGestion.getConfig();
    }
    return { loyer: 60, frais: 100, caution: 1150 };
  }

  function renderInstrumentCard(inst) {
    var config = getConfig();
    var loyer = config.loyer || 60;
    var gamme = escapeHtml(inst.gamme || inst.nom || 'Handpan');
    var taille = inst.taille ? escapeHtml(inst.taille + ' cm') : '';
    var img = inst.photos && inst.photos.length > 0 ? inst.photos[0] : '';
    var imgHtml = img
      ? '<img src="' + escapeHtml(img) + '" alt="' + gamme + '" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius-md);flex-shrink:0;">'
      : '<div style="width:80px;height:80px;background:var(--color-bg-warm);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:2rem;">&#127925;</div>';

    return '<div class="rental-instrument-card" data-id="' + escapeHtml(inst.id) + '" style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.borderColor=\'var(--color-accent)\';this.style.boxShadow=\'var(--shadow-sm)\'" onmouseout="this.style.borderColor=\'var(--color-border)\';this.style.boxShadow=\'none\'">'
      + imgHtml
      + '<div style="flex:1;min-width:0;">'
      + '<p style="font-weight:600;">' + gamme + '</p>'
      + '<p class="text-sm text-muted">' + [taille, escapeHtml(inst.tonalite || ''), escapeHtml(inst.materiau || '')].filter(Boolean).join(' · ') + '</p>'
      + '</div>'
      + '<div style="text-align:right;flex-shrink:0;">'
      + '<p style="font-weight:600;color:var(--color-accent);">' + loyer + '&euro;<span class="text-sm" style="font-weight:400;opacity:0.7;">/mois</span></p>'
      + '</div>'
      + '</div>';
  }

  function showStep(step) {
    var steps = ['instruments', 'notify', 'form', 'confirm'];
    steps.forEach(function(s) {
      var el = document.getElementById('rental-step-' + s);
      if (el) el.style.display = s === step ? 'block' : 'none';
    });

    var title = document.getElementById('rental-modal-title');
    if (step === 'instruments') title.textContent = 'Choisissez un instrument';
    else if (step === 'notify') title.textContent = 'Être averti';
    else if (step === 'form') title.textContent = 'Réserver une location';
    else if (step === 'confirm') title.textContent = 'Réservation confirmée';
  }

  function openModal() {
    instruments = getAvailableInstruments();

    if (instruments.length > 0) {
      var grid = document.getElementById('rental-instruments-grid');
      grid.innerHTML = instruments.map(renderInstrumentCard).join('');

      // Bind click events on instrument cards
      grid.querySelectorAll('.rental-instrument-card').forEach(function(card) {
        card.addEventListener('click', function() {
          var id = card.dataset.id;
          selectedInstrument = instruments.find(function(i) { return i.id === id; });
          if (selectedInstrument) selectInstrument(selectedInstrument);
        });
      });

      showStep('instruments');
    } else {
      showStep('notify');
    }

    document.getElementById('contact-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function selectInstrument(inst) {
    selectedInstrument = inst;
    document.getElementById('rental-instrument-id').value = inst.id;
    document.getElementById('rental-selected-name').textContent = inst.gamme || inst.nom || 'Handpan';
    document.getElementById('rental-selected-details').textContent =
      [inst.taille ? inst.taille + ' cm' : '', inst.tonalite, inst.materiau].filter(Boolean).join(' · ');
    showStep('form');
  }

  function closeModal() {
    document.getElementById('contact-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function init() {
    // Reservation form submit
    var form = document.getElementById('location-form');
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();

        var submitBtn = form.querySelector('button[type="submit"]');
        var originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Réservation en cours...';

        var firstname = document.getElementById('contact-firstname').value.trim();
        var lastname = document.getElementById('contact-lastname').value.trim();
        var email = document.getElementById('contact-email').value.trim();
        var phone = document.getElementById('contact-phone').value.trim();
        var city = document.getElementById('contact-city').value.trim();
        var message = document.getElementById('contact-message').value.trim();

        // Honeypot
        var hp = form.querySelector('[name="website"]');
        if (hp && hp.value) { submitBtn.disabled = false; submitBtn.textContent = originalText; return; }

        var instrumentName = selectedInstrument ? (selectedInstrument.gamme || selectedInstrument.nom || 'Handpan') : 'Handpan';
        var instrumentId = selectedInstrument ? selectedInstrument.id : '';
        var config = getConfig();

        var fullMessage = 'RÉSERVATION DE LOCATION\n\n'
          + 'Instrument: ' + instrumentName + (selectedInstrument ? ' (' + (selectedInstrument.reference || instrumentId) + ')' : '') + '\n'
          + 'Ville: ' + city + '\n'
          + 'Téléphone: ' + phone + '\n\n'
          + 'Précisions:\n' + (message || 'Aucune');

        try {
          // 1. Send notification email to admin
          var response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emailType: 'contact',
              firstname: firstname,
              lastname: lastname,
              email: email,
              phone: phone,
              message: fullMessage,
              type: 'Réservation location'
            })
          });

          var result = await response.json();

          if (response.ok && result.success) {
            // 2. Try to mark instrument as reserved via Supabase
            if (selectedInstrument && typeof supabase !== 'undefined') {
              try {
                await supabase.from('instruments').update({ statut: 'reserve' }).eq('id', instrumentId);
              } catch (err) { /* Non-blocking */ }
            }

            // 3. Show confirmation
            showStep('confirm');
          } else {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            alert('Erreur lors de l\'envoi. Contactez-nous à contact@mistralpans.fr');
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          alert('Erreur de connexion. Contactez-nous à contact@mistralpans.fr');
        }
      });
    }

    // Notification form submit
    var notifyForm = document.getElementById('rental-notify-form');
    if (notifyForm) {
      notifyForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        var hp = notifyForm.querySelector('[name="website"]');
        if (hp && hp.value) return;

        var email = document.getElementById('notify-email').value.trim();
        var submitBtn = notifyForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Inscription...';

        try {
          // Store notification email via Supabase if available
          if (typeof supabase !== 'undefined') {
            await supabase.from('configuration').upsert({
              key: 'location_notify_emails',
              namespace: 'gestion',
              value: { emails: [email], updated: new Date().toISOString() }
            }, { onConflict: 'key,namespace' });
          }

          // Also send an email notification to admin
          await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emailType: 'contact',
              firstname: 'Notification',
              lastname: 'Location',
              email: email,
              message: 'Demande de notification pour disponibilité location.\nEmail: ' + email,
              type: 'Notification location'
            })
          });

          notifyForm.innerHTML = '<div style="text-align:center;padding:var(--space-lg);"><p style="color:var(--color-success);font-weight:600;">Inscrit !</p><p class="text-sm text-muted" style="margin-top:var(--space-xs);">Vous recevrez un email unique dès qu\'un instrument sera disponible.</p></div>';
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Me prévenir';
          alert('Erreur. Contactez-nous à contact@mistralpans.fr');
        }
      });
    }

    // Modal open/close handlers
    document.addEventListener('click', function(e) {
      var contactTrigger = e.target.closest('[data-modal="contact"]');
      if (contactTrigger) {
        e.preventDefault();
        openModal();
      }
      if (e.target.id === 'contact-modal') closeModal();
      if (e.target.closest('.modal__close')) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    openModal: openModal,
    closeModal: closeModal,
    showStep: showStep,
    selectInstrument: selectInstrument
  };
})();

// Connecter les prix dynamiques à la config admin
window.addEventListener('mistral-sync-complete', function() {
  try {
    var config = window.MistralGestion ? MistralGestion.getConfig() : null;
    if (!config) return;

    var loyer = config.loyer || 60;
    var frais = config.frais || 100;

    var heroPrice = document.getElementById('location-hero-price');
    if (heroPrice) heroPrice.textContent = loyer + '\u20AC';

    var faqFrais = document.getElementById('location-faq-frais');
    if (faqFrais) faqFrais.textContent = frais + '\u20AC';
  } catch (e) {
    // Config not available, keep defaults
  }
});
