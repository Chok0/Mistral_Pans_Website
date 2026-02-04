/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Configuration
   Configuration, Export/Import, Matériaux
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-config] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers || {};


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
    }
  }

  function saveConfig() {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.setConfigValue('loyerMensuel', parseFloat($('#config-loyer')?.value) || 50);
      MistralGestion.setConfigValue('montantCaution', parseFloat($('#config-caution')?.value) || 1150);
      MistralGestion.setConfigValue('fraisDossierTransport', parseFloat($('#config-frais')?.value) || 100);
      MistralGestion.setConfigValue('creditFidelitePourcent', parseFloat($('#config-fidelite')?.value) || 50);
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
          refreshAll();
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
    showModal('materiau');
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
    closeModal('materiau');
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
    populateMateriauxSelect
  });

  console.log('[admin-ui-config] Module chargé');

})(window);
