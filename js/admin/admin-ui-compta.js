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
   * Classification des types de factures :
   * - BIC (Bénéfices Industriels et Commerciaux) : ventes, locations, acomptes, soldes
   * - BNC (Bénéfices Non Commerciaux) : prestations de services
   */
  const TYPE_CLASSIFICATION = {
    'vente': 'BIC',
    'acompte': 'BIC',
    'solde': 'BIC',
    'location': 'BIC',
    'prestation': 'BNC',
    'avoir': 'AVOIR' // Les avoirs réduisent le CA
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
  
  function renderComptabilite() {
    if (typeof MistralGestion === 'undefined') return;
    
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    
    // Récupérer les factures du mois (payées uniquement, hors annulées)
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    // Calculer BIC et BNC
    let totalBIC = 0;
    let totalBNC = 0;
    let totalAvoir = 0;
    
    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      
      if (classification === 'BIC') {
        totalBIC += montant;
      } else if (classification === 'BNC') {
        totalBNC += montant;
      } else if (classification === 'AVOIR') {
        totalAvoir += montant;
      }
    });
    
    // Appliquer les avoirs (réduire le BIC par défaut)
    totalBIC = Math.max(0, totalBIC - totalAvoir);
    
    // Afficher les totaux
    if ($('#compta-bic')) $('#compta-bic').textContent = formatPrice(totalBIC);
    if ($('#compta-bnc')) $('#compta-bnc').textContent = formatPrice(totalBNC);
    if ($('#compta-total')) $('#compta-total').textContent = formatPrice(totalBIC + totalBNC);
    
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
        'prestation': 'Prestation',
        'avoir': 'Avoir'
      };
      
      return `
        <tr>
          <td>${formatDate(f.date)}</td>
          <td><a href="#" onclick="AdminUI.editFacture('${f.id}'); return false;" style="color: var(--admin-accent);">${f.numero || f.id}</a></td>
          <td>${escapeHtml(clientNom)}</td>
          <td>${typeLabels[f.type] || f.type}</td>
          <td><span class="admin-badge admin-badge--${classification === 'BNC' ? 'warning' : classification === 'AVOIR' ? 'neutral' : 'success'}">${classification}</span></td>
          <td style="text-align: right; font-weight: 500;">${classification === 'AVOIR' ? '-' : ''}${formatPrice(montant)}</td>
        </tr>
      `;
    }).join('');
  }
  
  function genererRapportMensuel() {
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    const [annee, moisNum] = mois.split('-');
    
    const moisLabel = new Date(annee, parseInt(moisNum) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // Récupérer les données
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    let totalBIC = 0;
    let totalBNC = 0;
    
    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      if (classification === 'BIC') totalBIC += montant;
      else if (classification === 'BNC') totalBNC += montant;
    });
    
    // Générer le PDF avec jsPDF
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      Toast.error('Module PDF non chargé');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport Comptable Mensuel', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1), 105, 30, { align: 'center' });
    
    // Informations entreprise
    const pdfConfig = (typeof MistralGestion !== 'undefined') ? MistralGestion.getConfig() : Storage.get('mistral_gestion_config', {});
    doc.setFontSize(10);
    doc.text(`${pdfConfig.nom || 'Mistral Pan'}`, 20, 45);
    doc.text(`SIRET: ${pdfConfig.siret || '889 482 758 00014'}`, 20, 50);
    
    // Résumé URSSAF
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Montants à déclarer URSSAF', 20, 65);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Tableau récapitulatif
    doc.setFillColor(240, 240, 240);
    doc.rect(20, 70, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Catégorie', 25, 77);
    doc.text('Régime', 100, 77);
    doc.text('Montant', 160, 77, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.text('Ventes & Locations', 25, 87);
    doc.text('BIC (Micro-entreprise)', 100, 87);
    doc.text(formatPrice(totalBIC), 185, 87, { align: 'right' });
    
    doc.text('Prestations de services', 25, 97);
    doc.text('BNC (Micro-entreprise)', 100, 97);
    doc.text(formatPrice(totalBNC), 185, 97, { align: 'right' });
    
    doc.setFillColor(220, 240, 220);
    doc.rect(20, 102, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL CA', 25, 109);
    doc.text(formatPrice(totalBIC + totalBNC), 185, 109, { align: 'right' });
    
    // Détail des factures
    doc.setFontSize(14);
    doc.text('Détail des factures', 20, 130);
    
    doc.setFontSize(9);
    let y = 140;
    
    // En-tête tableau
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
    factures.sort((a, b) => a.date.localeCompare(b.date)).forEach(f => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const client = MistralGestion.Clients.get(f.client_id);
      const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Inconnu';
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      
      doc.text(formatDate(f.date), 22, y);
      doc.text(f.numero || f.id.slice(0, 10), 45, y);
      doc.text(clientNom.slice(0, 25), 80, y);
      doc.text(`${f.type} (${classification})`, 130, y);
      doc.text(formatPrice(montant), 185, y, { align: 'right' });
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
    
    // Télécharger
    doc.save(`rapport-comptable-${mois}.pdf`);
    Toast.success('Rapport téléchargé');
  }
  
  /**
   * TODO: Envoi automatique mensuel
   * ================================
   * Options d'implémentation :
   * 
   * 1. CRON JOB + Backend PHP
   *    - Créer un script PHP qui génère et envoie le rapport
   *    - Configurer un cron sur le serveur: 0 8 1 * * php /path/to/send_report.php
   * 
   * 2. Service externe (Zapier, Make, n8n)
   *    - Webhook déclenché le 1er du mois
   *    - Appelle une API pour générer le rapport
   * 
   * 3. API EmailJS ou Brevo
   *    - Nécessite que l'utilisateur ouvre l'app le 1er du mois
   *    - Peut être combiné avec une notification push
   * 
   * Pour l'instant : envoi manuel avec mailto:
   */
  async function envoyerRapportMensuel() {
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    const [annee, moisNum] = mois.split('-');
    
    const moisLabel = new Date(annee, parseInt(moisNum) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // Récupérer les données
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    let totalBIC = 0;
    let totalBNC = 0;
    
    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      if (classification === 'BIC') totalBIC += montant;
      else if (classification === 'BNC') totalBNC += montant;
    });
    
    // Générer le contenu de l'email
    const config = (typeof MistralGestion !== 'undefined') ? MistralGestion.getConfig() : Storage.get('mistral_gestion_config', {});
    let comptaConfig = {};
    if (window.MistralSync && MistralSync.hasKey('mistral_compta_config')) {
      comptaConfig = MistralSync.getData('mistral_compta_config') || {};
    } else {
      comptaConfig = Storage.get('mistral_compta_config', {});
    }
    const emailDest = comptaConfig.emailDest || config.email || '';
    
    if (!emailDest) {
      Toast.error('Configurez l\'email de destination');
      return;
    }
    
    const subject = encodeURIComponent(`Rapport comptable - ${moisLabel}`);
    const body = encodeURIComponent(`
Rapport comptable Mistral Pan
${moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1)}
=====================================

MONTANTS À DÉCLARER URSSAF
--------------------------
BIC (Ventes & Locations) : ${formatPrice(totalBIC)}
BNC (Prestations)        : ${formatPrice(totalBNC)}
--------------------------
TOTAL CA                 : ${formatPrice(totalBIC + totalBNC)}

Nombre de factures : ${factures.length}

---
Ce rapport a été généré automatiquement.
Pensez à joindre le PDF du rapport détaillé.
    `.trim());
    
    // D'abord générer le PDF
    genererRapportMensuel();
    
    // Puis ouvrir le client mail
    setTimeout(() => {
      window.open(`mailto:${emailDest}?subject=${subject}&body=${body}`, '_blank');
      Toast.info('Email préparé - Joignez le PDF téléchargé');
    }, 500);
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

    // TODO: Si autoEmail activé, planifier l'envoi automatique
    if (config.autoEmail) {
      Toast.info('L\'envoi automatique nécessite une configuration serveur');
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
    saveComptaConfig
  });

  console.log('[admin-ui-compta] Module chargé');

})(window);
