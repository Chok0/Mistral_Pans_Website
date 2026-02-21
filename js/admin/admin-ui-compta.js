/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Comptabilité
   Comptabilité et URSSAF
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-compta] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, formatDate, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;

  
  /**
   * Classification URSSAF des types de factures :
   * - BIC_VENTES (71% abattement) : ventes d'instruments/accessoires, acomptes, soldes
   * - BIC_PRESTATIONS (50% abattement) : locations, réaccordages (services artisanaux)
   * - BNC (34% abattement) : prestations intellectuelles (modélisation 3D, design, formation)
   * - AVOIR : notes de crédit (déduites de la catégorie d'origine via classification_origine)
   */
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  async function ensureJsPdfLoaded() {
    if (typeof window.jspdf !== 'undefined') return true;
    try {
      const loadScript = (typeof MistralUtils !== 'undefined' && MistralUtils.loadScript)
        ? MistralUtils.loadScript
        : function(src) {
            return new Promise(function(resolve, reject) {
              var s = document.createElement('script');
              s.src = src; s.onload = resolve; s.onerror = reject;
              document.head.appendChild(s);
            });
          };
      await loadScript(JSPDF_CDN);
      return typeof window.jspdf !== 'undefined';
    } catch (err) {
      console.warn('[Compta] Echec chargement jsPDF:', err);
      return false;
    }
  }

  const TYPE_CLASSIFICATION = {
    'vente': 'BIC_VENTES',
    'acompte': 'BIC_VENTES',
    'solde': 'BIC_VENTES',
    'location': 'BIC_PRESTATIONS',
    'reaccordage': 'BIC_PRESTATIONS',
    'prestation': 'BNC',
    'avoir': 'AVOIR'
  };
  
  function initComptabilite() {
    // Initialiser le sélecteur de mois
    const select = $('#compta-mois');
    if (!select) return;
    
    const now = new Date();
    select.innerHTML = '';
    
    // Générer les 12 derniers mois
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      select.appendChild(option);
    }
    
    // Événement changement de mois
    select.addEventListener('change', () => renderComptabilite());
    
    // Charger la configuration
    loadComptaConfig();
    
    // Afficher le mois en cours
    renderComptabilite();
  }
  
  let _comptaInitialized = false;

  function renderComptabilite() {
    if (typeof MistralGestion === 'undefined') return;

    if (!_comptaInitialized) {
      initComptabilite();
      _comptaInitialized = true;
      return; // initComptabilite calls renderComptabilite at the end
    }

    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    
    // Récupérer les factures du mois (payées uniquement, hors annulées)
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    // Calculer BIC Ventes, BIC Prestations et BNC
    let totalBICVentes = 0;
    let totalBICPrestations = 0;
    let totalBNC = 0;
    let avoirBICVentes = 0;
    let avoirBICPrestations = 0;
    let avoirBNC = 0;

    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC_VENTES';

      if (classification === 'BIC_VENTES') {
        totalBICVentes += montant;
      } else if (classification === 'BIC_PRESTATIONS') {
        totalBICPrestations += montant;
      } else if (classification === 'BNC') {
        totalBNC += montant;
      } else if (classification === 'AVOIR') {
        // Ventiler l'avoir selon la catégorie d'origine
        const origClassification = f.classification_origine || 'BIC_VENTES';
        if (origClassification === 'BIC_PRESTATIONS') avoirBICPrestations += montant;
        else if (origClassification === 'BNC') avoirBNC += montant;
        else avoirBICVentes += montant; // fallback BIC_VENTES (legacy)
      }
    });

    // Appliquer les avoirs par catégorie
    totalBICVentes = Math.max(0, totalBICVentes - avoirBICVentes);
    totalBICPrestations = Math.max(0, totalBICPrestations - avoirBICPrestations);
    totalBNC = Math.max(0, totalBNC - avoirBNC);

    // Afficher les totaux
    if ($('#compta-bic-ventes')) $('#compta-bic-ventes').textContent = formatPrice(totalBICVentes);
    if ($('#compta-bic-prestations')) $('#compta-bic-prestations').textContent = formatPrice(totalBICPrestations);
    if ($('#compta-bnc')) $('#compta-bnc').textContent = formatPrice(totalBNC);
    if ($('#compta-total')) $('#compta-total').textContent = formatPrice(totalBICVentes + totalBICPrestations + totalBNC);
    
    // Afficher le détail des factures
    renderComptaFactures(factures, mois);
  }
  
  function renderComptaFactures(factures, mois) {
    const tbody = $('#compta-factures-list');
    if (!tbody) return;
    
    if (!factures.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--admin-text-muted); padding: 2rem;">Aucune facture payée ce mois</td></tr>`;
      return;
    }
    
    // Trier par date
    factures.sort((a, b) => a.date.localeCompare(b.date));
    
    tbody.innerHTML = factures.map(f => {
      const client = MistralGestion.Clients.get(f.client_id);
      const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Client inconnu';
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      const montant = f.total || f.montant_ttc || 0;
      
      const typeLabels = {
        'vente': 'Vente',
        'acompte': 'Acompte',
        'solde': 'Solde',
        'location': 'Location',
        'reaccordage': 'Réaccordage',
        'prestation': 'Prestation',
        'avoir': 'Avoir'
      };

      const classificationLabels = {
        'BIC_VENTES': 'BIC Ventes',
        'BIC_PRESTATIONS': 'BIC Presta.',
        'BNC': 'BNC',
        'AVOIR': 'Avoir'
      };
      const badgeClass = {
        'BIC_VENTES': 'success',
        'BIC_PRESTATIONS': 'info',
        'BNC': 'warning',
        'AVOIR': 'neutral'
      }[classification] || 'success';
      const classificationLabel = classificationLabels[classification] || classification;

      return `
        <tr>
          <td>${formatDate(f.date)}</td>
          <td><a href="#" data-action="edit-facture" data-id="${f.id}" style="color: var(--admin-accent);">${f.numero || f.id}</a></td>
          <td>${escapeHtml(clientNom)}</td>
          <td>${typeLabels[f.type] || f.type}</td>
          <td><span class="admin-badge admin-badge--${badgeClass}">${classificationLabel}</span></td>
          <td style="text-align: right; font-weight: 500;">${classification === 'AVOIR' ? '-' : ''}${formatPrice(montant)}</td>
        </tr>
      `;
    }).join('');

    // Delegated event listener for facture links
    tbody.addEventListener('click', (e) => {
      const link = e.target.closest('[data-action="edit-facture"]');
      if (!link) return;
      e.preventDefault();
      const id = link.dataset.id;
      if (id) AdminUI.editFacture(id);
    });
  }

  async function genererRapportMensuel() {
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);

    const donnees = collecterDonneesMois(mois);
    if (!donnees) {
      Toast.error('Impossible de collecter les données comptables');
      return;
    }

    // Lazy-load jsPDF si necessaire
    const loaded = await ensureJsPdfLoaded();
    if (!loaded) {
      Toast.error('Impossible de charger le module PDF');
      return;
    }

    // Reutiliser la generation base64 puis convertir en telechargement
    const base64 = genererRapportPdfBase64(donnees);
    if (!base64) {
      Toast.error('Erreur lors de la génération du PDF');
      return;
    }

    // Convertir base64 en blob et telecharger
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-comptable-${mois}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Toast.success('Rapport téléchargé');
  }
  
  /**
   * Collecte les donnees comptables pour un mois donne
   */
  function collecterDonneesMois(mois) {
    if (typeof MistralGestion === 'undefined') return null;

    const [annee, moisNum] = mois.split('-');
    const moisLabel = new Date(annee, parseInt(moisNum) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date &&
             f.date.startsWith(mois) &&
             f.statut_paiement === 'paye' &&
             f.statut !== 'annulee';
    });

    let totalBICVentes = 0;
    let totalBICPrestations = 0;
    let totalBNC = 0;
    let avoirBICVentes = 0;
    let avoirBICPrestations = 0;
    let avoirBNC = 0;

    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC_VENTES';
      if (classification === 'BIC_VENTES') totalBICVentes += montant;
      else if (classification === 'BIC_PRESTATIONS') totalBICPrestations += montant;
      else if (classification === 'BNC') totalBNC += montant;
      else if (classification === 'AVOIR') {
        const origClassification = f.classification_origine || 'BIC_VENTES';
        if (origClassification === 'BIC_PRESTATIONS') avoirBICPrestations += montant;
        else if (origClassification === 'BNC') avoirBNC += montant;
        else avoirBICVentes += montant;
      }
    });

    totalBICVentes = Math.max(0, totalBICVentes - avoirBICVentes);
    totalBICPrestations = Math.max(0, totalBICPrestations - avoirBICPrestations);
    totalBNC = Math.max(0, totalBNC - avoirBNC);

    const totalAvoir = avoirBICVentes + avoirBICPrestations + avoirBNC;
    const config = MistralGestion.getConfig();

    // Preparer le detail des factures pour l'email
    const facturesDetail = factures.sort((a, b) => a.date.localeCompare(b.date)).map(f => {
      const client = MistralGestion.Clients.get(f.client_id);
      const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Inconnu';
      return {
        date: f.date,
        numero: f.numero || f.id,
        client: clientNom,
        type: f.type,
        classification: TYPE_CLASSIFICATION[f.type] || 'BIC_VENTES',
        montant: f.total || f.montant_ttc || 0
      };
    });

    return {
      mois,
      moisLabel: moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1),
      totalBICVentes,
      totalBICPrestations,
      totalBIC: totalBICVentes + totalBICPrestations, // backward compat
      totalBNC,
      totalAvoir,
      totalCA: totalBICVentes + totalBICPrestations + totalBNC,
      nbFactures: factures.length,
      factures: facturesDetail,
      config: {
        nom: config.nom || 'Mistral Pans',
        siret: config.siret || '889 482 758 00014'
      }
    };
  }

  /**
   * Genere le PDF du rapport et retourne le base64 (sans telecharger)
   */
  function genererRapportPdfBase64(donnees) {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') return null;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // En-tete
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport Comptable Mensuel', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(donnees.moisLabel, 105, 30, { align: 'center' });

    // Informations entreprise
    doc.setFontSize(10);
    doc.text(donnees.config.nom, 20, 45);
    doc.text(`SIRET: ${donnees.config.siret}`, 20, 50);

    // Resume URSSAF
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Montants à déclarer URSSAF', 20, 65);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.setFillColor(240, 240, 240);
    doc.rect(20, 70, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Catégorie', 25, 77);
    doc.text('Régime', 100, 77);
    doc.text('Montant', 160, 77, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Ventes (instruments, accessoires)', 25, 87);
    doc.text('BIC Ventes (71%)', 110, 87);
    doc.text(formatPrice(donnees.totalBICVentes), 185, 87, { align: 'right' });

    doc.text('Prestations artisanales (locations, réacc.)', 25, 97);
    doc.text('BIC Prestations (50%)', 110, 97);
    doc.text(formatPrice(donnees.totalBICPrestations), 185, 97, { align: 'right' });

    doc.text('Prestations intellectuelles (3D, design)', 25, 107);
    doc.text('BNC (34%)', 110, 107);
    doc.text(formatPrice(donnees.totalBNC), 185, 107, { align: 'right' });

    doc.setFillColor(220, 240, 220);
    doc.rect(20, 112, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL CA', 25, 119);
    doc.text(formatPrice(donnees.totalCA), 185, 119, { align: 'right' });

    // Detail des factures
    doc.setFontSize(14);
    doc.text('Détail des factures', 20, 140);

    doc.setFontSize(9);
    let y = 150;

    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 22, y);
    doc.text('N° Facture', 45, y);
    doc.text('Client', 80, y);
    doc.text('Type', 130, y);
    doc.text('Montant', 185, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    donnees.factures.forEach(f => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(formatDate(f.date), 22, y);
      doc.text(String(f.numero).slice(0, 15), 45, y);
      doc.text(f.client.slice(0, 25), 80, y);
      doc.text(`${f.type} (${f.classification})`, 130, y);
      doc.text(formatPrice(f.montant), 185, y, { align: 'right' });
      y += 6;
    });

    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }

    // Retourner base64 au lieu de telecharger
    const dataUri = doc.output('datauristring');
    return dataUri.split(',')[1];
  }

  /**
   * Envoie le rapport mensuel par email via Brevo
   */
  async function envoyerRapportMensuel() {
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);

    // Recuperer la config compta
    let comptaConfig = {};
    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      comptaConfig = MistralSync.getData('mistral_compta_config') || {};
    } else {
      comptaConfig = Storage.get('mistral_compta_config', {});
    }

    const gestionConfig = (typeof MistralGestion !== 'undefined') ? MistralGestion.getConfig() : {};
    const emailDest = comptaConfig.emailDest || gestionConfig.email || '';

    if (!emailDest) {
      Toast.error('Configurez l\'email de destination dans les paramètres ci-dessous');
      return;
    }

    // Collecter les donnees
    const donnees = collecterDonneesMois(mois);
    if (!donnees) {
      Toast.error('Impossible de collecter les données comptables');
      return;
    }

    // Generer le PDF en base64 si option activee
    let pdfBase64 = null;
    if (comptaConfig.includePdf !== false) {
      try {
        await ensureJsPdfLoaded();
        pdfBase64 = genererRapportPdfBase64(donnees);
      } catch (err) {
        console.warn('[Compta] Erreur generation PDF:', err);
      }
    }

    // Envoyer via Brevo
    Toast.info('Envoi du rapport en cours...');

    try {
      if (typeof MistralEmail === 'undefined') {
        Toast.error('Module email non chargé');
        return;
      }

      const result = await MistralEmail.sendMonthlyReport({
        emailDest,
        moisLabel: donnees.moisLabel,
        mois: donnees.mois,
        totalBICVentes: donnees.totalBICVentes,
        totalBICPrestations: donnees.totalBICPrestations,
        totalBIC: donnees.totalBIC, // backward compat
        totalBNC: donnees.totalBNC,
        totalAvoir: donnees.totalAvoir,
        totalCA: donnees.totalCA,
        nbFactures: donnees.nbFactures,
        factures: comptaConfig.includeFactures !== false ? donnees.factures : [],
        config: donnees.config,
        pdfBase64: pdfBase64
      });

      if (result.success) {
        Toast.success(`Rapport envoyé à ${emailDest}`);
        // Enregistrer la date d'envoi
        marquerRapportEnvoye(mois);
      } else {
        Toast.error(`Erreur d'envoi : ${result.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error('[Compta] Erreur envoi rapport:', err);
      Toast.error('Erreur lors de l\'envoi du rapport');
    }
  }

  /**
   * Marque un rapport mensuel comme envoye
   */
  function marquerRapportEnvoye(mois) {
    let comptaConfig = {};
    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      comptaConfig = MistralSync.getData('mistral_compta_config') || {};
    } else {
      comptaConfig = Storage.get('mistral_compta_config', {});
    }

    if (!comptaConfig.rapportsEnvoyes) comptaConfig.rapportsEnvoyes = {};
    comptaConfig.rapportsEnvoyes[mois] = new Date().toISOString();

    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      MistralSync.setData('mistral_compta_config', comptaConfig);
    } else {
      Storage.set('mistral_compta_config', comptaConfig);
    }

    // Masquer la banniere de rappel si elle existe
    const banner = $('#compta-rappel-banner');
    if (banner) banner.style.display = 'none';
  }

  /**
   * Verifie si le rapport du mois precedent a ete envoye
   * Affiche une banniere de rappel si necessaire
   */
  function verifierRapportMoisPrecedent() {
    let comptaConfig = {};
    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      comptaConfig = MistralSync.getData('mistral_compta_config') || {};
    } else {
      comptaConfig = Storage.get('mistral_compta_config', {});
    }

    // Verifier si l'envoi auto est active
    if (!comptaConfig.autoEmail || !comptaConfig.emailDest) return;

    // Calculer le mois precedent
    const now = new Date();
    const moisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const moisPrecKey = `${moisPrec.getFullYear()}-${String(moisPrec.getMonth() + 1).padStart(2, '0')}`;
    const moisPrecLabel = moisPrec.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Verifier si deja envoye
    const rapportsEnvoyes = comptaConfig.rapportsEnvoyes || {};
    if (rapportsEnvoyes[moisPrecKey]) return;

    // Afficher la banniere de rappel
    afficherBanniereRappel(moisPrecKey, moisPrecLabel.charAt(0).toUpperCase() + moisPrecLabel.slice(1));
  }

  /**
   * Affiche une banniere de rappel pour envoyer le rapport
   */
  function afficherBanniereRappel(mois, moisLabel) {
    // Chercher ou creer le conteneur de banniere
    let banner = $('#compta-rappel-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'compta-rappel-banner';
      banner.className = 'admin-banner admin-banner--warning';
      banner.style.cssText = 'margin: 1rem; padding: 1rem 1.5rem; background: #FEF3CD; border: 1px solid #F0D77B; border-radius: 8px; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;';

      // Inserer apres le header admin
      const adminHeader = $('.admin-header') || document.querySelector('header');
      if (adminHeader && adminHeader.parentNode) {
        adminHeader.parentNode.insertBefore(banner, adminHeader.nextSibling);
      } else {
        document.body.prepend(banner);
      }
    }

    banner.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92610C" stroke-width="2" style="flex-shrink:0;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span style="flex:1; color: #92610C; font-size: 0.9rem;">
        <strong>Rapport comptable</strong> — Le rapport de <strong>${escapeHtml(moisLabel)}</strong> n'a pas encore été envoyé.
      </span>
      <button class="admin-btn admin-btn--primary admin-btn--sm" data-action="envoyer-rapport-rappel" data-param="${escapeHtml(mois)}" style="white-space:nowrap;">
        Envoyer maintenant
      </button>
      <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="fermer-rappel-banner" style="padding:0.25rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    banner.style.display = 'flex';
  }

  /**
   * Envoie le rapport depuis la banniere de rappel
   * Selectionne le mois precedent et envoie
   */
  async function envoyerRapportRappel(mois) {
    // Selectionner le mois dans le select si possible
    const moisSelect = $('#compta-mois');
    if (moisSelect) {
      moisSelect.value = mois;
      renderComptabilite();
    }

    // Envoyer le rapport
    await envoyerRapportMensuel();
  }

  /**
   * Ferme la banniere de rappel
   */
  function fermerRappelBanner() {
    const banner = $('#compta-rappel-banner');
    if (banner) banner.style.display = 'none';
  }
  
  function saveComptaConfig() {
    const config = {
      autoEmail: $('#compta-auto-email')?.checked || false,
      emailDest: $('#compta-email-dest')?.value?.trim() || '',
      includeAnalytics: $('#compta-include-analytics')?.checked || true,
      includeFactures: $('#compta-include-factures')?.checked || true,
      includePdf: $('#compta-include-pdf')?.checked || true
    };

    // Ecrire via MistralSync (memoire + Supabase) ou fallback Storage
    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      MistralSync.setData('mistral_compta_config', config);
    } else {
      Storage.set('mistral_compta_config', config);
    }
    Toast.success('Configuration enregistrée');

    if (config.autoEmail && config.emailDest) {
      Toast.info('Un rappel sera affiché à l\'ouverture de l\'admin si le rapport n\'a pas été envoyé');
    }
  }

  function loadComptaConfig() {
    let config = {};
    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      config = MistralSync.getData('mistral_compta_config') || {};
    } else {
      config = Storage.get('mistral_compta_config', {});
    }

    if ($('#compta-auto-email')) $('#compta-auto-email').checked = config.autoEmail || false;
    if ($('#compta-email-dest')) $('#compta-email-dest').value = config.emailDest || '';
    if ($('#compta-include-analytics')) $('#compta-include-analytics').checked = config.includeAnalytics !== false;
    if ($('#compta-include-factures')) $('#compta-include-factures').checked = config.includeFactures !== false;
    if ($('#compta-include-pdf')) $('#compta-include-pdf').checked = config.includePdf !== false;
  }


  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    renderComptabilite,
    genererRapportMensuel,
    envoyerRapportMensuel,
    envoyerRapportRappel,
    fermerRappelBanner,
    saveComptaConfig,
    verifierRapportMoisPrecedent
  });

  // Verifier le rapport du mois precedent apres le chargement des donnees
  window.addEventListener('mistral-sync-complete', () => {
    setTimeout(() => verifierRapportMoisPrecedent(), 1000);
  });

  console.log('[admin-ui-compta] Module chargé');

})(window);
