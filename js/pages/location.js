/**
 * =============================================================================
 * MISTRAL PANS — Module de Location (location.html)
 * =============================================================================
 *
 * Gere le parcours de reservation de location d'un handpan :
 *   1. Affichage des instruments disponibles (depuis MistralSync/Supabase)
 *   2. Selection d'un instrument → formulaire de reservation
 *   3. Generation contrat PDF (jsPDF) + envoi email client avec PJ
 *   4. Si livraison : creation depot Swikly + permalien dans email
 *   5. Marquage instrument "reserve" en base
 *   6. Confirmation simple (sans Calendly)
 *
 * Si aucun instrument n'est disponible, propose un formulaire de notification
 * par email (stockage Supabase + email admin).
 *
 * Flux modal multi-etapes :
 *   instruments → form → [processing] → confirm   (instrument dispo)
 *   notify                                          (aucun instrument dispo)
 *
 * Dependances :
 *   - MistralSync (supabase-sync.js) : lecture instruments + config tarifs
 *   - MistralUtils (utils.js) : getTarifsPublics, escapeHtml, loadScript
 *   - MistralPDF (gestion-pdf.js) : generateContratLocationPublic — lazy-loaded
 *   - MistralSwikly (swikly-client.js) : createDeposit — lazy-loaded si livraison
 *   - Netlify Function send-email : envoi email client + admin (BCC)
 *   - Supabase client : mise a jour statut instrument
 *
 * Expose : LocationRental.openModal(), closeModal(), showStep(), selectInstrument()
 *
 * @version 3.5.3
 * =============================================================================
 */
