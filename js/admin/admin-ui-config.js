/**
 * =============================================================================
 * MISTRAL PANS - Admin UI - Module Configuration
 * =============================================================================
 *
 * Ce module gere l'onglet "Configuration" du panneau d'administration.
 * Il regroupe toutes les fonctionnalites de parametrage du site :
 *
 * - Configuration generale (entreprise, tarifs, tarification configurateur)
 * - Export / Import des donnees (JSON)
 * - Gestion des materiaux (CRUD complet via MistralMateriaux)
 * - Gestion des gammes musicales (CRUD, patterns, lots/batches)
 * - Gestion des tailles de handpan (CRUD, faisabilite)
 * - Configuration des emails automatiques (activation, sujets, tests)
 * - Sections repliables avec persistance d'etat (localStorage)
 *
 * Dependances :
 * - window.AdminUI           (admin-ui-core.js) — objet parent pour l'export
 * - window.AdminUIHelpers    (admin-ui-core.js) — $, $$, escapeHtml, Toast, Confirm, etc.
 * - window.MistralGestion    (gestion.js)       — config entreprise et tarifs
 * - window.MistralMateriaux  (materiaux-data.js) — CRUD materiaux
 * - window.MistralGammes     (gammes-data.js)   — CRUD gammes, patterns, lots
 * - window.MistralTailles    (tailles-data.js)  — CRUD tailles
 * - window.MistralScales     (scales-data.js)   — donnees statiques patterns (import)
 * - window.MistralSync       (supabase-sync.js) — lecture/ecriture config emails
 *
 * Export : toutes les fonctions sont rattachees a window.AdminUI via Object.assign
 *
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ===========================================================================
  // GARDE D'INITIALISATION
  // ===========================================================================

  /**
   * Verifie que AdminUI est disponible avant de charger ce module.
   * Si AdminUI n'est pas encore defini (chargement asynchrone), le module
   * s'arrete immediatement et un warning est emis en mode debug.
   */
  if (typeof window.AdminUI === 'undefined') {
    if (window.MISTRAL_DEBUG) console.warn('[admin-ui-config] AdminUI non disponible, module différé');
    return;
  }

  // ===========================================================================
  // IMPORTS DES HELPERS
  // ===========================================================================

  /**
   * Destructuration des utilitaires partages depuis AdminUIHelpers :
   * - $       : raccourci pour document.querySelector
   * - $$      : raccourci pour document.querySelectorAll
   * - escapeHtml : echappe les caracteres HTML pour eviter les XSS
   * - Toast   : systeme de notifications (success, error, info)
   * - Confirm : boite de dialogue de confirmation asynchrone
   * - Modal   : gestion des modales (show/close)
   * - Storage : abstraction localStorage
   * - CONFIG  : constantes globales admin (TODO_KEY, etc.)
   */
  const { $, $$, escapeHtml, Toast, Confirm, Modal, Storage, CONFIG } = window.AdminUIHelpers;


  // ===========================================================================
  // CONFIGURATION GENERALE (ENTREPRISE + TARIFS)
  // ===========================================================================

  /**
   * Affiche les valeurs de configuration dans les champs du formulaire.
   *
   * Lit la configuration depuis MistralGestion et remplit les inputs HTML
   * correspondants. Deux groupes de champs :
   * 1. Informations entreprise (nom, SIRET, email, telephone)
   * 2. Tarification configurateur (prix par note, bonus octave 2, bottoms,
   *    malus difficulte warning/difficile)
   *
   * Chaque champ est protege par un guard (if($('#...'))) pour eviter
   * les erreurs si le DOM n'est pas encore pret ou si la section est masquee.
   */
  function renderConfiguration() {
    if (typeof MistralGestion !== 'undefined') {
      const config = MistralGestion.getConfig();
      const entreprise = MistralGestion.CONFIG.ENTREPRISE;

      // Remplir les champs
      if ($('#config-nom')) $('#config-nom').value = entreprise.marque || '';
      if ($('#config-siret')) $('#config-siret').value = entreprise.siret || '';
      if ($('#config-email')) $('#config-email').value = entreprise.email || '';
      if ($('#config-tel')) $('#config-tel').value = entreprise.telephone || '';
      if ($('#config-loyer')) $('#config-loyer').value = config.loyerMensuel || 60;
      if ($('#config-caution')) $('#config-caution').value = config.montantCaution || 1150;
      if ($('#config-frais')) $('#config-frais').value = config.fraisDossierTransport || 100;
      if ($('#config-colissimo')) $('#config-colissimo').value = config.fraisExpeditionColissimo || 50;
      if ($('#config-acompte')) $('#config-acompte').value = config.tauxAcompte || 30;
      if ($('#config-fidelite')) $('#config-fidelite').value = config.creditFidelitePourcent || 50;

      // Tarification configurateur
      if ($('#config-prix-note')) $('#config-prix-note').value = config.prixParNote || 115;
      if ($('#config-bonus-octave2')) $('#config-bonus-octave2').value = config.bonusOctave2 || 50;
      if ($('#config-bonus-bottoms')) $('#config-bonus-bottoms').value = config.bonusBottoms || 25;
      if ($('#config-malus-warning')) $('#config-malus-warning').value = config.malusDifficulteWarning || 5;
      if ($('#config-malus-difficile')) $('#config-malus-difficile').value = config.malusDifficulteDifficile || 10;
    }
  }

  /**
   * Sauvegarde la configuration depuis les champs du formulaire vers MistralGestion.
   *
   * Lit les valeurs des inputs HTML et les persiste via MistralGestion.setConfigValue().
   * Trois groupes de donnees sont sauvegardes :
   * 1. Informations entreprise (objet ENTREPRISE complet)
   * 2. Tarifs location/gestion (loyer, caution, frais, fidelite)
   * 3. Tarification configurateur (prix/note, bonus, malus)
   *
   * Les valeurs numeriques sont parsees avec parseFloat() et ont des fallbacks
   * par defaut en cas de valeur invalide ou vide.
   */
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
      MistralGestion.setConfigValue('loyerMensuel', parseFloat($('#config-loyer')?.value) || 60);
      MistralGestion.setConfigValue('montantCaution', parseFloat($('#config-caution')?.value) || 1150);
      MistralGestion.setConfigValue('fraisDossierTransport', parseFloat($('#config-frais')?.value) || 100);
      MistralGestion.setConfigValue('fraisExpeditionColissimo', parseFloat($('#config-colissimo')?.value) || 50);
      MistralGestion.setConfigValue('tauxAcompte', parseFloat($('#config-acompte')?.value) || 30);
      MistralGestion.setConfigValue('creditFidelitePourcent', parseFloat($('#config-fidelite')?.value) || 50);

      // Tarification configurateur
      MistralGestion.setConfigValue('prixParNote', parseFloat($('#config-prix-note')?.value) || 115);
      MistralGestion.setConfigValue('bonusOctave2', parseFloat($('#config-bonus-octave2')?.value) || 50);
      MistralGestion.setConfigValue('bonusBottoms', parseFloat($('#config-bonus-bottoms')?.value) || 25);
      MistralGestion.setConfigValue('malusDifficulteWarning', parseFloat($('#config-malus-warning')?.value) || 5);
      MistralGestion.setConfigValue('malusDifficulteDifficile', parseFloat($('#config-malus-difficile')?.value) || 10);

      // Publier les tarifs dans namespace=configurateur (public read via RLS)
      publishTarifsPublics();
    }
    Toast.success('Configuration enregistrée');
  }

  /**
   * Publie un snapshot des tarifs dans namespace=configurateur.
   * La RLS autorise la lecture publique sur ce namespace,
   * contrairement à namespace=gestion (admin-only, protège IBAN/BIC).
   */
  async function publishTarifsPublics() {
    if (!window.MistralDB) { console.warn('[Config] MistralDB non disponible — tarifs publics non publiés'); return; }
    const client = MistralDB.getClient();
    if (!client) { console.warn('[Config] Supabase client non initialisé — tarifs publics non publiés'); return; }

    const config = MistralGestion.getConfig();
    const tarifs = {
      prixParNote: config.prixParNote,
      bonusOctave2: config.bonusOctave2,
      bonusBottoms: config.bonusBottoms,
      malusDifficulteWarning: config.malusDifficulteWarning,
      malusDifficulteDifficile: config.malusDifficulteDifficile,
      loyerMensuel: config.loyerMensuel,
      montantCaution: config.montantCaution,
      fraisDossierTransport: config.fraisDossierTransport,
      fraisExpeditionColissimo: config.fraisExpeditionColissimo,
      tauxAcompte: config.tauxAcompte,
      creditFidelitePourcent: config.creditFidelitePourcent
    };

    try {
      await client
        .from('configuration')
        .upsert({
          key: 'tarifs_publics',
          value: JSON.stringify(tarifs),
          namespace: 'configurateur',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key,namespace' });
      console.log('[Config] Tarifs publics publiés');
    } catch (err) {
      console.error('[Config] Erreur publication tarifs publics:', err);
    }
  }

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================

  /**
   * Exporte toutes les donnees de gestion au format JSON.
   *
   * Delegue a MistralGestion.DataManager.downloadExport() qui genere
   * un fichier JSON telecharge automatiquement par le navigateur.
   * Contient : clients, instruments, commandes, locations, factures, config.
   */
  function exportAllData() {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.DataManager.downloadExport();
      Toast.success('Export téléchargé');
    }
  }

  /**
   * Importe des donnees depuis un fichier JSON.
   *
   * Processus :
   * 1. Lecture du fichier via FileReader (readAsText)
   * 2. Parsing JSON du contenu
   * 3. Demande de confirmation a l'utilisateur (action destructive)
   * 4. Import via MistralGestion.DataManager.importAll()
   * 5. Rafraichissement complet de l'interface admin
   *
   * @param {File} file - Fichier JSON selectionne par l'utilisateur via <input type="file">
   */
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

  /**
   * Reinitialise toutes les donnees de l'application.
   *
   * Action destructive et irreversible :
   * - Supprime toutes les donnees MistralGestion (clients, instruments, etc.)
   * - Vide la liste de todos admin
   * - Recharge la page apres 1 seconde pour repartir de zero
   *
   * Une confirmation de type "danger" est requise avant execution.
   */
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
  // GESTION DES MATERIAUX
  // ============================================================================

  /**
   * Affiche la liste des materiaux dans le conteneur #materiaux-list.
   *
   * Pour chaque materiau, genere une carte HTML contenant :
   * - Apercu couleur (pastille coloree)
   * - Nom, code, nom court
   * - Badge de statut (Disponible / Indisponible)
   * - Badge "Configurateur" si visible dans le configurateur public
   * - Malus de prix (en pourcentage) ou "Inclus" si 0
   * - Description tronquee a 100 caracteres
   * - Boutons d'edition et de suppression
   *
   * Les donnees proviennent du module MistralMateriaux.
   * Si le module n'est pas charge, un message d'erreur est affiche.
   */
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
      /** Badge indiquant si le materiau est disponible ou non */
      const statusBadge = mat.disponible
        ? '<span style="color: var(--color-success, #3D6B4A); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';

      /** Badge indiquant si le materiau est visible dans le configurateur public */
      const configBadge = mat.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';

      /** Pastille de couleur representant visuellement le materiau */
      const colorPreview = mat.couleur
        ? `<span style="display: inline-block; width: 16px; height: 16px; background: ${mat.couleur}; border-radius: 3px; vertical-align: middle; margin-right: 0.5rem; border: 1px solid rgba(0,0,0,0.1);"></span>`
        : '';

      /** Affichage du malus de prix : pourcentage supplementaire ou "Inclus" */
      const prixMalusDisplay = mat.prix_malus > 0
        ? `<span style="color: var(--color-warning, #D97706); font-size: 0.8rem;">+${mat.prix_malus}%</span>`
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
              <button class="admin-btn admin-btn--sm admin-btn--secondary" data-action="edit-materiau" data-id="${mat.id}" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete-materiau" data-id="${mat.id}" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * Initialise la synchronisation bidirectionnelle entre le color picker
   * et le champ texte hexadecimal pour la couleur d'un materiau.
   *
   * - Quand le picker change, le champ texte est mis a jour
   * - Quand le champ texte contient une couleur hex valide (#RRGGBB),
   *   le picker est mis a jour en retour
   */
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

  /**
   * Remplit le <select> des materiaux dans le formulaire instrument.
   *
   * Utilise MistralMateriaux.toSelectOptions() si le module est disponible,
   * sinon affiche un fallback statique avec les 3 materiaux par defaut
   * (NS = Acier nitrure, ES = Ember Steel, SS = Inox).
   *
   * @param {string} [selectedCode='NS'] - Code du materiau a pre-selectionner
   */
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

  /**
   * Ouvre la modale d'edition d'un materiau existant.
   *
   * Recupere le materiau par son ID depuis MistralMateriaux, remplit
   * tous les champs du formulaire (code, nom, couleur, prix_malus, etc.),
   * initialise la sync couleur picker/texte, puis affiche la modale.
   *
   * @param {string} id - Identifiant unique du materiau a editer
   */
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

  /**
   * Sauvegarde un materiau (creation ou modification).
   *
   * Validation :
   * - Le code et le nom sont obligatoires
   * - Le code est converti en majuscules et trim
   * - Verification de duplicat de code (sauf pour le materiau en cours d'edition)
   *
   * Apres sauvegarde via MistralMateriaux.save(), ferme la modale,
   * rafraichit la liste et affiche un toast de confirmation.
   */
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

  /**
   * Supprime un materiau apres confirmation utilisateur.
   *
   * Affiche une boite de dialogue de confirmation de type "danger"
   * avec le nom et le code du materiau. Si confirme, supprime via
   * MistralMateriaux.remove() et rafraichit la liste.
   *
   * @param {string} id - Identifiant unique du materiau a supprimer
   */
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

  /**
   * Reinitialise tous les materiaux aux valeurs par defaut.
   *
   * Les valeurs par defaut sont : NS (Acier nitrure), ES (Ember Steel), SS (Inox).
   * Une confirmation de type "warning" est requise avant execution.
   */
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

  /**
   * Definitions par defaut des emails automatiques du systeme.
   *
   * Chaque cle represente un type d'email avec sa configuration :
   * - id          : identifiant unique
   * - label       : nom affiche dans l'interface admin
   * - description : explication du declencheur
   * - trigger     : condition de declenchement (lisible)
   * - enabled     : etat d'activation par defaut
   * - subject     : objet de l'email (supporte les variables {reference}, {prenom}, etc.)
   * - replyTo     : adresse de reponse par defaut
   * - serverSide  : si true, gere cote serveur (webhook) et toujours actif,
   *                 non modifiable depuis l'admin
   *
   * Types d'emails :
   * - balance_request        : demande de solde quand l'instrument est pret
   * - shipping_notification  : notification d'expedition
   * - new_order_notification : alerte artisan a la reception d'une commande (serveur)
   * - payment_confirmation   : confirmation de paiement au client (serveur)
   */
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

  /** Cle de stockage pour la configuration des emails automatiques (MistralSync / localStorage) */
  const EMAIL_CONFIG_KEY = 'mistral_email_automations';

  /**
   * Recupere la configuration des emails automatiques.
   *
   * Strategie de lecture a deux niveaux :
   * 1. MistralSync (memoire + Supabase) si disponible et si la cle est geree
   * 2. localStorage en fallback
   *
   * Les valeurs stockees sont fusionnees (merge) avec les defauts de
   * EMAIL_AUTOMATIONS_DEFAULTS pour garantir que toutes les cles existent,
   * meme si de nouveaux types d'emails sont ajoutes dans le code.
   *
   * @returns {Object} Configuration complete des emails, cles = types d'email
   */
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

  /**
   * Sauvegarde la configuration des emails automatiques.
   *
   * Lit les valeurs actuelles des champs du formulaire (enabled, subject, replyTo)
   * pour chaque type d'email, puis persiste via :
   * - MistralSync (memoire + Supabase) si disponible
   * - localStorage en fallback
   */
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

  /**
   * Affiche la liste des emails automatiques dans le conteneur #email-automations-list.
   *
   * Pour chaque type d'email, genere une carte contenant :
   * - Label et badge d'etat (Actif/Inactif ou "Serveur — toujours actif")
   * - Description et declencheur
   * - Toggle on/off pour les emails cote client (non serverSide)
   * - Icone serveur pour les emails geres par webhook
   * - Champs editables : objet de l'email et adresse reply-to
   * - Indication des variables disponibles ({reference}, {prenom}, {produit})
   *
   * Les emails serverSide ont leurs champs desactives (disabled) car ils sont
   * geres par les Netlify Functions (webhooks PayPlug).
   * Les emails client desactives ont leur section de details grisee (opacity 0.5).
   */
  function renderEmailAutomations() {
    const container = $('#email-automations-list');
    if (!container) return;

    const config = getEmailConfig();
    let html = '';

    for (const [key, emailConf] of Object.entries(config)) {
      /** Determine si l'email est gere cote serveur (webhook) */
      const isServer = emailConf.serverSide;
      /** Couleur du badge selon le type et l'etat d'activation */
      const badgeBg = isServer ? 'var(--admin-accent, #0D7377)' : (emailConf.enabled ? 'var(--color-success, #3D6B4A)' : 'var(--admin-text-muted)');
      /** Texte du badge d'etat */
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
                <input type="checkbox" id="email-auto-${key}-enabled" ${emailConf.enabled ? 'checked' : ''} data-action="on-email-toggle" data-param="${key}" data-on="change">
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

  /**
   * Callback appele lors du toggle on/off d'un email automatique.
   *
   * Met a jour visuellement en temps reel :
   * - Le texte et la couleur du badge (Actif vert / Inactif gris)
   * - L'opacite et l'interactivite de la section de details
   *
   * Note : cette fonction ne persiste pas le changement. Il faut appeler
   * saveEmailConfig() pour sauvegarder.
   *
   * @param {string} key - Identifiant du type d'email (ex: 'balance_request')
   * @param {boolean} enabled - Nouvel etat d'activation
   */
  function onEmailToggle(key, enabled) {
    const badge = $(`#email-auto-${key}-badge`);
    const details = $(`#email-auto-${key}-details`);
    if (badge) {
      badge.textContent = enabled ? 'Actif' : 'Inactif';
      badge.style.background = enabled ? 'var(--color-success, #3D6B4A)' : 'var(--admin-text-muted)';
    }
    if (details) {
      details.style.opacity = enabled ? '1' : '0.5';
      details.style.pointerEvents = enabled ? '' : 'none';
    }
  }

  /**
   * Envoie un email de test pour verifier la configuration.
   *
   * Processus :
   * 1. Filtre les emails actifs et les presente dans un select
   * 2. Affiche une modale de confirmation avec choix du type et de l'adresse
   * 3. Envoie une requete POST vers /.netlify/functions/send-email
   *    avec des donnees de test factices (client Test Utilisateur, commande MP-TEST-000)
   * 4. Affiche le resultat (succes ou erreur)
   *
   * Les donnees de test incluent :
   * - Un client fictif (Test Utilisateur)
   * - Une commande fictive (MP-TEST-000, Handpan Kurd D3)
   * - Un paiement fictif (450/1500 EUR, partiel)
   * - Un numero de suivi fictif (FR123456789)
   */
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

      /** Donnees factices pour le test d'email */
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
   * Verifie si un type d'email automatique est active.
   *
   * Utilise par d'autres modules (ex: admin-ui-gestion.js) pour conditionner
   * l'envoi d'emails lors de changements de statut de commande.
   *
   * @param {string} emailType - Identifiant du type d'email (ex: 'balance_request')
   * @returns {boolean} true si l'email est active, false sinon
   */
  function isEmailAutomationEnabled(emailType) {
    const config = getEmailConfig();
    return config[emailType]?.enabled !== false;
  }

  // ============================================================================
  // GESTION DES GAMMES MUSICALES
  // ============================================================================

  /**
   * Affiche la liste des gammes musicales dans le conteneur #gammes-list.
   *
   * Pour chaque gamme, genere une carte HTML contenant :
   * - Nom et code de la gamme
   * - Categorie (majeur, mineur, exotique, etc.), note de base et mode
   * - Ambiance/mood (texte en italique, optionnel)
   * - Badge de statut (Disponible / Indisponible)
   * - Badge "Configurateur" si visible dans le configurateur public
   * - Badge "Patterns" si des layouts SVG sont configures pour le configurateur
   * - Boutons d'edition et de suppression
   *
   * Les donnees proviennent du module MistralGammes.
   */
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

    /** Dictionnaire des categories disponibles pour l'affichage des labels */
    const CATEGORIES = MistralGammes.CATEGORIES;
    let html = '';
    gammes.forEach(g => {
      const statusBadge = g.disponible
        ? '<span style="color: var(--color-success, #3D6B4A); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';
      const configBadge = g.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';
      /** Verifie si des patterns de layout SVG existent pour cette gamme */
      const hasPatterns = MistralGammes.hasConfiguratorPatterns(g.code);
      const patternBadge = hasPatterns
        ? '<span style="background: var(--color-success, #3D6B4A); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Patterns</span>'
        : '';
      /** Label traduit de la categorie (ou code brut si non reconnu) */
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
              ${patternBadge}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="admin-btn admin-btn--sm admin-btn--secondary" data-action="edit-gamme" data-id="${g.id}" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete-gamme" data-id="${g.id}" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ── Editeur de patterns (layouts SVG pour le configurateur) ────────────

  /**
   * Genere les champs de saisie de patterns pour 9 a 17 notes.
   *
   * Chaque ligne contient :
   * - Un label indiquant le nombre de notes (9, 10, ... 17)
   * - Un input texte pour le pattern au format "Root/-note1-note2-..."
   * - Un badge de validation en temps reel (compte des notes T/B/M)
   * - Un bouton de suppression rapide (x)
   *
   * Les patterns utilisent la notation Mistral Pans :
   * - Notes tonales : nom simple (ex: "D4")
   * - Notes basses (bottoms) : entre parentheses (ex: "(A2)")
   * - Notes mutantes : entre crochets (ex: "[F#3]")
   * - Separateur "/" entre le ding et les notes peripheriques
   *
   * Les inputs sont inseres dans le conteneur #gamme-patterns-container.
   */
  function renderPatternInputs() {
    const container = document.getElementById('gamme-patterns-container');
    if (!container) return;
    let html = '';
    for (let n = 9; n <= 17; n++) {
      html += '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
        '<label style="min-width: 58px; font-size: 0.82rem; font-weight: 500;">' + n + ' notes</label>' +
        '<input type="text" class="admin-form__input" id="gamme-pattern-' + n + '" ' +
          'placeholder="Root/-note1-note2-..." ' +
          'style="flex: 1; font-family: \'JetBrains Mono\', monospace; font-size: 0.82rem;" ' +
          'data-action="validate-pattern" data-param="' + n + '" data-on="input">' +
        '<span id="gamme-pattern-badge-' + n + '" style="font-size: 0.72rem; min-width: 80px; text-align: center;"></span>' +
        '<button type="button" style="background: none; border: none; cursor: pointer; padding: 0.2rem; opacity: 0.5;" ' +
          'data-action="clear-pattern" data-param="' + n + '" ' +
          'title="Effacer">&times;</button>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /**
   * Valide un pattern de layout et met a jour le badge de feedback en temps reel.
   *
   * Algorithme de tokenisation :
   * 1. Extrait la partie apres le "/" (ding exclue)
   * 2. Decoupe en tokens selon les separateurs "-" et " "
   *    - Les parentheses () delimitent les notes basses (bottoms)
   *    - Les crochets [] delimitent les notes mutantes
   *    - Les autres tokens sont des notes tonales
   * 3. Calcule le total : 1 (ding) + tonales + bottoms + mutantes
   * 4. Compare avec le nombre de notes attendu (noteCount)
   *
   * Feedback visuel :
   * - Badge vert si le total correspond au nombre de notes attendu
   * - Badge orange si le total ne correspond pas (warning)
   * - Badge rouge si le format est invalide (pas de "/")
   * - Badge vide si le champ est vide
   *
   * @param {number} noteCount - Nombre de notes attendu (9 a 17)
   */
  function validatePattern(noteCount) {
    const input = document.getElementById('gamme-pattern-' + noteCount);
    const badge = document.getElementById('gamme-pattern-badge-' + noteCount);
    if (!input || !badge) return;

    const pattern = input.value.trim();
    if (!pattern) {
      badge.textContent = '';
      badge.style.color = '';
      input.style.borderColor = '';
      return;
    }

    /** Recherche du separateur "/" entre le ding et les notes peripheriques */
    const slashIndex = pattern.indexOf('/');
    if (slashIndex === -1) {
      badge.textContent = 'Format invalide';
      badge.style.color = 'var(--admin-error, #DC2626)';
      input.style.borderColor = 'var(--admin-error, #DC2626)';
      return;
    }

    /** Extrait la partie notes (apres le "/"), en supprimant le trailing "_" eventuel */
    const notesPart = pattern.substring(slashIndex + 1).replace(/_$/, '');
    let tonals = 0, bottoms = 0, mutants = 0;

    /*
     * Tokenisation du pattern :
     * On parcourt caractere par caractere pour gerer correctement les groupes
     * delimites par () et [] qui peuvent contenir des tirets internes.
     * Les separateurs "-" et " " ne sont actifs que en dehors des groupes.
     */
    const tokens = [];
    let current = '';
    for (let i = 0; i < notesPart.length; i++) {
      const ch = notesPart[i];
      if (ch === '(' || ch === '[') {
        if (current.trim()) tokens.push(current.trim());
        current = ch;
      } else if (ch === ')' || ch === ']') {
        current += ch;
        tokens.push(current.trim());
        current = '';
      } else if ((ch === '-' || ch === ' ') && !current.includes('(') && !current.includes('[')) {
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    /** Classification de chaque token selon son type (tonale, bottom, mutante) */
    tokens.forEach(function(t) {
      if (t.startsWith('(') && t.endsWith(')')) bottoms++;
      else if (t.startsWith('[') && t.endsWith(']')) mutants++;
      else if (t.length > 0) tonals++;
    });

    const total = 1 + tonals + bottoms + mutants; // +1 pour le ding (note centrale)
    const isCorrect = total === noteCount;
    badge.textContent = total + ' (' + tonals + 'T ' + bottoms + 'B ' + mutants + 'M)';
    badge.style.color = isCorrect ? 'var(--color-success, #3D6B4A)' : 'var(--color-warning, #D97706)';
    input.style.borderColor = isCorrect ? 'var(--color-success, #3D6B4A)' : 'var(--color-warning, #D97706)';
  }

  /**
   * Importe les patterns depuis le fichier statique scales-data.js.
   *
   * Permet de pre-remplir les champs de patterns a partir des donnees
   * hardcodees dans MistralScales.SCALES_DATA lorsqu'on edite une gamme
   * dont le code correspond a une entree existante.
   *
   * Importe egalement les baseNotes si le champ est vide.
   *
   * Pre-requis : le champ #gamme-code doit etre rempli avant l'appel.
   * Le code est converti en minuscules pour la recherche dans SCALES_DATA.
   */
  function importPatternsFromScalesData() {
    const code = ($('#gamme-code')?.value || '').trim().toLowerCase();
    if (!code) {
      Toast.error('Renseignez le code de la gamme d\'abord');
      return;
    }
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      const scaleData = MistralScales.SCALES_DATA[code];
      if (scaleData.patterns) {
        for (let n = 9; n <= 17; n++) {
          const input = document.getElementById('gamme-pattern-' + n);
          if (input && scaleData.patterns[n]) {
            input.value = scaleData.patterns[n];
            validatePattern(n);
          }
        }
        // Aussi importer baseNotes
        if (scaleData.baseNotes) {
          const baseNotesInput = document.getElementById('gamme-basenotes');
          if (baseNotesInput && !baseNotesInput.value.trim()) {
            baseNotesInput.value = scaleData.baseNotes.join(', ');
          }
        }
        Toast.success('Patterns importés depuis scales-data.js');
      } else {
        Toast.info('Aucun pattern disponible pour cette gamme dans scales-data.js');
      }
    } else {
      Toast.info('Gamme non trouvée dans scales-data.js (normal pour une nouvelle gamme)');
    }
  }

  // ── CRUD Gammes ────────────────────────────────────────────────────────

  /**
   * Ouvre la modale d'edition d'une gamme existante.
   *
   * Remplit tous les champs du formulaire :
   * - Identite : code, nom, categorie, mode, note de base, octave
   * - Metadonnees : description, mood/ambiance, ordre d'affichage
   * - Flags : disponible, visible dans le configurateur
   * - Notes de base (baseNotes) : liste separee par des virgules
   * - Patterns : un champ par nombre de notes (9 a 17), pre-rempli
   *   depuis MistralGammes.getPattern()
   * - Bouton d'import depuis scales-data.js (visible si des patterns existent)
   *
   * @param {string} id - Identifiant unique de la gamme a editer
   */
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

    // baseNotes
    const baseNotes = MistralGammes.getBaseNotes(gamme.code);
    const baseNotesInput = document.getElementById('gamme-basenotes');
    if (baseNotesInput) baseNotesInput.value = baseNotes.length > 0 ? baseNotes.join(', ') : '';

    // Patterns
    renderPatternInputs();
    for (let n = 9; n <= 17; n++) {
      const input = document.getElementById('gamme-pattern-' + n);
      if (input) {
        const pattern = MistralGammes.getPattern(gamme.code, n);
        input.value = pattern || '';
        validatePattern(n);
      }
    }

    // Import button visibility
    const importBtn = document.getElementById('gamme-import-patterns-btn');
    if (importBtn) {
      const hasScalesData = typeof MistralScales !== 'undefined' &&
        MistralScales.SCALES_DATA[gamme.code] &&
        MistralScales.SCALES_DATA[gamme.code].patterns;
      importBtn.style.display = hasScalesData ? '' : 'none';
    }

    AdminUI.showModal('gamme');
  }

  /**
   * Sauvegarde une gamme (creation ou modification).
   *
   * Validation :
   * - Le code et le nom sont obligatoires
   * - Le code est converti en minuscules et trim
   * - Verification de duplicat de code
   *
   * Collecte des donnees supplementaires :
   * - baseNotes : parse de la liste separee par virgules en tableau
   * - custom_layouts : collecte des patterns non-vides pour chaque nombre de notes (9-17)
   *
   * Apres sauvegarde via MistralGammes.save(), ferme la modale et rafraichit la liste.
   */
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

    // baseNotes
    const baseNotesRaw = ($('#gamme-basenotes')?.value || '').trim();
    const baseNotes = baseNotesRaw ? baseNotesRaw.split(',').map(function(n) { return n.trim(); }).filter(Boolean) : [];

    // custom_layouts : collecte les patterns pour chaque nombre de notes (9-17)
    const customLayouts = {};
    for (let n = 9; n <= 17; n++) {
      const patternInput = document.getElementById('gamme-pattern-' + n);
      if (patternInput) {
        const val = patternInput.value.trim();
        if (val) customLayouts[n] = val;
      }
    }

    const gamme = {
      id: id || null,
      code: code,
      nom: nom,
      categorie: $('#gamme-categorie')?.value || 'autre',
      mode: $('#gamme-mode')?.value || 'aeolian',
      baseRoot: $('#gamme-baseroot')?.value?.trim() || '',
      baseOctave: parseInt($('#gamme-baseoctave')?.value) || 3,
      baseNotes: baseNotes,
      custom_layouts: customLayouts,
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

  /**
   * Supprime une gamme apres confirmation utilisateur.
   *
   * @param {string} id - Identifiant unique de la gamme a supprimer
   */
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

  /**
   * Reinitialise toutes les gammes aux valeurs par defaut.
   *
   * Remplace l'ensemble des gammes par les 12 gammes par defaut definies
   * dans MistralGammes. Confirmation de type "warning" requise.
   */
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
  // GAMMES - SELECT SEARCHABLE (formulaire instrument)
  // ============================================================================

  /**
   * Initialise le select searchable de gammes dans le formulaire instrument.
   *
   * Ce composant utilise un champ texte de recherche (#instrument-gamme-search)
   * couple a un champ cache (#instrument-gamme) qui stocke le code reel.
   * Si un code est fourni, le nom de la gamme correspondante est affiche.
   *
   * @param {string} [selectedCode=''] - Code de la gamme a pre-selectionner
   */
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

  /**
   * Filtre et affiche le dropdown de recherche de gammes.
   *
   * Fonctionnement :
   * 1. Filtre les gammes disponibles selon la requete (nom, code, categorie, mood)
   * 2. Groupe les resultats par categorie pour une navigation plus claire
   * 3. Affiche un icone engrenage pour les gammes visibles dans le configurateur
   * 4. Au clic sur un element, remplit le champ de recherche et le champ cache,
   *    ferme le dropdown et met a jour la reference instrument si disponible
   *
   * @param {string} query - Texte de recherche saisi par l'utilisateur
   */
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
    /** Filtrage multicritere : nom, code, categorie, mood */
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
      // Regroupement par categorie pour un affichage structure
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
          /** Icone engrenage indiquant la visibilite dans le configurateur */
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
          /** Met a jour la reference instrument si la fonction est disponible */
          if (AdminUI.updateInstrumentReference) AdminUI.updateInstrumentReference();
        }
      }
    };
  }

  /**
   * Ferme le dropdown de gammes lors d'un clic a l'exterieur.
   * Ecoute les clics sur tout le document et masque le dropdown si le clic
   * n'est ni sur le champ de recherche ni sur le dropdown lui-meme.
   */
  document.addEventListener('click', function(e) {
    const dropdown = $('#instrument-gamme-dropdown');
    if (dropdown && !e.target.closest('#instrument-gamme-search') && !e.target.closest('#instrument-gamme-dropdown')) {
      dropdown.style.display = 'none';
    }
  });

  // ============================================================================
  // LOTS DE GAMMES (BATCHES / COLLECTIONS)
  // ============================================================================

  /*
   * Un "lot de gammes" (batch) est une collection nommee de gammes
   * qui peut etre publiee pour etre visible dans le configurateur public.
   *
   * Cela permet a l'artisan de preparer des collections thematiques
   * (ex: "Gammes hiver 2026", "Gammes exotiques") et de publier/depublier
   * rapidement l'ensemble des gammes visibles dans la boutique.
   *
   * Un seul lot peut etre publie a la fois. La publication ecrit la liste
   * des codes de gammes dans la config Supabase (namespace=configurateur).
   */

  /**
   * Affiche la liste des lots de gammes dans le conteneur #gamme-batches-list.
   *
   * Pour chaque lot, genere une carte contenant :
   * - Nom du lot et badge "Publie" si c'est le lot actif
   * - Nombre de gammes et leurs noms
   * - Ordre d'affichage
   * - Boutons : Publier/Depublier, Modifier, Supprimer
   *
   * Les lots sont tries par ordre puis par nom.
   * Le lot publie est mis en evidence avec une bordure accent et un box-shadow.
   */
  function renderGammeBatches() {
    const container = $('#gamme-batches-list');
    if (!container) return;

    if (typeof MistralGammes === 'undefined') {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Module gammes non chargé</p>';
      return;
    }

    const batches = MistralGammes.getBatches();

    if (batches.length === 0) {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Aucun lot créé. Créez un lot pour grouper les gammes visibles dans le configurateur.</p>';
      return;
    }

    // Sort by ordre then by nom
    const sorted = [...batches].sort((a, b) => (a.ordre || 99) - (b.ordre || 99) || (a.nom || '').localeCompare(b.nom || ''));

    let html = '';
    sorted.forEach(b => {
      const isPublished = b.published === true;
      const gammeCount = (b.gammes || []).length;
      /** Resolution des codes de gammes vers leurs noms affichables */
      const gammeNames = (b.gammes || []).map(code => {
        const g = MistralGammes.getByCode(code);
        return g ? g.nom : code;
      }).join(', ');

      html += `
        <div style="background: var(--admin-surface); border: 1px solid ${isPublished ? 'var(--admin-accent)' : 'var(--admin-border)'}; border-radius: 8px; padding: 1rem; ${isPublished ? 'box-shadow: 0 0 0 1px var(--admin-accent);' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                ${escapeHtml(b.nom)}
                ${isPublished ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Publié</span>' : ''}
                <span style="font-size: 0.75rem; color: var(--admin-text-muted);">Ordre : ${b.ordre || '—'}</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                ${gammeCount} gamme${gammeCount > 1 ? 's' : ''} : ${gammeNames || '<em>aucune</em>'}
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--admin-border);">
            <div>
              ${isPublished
                ? `<button class="admin-btn admin-btn--sm admin-btn--secondary" data-action="unpublish-gamme-batch" data-id="${b.id}">Dépublier</button>`
                : `<button class="admin-btn admin-btn--sm admin-btn--primary" data-action="publish-gamme-batch" data-id="${b.id}">Publier</button>`
              }
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="admin-btn admin-btn--sm admin-btn--secondary" data-action="edit-gamme-batch" data-id="${b.id}" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete-gamme-batch" data-id="${b.id}" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  /**
   * Ouvre la modale d'edition d'un lot de gammes (creation ou modification).
   *
   * La modale contient :
   * - Nom du lot et ordre d'affichage
   * - Liste de checkboxes pour toutes les gammes disponibles, groupees par categorie
   * - Les gammes non categorisees apparaissent dans un groupe "Autre"
   *
   * @param {string|null} id - Identifiant du lot a editer, ou null/undefined pour creation
   */
  function editGammeBatch(id) {
    if (typeof MistralGammes === 'undefined') return;

    const batch = id ? MistralGammes.getBatches().find(b => b.id === id) : null;

    $('#modal-gamme-batch-title').textContent = batch ? 'Modifier le lot' : 'Nouveau lot de gammes';
    $('#gamme-batch-id').value = batch ? batch.id : '';
    $('#gamme-batch-nom').value = batch ? batch.nom : '';
    $('#gamme-batch-ordre').value = batch ? (batch.ordre || 1) : 1;

    // Render checkboxes for all available gammes
    const allGammes = MistralGammes.getAll();
    const selectedCodes = batch ? (batch.gammes || []) : [];
    const checkboxContainer = $('#gamme-batch-gammes');
    if (checkboxContainer) {
      let html = '';
      /** Gammes groupees par categorie via MistralGammes.getGroupedByCategorie() */
      const grouped = MistralGammes.getGroupedByCategorie();
      for (const [cat, group] of Object.entries(grouped)) {
        html += `<div style="margin-bottom: 0.75rem;">
          <div style="font-weight: 600; font-size: 0.8rem; color: var(--admin-text-muted); text-transform: uppercase; margin-bottom: 0.35rem;">${escapeHtml(group.label)}</div>`;
        group.gammes.forEach(g => {
          const checked = selectedCodes.includes(g.code) ? ' checked' : '';
          html += `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; cursor: pointer;">
            <input type="checkbox" value="${g.code}"${checked}>
            <span>${escapeHtml(g.nom)}</span>
            <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${g.baseRoot || ''}${g.baseOctave || ''}</span>
          </label>`;
        });
        html += '</div>';
      }
      // Also show gammes not in any category
      const ungrouped = allGammes.filter(g => !grouped[g.categorie]);
      if (ungrouped.length > 0) {
        html += '<div style="margin-bottom: 0.75rem;"><div style="font-weight: 600; font-size: 0.8rem; color: var(--admin-text-muted); text-transform: uppercase; margin-bottom: 0.35rem;">Autre</div>';
        ungrouped.forEach(g => {
          const checked = selectedCodes.includes(g.code) ? ' checked' : '';
          html += `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; cursor: pointer;">
            <input type="checkbox" value="${g.code}"${checked}>
            <span>${escapeHtml(g.nom)}</span>
          </label>`;
        });
        html += '</div>';
      }
      checkboxContainer.innerHTML = html;
    }

    AdminUI.showModal('gamme-batch');
  }

  /**
   * Sauvegarde un lot de gammes (creation ou modification).
   *
   * Validation :
   * - Le nom est obligatoire
   * - Au moins une gamme doit etre selectionnee
   *
   * Lors de la modification, l'etat de publication (published) est preserve
   * pour eviter de depublier accidentellement un lot actif.
   */
  function saveGammeBatch() {
    if (typeof MistralGammes === 'undefined') {
      Toast.error('Module gammes non chargé');
      return;
    }

    const id = $('#gamme-batch-id')?.value || '';
    const nom = $('#gamme-batch-nom')?.value?.trim();
    const ordre = parseInt($('#gamme-batch-ordre')?.value, 10) || 1;

    if (!nom) {
      Toast.error('Le nom du lot est requis');
      return;
    }

    // Collecter les gammes cochées
    const checkboxes = document.querySelectorAll('#gamme-batch-gammes input[type="checkbox"]:checked');
    const selectedCodes = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCodes.length === 0) {
      Toast.error('Sélectionnez au moins une gamme');
      return;
    }

    // Preserve published state if editing
    let published = false;
    if (id) {
      const existing = MistralGammes.getBatches().find(b => b.id === id);
      if (existing) published = existing.published === true;
    }

    const batch = {
      id: id || null,
      nom: nom,
      gammes: selectedCodes,
      ordre: ordre,
      published: published
    };

    MistralGammes.saveBatch(batch);
    AdminUI.closeModal('gamme-batch');
    renderGammeBatches();
    Toast.success(id ? 'Lot modifié' : 'Lot créé');
  }

  /**
   * Supprime un lot de gammes apres confirmation utilisateur.
   *
   * @param {string} id - Identifiant unique du lot a supprimer
   */
  async function deleteGammeBatch(id) {
    if (typeof MistralGammes === 'undefined') return;
    const batch = MistralGammes.getBatches().find(b => b.id === id);
    if (!batch) return;

    const confirmed = await Confirm.show({
      title: 'Supprimer le lot',
      message: `Voulez-vous vraiment supprimer le lot "${batch.nom}" ?`,
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralGammes.removeBatch(id);
      renderGammeBatches();
      Toast.success('Lot supprimé');
    }
  }

  /**
   * Publie un lot de gammes pour le rendre visible dans le configurateur public.
   *
   * La publication ecrit la liste des codes de gammes du lot dans la configuration
   * Supabase (namespace=configurateur, cle published_lots). Un seul lot peut etre
   * publie a la fois — la publication d'un nouveau lot depublie automatiquement l'ancien.
   *
   * @param {string} id - Identifiant unique du lot a publier
   */
  async function publishGammeBatch(id) {
    if (typeof MistralGammes === 'undefined') return;

    const success = await MistralGammes.publishBatch(id);
    if (success) {
      renderGammeBatches();
      Toast.success('Lot publié — visible dans le configurateur');
    } else {
      Toast.error('Erreur lors de la publication du lot');
    }
  }

  /**
   * Depublie un lot de gammes (le retire du configurateur public).
   *
   * Apres depublication, aucun lot n'est actif dans le configurateur
   * et les gammes ne sont plus visibles cote public.
   *
   * @param {string} id - Identifiant unique du lot a depublier
   */
  async function unpublishGammeBatch(id) {
    if (typeof MistralGammes === 'undefined') return;

    const success = await MistralGammes.unpublishBatch(id);
    if (success) {
      renderGammeBatches();
      Toast.success('Lot dépublié');
    } else {
      Toast.error('Erreur lors de la dépublication du lot');
    }
  }

  // ============================================================================
  // GESTION DES TAILLES DE HANDPAN
  // ============================================================================

  /**
   * Affiche la liste des tailles dans le conteneur #tailles-list.
   *
   * Pour chaque taille, genere une carte HTML contenant :
   * - Label (ex: "53 cm") et description
   * - Badge de statut (Disponible / Indisponible)
   * - Badge "Configurateur" si visible dans le configurateur public
   * - Malus de prix en euros ou "Standard" si 0
   * - Boutons d'edition et de suppression
   *
   * Les donnees proviennent du module MistralTailles.
   */
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
        ? '<span style="color: var(--color-success, #3D6B4A); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';
      const configBadge = t.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';
      /** Affichage du malus : montant en euros (arrondi) ou "Standard" si 0 */
      const malusDisplay = t.prix_malus > 0
        ? `<span style="color: var(--color-warning, #D97706); font-size: 0.8rem;">+${Math.round(t.prix_malus)} €</span>`
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
              <button class="admin-btn admin-btn--sm admin-btn--secondary" data-action="edit-taille" data-id="${t.id}" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete-taille" data-id="${t.id}" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  /**
   * Ouvre la modale d'edition d'une taille (creation ou modification).
   *
   * Remplit les champs du formulaire :
   * - Code, label, description, prix_malus, ordre
   * - Flags : disponible, visible dans le configurateur
   * - Notes interdites (faisabilite) : liste de notes separees par virgules
   *   qui ne peuvent pas etre jouees sur cette taille de shell
   *
   * @param {string|null} id - Identifiant de la taille a editer, ou null pour creation
   */
  function editTaille(id) {
    if (typeof MistralTailles === 'undefined') return;
    const taille = id ? MistralTailles.getById(id) : null;

    $('#modal-taille-title').textContent = taille ? 'Modifier la taille' : 'Nouvelle taille';
    $('#taille-id').value = taille ? taille.id : '';
    $('#taille-code').value = taille ? (taille.code || '') : '';
    $('#taille-label').value = taille ? (taille.label || '') : '';
    $('#taille-prix-malus').value = taille ? (taille.prix_malus || 0) : 0;
    $('#taille-description').value = taille ? (taille.description || '') : '';
    $('#taille-ordre').value = taille ? (taille.ordre || 1) : 1;
    $('#taille-disponible').checked = taille ? (taille.disponible !== false) : true;
    $('#taille-visible-config').checked = taille ? (taille.visible_configurateur !== false) : true;

    // Notes interdites (faisabilite)
    const forbiddenNotes = (taille && taille.feasibility && taille.feasibility.forbiddenNotes)
      ? taille.feasibility.forbiddenNotes.join(', ')
      : '';
    $('#taille-forbidden-notes').value = forbiddenNotes;

    AdminUI.showModal('taille');
  }

  /**
   * Sauvegarde une taille (creation ou modification).
   *
   * Validation :
   * - Le code est obligatoire
   * - Verification de duplicat de code
   *
   * Gestion de la faisabilite :
   * - Lors de la modification, les donnees de faisabilite existantes sont preservees
   * - Les notes interdites sont parsees depuis le champ texte (liste separee par virgules)
   *   et stockees dans taille.feasibility.forbiddenNotes
   *
   * Les notes interdites definissent quelles notes chromatiques sont physiquement
   * impossibles a accorder sur cette taille de shell (contrainte physique).
   */
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
        taille.feasibility = { ...existingTaille.feasibility };
      }
    }

    // Parse forbidden notes from form field
    const forbiddenRaw = $('#taille-forbidden-notes')?.value?.trim() || '';
    const forbiddenNotes = forbiddenRaw
      ? forbiddenRaw.split(',').map(function(n) { return n.trim(); }).filter(Boolean)
      : [];
    if (!taille.feasibility) taille.feasibility = {};
    taille.feasibility.forbiddenNotes = forbiddenNotes;

    MistralTailles.save(taille);
    AdminUI.closeModal('taille');
    renderTailles();
    Toast.success(id ? 'Taille modifiée' : 'Taille créée');
  }

  /**
   * Supprime une taille apres confirmation utilisateur.
   *
   * @param {string} id - Identifiant unique de la taille a supprimer
   */
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

  /**
   * Reinitialise toutes les tailles aux valeurs par defaut.
   *
   * Les valeurs par defaut sont : 45 cm, 50 cm, 53 cm.
   * Confirmation de type "warning" requise.
   */
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

  /**
   * Remplit le <select> des tailles dans le formulaire instrument.
   *
   * Utilise MistralTailles.toSelectOptions() si le module est disponible,
   * sinon affiche un fallback statique avec les 3 tailles par defaut.
   *
   * @param {string} [selectedCode='53'] - Code de la taille a pre-selectionner
   */
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

  // ============================================================================
  // SECTIONS REPLIABLES (COLLAPSIBLE CONFIG SECTIONS)
  // ============================================================================

  /*
   * Le panneau de configuration contient de nombreuses sections (materiaux,
   * gammes, tailles, entreprise, tarifs, etc.). Pour ameliorer l'ergonomie,
   * chaque section peut etre repliee/depliee. L'etat ouvert/ferme de chaque
   * section est persiste dans localStorage pour etre restaure a la prochaine visite.
   */

  /** Cle localStorage pour la persistance de l'etat des sections repliables */
  const CONFIG_SECTIONS_KEY = 'mistral_config_sections';

  /**
   * Lit l'etat persiste des sections repliables depuis localStorage.
   *
   * @returns {Object} Objet dont les cles sont les noms de sections et
   *                    les valeurs sont des booleens (true = ouvert, false = ferme)
   */
  function getConfigSectionsState() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_SECTIONS_KEY)) || {};
    } catch { return {}; }
  }

  /**
   * Sauvegarde l'etat des sections repliables dans localStorage.
   *
   * @param {Object} state - Objet {nomSection: boolean} representant l'etat de chaque section
   */
  function saveConfigSectionsState(state) {
    localStorage.setItem(CONFIG_SECTIONS_KEY, JSON.stringify(state));
  }

  /**
   * Bascule l'etat ouvert/ferme d'une section de configuration.
   *
   * Fonctionnement :
   * 1. Recupere le header (element precedent) et le body de la section
   * 2. Toggle la classe CSS "collapsed" sur les deux elements
   * 3. Persiste le nouvel etat dans localStorage
   *
   * La convention CSS est : la classe "collapsed" masque le contenu
   * et affiche une fleche fermee sur le header.
   *
   * @param {string} name - Nom de la section (ex: 'materiaux', 'gammes', 'tailles')
   */
  function toggleConfigSection(name) {
    const header = $(`#config-body-${name}`)?.previousElementSibling;
    const body = $(`#config-body-${name}`);
    if (!header || !body) return;

    const isCollapsed = body.classList.contains('collapsed');
    header.classList.toggle('collapsed', !isCollapsed);
    body.classList.toggle('collapsed', !isCollapsed);

    const state = getConfigSectionsState();
    state[name] = isCollapsed; // true = open (on inverse car on part de l'etat precedent)
    saveConfigSectionsState(state);
  }

  /**
   * Initialise l'etat des sections repliables au chargement de la page.
   *
   * Pour chaque section connue, restaure l'etat persiste dans localStorage.
   * Si aucun etat n'est persiste pour une section, l'etat par defaut du HTML
   * est conserve (certaines sections sont ouvertes par defaut, d'autres fermees).
   *
   * Sections gerees : materiaux, gammes, tailles, entreprise, tarifs,
   * tarification, emails, donnees.
   */
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

  // ===========================================================================
  // RÉTENTION DES DONNÉES (RGPD)
  // ===========================================================================

  /** Durées de rétention (en millisecondes) */
  const RETENTION_RULES = {
    clients:   { label: 'Clients',         maxAge: 3 * 365.25 * 24 * 3600 * 1000, dateField: 'derniere_commande', fallbackField: 'created_at' },
    commandes: { label: 'Commandes',       maxAge: 3 * 365.25 * 24 * 3600 * 1000, dateField: 'date',             fallbackField: 'created_at' },
    factures:  { label: 'Factures',        maxAge: 10 * 365.25 * 24 * 3600 * 1000, dateField: 'date',            fallbackField: 'created_at', softDeleteOnly: true },
    teachers:  { label: 'Professeurs (inactifs)', maxAge: 2 * 365.25 * 24 * 3600 * 1000, dateField: 'submitted_at', filter: function (p) { return p.statut === 'pending'; } }
  };

  /**
   * Scanne les données et affiche un rapport de rétention.
   */
  function scanRetention() {
    var now = Date.now();
    var report = [];
    var totalExpired = 0;

    // --- Clients ---
    var clients = (typeof MistralGestion !== 'undefined' && MistralGestion.Clients)
      ? MistralGestion.Clients.getAll()
      : [];
    var expiredClients = clients.filter(function (c) {
      if (c.archived) return false; // déjà archivé
      var dateStr = c.derniere_commande || c.created_at || c.createdAt;
      if (!dateStr) return false;
      var age = now - new Date(dateStr).getTime();
      return age > RETENTION_RULES.clients.maxAge;
    });
    report.push({ entity: 'Clients', total: clients.length, expired: expiredClients.length, maxAge: '3 ans' });
    totalExpired += expiredClients.length;

    // --- Commandes ---
    var commandes = (typeof MistralGestion !== 'undefined' && MistralGestion.Commandes)
      ? MistralGestion.Commandes.getAll()
      : [];
    var expiredCommandes = commandes.filter(function (c) {
      var dateStr = c.date || c.created_at || c.createdAt;
      if (!dateStr) return false;
      var age = now - new Date(dateStr).getTime();
      return age > RETENTION_RULES.commandes.maxAge;
    });
    report.push({ entity: 'Commandes', total: commandes.length, expired: expiredCommandes.length, maxAge: '3 ans' });
    totalExpired += expiredCommandes.length;

    // --- Factures (soft-delete uniquement) ---
    var factures = (typeof MistralGestion !== 'undefined' && MistralGestion.Factures)
      ? MistralGestion.Factures.getAll()
      : [];
    var oldFactures = factures.filter(function (f) {
      var dateStr = f.date || f.created_at || f.createdAt;
      if (!dateStr) return false;
      var age = now - new Date(dateStr).getTime();
      return age > RETENTION_RULES.factures.maxAge;
    });
    report.push({ entity: 'Factures', total: factures.length, expired: oldFactures.length, maxAge: '10 ans', note: 'archivage uniquement' });

    // --- Professeurs en attente ---
    var pendingTeachers = [];
    if (window.MistralSync) {
      pendingTeachers = MistralSync.getData('mistral_pending_teachers') || [];
    }
    var expiredTeachers = pendingTeachers.filter(function (p) {
      var dateStr = p.submitted_at || p.submittedAt || p.created_at;
      if (!dateStr) return false;
      var age = now - new Date(dateStr).getTime();
      return age > RETENTION_RULES.teachers.maxAge;
    });
    report.push({ entity: 'Professeurs en attente', total: pendingTeachers.length, expired: expiredTeachers.length, maxAge: '2 ans' });
    totalExpired += expiredTeachers.length;

    // Afficher le rapport
    var html = '<table style="width:100%;font-size:0.85rem;border-collapse:collapse;">';
    html += '<thead><tr style="text-align:left;border-bottom:1px solid var(--admin-border);">';
    html += '<th style="padding:0.5rem 0.5rem 0.5rem 0;">Entité</th><th>Total</th><th>Expirés</th><th>Rétention</th></tr></thead><tbody>';

    report.forEach(function (r) {
      var color = r.expired > 0 ? 'var(--color-warning, #D97706)' : 'var(--color-success, #3D6B4A)';
      html += '<tr style="border-bottom:1px solid var(--admin-border);">';
      html += '<td style="padding:0.4rem 0.5rem 0.4rem 0;">' + escapeHtml(r.entity) + '</td>';
      html += '<td>' + r.total + '</td>';
      html += '<td style="color:' + color + ';font-weight:600;">' + r.expired + (r.note ? ' <span style="font-weight:400;font-size:0.75rem;">(' + r.note + ')</span>' : '') + '</td>';
      html += '<td>' + r.maxAge + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';

    if (totalExpired > 0) {
      html += '<p style="margin-top:0.75rem;font-size:0.85rem;color:var(--color-warning, #D97706);">';
      html += '⚠ ' + totalExpired + ' enregistrement(s) dépasse(nt) la durée de rétention.';
      html += '</p>';
    } else {
      html += '<p style="margin-top:0.75rem;font-size:0.85rem;color:var(--color-success, #3D6B4A);">';
      html += '✓ Toutes les données sont dans les délais de rétention.';
      html += '</p>';
    }

    var container = document.getElementById('retention-report');
    if (container) container.innerHTML = html;

    // Afficher/masquer le bouton purge
    var purgeBtn = document.getElementById('btn-purge-retention');
    if (purgeBtn) purgeBtn.style.display = totalExpired > 0 ? '' : 'none';

    // Stocker les résultats pour la purge
    window._retentionScan = { expiredClients: expiredClients, expiredCommandes: expiredCommandes, expiredTeachers: expiredTeachers };

    Toast.info('Scan terminé : ' + totalExpired + ' donnée(s) expirée(s)');
  }

  /**
   * Purge les données expirées identifiées par le scan.
   * Demande confirmation avant chaque catégorie.
   */
  async function purgeExpiredData() {
    var scan = window._retentionScan;
    if (!scan) {
      Toast.error('Effectuez un scan d\'abord.');
      return;
    }

    var total = (scan.expiredClients || []).length + (scan.expiredCommandes || []).length + (scan.expiredTeachers || []).length;
    if (total === 0) {
      Toast.info('Aucune donnée à purger.');
      return;
    }

    var confirmed = await Confirm.show({
      title: 'Purge RGPD',
      message: 'Supprimer ' + total + ' enregistrement(s) expirés ?\n\n' +
        (scan.expiredClients.length ? '• ' + scan.expiredClients.length + ' client(s)\n' : '') +
        (scan.expiredCommandes.length ? '• ' + scan.expiredCommandes.length + ' commande(s)\n' : '') +
        (scan.expiredTeachers.length ? '• ' + scan.expiredTeachers.length + ' professeur(s) en attente\n' : '') +
        '\nCette action est irréversible.',
      confirmText: 'Purger',
      type: 'danger'
    });

    if (!confirmed) return;

    var deleted = 0;

    // Purge clients (archivage)
    if (scan.expiredClients && scan.expiredClients.length > 0) {
      scan.expiredClients.forEach(function (c) {
        if (typeof MistralGestion !== 'undefined' && MistralGestion.Clients) {
          MistralGestion.Clients.update(c.id, { archived: true, archived_at: new Date().toISOString(), archived_reason: 'retention_policy' });
          deleted++;
        }
      });
    }

    // Purge commandes
    if (scan.expiredCommandes && scan.expiredCommandes.length > 0) {
      scan.expiredCommandes.forEach(function (c) {
        if (typeof MistralGestion !== 'undefined' && MistralGestion.Commandes) {
          MistralGestion.Commandes.delete(c.id);
          deleted++;
        }
      });
    }

    // Purge professeurs en attente
    if (scan.expiredTeachers && scan.expiredTeachers.length > 0) {
      scan.expiredTeachers.forEach(function (p) {
        if (window.MistralSync && MistralSync.deleteFromSupabase) {
          MistralSync.deleteFromSupabase('mistral_pending_teachers', p.id).catch(function () {});
          deleted++;
        }
      });
    }

    Toast.success(deleted + ' enregistrement(s) supprimé(s)');
    window._retentionScan = null;

    // Re-scanner pour mettre à jour l'affichage
    setTimeout(function () { scanRetention(); }, 500);
  }

  /**
   * Exporte les données d'un client par email (droit d'accès RGPD).
   * Recherche le client, ses commandes, factures et télécharge un JSON.
   */
  function exportClientData() {
    var emailInput = document.getElementById('rgpd-export-email');
    var email = emailInput ? emailInput.value.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.error('Veuillez entrer un email valide.');
      return;
    }

    // Trouver le client
    var clients = (typeof MistralGestion !== 'undefined' && MistralGestion.Clients)
      ? MistralGestion.Clients.getAll()
      : [];
    var client = clients.find(function (c) { return c.email && c.email.toLowerCase() === email.toLowerCase(); });

    if (!client) {
      Toast.error('Aucun client trouvé avec cet email.');
      return;
    }

    // Collecter toutes les données associées
    var commandes = (typeof MistralGestion !== 'undefined' && MistralGestion.Commandes)
      ? MistralGestion.Commandes.getAll().filter(function (c) { return c.client_id === client.id; })
      : [];
    var factures = (typeof MistralGestion !== 'undefined' && MistralGestion.Factures)
      ? MistralGestion.Factures.getAll().filter(function (f) { return f.client_id === client.id; })
      : [];
    var locations = (typeof MistralGestion !== 'undefined' && MistralGestion.Locations)
      ? MistralGestion.Locations.getAll().filter(function (l) { return l.client_id === client.id; })
      : [];

    // Construire l'export
    var exportData = {
      _meta: {
        type: 'RGPD_EXPORT',
        date: new Date().toISOString(),
        email: email,
        source: 'Mistral Pans — mistralpans.fr'
      },
      client: client,
      commandes: commandes,
      factures: factures.map(function (f) {
        // Masquer les coordonnées bancaires internes
        var clean = Object.assign({}, f);
        delete clean.iban;
        delete clean.bic;
        return clean;
      }),
      locations: locations
    };

    // Télécharger en JSON
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'rgpd-export-' + email.replace(/[^a-z0-9]/gi, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);

    Toast.success('Export RGPD téléchargé pour ' + escapeHtml(email));
  }

  // ===========================================================================
  // EXPORT DES FONCTIONS VERS AdminUI
  // ===========================================================================

  /**
   * Rattache toutes les fonctions publiques de ce module a l'objet global AdminUI.
   *
   * Cela permet aux autres modules et au HTML (via data-action="xxx")
   * d'acceder aux fonctionnalites de configuration sans coupler les modules entre eux.
   */
  Object.assign(window.AdminUI, {
    // Configuration generale
    renderConfiguration,
    saveConfig,
    // Export / Import
    exportAllData,
    importData,
    resetAllData,
    // Materiaux
    renderMateriaux,
    editMateriau,
    saveMateriau,
    deleteMateriau,
    resetMateriaux,
    populateMateriauxSelect,
    // Gammes
    renderGammes,
    editGamme,
    saveGamme,
    deleteGamme,
    resetGammes,
    renderPatternInputs,
    validatePattern,
    importPatternsFromScalesData,
    populateGammesSelect,
    filterGammeDropdown,
    // Lots de gammes
    renderGammeBatches,
    editGammeBatch,
    saveGammeBatch,
    deleteGammeBatch,
    publishGammeBatch,
    unpublishGammeBatch,
    // Tailles
    renderTailles,
    editTaille,
    saveTaille,
    deleteTaille,
    resetTailles,
    populateTaillesSelect,
    // Emails automatiques
    renderEmailAutomations,
    saveEmailConfig,
    testEmailAutomation,
    onEmailToggle,
    isEmailAutomationEnabled,
    getEmailConfig,
    // Sections repliables
    toggleConfigSection,
    initConfigSections,
    // Rétention des données (RGPD)
    scanRetention,
    purgeExpiredData,
    exportClientData
  });

  console.log('[admin-ui-config] Module chargé');

})(window);
