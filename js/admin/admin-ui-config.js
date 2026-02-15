/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Configuration
   Configuration, Export/Import, Matériaux
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    if (window.MISTRAL_DEBUG) console.warn('[admin-ui-config] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, Toast, Confirm, Modal, Storage, CONFIG } = window.AdminUIHelpers;


  function renderConfiguration() {
    if (typeof MistralGestion !== 'undefined') {
      const config = MistralGestion.getConfig();
      const entreprise = MistralGestion.CONFIG.ENTREPRISE;

      // Remplir les champs
      if ($('#config-nom')) $('#config-nom').value = entreprise.marque || '';
      if ($('#config-siret')) $('#config-siret').value = entreprise.siret || '';
      if ($('#config-email')) $('#config-email').value = entreprise.email || '';
      if ($('#config-tel')) $('#config-tel').value = entreprise.telephone || '';
      if ($('#config-loyer')) $('#config-loyer').value = config.loyerMensuel || 50;
      if ($('#config-caution')) $('#config-caution').value = config.montantCaution || 1150;
      if ($('#config-frais')) $('#config-frais').value = config.fraisDossierTransport || 100;
      if ($('#config-fidelite')) $('#config-fidelite').value = config.creditFidelitePourcent || 50;

      // Tarification configurateur
      if ($('#config-prix-note')) $('#config-prix-note').value = config.prixParNote || 115;
      if ($('#config-bonus-octave2')) $('#config-bonus-octave2').value = config.bonusOctave2 || 50;
      if ($('#config-bonus-bottoms')) $('#config-bonus-bottoms').value = config.bonusBottoms || 25;
      if ($('#config-malus-warning')) $('#config-malus-warning').value = config.malusDifficulteWarning || 5;
      if ($('#config-malus-difficile')) $('#config-malus-difficile').value = config.malusDifficulteDifficile || 10;
    }
  }

  function saveConfig() {
    if (typeof MistralGestion !== 'undefined') {
      // Enterprise info
      const entreprise = MistralGestion.CONFIG.ENTREPRISE;
      if ($('#config-nom')) entreprise.marque = $('#config-nom').value.trim();
      if ($('#config-siret')) entreprise.siret = $('#config-siret').value.trim();
      if ($('#config-email')) entreprise.email = $('#config-email').value.trim();
      if ($('#config-tel')) entreprise.telephone = $('#config-tel').value.trim();
      MistralGestion.setConfigValue('ENTREPRISE', entreprise);

      // Tarifs
      MistralGestion.setConfigValue('loyerMensuel', parseFloat($('#config-loyer')?.value) || 50);
      MistralGestion.setConfigValue('montantCaution', parseFloat($('#config-caution')?.value) || 1150);
      MistralGestion.setConfigValue('fraisDossierTransport', parseFloat($('#config-frais')?.value) || 100);
      MistralGestion.setConfigValue('creditFidelitePourcent', parseFloat($('#config-fidelite')?.value) || 50);

      // Tarification configurateur
      MistralGestion.setConfigValue('prixParNote', parseFloat($('#config-prix-note')?.value) || 115);
      MistralGestion.setConfigValue('bonusOctave2', parseFloat($('#config-bonus-octave2')?.value) || 50);
      MistralGestion.setConfigValue('bonusBottoms', parseFloat($('#config-bonus-bottoms')?.value) || 25);
      MistralGestion.setConfigValue('malusDifficulteWarning', parseFloat($('#config-malus-warning')?.value) || 5);
      MistralGestion.setConfigValue('malusDifficulteDifficile', parseFloat($('#config-malus-difficile')?.value) || 10);
    }
    Toast.success('Configuration enregistrée');
  }

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================

  function exportAllData() {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.DataManager.downloadExport();
      Toast.success('Export téléchargé');
    }
  }

  function importData(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = JSON.parse(e.target.result);
        const confirmed = await Confirm.show({
          title: 'Confirmer l\'import',
          message: 'Cette action remplacera les données existantes. Continuer ?',
          confirmText: 'Importer'
        });
        
        if (confirmed && typeof MistralGestion !== 'undefined') {
          MistralGestion.DataManager.importAll(data);
          Toast.success('Import réussi');
          AdminUI.refreshAll();
        }
      } catch (err) {
        Toast.error('Erreur: fichier invalide');
      }
    };
    reader.readAsText(file);
  }

  async function resetAllData() {
    const confirmed = await Confirm.show({
      title: '⚠️ Réinitialisation',
      message: 'Cette action supprimera TOUTES les données. Cette action est irréversible !',
      confirmText: 'Tout supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      if (typeof MistralGestion !== 'undefined') {
        MistralGestion.DataManager.resetAll();
      }
      Storage.set(CONFIG.TODO_KEY, []);
      Toast.info('Données réinitialisées');
      setTimeout(() => location.reload(), 1000);
    }
  }

  // ============================================================================
  // MATÉRIAUX MANAGEMENT
  // ============================================================================

  function renderMateriaux() {
    const container = $('#materiaux-list');
    if (!container) return;

    if (typeof MistralMateriaux === 'undefined') {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Module matériaux non chargé</p>';
      return;
    }

    const materiaux = MistralMateriaux.getAll();

    if (materiaux.length === 0) {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Aucun matériau configuré</p>';
      return;
    }

    let html = '';
    materiaux.forEach(mat => {
      const statusBadge = mat.disponible
        ? '<span style="color: var(--color-success, #4A7C59); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';

      const configBadge = mat.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';

      const colorPreview = mat.couleur
        ? `<span style="display: inline-block; width: 16px; height: 16px; background: ${mat.couleur}; border-radius: 3px; vertical-align: middle; margin-right: 0.5rem; border: 1px solid rgba(0,0,0,0.1);"></span>`
        : '';

      const prixMalusDisplay = mat.prix_malus > 0
        ? `<span style="color: var(--color-warning, #F59E0B); font-size: 0.8rem;">+${mat.prix_malus}%</span>`
        : '<span style="color: var(--admin-text-muted); font-size: 0.8rem;">Inclus</span>';

      html += `
        <div class="materiau-card" style="background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                ${colorPreview}
                ${escapeHtml(mat.nom)}
                <code style="background: var(--admin-surface-hover); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.75rem;">${mat.code}</code>
              </div>
              <div style="font-size: 0.85rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                ${mat.nom_court ? escapeHtml(mat.nom_court) : ''}
              </div>
            </div>
            ${prixMalusDisplay}
          </div>
          ${mat.description ? `<p style="font-size: 0.8rem; color: var(--admin-text-muted); margin: 0.5rem 0; line-height: 1.4;">${escapeHtml(mat.description.substring(0, 100))}${mat.description.length > 100 ? '...' : ''}</p>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--admin-border);">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${statusBadge}
              ${configBadge}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="admin-btn admin-btn--sm admin-btn--secondary" onclick="AdminUI.editMateriau('${mat.id}')" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" onclick="AdminUI.deleteMateriau('${mat.id}')" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function initMateriauColorSync() {
    const picker = $('#materiau-couleur-picker');
    const input = $('#materiau-couleur');
    if (picker && input) {
      picker.addEventListener('input', () => {
        input.value = picker.value;
      });
      input.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(input.value)) {
          picker.value = input.value;
        }
      });
    }
  }

  function populateMateriauxSelect(selectedCode = 'NS') {
    const select = $('#instrument-materiau');
    if (!select) return;

    if (typeof MistralMateriaux !== 'undefined') {
      select.innerHTML = MistralMateriaux.toSelectOptions(selectedCode);
    } else {
      // Fallback if module not loaded
      select.innerHTML = `
        <option value="NS" ${selectedCode === 'NS' ? 'selected' : ''}>Acier nitruré (NS)</option>
        <option value="ES" ${selectedCode === 'ES' ? 'selected' : ''}>Ember Steel (ES)</option>
        <option value="SS" ${selectedCode === 'SS' ? 'selected' : ''}>Inox</option>
      `;
    }
  }

  function editMateriau(id) {
    if (typeof MistralMateriaux === 'undefined') return;

    const materiau = MistralMateriaux.getById(id);
    if (!materiau) return;

    $('#modal-materiau-title').textContent = 'Modifier le matériau';
    $('#materiau-id').value = materiau.id;
    $('#materiau-code').value = materiau.code || '';
    $('#materiau-nom').value = materiau.nom || '';
    $('#materiau-nom-court').value = materiau.nom_court || '';
    $('#materiau-prix-malus').value = materiau.prix_malus || 0;
    $('#materiau-description').value = materiau.description || '';
    $('#materiau-couleur').value = materiau.couleur || '#C9A227';
    $('#materiau-couleur-picker').value = materiau.couleur || '#C9A227';
    $('#materiau-ordre').value = materiau.ordre || 1;
    $('#materiau-disponible').checked = materiau.disponible !== false;
    $('#materiau-visible-config').checked = materiau.visible_configurateur !== false;

    initMateriauColorSync();
    AdminUI.showModal('materiau');
  }

  function saveMateriau() {
    if (typeof MistralMateriaux === 'undefined') {
      Toast.error('Module matériaux non chargé');
      return;
    }

    const id = $('#materiau-id')?.value;
    const code = $('#materiau-code')?.value?.toUpperCase().trim();
    const nom = $('#materiau-nom')?.value?.trim();

    if (!code || !nom) {
      Toast.error('Le code et le nom sont requis');
      return;
    }

    // Check for duplicate code (except when editing same material)
    const existing = MistralMateriaux.getByCode(code);
    if (existing && existing.id !== id) {
      Toast.error(`Le code "${code}" existe déjà`);
      return;
    }

    const materiau = {
      id: id || null,
      code: code,
      nom: nom,
      nom_court: $('#materiau-nom-court')?.value?.trim() || '',
      prix_malus: parseFloat($('#materiau-prix-malus')?.value) || 0,
      description: $('#materiau-description')?.value?.trim() || '',
      couleur: $('#materiau-couleur')?.value?.trim() || '',
      ordre: parseInt($('#materiau-ordre')?.value) || 1,
      disponible: $('#materiau-disponible')?.checked,
      visible_configurateur: $('#materiau-visible-config')?.checked
    };

    MistralMateriaux.save(materiau);
    AdminUI.closeModal('materiau');
    renderMateriaux();
    Toast.success(id ? 'Matériau modifié' : 'Matériau créé');
  }

  async function deleteMateriau(id) {
    if (typeof MistralMateriaux === 'undefined') return;

    const materiau = MistralMateriaux.getById(id);
    if (!materiau) return;

    const confirmed = await Confirm.show({
      title: 'Supprimer le matériau',
      message: `Voulez-vous vraiment supprimer "${materiau.nom}" (${materiau.code}) ?`,
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralMateriaux.remove(id);
      renderMateriaux();
      Toast.success('Matériau supprimé');
    }
  }

  async function resetMateriaux() {
    if (typeof MistralMateriaux === 'undefined') return;

    const confirmed = await Confirm.show({
      title: 'Réinitialiser les matériaux',
      message: 'Ceci remplacera tous les matériaux par les valeurs par défaut (NS, ES, SS). Continuer ?',
      confirmText: 'Réinitialiser',
      type: 'warning'
    });

    if (confirmed) {
      MistralMateriaux.reset();
      renderMateriaux();
      Toast.success('Matériaux réinitialisés');
    }
  }


  // ============================================================================
  // EMAILS AUTOMATIQUES - Configuration
  // ============================================================================

  const EMAIL_AUTOMATIONS_DEFAULTS = {
    balance_request: {
      id: 'balance_request',
      label: 'Demande de solde',
      description: 'Envoyé quand le statut passe à "Prêt" et qu\'un solde reste à payer',
      trigger: 'Statut → Prêt + Paiement partiel',
      enabled: true,
      subject: 'Votre handpan est prêt ! - Commande {reference}',
      replyTo: 'contact@mistralpans.fr',
      serverSide: false
    },
    shipping_notification: {
      id: 'shipping_notification',
      label: 'Notification d\'expédition',
      description: 'Envoyé quand le statut passe à "Expédié"',
      trigger: 'Statut → Expédié',
      enabled: true,
      subject: 'Votre handpan est en route ! - Commande {reference}',
      replyTo: 'contact@mistralpans.fr',
      serverSide: false
    },
    new_order_notification: {
      id: 'new_order_notification',
      label: 'Notification artisan (nouvelle commande)',
      description: 'Envoyé à l\'artisan quand un paiement est validé via webhook PayPlug',
      trigger: 'Webhook paiement validé',
      enabled: true,
      subject: 'Nouvelle commande {reference}',
      replyTo: 'contact@mistralpans.fr',
      serverSide: true
    },
    payment_confirmation: {
      id: 'payment_confirmation',
      label: 'Confirmation de paiement client',
      description: 'Envoyé au client quand un paiement est validé via webhook PayPlug',
      trigger: 'Webhook paiement validé',
      enabled: true,
      subject: 'Confirmation de paiement - Commande {reference}',
      replyTo: 'contact@mistralpans.fr',
      serverSide: true
    }
  };

  const EMAIL_CONFIG_KEY = 'mistral_email_automations';

  function getEmailConfig() {
    let parsed = {};

    // Lire via MistralSync si disponible
    if (window.MistralSync && MistralSync.hasKey(EMAIL_CONFIG_KEY)) {
      parsed = MistralSync.getData(EMAIL_CONFIG_KEY) || {};
    } else {
      try {
        const stored = localStorage.getItem(EMAIL_CONFIG_KEY);
        parsed = stored ? JSON.parse(stored) : {};
      } catch (e) {
        console.error('Erreur lecture config emails:', e);
        return { ...EMAIL_AUTOMATIONS_DEFAULTS };
      }
    }

    // Merge defaults with stored values
    const config = {};
    for (const [key, defaults] of Object.entries(EMAIL_AUTOMATIONS_DEFAULTS)) {
      config[key] = { ...defaults, ...(parsed[key] || {}) };
    }
    return config;
  }

  function saveEmailConfig() {
    const config = getEmailConfig();

    for (const key of Object.keys(EMAIL_AUTOMATIONS_DEFAULTS)) {
      const enabledEl = $(`#email-auto-${key}-enabled`);
      const subjectEl = $(`#email-auto-${key}-subject`);
      const replyToEl = $(`#email-auto-${key}-replyto`);

      if (enabledEl) config[key].enabled = enabledEl.checked;
      if (subjectEl) config[key].subject = subjectEl.value.trim();
      if (replyToEl) config[key].replyTo = replyToEl.value.trim();
    }

    // Ecrire via MistralSync (memoire + Supabase)
    if (window.MistralSync && MistralSync.hasKey(EMAIL_CONFIG_KEY)) {
      MistralSync.setData(EMAIL_CONFIG_KEY, config);
    } else {
      localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(config));
    }
    Toast.success('Configuration emails enregistrée');
  }

  function renderEmailAutomations() {
    const container = $('#email-automations-list');
    if (!container) return;

    const config = getEmailConfig();
    let html = '';

    for (const [key, emailConf] of Object.entries(config)) {
      const isServer = emailConf.serverSide;
      const badgeBg = isServer ? 'var(--admin-accent, #0D7377)' : (emailConf.enabled ? 'var(--color-success, #4A7C59)' : 'var(--admin-text-muted)');
      const badgeText = isServer ? 'Serveur — toujours actif' : (emailConf.enabled ? 'Actif' : 'Inactif');

      html += `
        <div class="email-automation-card" style="background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                ${escapeHtml(emailConf.label)}
                <span style="font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; background: ${badgeBg}; color: white;" id="email-auto-${key}-badge">
                  ${badgeText}
                </span>
              </div>
              <div style="font-size: 0.8rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                ${escapeHtml(emailConf.description)}
              </div>
              <div style="font-size: 0.75rem; color: var(--admin-accent); margin-top: 0.25rem; font-family: 'JetBrains Mono', monospace;">
                Déclencheur : ${escapeHtml(emailConf.trigger)}
              </div>
            </div>
            ${isServer ? `
              <span style="flex-shrink: 0; margin-left: 1rem; font-size: 0.75rem; color: var(--admin-text-muted);" title="Géré côté serveur (webhook)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
              </span>
            ` : `
              <label class="admin-toggle" style="flex-shrink: 0; margin-left: 1rem;">
                <input type="checkbox" id="email-auto-${key}-enabled" ${emailConf.enabled ? 'checked' : ''} onchange="AdminUI.onEmailToggle('${key}', this.checked)">
                <span class="admin-toggle__slider"></span>
              </label>
            `}
          </div>
          <div class="email-auto-details" id="email-auto-${key}-details" style="${!isServer && !emailConf.enabled ? 'opacity: 0.5; pointer-events: none;' : ''}">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="admin-form__group" style="margin: 0;">
                <label class="admin-form__label" style="font-size: 0.8rem;">Objet de l'email</label>
                <input type="text" class="admin-form__input" id="email-auto-${key}-subject" value="${escapeHtml(emailConf.subject)}" style="font-size: 0.85rem;" placeholder="Objet..." ${isServer ? 'disabled title="Géré côté serveur"' : ''}>
                <div style="font-size: 0.7rem; color: var(--admin-text-muted); margin-top: 0.25rem;">Variables : {reference}, {prenom}, {produit}</div>
              </div>
              <div class="admin-form__group" style="margin: 0;">
                <label class="admin-form__label" style="font-size: 0.8rem;">Reply-to</label>
                <input type="email" class="admin-form__input" id="email-auto-${key}-replyto" value="${escapeHtml(emailConf.replyTo)}" style="font-size: 0.85rem;" placeholder="email@exemple.fr" ${isServer ? 'disabled title="Géré côté serveur"' : ''}>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function onEmailToggle(key, enabled) {
    const badge = $(`#email-auto-${key}-badge`);
    const details = $(`#email-auto-${key}-details`);
    if (badge) {
      badge.textContent = enabled ? 'Actif' : 'Inactif';
      badge.style.background = enabled ? 'var(--color-success, #4A7C59)' : 'var(--admin-text-muted)';
    }
    if (details) {
      details.style.opacity = enabled ? '1' : '0.5';
      details.style.pointerEvents = enabled ? '' : 'none';
    }
  }

  async function testEmailAutomation() {
    const emailTypes = Object.keys(EMAIL_AUTOMATIONS_DEFAULTS);
    const config = getEmailConfig();

    // Propose to choose which email to test
    const options = emailTypes
      .filter(key => config[key].enabled)
      .map(key => `<option value="${key}">${escapeHtml(config[key].label)}</option>`)
      .join('');

    if (!options) {
      Toast.error('Aucun email actif à tester');
      return;
    }

    // Create a quick inline dialog
    const html = `
      <div style="margin-bottom: 1rem;">
        <label class="admin-form__label">Email à tester</label>
        <select class="admin-form__select" id="test-email-type">${options}</select>
      </div>
      <div>
        <label class="admin-form__label">Adresse de destination</label>
        <input type="email" class="admin-form__input" id="test-email-dest" value="${escapeHtml(config.balance_request.replyTo || 'contact@mistralpans.fr')}" placeholder="email@test.fr">
      </div>
    `;

    const confirmed = await Confirm.show({
      title: 'Envoyer un email de test',
      message: html,
      confirmText: 'Envoyer',
      type: 'info',
      isHtml: true
    });

    if (!confirmed) return;

    const emailType = $('#test-email-type')?.value;
    const destEmail = $('#test-email-dest')?.value?.trim();

    if (!emailType || !destEmail) {
      Toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      Toast.info('Envoi du test en cours...');

      const testData = {
        emailType: emailType,
        client: {
          email: destEmail,
          prenom: 'Test',
          nom: 'Utilisateur'
        },
        order: {
          reference: 'MP-TEST-000',
          productName: 'Handpan Kurd D3 (test)',
          source: 'custom',
          trackingNumber: 'FR123456789',
          estimatedDelivery: 'Dans 3-5 jours ouvrés'
        },
        payment: {
          amount: 450,
          totalAmount: 1500,
          remainingAmount: 1050,
          isFullPayment: false,
          paymentUrl: null
        }
      };

      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (response.ok) {
        Toast.success(`Email de test "${config[emailType].label}" envoyé à ${destEmail}`);
      } else {
        const err = await response.json().catch(() => ({}));
        Toast.error(`Erreur: ${err.error || 'Échec envoi'}`);
      }
    } catch (err) {
      console.error('Erreur test email:', err);
      Toast.error('Erreur réseau');
    }
  }

  /**
   * Vérifie si un type d'email automatique est activé
   */
  function isEmailAutomationEnabled(emailType) {
    const config = getEmailConfig();
    return config[emailType]?.enabled !== false;
  }

  // ============================================================================
  // GAMMES MANAGEMENT
  // ============================================================================

  function renderGammes() {
    const container = $('#gammes-list');
    if (!container) return;

    if (typeof MistralGammes === 'undefined') {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Module gammes non chargé</p>';
      return;
    }

    const gammes = MistralGammes.getAll();
    if (gammes.length === 0) {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Aucune gamme configurée</p>';
      return;
    }

    const CATEGORIES = MistralGammes.CATEGORIES;
    let html = '';
    gammes.forEach(g => {
      const statusBadge = g.disponible
        ? '<span style="color: var(--color-success, #4A7C59); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';
      const configBadge = g.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';
      const catLabel = CATEGORIES[g.categorie] ? CATEGORIES[g.categorie].label : g.categorie;

      html += `
        <div class="materiau-card" style="background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                ${escapeHtml(g.nom)}
                <code style="background: var(--admin-surface-hover); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.75rem;">${g.code}</code>
              </div>
              <div style="font-size: 0.85rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                ${escapeHtml(catLabel)} · ${g.baseRoot || '?'}${g.baseOctave || ''} · ${g.mode || '?'}
              </div>
            </div>
          </div>
          ${g.mood ? `<p style="font-size: 0.8rem; color: var(--admin-text-muted); margin: 0.25rem 0; font-style: italic;">${escapeHtml(g.mood)}</p>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--admin-border);">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${statusBadge}
              ${configBadge}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="admin-btn admin-btn--sm admin-btn--secondary" onclick="AdminUI.editGamme('${g.id}')" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" onclick="AdminUI.deleteGamme('${g.id}')" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  function editGamme(id) {
    if (typeof MistralGammes === 'undefined') return;
    const gamme = MistralGammes.getById(id);
    if (!gamme) return;

    $('#modal-gamme-title').textContent = 'Modifier la gamme';
    $('#gamme-id').value = gamme.id;
    $('#gamme-code').value = gamme.code || '';
    $('#gamme-nom').value = gamme.nom || '';
    $('#gamme-categorie').value = gamme.categorie || 'autre';
    $('#gamme-mode').value = gamme.mode || 'aeolian';
    $('#gamme-baseroot').value = gamme.baseRoot || '';
    $('#gamme-baseoctave').value = gamme.baseOctave || 3;
    $('#gamme-ordre').value = gamme.ordre || 1;
    $('#gamme-description').value = gamme.description || '';
    $('#gamme-mood').value = gamme.mood || '';
    $('#gamme-disponible').checked = gamme.disponible !== false;
    $('#gamme-visible-config').checked = gamme.visible_configurateur || false;

    AdminUI.showModal('gamme');
  }

  function saveGamme() {
    if (typeof MistralGammes === 'undefined') {
      Toast.error('Module gammes non chargé');
      return;
    }

    const id = $('#gamme-id')?.value;
    const code = $('#gamme-code')?.value?.toLowerCase().trim();
    const nom = $('#gamme-nom')?.value?.trim();

    if (!code || !nom) {
      Toast.error('Le code et le nom sont requis');
      return;
    }

    const existing = MistralGammes.getByCode(code);
    if (existing && existing.id !== id) {
      Toast.error(`Le code "${code}" existe déjà`);
      return;
    }

    const gamme = {
      id: id || null,
      code: code,
      nom: nom,
      categorie: $('#gamme-categorie')?.value || 'autre',
      mode: $('#gamme-mode')?.value || 'aeolian',
      baseRoot: $('#gamme-baseroot')?.value?.trim() || '',
      baseOctave: parseInt($('#gamme-baseoctave')?.value) || 3,
      ordre: parseInt($('#gamme-ordre')?.value) || 1,
      description: $('#gamme-description')?.value?.trim() || '',
      mood: $('#gamme-mood')?.value?.trim() || '',
      disponible: $('#gamme-disponible')?.checked,
      visible_configurateur: $('#gamme-visible-config')?.checked
    };

    MistralGammes.save(gamme);
    AdminUI.closeModal('gamme');
    renderGammes();
    Toast.success(id ? 'Gamme modifiée' : 'Gamme créée');
  }

  async function deleteGamme(id) {
    if (typeof MistralGammes === 'undefined') return;
    const gamme = MistralGammes.getById(id);
    if (!gamme) return;

    const confirmed = await Confirm.show({
      title: 'Supprimer la gamme',
      message: `Voulez-vous vraiment supprimer "${gamme.nom}" (${gamme.code}) ?`,
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralGammes.remove(id);
      renderGammes();
      Toast.success('Gamme supprimée');
    }
  }

  async function resetGammes() {
    if (typeof MistralGammes === 'undefined') return;
    const confirmed = await Confirm.show({
      title: 'Réinitialiser les gammes',
      message: 'Ceci remplacera toutes les gammes par les valeurs par défaut. Continuer ?',
      confirmText: 'Réinitialiser',
      type: 'warning'
    });
    if (confirmed) {
      MistralGammes.reset();
      renderGammes();
      Toast.success('Gammes réinitialisées');
    }
  }

  // ============================================================================
  // GAMMES SEARCHABLE SELECT (for instrument form)
  // ============================================================================

  function populateGammesSelect(selectedCode = '') {
    const searchInput = $('#instrument-gamme-search');
    const hiddenInput = $('#instrument-gamme');
    if (!searchInput || !hiddenInput) return;

    if (selectedCode && typeof MistralGammes !== 'undefined') {
      const gamme = MistralGammes.getByCode(selectedCode);
      if (gamme) {
        searchInput.value = gamme.nom;
        hiddenInput.value = gamme.code;
      }
    } else {
      searchInput.value = '';
      hiddenInput.value = '';
    }
  }

  function filterGammeDropdown(query) {
    const dropdown = $('#instrument-gamme-dropdown');
    const hiddenInput = $('#instrument-gamme');
    if (!dropdown) return;

    if (typeof MistralGammes === 'undefined') {
      dropdown.innerHTML = '<div class="searchable-dropdown__empty">Module gammes non chargé</div>';
      dropdown.style.display = 'block';
      return;
    }

    const gammes = MistralGammes.getDisponibles();
    const q = (query || '').toLowerCase();
    const filtered = q
      ? gammes.filter(g =>
          g.nom.toLowerCase().includes(q) ||
          g.code.toLowerCase().includes(q) ||
          (g.categorie && g.categorie.toLowerCase().includes(q)) ||
          (g.mood && g.mood.toLowerCase().includes(q))
        )
      : gammes;

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="searchable-dropdown__empty">Aucune gamme trouvée</div>';
    } else {
      const CATEGORIES = MistralGammes.CATEGORIES;
      // Group by category
      const grouped = {};
      filtered.forEach(g => {
        const cat = g.categorie || 'autre';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(g);
      });

      let html = '';
      for (const [cat, items] of Object.entries(grouped)) {
        const catLabel = CATEGORIES[cat] ? CATEGORIES[cat].label : cat;
        html += `<div class="searchable-dropdown__category">${escapeHtml(catLabel)}</div>`;
        items.forEach(g => {
          const configIcon = g.visible_configurateur ? ' ⚙' : '';
          html += `<div class="searchable-dropdown__item" data-code="${g.code}">
            <strong>${escapeHtml(g.nom)}</strong>${configIcon}
            <span style="color: var(--admin-text-muted); font-size: 0.8rem; margin-left: 0.5rem;">${g.baseRoot || ''}${g.baseOctave || ''} · ${g.mode || ''}</span>
          </div>`;
        });
      }
      dropdown.innerHTML = html;
    }

    dropdown.style.display = 'block';

    // Click handler for items
    dropdown.onclick = function(e) {
      const item = e.target.closest('.searchable-dropdown__item');
      if (item) {
        const code = item.dataset.code;
        const gamme = MistralGammes.getByCode(code);
        if (gamme) {
          $('#instrument-gamme-search').value = gamme.nom;
          hiddenInput.value = gamme.code;
          dropdown.style.display = 'none';
          if (AdminUI.updateInstrumentReference) AdminUI.updateInstrumentReference();
        }
      }
    };
  }

  // Close gamme dropdown on outside click
  document.addEventListener('click', function(e) {
    const dropdown = $('#instrument-gamme-dropdown');
    if (dropdown && !e.target.closest('#instrument-gamme-search') && !e.target.closest('#instrument-gamme-dropdown')) {
      dropdown.style.display = 'none';
    }
  });

  // ============================================================================
  // TAILLES MANAGEMENT
  // ============================================================================

  function renderTailles() {
    const container = $('#tailles-list');
    if (!container) return;

    if (typeof MistralTailles === 'undefined') {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Module tailles non chargé</p>';
      return;
    }

    const tailles = MistralTailles.getAll();
    if (tailles.length === 0) {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Aucune taille configurée</p>';
      return;
    }

    let html = '';
    tailles.forEach(t => {
      const statusBadge = t.disponible
        ? '<span style="color: var(--color-success, #4A7C59); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';
      const configBadge = t.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';
      const malusDisplay = t.prix_malus > 0
        ? `<span style="color: var(--color-warning, #F59E0B); font-size: 0.8rem;">+${Math.round(t.prix_malus)} €</span>`
        : '<span style="color: var(--admin-text-muted); font-size: 0.8rem;">Standard</span>';

      html += `
        <div style="background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 600; font-size: 1.1rem;">${escapeHtml(t.label || t.code + ' cm')}</div>
              ${t.description ? `<div style="font-size: 0.85rem; color: var(--admin-text-muted);">${escapeHtml(t.description)}</div>` : ''}
            </div>
            ${malusDisplay}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--admin-border);">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${statusBadge}
              ${configBadge}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="admin-btn admin-btn--sm admin-btn--secondary" onclick="AdminUI.editTaille('${t.id}')" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" onclick="AdminUI.deleteTaille('${t.id}')" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  function editTaille(id) {
    if (typeof MistralTailles === 'undefined') return;
    const taille = MistralTailles.getById(id);
    if (!taille) return;

    $('#modal-taille-title').textContent = 'Modifier la taille';
    $('#taille-id').value = taille.id;
    $('#taille-code').value = taille.code || '';
    $('#taille-label').value = taille.label || '';
    $('#taille-prix-malus').value = taille.prix_malus || 0;
    $('#taille-description').value = taille.description || '';
    $('#taille-ordre').value = taille.ordre || 1;
    $('#taille-disponible').checked = taille.disponible !== false;
    $('#taille-visible-config').checked = taille.visible_configurateur !== false;

    AdminUI.showModal('taille');
  }

  function saveTaille() {
    if (typeof MistralTailles === 'undefined') {
      Toast.error('Module tailles non chargé');
      return;
    }

    const id = $('#taille-id')?.value;
    const code = $('#taille-code')?.value?.trim();
    if (!code) {
      Toast.error('Le code est requis');
      return;
    }

    const existing = MistralTailles.getByCode(code);
    if (existing && existing.id !== id) {
      Toast.error(`Le code "${code}" existe déjà`);
      return;
    }

    const taille = {
      id: id || null,
      code: code,
      label: $('#taille-label')?.value?.trim() || code + ' cm',
      prix_malus: parseFloat($('#taille-prix-malus')?.value) || 0,
      description: $('#taille-description')?.value?.trim() || '',
      ordre: parseInt($('#taille-ordre')?.value) || 1,
      disponible: $('#taille-disponible')?.checked,
      visible_configurateur: $('#taille-visible-config')?.checked
    };

    // Preserve feasibility data if editing
    if (id) {
      const existingTaille = MistralTailles.getById(id);
      if (existingTaille && existingTaille.feasibility) {
        taille.feasibility = existingTaille.feasibility;
      }
    }

    MistralTailles.save(taille);
    AdminUI.closeModal('taille');
    renderTailles();
    Toast.success(id ? 'Taille modifiée' : 'Taille créée');
  }

  async function deleteTaille(id) {
    if (typeof MistralTailles === 'undefined') return;
    const taille = MistralTailles.getById(id);
    if (!taille) return;

    const confirmed = await Confirm.show({
      title: 'Supprimer la taille',
      message: `Voulez-vous vraiment supprimer "${taille.label}" ?`,
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralTailles.remove(id);
      renderTailles();
      Toast.success('Taille supprimée');
    }
  }

  async function resetTailles() {
    if (typeof MistralTailles === 'undefined') return;
    const confirmed = await Confirm.show({
      title: 'Réinitialiser les tailles',
      message: 'Ceci remplacera toutes les tailles par les valeurs par défaut (45, 50, 53 cm). Continuer ?',
      confirmText: 'Réinitialiser',
      type: 'warning'
    });
    if (confirmed) {
      MistralTailles.reset();
      renderTailles();
      Toast.success('Tailles réinitialisées');
    }
  }

  function populateTaillesSelect(selectedCode = '53') {
    const select = $('#instrument-taille');
    if (!select) return;

    if (typeof MistralTailles !== 'undefined') {
      select.innerHTML = MistralTailles.toSelectOptions(selectedCode);
    } else {
      select.innerHTML = `
        <option value="45" ${selectedCode === '45' ? 'selected' : ''}>45 cm</option>
        <option value="50" ${selectedCode === '50' ? 'selected' : ''}>50 cm</option>
        <option value="53" ${selectedCode === '53' ? 'selected' : ''}>53 cm</option>
      `;
    }
  }

  // ── Collapsible config sections ──────────────────────────────────────────

  const CONFIG_SECTIONS_KEY = 'mistral_config_sections';

  function getConfigSectionsState() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_SECTIONS_KEY)) || {};
    } catch { return {}; }
  }

  function saveConfigSectionsState(state) {
    localStorage.setItem(CONFIG_SECTIONS_KEY, JSON.stringify(state));
  }

  function toggleConfigSection(name) {
    const header = $(`#config-body-${name}`)?.previousElementSibling;
    const body = $(`#config-body-${name}`);
    if (!header || !body) return;

    const isCollapsed = body.classList.contains('collapsed');
    header.classList.toggle('collapsed', !isCollapsed);
    body.classList.toggle('collapsed', !isCollapsed);

    const state = getConfigSectionsState();
    state[name] = isCollapsed; // true = open
    saveConfigSectionsState(state);
  }

  function initConfigSections() {
    const state = getConfigSectionsState();
    const sections = ['materiaux', 'gammes', 'tailles', 'entreprise', 'tarifs', 'tarification', 'emails', 'donnees'];
    sections.forEach(name => {
      const header = $(`#config-body-${name}`)?.previousElementSibling;
      const body = $(`#config-body-${name}`);
      if (!header || !body) return;

      if (state[name] !== undefined) {
        // Restore persisted state
        header.classList.toggle('collapsed', !state[name]);
        body.classList.toggle('collapsed', !state[name]);
      }
      // else: keep the HTML default (collapsed for wide cards, open for small ones)
    });
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    renderConfiguration,
    saveConfig,
    exportAllData,
    importData,
    resetAllData,
    renderMateriaux,
    editMateriau,
    saveMateriau,
    deleteMateriau,
    resetMateriaux,
    populateMateriauxSelect,
    renderGammes,
    editGamme,
    saveGamme,
    deleteGamme,
    resetGammes,
    populateGammesSelect,
    filterGammeDropdown,
    renderTailles,
    editTaille,
    saveTaille,
    deleteTaille,
    resetTailles,
    populateTaillesSelect,
    renderEmailAutomations,
    saveEmailConfig,
    testEmailAutomation,
    onEmailToggle,
    isEmailAutomationEnabled,
    getEmailConfig,
    toggleConfigSection,
    initConfigSections
  });

  console.log('[admin-ui-config] Module chargé');

})(window);