const LocationRental = (function() {

  /** @type {Object|null} Instrument actuellement selectionne */
  let selectedInstrument = null;

  /** @type {Array} Liste des instruments disponibles a la location */
  let instruments = [];

  /**
   * Echappe les caracteres HTML pour prevenir les injections XSS
   * @param {string} str - Chaine a echapper
   * @returns {string} Chaine echappee (& < > " remplaces par entites)
   */
  const escapeHtml = MistralUtils.escapeHtml;

  // ===========================================================================
  // DONNEES
  // ===========================================================================

  /**
   * Recupere les instruments disponibles a la location depuis MistralSync
   * Filtre : disponible_location=true ET statut ni 'vendu' ni 'en_location'
   * @returns {Array<Object>} Instruments filtres (peut etre vide)
   */
  function getAvailableInstruments() {
    if (typeof MistralSync === 'undefined' || !MistralSync.isReady()) return [];
    const allInstruments = MistralSync.getData('mistral_gestion_instruments') || [];
    return allInstruments.filter(function(i) {
      return i.disponible_location && i.statut !== 'vendu' && i.statut !== 'en_location';
    });
  }

  /**
   * Recupere la configuration tarifaire de location
   * Fallback : loyer 60€/mois, frais 100€, caution 1150€
   * @returns {Object} Config avec toutes les cles tarifs garanties
   */
  function getConfig() {
    return MistralUtils.getTarifsPublics();
  }

  // ===========================================================================
  // RENDU UI
  // ===========================================================================

  /**
   * Genere le HTML d'une carte instrument pour la grille de selection
   * Affiche : photo (ou placeholder), gamme, taille/tonalite/materiau, prix/mois
   * @param {Object} inst - Objet instrument depuis Supabase
   * @returns {string} HTML de la carte (div cliquable avec data-id)
   */
  function renderInstrumentCard(inst) {
    const config = getConfig();
    const loyer = config.loyerMensuel || 60;
    const gamme = escapeHtml(inst.gamme || inst.nom || 'Handpan');
    const taille = inst.taille ? escapeHtml(inst.taille + ' cm') : '';
    const img = inst.images && inst.images.length > 0 ? inst.images[0] : '';
    const imgHtml = img
      ? '<img src="' + escapeHtml(img) + '" alt="' + gamme + '" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius-md);flex-shrink:0;">'
      : '<div style="width:80px;height:80px;background:var(--color-bg-warm);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:2rem;">&#127925;</div>';

    return '<div class="rental-instrument-card" data-id="' + escapeHtml(inst.id) + '">'
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

  // ===========================================================================
  // NAVIGATION MULTI-ETAPES
  // ===========================================================================

  /**
   * Affiche une etape du modal et masque les autres
   * Met a jour le titre du modal selon l'etape
   * @param {string} step - 'instruments'|'notify'|'form'|'confirm'
   */
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
    else if (step === 'confirm') title.textContent = 'Demande envoyée';
  }

  /**
   * Affiche la grille d'instruments ou le formulaire de notification
   * Appelé une fois que les données sync sont prêtes
   */
  function populateModal() {
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
  }

  /**
   * Ouvre le modal de location
   * Si le sync n'est pas encore terminé, affiche un loader et attend
   * Sinon affiche directement la grille d'instruments
   */
  function openModal() {
    document.getElementById('contact-modal').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Si le sync est prêt, afficher directement
    if (typeof MistralSync !== 'undefined' && MistralSync.isReady()) {
      populateModal();
      return;
    }

    // Sync pas encore terminé : afficher un loader temporaire
    var body = document.getElementById('rental-modal-body');
    var title = document.getElementById('rental-modal-title');
    if (title) title.textContent = 'Chargement...';

    // Masquer toutes les étapes
    ['instruments', 'notify', 'form', 'confirm'].forEach(function(s) {
      var el = document.getElementById('rental-step-' + s);
      if (el) el.style.display = 'none';
    });

    // Créer un loader inline
    var loader = document.createElement('div');
    loader.id = 'rental-loader';
    loader.style.cssText = 'text-align:center;padding:3rem 1rem;';
    loader.innerHTML = '<div style="width:36px;height:36px;border:3px solid var(--color-border);border-top-color:var(--color-accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem;"></div>' +
      '<p style="color:var(--color-text-muted);">Chargement des instruments...</p>' +
      '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    body.appendChild(loader);

    // Attendre le sync puis afficher
    window.addEventListener('mistral-sync-complete', function onSync() {
      window.removeEventListener('mistral-sync-complete', onSync);
      var existingLoader = document.getElementById('rental-loader');
      if (existingLoader) existingLoader.remove();
      populateModal();
    });
  }

  /**
   * Selectionne un instrument et passe a l'etape formulaire
   * Pre-remplit les champs caches du formulaire avec l'instrument choisi
   * @param {Object} inst - Instrument selectionne
   */
  function selectInstrument(inst) {
    selectedInstrument = inst;
    document.getElementById('rental-instrument-id').value = inst.id;
    document.getElementById('rental-selected-name').textContent = inst.gamme || inst.nom || 'Handpan';
    document.getElementById('rental-selected-details').textContent =
      [inst.taille ? inst.taille + ' cm' : '', inst.tonalite, inst.materiau].filter(Boolean).join(' · ');
    showStep('form');
  }

  /** Ferme le modal et restaure le scroll de la page */
  function closeModal() {
    document.getElementById('contact-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ===========================================================================
  // SOUMISSION DU FORMULAIRE (nouveau flow v3.5.3)
  // ===========================================================================

  /**
   * Affiche un ecran intermediaire "Envoi en cours..." dans la modale
   * Remplace temporairement le contenu du formulaire
   */
  function showProcessingStep() {
    // Masquer toutes les etapes
    ['instruments', 'notify', 'form', 'confirm'].forEach(function(s) {
      var el = document.getElementById('rental-step-' + s);
      if (el) el.style.display = 'none';
    });

    var title = document.getElementById('rental-modal-title');
    if (title) title.textContent = 'Envoi en cours...';

    // Creer le loader de traitement
    var body = document.getElementById('rental-modal-body');
    var existingProcessing = document.getElementById('rental-processing');
    if (existingProcessing) existingProcessing.remove();

    var processing = document.createElement('div');
    processing.id = 'rental-processing';
    processing.style.cssText = 'text-align:center;padding:3rem 1rem;';
    processing.innerHTML =
      '<div style="width:36px;height:36px;border:3px solid var(--color-border);border-top-color:var(--color-accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem;"></div>' +
      '<p style="font-weight:600;margin-bottom:var(--space-xs);">Préparation de votre réservation...</p>' +
      '<p style="color:var(--color-text-muted);font-size:0.9rem;">Génération du contrat et envoi de votre email.</p>';
    body.appendChild(processing);
  }

  /**
   * Retire l'ecran de traitement
   */
  function hideProcessingStep() {
    var el = document.getElementById('rental-processing');
    if (el) el.remove();
  }

  /**
   * Extrait le Base64 pur d'un data URI PDF
   * @param {string} dataUri - data:application/pdf;filename=...;base64,...
   * @returns {string} Base64 brut sans prefixe
   */
  function extractPdfBase64(dataUri) {
    if (!dataUri) return null;
    var idx = dataUri.indexOf('base64,');
    if (idx !== -1) return dataUri.substring(idx + 7);
    return dataUri;
  }

  /**
   * Handler de soumission du formulaire de reservation
   * Orchestre : collecte → PDF → Swikly (si livraison) → email → Supabase → confirmation
   */
  async function handleReservationSubmit(e) {
    e.preventDefault();

    var form = e.target;
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;

    // Desactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Réservation en cours...';

    // Collecter les champs
    var firstname = document.getElementById('contact-firstname').value.trim();
    var lastname = document.getElementById('contact-lastname').value.trim();
    var email = document.getElementById('contact-email').value.trim();
    var phone = document.getElementById('contact-phone').value.trim();
    var city = document.getElementById('contact-city').value.trim();
    var message = document.getElementById('contact-message').value.trim();

    // Mode de recuperation (radio)
    var modeRadio = form.querySelector('input[name="rental-mode"]:checked');
    var mode = modeRadio ? modeRadio.value : 'atelier';

    // Honeypot
    var hp = form.querySelector('[name="website"]');
    if (hp && hp.value) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    if (!selectedInstrument) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      alert('Veuillez sélectionner un instrument.');
      return;
    }

    // Recuperer les tarifs dynamiquement
    var config = getConfig();
    var loyer = config.loyerMensuel || 60;
    var caution = config.montantCaution || 1150;
    var frais = config.fraisDossierTransport || 100;

    // Utiliser le loyer specifique a l'instrument si disponible
    if (selectedInstrument.prix_location_mensuel && selectedInstrument.prix_location_mensuel > 0) {
      loyer = selectedInstrument.prix_location_mensuel;
    }
    if (selectedInstrument.montant_caution && selectedInstrument.montant_caution > 0) {
      caution = selectedInstrument.montant_caution;
    }

    var instrumentId = selectedInstrument.id;

    // Afficher l'ecran de traitement
    showProcessingStep();

    try {
      // =====================================================================
      // 1. Lazy-load jsPDF + gestion-pdf si necessaire
      // =====================================================================
      if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        await MistralUtils.loadScript('js/vendor/jspdf.umd.min.js?v=3.5.3');
      }
      if (typeof MistralPDF === 'undefined' || !MistralPDF.generateContratLocationPublic) {
        await MistralUtils.loadScript('js/admin/gestion-pdf.js?v=3.5.3');
      }

      // =====================================================================
      // 2. Generer le contrat PDF
      // =====================================================================
      var pdfData = {
        client: {
          prenom: firstname,
          nom: lastname,
          email: email,
          phone: phone,
          ville: city
        },
        instrument: {
          gamme: selectedInstrument.gamme || selectedInstrument.nom || 'Handpan',
          taille: selectedInstrument.taille || '',
          tonalite: selectedInstrument.tonalite || '',
          materiau: selectedInstrument.materiau || '',
          reference: selectedInstrument.reference || ''
        },
        mode: mode,
        loyer: loyer,
        caution: caution,
        frais: frais,
        date: new Date().toISOString()
      };

      var pdfBase64 = null;
      try {
        var doc = MistralPDF.generateContratLocationPublic(pdfData);
        var dataUri = doc.output('datauristring');
        pdfBase64 = extractPdfBase64(dataUri);
      } catch (pdfErr) {
        console.warn('[Location] Erreur generation PDF, envoi sans PJ:', pdfErr.message);
        // Continue sans PDF — pas bloquant
      }

      // =====================================================================
      // 3. Si livraison → creer depot Swikly
      // =====================================================================
      var swiklyUrl = null;
      if (mode === 'livraison') {
        try {
          // Lazy-load swikly-client si necessaire
          if (typeof MistralSwikly === 'undefined') {
            await MistralUtils.loadScript('js/services/swikly-client.js?v=3.5.3');
          }
          if (typeof MistralSwikly !== 'undefined' && MistralSwikly.createDeposit) {
            var swiklyResult = await MistralSwikly.createDeposit({
              email: email,
              firstName: firstname,
              lastName: lastname,
              phone: phone
            }, {
              amount: caution,
              description: 'Caution location handpan — ' + (selectedInstrument.gamme || 'Handpan')
            });
            if (swiklyResult && swiklyResult.depositUrl) {
              swiklyUrl = swiklyResult.depositUrl;
            }
          }
        } catch (swiklyErr) {
          console.warn('[Location] Erreur Swikly, envoi sans permalien:', swiklyErr.message);
          // Continue sans Swikly — l'admin enverra le lien manuellement
        }
      }

      // =====================================================================
      // 4. Envoyer l'email au client (+ BCC admin) via Netlify Function
      // =====================================================================
      var emailPayload = {
        emailType: 'rental_reservation',
        client: {
          prenom: firstname,
          nom: lastname,
          email: email,
          phone: phone,
          ville: city
        },
        instrument: {
          gamme: selectedInstrument.gamme || selectedInstrument.nom || 'Handpan',
          taille: selectedInstrument.taille || '',
          tonalite: selectedInstrument.tonalite || '',
          materiau: selectedInstrument.materiau || ''
        },
        mode: mode,
        loyer: loyer,
        caution: caution,
        frais: frais,
        swiklyUrl: swiklyUrl,
        pdfBase64: pdfBase64,
        // Informations supplementaires pour l'admin (dans le BCC)
        message: message || ''
      };

      var response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });

      var result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur envoi email');
      }

      // =====================================================================
      // 5. Marquer l'instrument "reserve" dans Supabase
      // =====================================================================
      if (typeof supabase !== 'undefined') {
        try {
          await supabase.from('instruments').update({ statut: 'reserve' }).eq('id', instrumentId);
        } catch (dbErr) {
          console.warn('[Location] Erreur update statut:', dbErr.message);
          // Non-bloquant
        }
      }

      // =====================================================================
      // 6. Afficher la confirmation
      // =====================================================================
      hideProcessingStep();
      showStep('confirm');

    } catch (err) {
      console.error('[Location] Erreur reservation:', err);
      hideProcessingStep();

      // Remettre le formulaire visible
      showStep('form');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      alert('Une erreur est survenue lors de l\'envoi. Contactez-nous à contact@mistralpans.fr');
    }
  }

  // ===========================================================================
  // INITIALISATION & FORMULAIRES
  // ===========================================================================

  /**
   * Initialise les formulaires et les handlers du modal
   * - Formulaire de reservation : collecte infos, genere PDF, envoie email,
   *   marque instrument "reserve" en base, affiche confirmation
   * - Formulaire de notification : stocke email en base + notifie admin
   * - Handlers modal : ouverture via data-modal="contact", fermeture clic/Escape
   */
  function init() {
    // Reservation form submit
    var form = document.getElementById('location-form');
    if (form) {
      form.addEventListener('submit', handleReservationSubmit);
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
          // Envoyer une notification email à l'admin via netlify function
          var resp = await fetch('/.netlify/functions/send-email', {
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
          if (!resp.ok) throw new Error('Email send failed: ' + resp.status);

          // Stocker l'email dans la waitlist (Supabase via MistralSync)
          if (typeof MistralSync !== 'undefined') {
            try {
              var waitlist = MistralSync.getData('mistral_location_waitlist') || {};
              var emails = waitlist.emails || [];
              if (!emails.includes(email)) {
                emails.push(email);
                MistralSync.setData('mistral_location_waitlist', { emails: emails });
              }
            } catch (wlErr) {
              console.warn('[Location] Erreur sauvegarde waitlist:', wlErr.message);
            }
          }

          notifyForm.innerHTML = '<div style="text-align:center;padding:var(--space-lg);"><p style="color:var(--color-success);font-weight:600;">Inscrit !</p><p class="text-sm text-muted" style="margin-top:var(--space-xs);">Vous recevrez un email unique dès qu\'un instrument sera disponible.</p></div>';
        } catch (err) {
          console.error('[Location] Notification erreur:', err);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Me prévenir';
          notifyForm.insertAdjacentHTML('beforeend', '<p style="color:var(--color-error);font-size:0.85rem;margin-top:0.5rem;">Une erreur est survenue. Réessayez ou contactez-nous à contact@mistralpans.fr</p>');
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

  /**
   * Bind les boutons dont les onclick etaient inline (CSP-safe).
   */
  function bindInlineHandlers() {
    var btnChange = document.getElementById('btn-location-change');
    if (btnChange) btnChange.addEventListener('click', function() { showStep('instruments'); });
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); bindInlineHandlers(); });
  } else {
    init();
    bindInlineHandlers();
  }

  return {
    openModal: openModal,
    closeModal: closeModal,
    showStep: showStep,
    selectInstrument: selectInstrument
  };
})();

/**
 * Met a jour les prix affiches dans la page (hero, FAQ, formulaire) quand les donnees
 * admin sont chargees depuis Supabase. Utilise les valeurs de getTarifsPublics()
 * pour remplacer les prix par defaut du HTML statique.
 */
window.addEventListener('mistral-sync-complete', function() {
  try {
    var config = MistralUtils.getTarifsPublics();

    var heroPrice = document.getElementById('location-hero-price');
    if (heroPrice) heroPrice.textContent = config.loyerMensuel + '\u20AC';

    var faqFrais = document.getElementById('location-faq-frais');
    if (faqFrais) faqFrais.textContent = config.fraisDossierTransport + '\u20AC';

    // Mettre a jour le prix des frais dans le radio livraison
    var fraisSpan = document.getElementById('rental-frais-livraison');
    if (fraisSpan) fraisSpan.textContent = config.fraisDossierTransport;
  } catch (e) {
    // Config not available, keep defaults
  }
});
