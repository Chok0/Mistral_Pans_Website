/* ==========================================================================
   MISTRAL PANS - Générateur PDF
   Factures et Contrats de location
   Utilise jsPDF
   ========================================================================== */

(function(window) {
  'use strict';

  // Vérifier que jsPDF est chargé
  if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    console.warn('jsPDF non chargé. Le module PDF ne fonctionnera pas.');
  }

  // ============================================================================
  // CONFIGURATION PDF
  // ============================================================================
  
  const PDF_CONFIG = {
    // Dimensions A4 en mm
    pageWidth: 210,
    pageHeight: 297,
    margin: 20,
    
    // Couleurs
    colors: {
      primary: [13, 115, 119],      // Teal #0D7377
      dark: [26, 29, 33],           // #1A1D21
      text: [51, 51, 51],           // #333333
      muted: [128, 128, 128],       // #808080
      light: [200, 200, 200],       // #C8C8C8
      white: [255, 255, 255]
    },
    
    // Polices
    fonts: {
      normal: 'helvetica',
      bold: 'helvetica'
    }
  };

  // ============================================================================
  // LOGO (apple-touch-icon 180x180, pre-encoded en Base64)
  // ============================================================================

  const LOGO_BASE64 = 'data:image/png;base64,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';

  // ============================================================================
  // UTILITAIRES PDF
  // ============================================================================

  /**
   * Ajoute un texte multiligne
   */
  function addMultilineText(doc, text, x, y, maxWidth, lineHeight = 5) {
    if (!text) return y;
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, i) => {
      doc.text(line, x, y + (i * lineHeight));
    });
    return y + (lines.length * lineHeight);
  }

  /**
   * Dessine un rectangle avec coins arrondis
   */
  function roundedRect(doc, x, y, w, h, r, style = 'S') {
    doc.roundedRect(x, y, w, h, r, r, style);
  }

  /**
   * Formate un prix pour le PDF
   */
  function formatPricePDF(price) {
    if (price === null || price === undefined) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }

  /**
   * Dessine une ligne horizontale accent teal
   */
  function drawTealLine(doc, x1, y, x2, width) {
    doc.setDrawColor(...PDF_CONFIG.colors.primary);
    doc.setLineWidth(width || 0.3);
    doc.line(x1, y, x2, y);
    doc.setLineWidth(0.2);
  }

  /**
   * Dessine un bloc carte avec bordure arrondie fine
   */
  function drawCardBlock(doc, x, y, w, h, borderColor) {
    doc.setDrawColor(...(borderColor || PDF_CONFIG.colors.light));
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, 'S');
    doc.setLineWidth(0.2);
  }

  /**
   * Retourne le label du type de facture
   */
  function getFactureTypeLabel(type) {
    const labels = {
      vente: 'FACTURE',
      acompte: 'FACTURE D\'ACOMPTE',
      solde: 'FACTURE DE SOLDE',
      location: 'FACTURE',
      prestation: 'FACTURE',
      reaccordage: 'FACTURE',
      avoir: 'AVOIR'
    };
    return labels[type] || 'FACTURE';
  }

  // ============================================================================
  // GÉNÉRATION FACTURE
  // ============================================================================

  /**
   * Génère une facture PDF avec logo et mise en page professionnelle
   * @param {Object} facture - Données de la facture
   * @param {Object} options - Options de génération
   * @returns {jsPDF} - Document PDF
   */
  function generateFacturePDF(facture, options = {}) {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const config = window.MistralGestion ? window.MistralGestion.getConfig() : {};
    const client = window.MistralGestion ? window.MistralGestion.Clients.get(facture.client_id) : {};

    const margin = PDF_CONFIG.margin;
    const pageWidth = PDF_CONFIG.pageWidth;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // ========== EN-TÊTE ==========

    // Logo (12x12mm)
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, y - 2, 12, 12);
    } catch (e) {
      console.warn('[PDF] Logo non chargé:', e.message);
    }

    // Nom de la marque (à droite du logo)
    doc.setFontSize(16);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(config.marque || 'Mistral Pans', margin + 15, y + 3);

    // Tagline
    doc.setFontSize(8);
    doc.setFont(PDF_CONFIG.fonts.normal, 'italic');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Instruments artisanaux', margin + 15, y + 8);

    // Type de facture (aligné à droite)
    const typeLabel = getFactureTypeLabel(facture.type);
    doc.setFontSize(18);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    const typeColor = facture.type === 'avoir'
      ? [220, 38, 38]
      : PDF_CONFIG.colors.primary;
    doc.setTextColor(...typeColor);
    doc.text(typeLabel, pageWidth - margin, y + 3, { align: 'right' });

    // Numéro et date (à droite, sous le type)
    doc.setFontSize(10);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text(`N° ${facture.numero}`, pageWidth - margin, y + 10, { align: 'right' });

    const dateFormatted = new Date(facture.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(dateFormatted, pageWidth - margin, y + 15, { align: 'right' });

    y += 20;

    // Ligne accent teal
    drawTealLine(doc, margin, y, pageWidth - margin, 0.4);

    y += 5;

    // Référence avoir (si lié à une facture d'origine)
    if (facture.type === 'avoir' && facture.facture_origine_id) {
      const origFacture = window.MistralGestion ? window.MistralGestion.Factures.get(facture.facture_origine_id) : null;
      if (origFacture) {
        doc.setFontSize(9);
        doc.setFont(PDF_CONFIG.fonts.normal, 'italic');
        doc.setTextColor(...PDF_CONFIG.colors.muted);
        doc.text(`Avoir relatif à la facture N° ${origFacture.numero}`, margin, y + 3);
        y += 6;
      }
    }

    y += 5;

    // ========== ÉMETTEUR / DESTINATAIRE ==========

    const blockWidth = (contentWidth - 10) / 2;
    const emetteurX = margin;
    const destinataireX = margin + blockWidth + 10;
    const blockHeight = 32;

    // Bloc émetteur
    drawCardBlock(doc, emetteurX, y, blockWidth, blockHeight);

    let ey = y + 5;
    doc.setFontSize(7);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.primary);
    doc.text('ÉMETTEUR', emetteurX + 4, ey);

    ey += 5;
    doc.setFontSize(9);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(config.nom || 'Adrien Santamaria', emetteurX + 4, ey);

    ey += 4.5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(config.adresse || '', emetteurX + 4, ey);
    ey += 4;
    doc.text(`${config.codePostal || ''} ${config.ville || ''}`, emetteurX + 4, ey);
    ey += 4;
    doc.setFontSize(8);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text(`SIRET : ${config.siret || ''}`, emetteurX + 4, ey);
    ey += 4;
    doc.text(config.email || '', emetteurX + 4, ey);

    // Bloc destinataire
    drawCardBlock(doc, destinataireX, y, blockWidth, blockHeight);

    let cy = y + 5;
    doc.setFontSize(7);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.primary);
    doc.text('DESTINATAIRE', destinataireX + 4, cy);

    cy += 5;
    doc.setFontSize(9);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Client';
    doc.text(clientNom, destinataireX + 4, cy);

    cy += 4.5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    if (client && client.adresse) {
      const adresseLines = client.adresse.split('\n');
      adresseLines.forEach(line => {
        doc.text(line.trim(), destinataireX + 4, cy);
        cy += 4;
      });
    }
    if (client && client.email) {
      doc.setFontSize(8);
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text(client.email, destinataireX + 4, cy);
      cy += 4;
    }
    if (client && client.telephone) {
      doc.setFontSize(8);
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text(client.telephone, destinataireX + 4, cy);
    }

    y += blockHeight + 10;

    // ========== TABLEAU DES LIGNES ==========

    const cols = {
      desc: { x: margin, w: contentWidth - 65 },
      qte:  { x: margin + contentWidth - 65, w: 15 },
      pu:   { x: margin + contentWidth - 50, w: 25 },
      tot:  { x: margin + contentWidth - 25, w: 25 }
    };

    // En-tête du tableau (coins arrondis en haut)
    doc.setFillColor(...PDF_CONFIG.colors.primary);
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
    doc.rect(margin, y + 4, contentWidth, 4, 'F');

    doc.setFontSize(8);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.white);
    doc.text('Désignation', cols.desc.x + 4, y + 5.5);
    doc.text('Qté', cols.qte.x + cols.qte.w / 2, y + 5.5, { align: 'center' });
    doc.text('P.U. HT', cols.pu.x + cols.pu.w - 3, y + 5.5, { align: 'right' });
    doc.text('Total HT', cols.tot.x + cols.tot.w - 3, y + 5.5, { align: 'right' });

    y += 10;

    // Lignes du tableau (calculer total par ligne si absent)
    const lignes = (facture.lignes || []).map(l => ({
      ...l,
      total: l.total != null ? l.total : (l.quantite || 1) * (l.prix_unitaire || 0)
    }));
    const sousTotal = facture.sous_total != null ? facture.sous_total
      : facture.montant_ht != null ? facture.montant_ht
      : lignes.reduce((s, l) => s + l.total, 0);
    const totalNet = facture.total != null ? facture.total
      : facture.montant_ttc != null ? facture.montant_ttc
      : sousTotal - (facture.acomptes_deduits || 0);

    lignes.forEach((ligne, index) => {
      const descLines = doc.splitTextToSize(ligne.description || '', cols.desc.w - 8);
      const rowHeight = Math.max(7, descLines.length * 4.5 + 3);

      // Alternance fond subtile
      if (index % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      // Description
      doc.setFontSize(8.5);
      doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
      doc.setTextColor(...PDF_CONFIG.colors.text);
      descLines.forEach((line, i) => {
        doc.text(line, cols.desc.x + 4, y + 4.5 + (i * 4.5));
      });

      // Quantité, PU, Total (centrés verticalement)
      const centerY = y + rowHeight / 2 + 1.5;
      doc.text(String(ligne.quantite || 1), cols.qte.x + cols.qte.w / 2, centerY, { align: 'center' });
      doc.text(formatPricePDF(ligne.prix_unitaire), cols.pu.x + cols.pu.w - 3, centerY, { align: 'right' });
      doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
      doc.text(formatPricePDF(ligne.total), cols.tot.x + cols.tot.w - 3, centerY, { align: 'right' });

      y += rowHeight;

      // Séparateur pointillé entre lignes (sauf dernière)
      if (index < lignes.length - 1) {
        doc.setDrawColor(...PDF_CONFIG.colors.light);
        try {
          doc.setLineDashPattern([1, 1], 0);
          doc.line(margin + 2, y, margin + contentWidth - 2, y);
          doc.setLineDashPattern([], 0);
        } catch (e) {
          doc.line(margin + 2, y, margin + contentWidth - 2, y);
        }
      }
    });

    // Bordure basse du tableau
    doc.setDrawColor(...PDF_CONFIG.colors.light);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineWidth(0.2);

    y += 8;

    // ========== TOTAUX ==========

    const totalsLabelX = pageWidth - margin - 70;
    const totalsValueX = pageWidth - margin;

    // Sous-total
    doc.setFontSize(9);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Sous-total HT', totalsLabelX, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(formatPricePDF(sousTotal), totalsValueX, y, { align: 'right' });

    y += 6;

    // Acomptes déduits (si applicable)
    if (facture.acomptes_deduits && facture.acomptes_deduits > 0) {
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text('Acomptes déduits', totalsLabelX, y);
      doc.setTextColor(...PDF_CONFIG.colors.text);
      doc.text(`- ${formatPricePDF(facture.acomptes_deduits)}`, totalsValueX, y, { align: 'right' });
      y += 6;
    }

    // Total (bloc arrondi teal)
    const totalBoxW = 75;
    const totalBoxX = pageWidth - margin - totalBoxW;
    doc.setFillColor(...PDF_CONFIG.colors.primary);
    doc.roundedRect(totalBoxX, y - 1, totalBoxW, 10, 2, 2, 'F');

    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.white);
    doc.text('TOTAL NET À PAYER', totalBoxX + 4, y + 6);
    doc.text(formatPricePDF(totalNet), pageWidth - margin - 3, y + 6, { align: 'right' });

    y += 16;

    // Mention TVA
    doc.setFont(PDF_CONFIG.fonts.normal, 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('TVA non applicable, article 293 B du Code Général des Impôts', margin, y);

    y += 12;

    // ========== INFORMATIONS DE PAIEMENT ==========

    const paymentBoxHeight = 30;
    doc.setDrawColor(...PDF_CONFIG.colors.light);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, paymentBoxHeight, 2, 2, 'FD');

    let py = y + 6;

    // Titre
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('Informations de paiement', margin + 5, py);

    // Séparateur sous le titre
    py += 2;
    doc.setDrawColor(...PDF_CONFIG.colors.light);
    doc.line(margin + 5, py, margin + 60, py);

    py += 5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(8);

    const labelX = margin + 5;
    const valueX = margin + 25;

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Titulaire', labelX, py);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(config.nom || '', valueX, py);
    py += 4.5;

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('IBAN', labelX, py);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(config.iban || '', valueX, py);
    py += 4.5;

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('BIC', labelX, py);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(config.bic || '', valueX, py);

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Banque', margin + 80, py);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(config.banque || '', margin + 97, py);

    // ========== PIED DE PAGE ==========

    const footerY = PDF_CONFIG.pageHeight - 15;

    // Ligne séparatrice fine
    doc.setDrawColor(...PDF_CONFIG.colors.light);
    doc.setLineWidth(0.2);
    doc.line(margin + 20, footerY - 4, pageWidth - margin - 20, footerY - 4);

    doc.setFontSize(7.5);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text(
      `${config.marque || 'Mistral Pans'} \u2013 ${config.nom || ''} \u2013 SIRET ${config.siret || ''}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.text(
      `${config.email || ''} \u2013 ${config.telephone || ''}`,
      pageWidth / 2,
      footerY + 3.5,
      { align: 'center' }
    );

    return doc;
  }

  // ============================================================================
  // GÉNÉRATION CONTRAT DE LOCATION
  // ============================================================================
  
  /**
   * Génère un contrat de location PDF
   * @param {Object} location - Données de la location
   * @param {Object} options - Options de génération
   * @returns {jsPDF} - Document PDF
   */
  function generateContratPDF(location, options = {}) {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const config = window.MistralGestion ? window.MistralGestion.getConfig() : {};
    const client = window.MistralGestion ? window.MistralGestion.Clients.get(location.client_id) : {};
    const instrument = window.MistralGestion ? window.MistralGestion.Instruments.get(location.instrument_id) : {};
    
    const margin = PDF_CONFIG.margin;
    const pageWidth = PDF_CONFIG.pageWidth;
    const contentWidth = pageWidth - (margin * 2);
    
    let y = margin;
    let pageNum = 1;

    // ========== FONCTION NOUVELLE PAGE ==========
    function newPage() {
      doc.addPage();
      pageNum++;
      y = margin;
      return y;
    }

    // ========== FONCTION VÉRIFIER ESPACE ==========
    function checkSpace(needed) {
      if (y + needed > PDF_CONFIG.pageHeight - 30) {
        newPage();
      }
    }

    // ========== EN-TÊTE ==========

    // Logo (12x12mm)
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, y - 2, 12, 12);
    } catch (e) {
      console.warn('[PDF] Logo non chargé:', e.message);
    }

    // Nom de la marque (à droite du logo)
    doc.setFontSize(16);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(config.marque || 'Mistral Pans', margin + 15, y + 3);

    // Tagline
    doc.setFontSize(8);
    doc.setFont(PDF_CONFIG.fonts.normal, 'italic');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Artisan Handpan — Île-de-France', margin + 15, y + 8);

    y += 16;
    
    // Titre
    doc.setFontSize(18);
    doc.setTextColor(...PDF_CONFIG.colors.primary);
    doc.text('CONTRAT DE LOCATION D\'INSTRUMENT', pageWidth / 2, y, { align: 'center' });
    
    y += 15;
    
    // ========== PARTIES ==========
    
    doc.setFontSize(10);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.text);
    
    // Loueur
    doc.text(`Entre la société ${config.marque || 'Mistral Pans'} domiciliée au ${config.adresse || ''} - ${config.codePostal || ''} ${config.ville || ''}`, margin, y);
    y += 5;
    doc.text(`Enregistrée sous le numéro SIRET - ${config.siret || ''}`, margin, y);
    y += 5;
    doc.text(`représentée par ${config.nom || ''}`, margin, y);
    y += 5;
    doc.text('désigné(e) comme « le prêteur ou loueur ».', margin, y);
    
    y += 10;
    doc.text('Et', margin, y);
    y += 7;
    
    // Locataire
    const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : '________________';
    doc.text(`M. ou Mme ${clientNom}`, margin, y);
    y += 5;
    
    const clientAdresse = client && client.adresse ? client.adresse.replace(/\n/g, ' ') : '________________';
    doc.text(`à ${clientAdresse}`, margin, y);
    y += 5;
    doc.text('désigné(e) comme « l\'emprunteur et locataire ».', margin, y);
    
    y += 10;
    doc.text('L\'emprunteur / locataire s\'engage à observer scrupuleusement les prescriptions ci-après :', margin, y);
    
    y += 15;
    
    // ========== ARTICLES ==========
    
    const articles = [
      {
        titre: 'ARTICLE 1. OBJET DU CONTRAT',
        contenu: `Dans le cadre de la gestion de son parc instrumental, et dans les limites de ses disponibilités, le loueur peut proposer des prêts ou des locations d'instrument dans les conditions définies ci-après et dans les annexes contractuelles.\n\nLe prêt ou la location d'un instrument est conditionné par un contrat de location entre le loueur et l'emprunteur. À tout contrat correspond la location d'un instrument unique et identifié, sous la responsabilité de l'emprunteur.`
      },
      {
        titre: 'ARTICLE 2. CONDITIONS DE VALIDATION',
        contenu: `Le contrat de prêt ou de location est nominatif et ne peut en aucun cas être cédé.\nSeul le prêteur est habilité à valider le contrat de location ou de prêt d'instruments de musique.\nLe prêteur est chargé de procéder à l'évaluation de l'état des instruments.\nUne copie du contrat est remise au locataire, l'original est conservé par le loueur.`
      },
      {
        titre: 'ARTICLE 3. MISE À DISPOSITION ET RETRAIT DE L\'INSTRUMENT',
        contenu: `Le prêteur s'engage à mettre à disposition de l'emprunteur un instrument de musique en bon état de fonctionnement et l'informe sur les conditions d'utilisation.\nL'emprunteur accepte l'instrument dans l'état de marche présenté.\nEn conséquence, le prêteur n'est pas tenu pour responsable en cas de mauvais fonctionnement ou de détérioration dudit instrument de musique.\nLe prêteur est chargé de vérifier l'état de l'instrument au moment de l'attribution.\nLors de la remise d'un instrument, le prêteur se doit d'indiquer clairement au loueur les gestes techniques de maintenance et d'entretien de l'instrument prêté ou loué.`
      },
      {
        titre: 'ARTICLE 4. DURÉE DU CONTRAT',
        contenu: `La durée du contrat est de 3 mois minimum, puis, par tacite reconduction pour des durées de 1 mois.`
      },
      {
        titre: 'ARTICLE 5. LOYER',
        contenu: `Le loyer de l'instrument est de ${formatPricePDF(location.loyer_mensuel || 50)} TTC par mois.`
      },
      {
        titre: 'ARTICLE 6. DÉLAI DE RÉTRACTATION',
        contenu: `Le locataire bénéficie d'un délai de rétractation de sept jours à compter de la date de règlement effectif du premier loyer.\n\nLe retour de l'instrument et de ses accessoires doit s'effectuer dans leur emballage d'origine afin d'en assurer le meilleur transport, ils doivent être en parfait état et au complet.\n\nTout article retourné incomplet ou abîmé sera facturé au locataire. Tout article sali sera nettoyé par le loueur aux frais du locataire.\n\nDe plus le locataire s'engage à venir restituer l'instrument en main propre.\n\nLe remboursement du premier loyer s'effectuera dans un délai maximum de 30 jours après réception des produits.`
      },
      {
        titre: 'ARTICLE 7. CAUTIONNEMENT – GARANTIE FINANCIÈRE',
        contenu: `Une garantie financière est demandée à l'emprunteur sous forme d'${location.caution_mode === 'swikly' ? 'une empreinte de carte bancaire via Swikly' : 'un chèque de caution'} à l'ordre du loueur dont le montant est fixé à ${formatPricePDF(location.montant_caution || 1150)}.\n\nLa caution n'est pas encaissée sauf si, à la terminaison du contrat, l'instrument rendu n'est pas conforme :\n- absence de nettoyage,\n- accessoire manquant,\n- mauvais état manifeste résultant d'une mauvaise utilisation`
      },
      {
        titre: 'ARTICLE 8. RÉVISION, ENTRETIEN ET MAINTENANCE',
        contenu: `Les instruments et accessoires sont prêtés propres, en bon état.\n\nL'entretien courant est à la charge de l'emprunteur:\nNettoyage au chiffon microfibre régulier.\nSelon l'état de la couche de protection de l'instrument, graissage annuel à l'huile de coco ou Phoenix oil.\n\nTout incident entravant le bon fonctionnement sera signalé au prêteur et toute réparation nécessaire sera à la charge de l'emprunteur.\n\nEn cas de détérioration, la remise en état ou le remplacement à équivalent de l'instrument reste à la charge de l'emprunteur.\n\nLe maintien en bon état de l'instrument prêté, dans une utilisation normale nécessite une révision annuelle.`
      },
      {
        titre: 'ARTICLE 9. ASSURANCE',
        contenu: `L'emprunteur se reconnaît responsable de toute dégradation survenue à l'instrument ou à ses accessoires. La souscription d'une assurance pour l'instrument est à la charge de l'emprunteur.`
      },
      {
        titre: 'ARTICLE 10. RÉSILIATION',
        contenu: `La résiliation du contrat peut intervenir à tout instant. Elle peut être :\n\n1. À l'initiative du loueur en cas de non-paiement du loyer à l'échéance d'un renouvellement de contrat.\n\nD'autre part, le contrat sera rompu automatiquement :\n- si l'une au moins des clauses du contrat n'est pas respectée,\n- si le prêteur en demande la restitution, notamment pour cause de dégradation.\n\n2. À l'initiative du locataire, la résiliation étant effective à la fin du mois en cours.\n\nLe prêteur se réserve le droit d'encaisser la caution si l'une des clauses du contrat n'a pas été respecté par le locataire, notamment en matière d'entretien et de maintenance de l'instrument.`
      },
      {
        titre: 'ARTICLE 11. RESTITUTION DE L\'INSTRUMENT',
        contenu: `Seul le prêteur est habilité à apprécier l'état de l'instrument restitué.\n\nÀ la fin de la location, le locataire restituera en main propre au loueur l'instrument de musique et ses accessoires.\n\nL'instrument de musique et ses accessoires seront rendus en parfait état cosmétique et de fonctionnement.\n\nLes éventuels frais de remise en état seront acquittés par le locataire.\n\nL'instrument de musique et tous les accessoires fournis seront retournés dans leur emballage d'origine.`
      },
      {
        titre: 'ARTICLE 12. NON-RESTITUTION DE L\'INSTRUMENT',
        contenu: `En cas de non restitution de l'instrument quel qu'en soit la raison (vol, perte, sinistre, etc...), l'instrument sera facturé à sa valeur: ${formatPricePDF(instrument.prix_vente || location.montant_caution || 1150)}\n\nLe loueur se donne la possibilité de recourir à tous les moyens légaux pour procéder à la régularisation du litige.`
      },
      {
        titre: 'ARTICLE 13. DÉGRADATIONS - RÉPARATIONS',
        contenu: `En cas de dégradation de l'instrument quelle qu'en soit la raison, la réparation de l'instrument sera à la charge du locataire à hauteur du devis établi par l'artisan choisi par le prêteur.`
      },
      {
        titre: 'ARTICLE 14. FOURNITURE D\'ACCESSOIRES',
        contenu: `Si l'instrument de musique est fourni avec des accessoires tels que housse de transport, boites, cordons, etc., ceux-ci devront être utilisés correctement et rendus en bon état en même temps que l'instrument.\n\nLa liste des accessoires fournis étant:\n${location.accessoires || 'Housse de transport'}`
      },
      {
        titre: 'ARTICLE 15. RENSEIGNEMENTS FOURNIS',
        contenu: `Le locataire s'engage à signaler au loueur tout changement d'adresse, de téléphone ou autre renseignement fourni au loueur.\n\nCeci ne met en aucun cas fin à la location ni oblige le locataire à rendre l'instrument.`
      }
    ];
    
    // Afficher les articles
    articles.forEach(article => {
      checkSpace(30);
      
      // Titre de l'article
      doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...PDF_CONFIG.colors.dark);
      doc.text(article.titre, margin, y);
      y += 6;
      
      // Contenu de l'article
      doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_CONFIG.colors.text);
      
      const paragraphs = article.contenu.split('\n\n');
      paragraphs.forEach(para => {
        const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), contentWidth);
        lines.forEach(line => {
          checkSpace(5);
          doc.text(line, margin, y);
          y += 4;
        });
        y += 2;
      });
      
      y += 5;
    });
    
    // ========== ANNEXES ==========
    
    checkSpace(50);
    
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('ARTICLE 16. ANNEXES', margin, y);
    y += 6;
    
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    
    doc.text('Des photos de l\'instrument faites lors de la signature de ce contrat seront prises et échangées par email entre:', margin, y);
    y += 5;
    doc.text(`- le prêteur ${config.email || ''}`, margin, y);
    y += 4;
    doc.text(`- et le locataire ${client.email || '________________'}`, margin, y);
    
    y += 10;
    
    // Identification de l'instrument
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text('N° Identification de l\'instrument :', margin, y);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.text(instrument.reference || '________________', margin + 55, y);
    
    y += 8;
    doc.text('Description :', margin, y);
    doc.text(instrument.nom || '________________', margin + 25, y);
    
    y += 8;
    doc.text('Gamme :', margin, y);
    doc.text(instrument.gamme || '________________', margin + 20, y);
    
    // ========== SIGNATURES ==========
    
    checkSpace(60);
    y += 15;
    
    const dateContrat = new Date(location.date_debut || new Date()).toLocaleDateString('fr-FR');
    
    doc.setFontSize(9);
    doc.text(`Le, ${dateContrat}`, margin, y);
    doc.text(`Fait à, ${config.ville || 'Mériel'}`, margin + 50, y);
    
    y += 15;
    
    // Colonnes de signature
    const colWidth = contentWidth / 2 - 10;
    
    // Signature prêteur
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text('Signature du prêteur', margin, y);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.rect(margin, y + 3, colWidth, 25);
    
    // Signature locataire
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text('Signature de l\'emprunteur', margin + colWidth + 20, y);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.rect(margin + colWidth + 20, y + 3, colWidth, 25);
    
    // ========== PIED DE PAGE ==========
    
    // Numéroter les pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text(
        `${i}/${totalPages}`,
        pageWidth / 2,
        PDF_CONFIG.pageHeight - 10,
        { align: 'center' }
      );
    }

    return doc;
  }

  // ============================================================================
  // GÉNÉRATION CONTRAT DE LOCATION — FLUX PUBLIC (réservation en ligne)
  // ============================================================================

  /**
   * Génère un contrat de location PDF simplifié pour le flux public.
   * Toutes les données viennent du paramètre `data` (aucune dépendance MistralGestion).
   *
   * @param {Object} data
   * @param {Object} data.client        - { prenom, nom, email, phone, ville }
   * @param {Object} data.instrument    - { gamme, taille, tonalite, materiau, reference }
   * @param {string} data.mode          - 'atelier' | 'livraison'
   * @param {number} data.loyer         - Loyer mensuel TTC
   * @param {number} data.caution       - Montant de la caution
   * @param {number} data.frais         - Frais de livraison (si mode === 'livraison')
   * @param {string} data.date          - Date ISO du contrat
   * @returns {jsPDF} - Document PDF
   */
  function generateContratLocationPublic(data) {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = PDF_CONFIG.margin;
    const pageWidth = PDF_CONFIG.pageWidth;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;
    let pageNum = 1;

    // ========== FONCTION NOUVELLE PAGE ==========
    function newPage() {
      doc.addPage();
      pageNum++;
      y = margin;
      return y;
    }

    // ========== FONCTION VÉRIFIER ESPACE ==========
    function checkSpace(needed) {
      if (y + needed > PDF_CONFIG.pageHeight - 30) {
        newPage();
      }
    }

    // ========== EN-TÊTE ==========

    // Logo (12x12mm)
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, y - 2, 12, 12);
    } catch (e) {
      console.warn('[PDF] Logo non chargé:', e.message);
    }

    // Nom de la marque (à droite du logo)
    doc.setFontSize(16);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('Mistral Pans', margin + 15, y + 3);

    // Tagline
    doc.setFontSize(8);
    doc.setFont(PDF_CONFIG.fonts.normal, 'italic');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Artisan Handpan — Île-de-France', margin + 15, y + 8);

    y += 16;

    // Titre
    doc.setFontSize(18);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.primary);
    doc.text('CONTRAT DE LOCATION D\'INSTRUMENT', pageWidth / 2, y, { align: 'center' });

    y += 4;
    drawTealLine(doc, margin + 30, y, pageWidth - margin - 30, 0.4);

    y += 12;

    // ========== PARTIES ==========

    doc.setFontSize(10);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('ENTRE LES SOUSSIGNÉS :', margin, y);

    y += 8;

    // Loueur
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text('Loueur :', margin, y);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text('Mistral Pans — Artisan Handpan, Île-de-France', margin + 18, y);

    y += 5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.text('désigné(e) comme « le prêteur ou loueur ».', margin, y);

    y += 10;

    // Locataire
    doc.text('Locataire :', margin, y);
    const clientNom = `${data.client.prenom || ''} ${data.client.nom || ''}`.trim() || '________________';
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text(clientNom, margin + 22, y);

    y += 5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    if (data.client.email) {
      doc.text(`Email : ${data.client.email}`, margin + 5, y);
      y += 4.5;
    }
    if (data.client.phone) {
      doc.text(`Téléphone : ${data.client.phone}`, margin + 5, y);
      y += 4.5;
    }
    if (data.client.ville) {
      doc.text(`Ville : ${data.client.ville}`, margin + 5, y);
      y += 4.5;
    }

    doc.text('désigné(e) comme « l\'emprunteur et locataire ».', margin, y);

    y += 12;

    // ========== INSTRUMENT (carte avec bordure) ==========

    checkSpace(40);

    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('INSTRUMENT LOUÉ', margin, y);
    y += 3;

    const instrCardY = y;
    const instrCardH = 28;
    drawCardBlock(doc, margin, instrCardY, contentWidth, instrCardH, PDF_CONFIG.colors.primary);

    y += 6;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.text);

    const instrCol1X = margin + 5;
    const instrCol2X = margin + contentWidth / 2;

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Gamme :', instrCol1X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(data.instrument.gamme || '—', instrCol1X + 20, y);

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Taille :', instrCol2X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(data.instrument.taille || '—', instrCol2X + 18, y);

    y += 6;
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Tonalité :', instrCol1X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(data.instrument.tonalite || '—', instrCol1X + 20, y);

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Matériau :', instrCol2X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(data.instrument.materiau || '—', instrCol2X + 18, y);

    y += 6;
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Référence :', instrCol1X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(data.instrument.reference || '—', instrCol1X + 22, y);

    y = instrCardY + instrCardH + 8;

    // ========== CONDITIONS (carte avec bordure) ==========

    checkSpace(45);

    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('CONDITIONS DE LOCATION', margin, y);
    y += 3;

    const condCardY = y;
    const isLivraison = data.mode === 'livraison';
    const condCardH = isLivraison ? 34 : 28;
    drawCardBlock(doc, margin, condCardY, contentWidth, condCardH, PDF_CONFIG.colors.primary);

    y += 6;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(9);

    // Loyer mensuel
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Loyer mensuel :', instrCol1X, y);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(formatPricePDF(data.loyer), instrCol1X + 30, y);

    // Caution
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Caution :', instrCol2X, y);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(formatPricePDF(data.caution), instrCol2X + 18, y);

    y += 6;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Durée minimale :', instrCol1X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text('3 mois', instrCol1X + 30, y);

    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Mode :', instrCol2X, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(isLivraison ? 'Livraison à domicile' : 'Retrait à l\'atelier', instrCol2X + 18, y);

    if (isLivraison) {
      y += 6;
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text('Frais de livraison :', instrCol1X, y);
      doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
      doc.setTextColor(...PDF_CONFIG.colors.dark);
      doc.text(formatPricePDF(data.frais), instrCol1X + 35, y);
    }

    y = condCardY + condCardH + 8;

    // ========== ARTICLES ==========

    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text('L\'emprunteur / locataire s\'engage à observer scrupuleusement les prescriptions ci-après :', margin, y);

    y += 10;

    const cautionMode = isLivraison ? 'swikly' : 'cheque';

    const articles = [
      {
        titre: 'ARTICLE 1. OBJET DU CONTRAT',
        contenu: `Dans le cadre de la gestion de son parc instrumental, et dans les limites de ses disponibilités, le loueur peut proposer des prêts ou des locations d'instrument dans les conditions définies ci-après et dans les annexes contractuelles.\n\nLe prêt ou la location d'un instrument est conditionné par un contrat de location entre le loueur et l'emprunteur. À tout contrat correspond la location d'un instrument unique et identifié, sous la responsabilité de l'emprunteur.`
      },
      {
        titre: 'ARTICLE 2. CONDITIONS DE VALIDATION',
        contenu: `Le contrat de prêt ou de location est nominatif et ne peut en aucun cas être cédé.\nSeul le prêteur est habilité à valider le contrat de location ou de prêt d'instruments de musique.\nLe prêteur est chargé de procéder à l'évaluation de l'état des instruments.\nUne copie du contrat est remise au locataire, l'original est conservé par le loueur.`
      },
      {
        titre: 'ARTICLE 3. MISE À DISPOSITION ET RETRAIT DE L\'INSTRUMENT',
        contenu: `Le prêteur s'engage à mettre à disposition de l'emprunteur un instrument de musique en bon état de fonctionnement et l'informe sur les conditions d'utilisation.\nL'emprunteur accepte l'instrument dans l'état de marche présenté.\nEn conséquence, le prêteur n'est pas tenu pour responsable en cas de mauvais fonctionnement ou de détérioration dudit instrument de musique.\nLe prêteur est chargé de vérifier l'état de l'instrument au moment de l'attribution.\nLors de la remise d'un instrument, le prêteur se doit d'indiquer clairement au loueur les gestes techniques de maintenance et d'entretien de l'instrument prêté ou loué.`
      },
      {
        titre: 'ARTICLE 4. DURÉE DU CONTRAT',
        contenu: `La durée du contrat est de 3 mois minimum, puis, par tacite reconduction pour des durées de 1 mois.`
      },
      {
        titre: 'ARTICLE 5. LOYER',
        contenu: `Le loyer de l'instrument est de ${formatPricePDF(data.loyer)} TTC par mois.`
      },
      {
        titre: 'ARTICLE 6. DÉLAI DE RÉTRACTATION',
        contenu: `Le locataire bénéficie d'un délai de rétractation de sept jours à compter de la date de règlement effectif du premier loyer.\n\nLe retour de l'instrument et de ses accessoires doit s'effectuer dans leur emballage d'origine afin d'en assurer le meilleur transport, ils doivent être en parfait état et au complet.\n\nTout article retourné incomplet ou abîmé sera facturé au locataire. Tout article sali sera nettoyé par le loueur aux frais du locataire.\n\nDe plus le locataire s'engage à venir restituer l'instrument en main propre.\n\nLe remboursement du premier loyer s'effectuera dans un délai maximum de 30 jours après réception des produits.`
      },
      {
        titre: 'ARTICLE 7. CAUTIONNEMENT – GARANTIE FINANCIÈRE',
        contenu: `Une garantie financière est demandée à l'emprunteur sous forme d'${cautionMode === 'swikly' ? 'une empreinte de carte bancaire via Swikly' : 'un chèque de caution'} à l'ordre du loueur dont le montant est fixé à ${formatPricePDF(data.caution)}.\n\nLa caution n'est pas encaissée sauf si, à la terminaison du contrat, l'instrument rendu n'est pas conforme :\n- absence de nettoyage,\n- accessoire manquant,\n- mauvais état manifeste résultant d'une mauvaise utilisation`
      },
      {
        titre: 'ARTICLE 8. RÉVISION, ENTRETIEN ET MAINTENANCE',
        contenu: `Les instruments et accessoires sont prêtés propres, en bon état.\n\nL'entretien courant est à la charge de l'emprunteur:\nNettoyage au chiffon microfibre régulier.\nSelon l'état de la couche de protection de l'instrument, graissage annuel à l'huile de coco ou Phoenix oil.\n\nTout incident entravant le bon fonctionnement sera signalé au prêteur et toute réparation nécessaire sera à la charge de l'emprunteur.\n\nEn cas de détérioration, la remise en état ou le remplacement à équivalent de l'instrument reste à la charge de l'emprunteur.\n\nLe maintien en bon état de l'instrument prêté, dans une utilisation normale nécessite une révision annuelle.`
      },
      {
        titre: 'ARTICLE 9. ASSURANCE',
        contenu: `L'emprunteur se reconnaît responsable de toute dégradation survenue à l'instrument ou à ses accessoires. La souscription d'une assurance pour l'instrument est à la charge de l'emprunteur.`
      },
      {
        titre: 'ARTICLE 10. RÉSILIATION',
        contenu: `La résiliation du contrat peut intervenir à tout instant. Elle peut être :\n\n1. À l'initiative du loueur en cas de non-paiement du loyer à l'échéance d'un renouvellement de contrat.\n\nD'autre part, le contrat sera rompu automatiquement :\n- si l'une au moins des clauses du contrat n'est pas respectée,\n- si le prêteur en demande la restitution, notamment pour cause de dégradation.\n\n2. À l'initiative du locataire, la résiliation étant effective à la fin du mois en cours.\n\nLe prêteur se réserve le droit d'encaisser la caution si l'une des clauses du contrat n'a pas été respecté par le locataire, notamment en matière d'entretien et de maintenance de l'instrument.`
      },
      {
        titre: 'ARTICLE 11. RESTITUTION DE L\'INSTRUMENT',
        contenu: `Seul le prêteur est habilité à apprécier l'état de l'instrument restitué.\n\nÀ la fin de la location, le locataire restituera en main propre au loueur l'instrument de musique et ses accessoires.\n\nL'instrument de musique et ses accessoires seront rendus en parfait état cosmétique et de fonctionnement.\n\nLes éventuels frais de remise en état seront acquittés par le locataire.\n\nL'instrument de musique et tous les accessoires fournis seront retournés dans leur emballage d'origine.`
      },
      {
        titre: 'ARTICLE 12. NON-RESTITUTION DE L\'INSTRUMENT',
        contenu: `En cas de non restitution de l'instrument quel qu'en soit la raison (vol, perte, sinistre, etc...), l'instrument sera facturé à sa valeur: ${formatPricePDF(data.caution)}\n\nLe loueur se donne la possibilité de recourir à tous les moyens légaux pour procéder à la régularisation du litige.`
      },
      {
        titre: 'ARTICLE 13. DÉGRADATIONS - RÉPARATIONS',
        contenu: `En cas de dégradation de l'instrument quelle qu'en soit la raison, la réparation de l'instrument sera à la charge du locataire à hauteur du devis établi par l'artisan choisi par le prêteur.`
      },
      {
        titre: 'ARTICLE 14. FOURNITURE D\'ACCESSOIRES',
        contenu: `Si l'instrument de musique est fourni avec des accessoires tels que housse de transport, boites, cordons, etc., ceux-ci devront être utilisés correctement et rendus en bon état en même temps que l'instrument.`
      },
      {
        titre: 'ARTICLE 15. RENSEIGNEMENTS FOURNIS',
        contenu: `Le locataire s'engage à signaler au loueur tout changement d'adresse, de téléphone ou autre renseignement fourni au loueur.\n\nCeci ne met en aucun cas fin à la location ni oblige le locataire à rendre l'instrument.`
      }
    ];

    // Afficher les articles
    articles.forEach(article => {
      checkSpace(30);

      // Titre de l'article
      doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...PDF_CONFIG.colors.dark);
      doc.text(article.titre, margin, y);
      y += 6;

      // Contenu de l'article
      doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_CONFIG.colors.text);

      const paragraphs = article.contenu.split('\n\n');
      paragraphs.forEach(para => {
        const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), contentWidth);
        lines.forEach(line => {
          checkSpace(5);
          doc.text(line, margin, y);
          y += 4;
        });
        y += 2;
      });

      y += 5;
    });

    // ========== SIGNATURES ==========

    checkSpace(60);
    y += 10;

    const dateContrat = data.date
      ? new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFontSize(9);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(`Le, ${dateContrat}`, margin, y);

    y += 15;

    // Colonnes de signature
    const colWidth = contentWidth / 2 - 10;

    // Signature prêteur
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('Signature du prêteur', margin, y);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setDrawColor(...PDF_CONFIG.colors.light);
    doc.rect(margin, y + 3, colWidth, 25);

    // Signature locataire
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text('Signature de l\'emprunteur', margin + colWidth + 20, y);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.rect(margin + colWidth + 20, y + 3, colWidth, 25);

    // ========== NUMÉROTATION DES PAGES ==========

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text(
        `${i}/${totalPages}`,
        pageWidth / 2,
        PDF_CONFIG.pageHeight - 10,
        { align: 'center' }
      );
    }

    return doc;
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================
  
  window.MistralPDF = {
    LOGO_BASE64,
    generateFacturePDF,
    generateContratPDF,
    generateContratLocationPublic,
    
    /**
     * Génère et télécharge une facture par ID
     */
    generateFacture(id) {
      if (!window.MistralGestion) {
        console.error('MistralGestion non disponible');
        return false;
      }
      const facture = window.MistralGestion.Factures.get(id);
      if (!facture) {
        console.error('Facture non trouvée:', id);
        return false;
      }
      const doc = generateFacturePDF(facture);
      doc.save(`Facture_${facture.numero || id}.pdf`);
      return true;
    },
    
    /**
     * Génère et télécharge un contrat par ID
     */
    generateContrat(id) {
      if (!window.MistralGestion) {
        console.error('MistralGestion non disponible');
        return false;
      }
      const location = window.MistralGestion.Locations.get(id);
      if (!location) {
        console.error('Location non trouvée:', id);
        return false;
      }
      const client = window.MistralGestion.Clients.get(location.client_id);
      const clientNom = client ? `${client.nom || 'Client'}` : 'Client';
      const doc = generateContratPDF(location);
      doc.save(`Contrat_Location_${clientNom}_${location.date_debut || 'draft'}.pdf`);
      return true;
    },
    
    /**
     * Génère et télécharge une facture (objet)
     */
    downloadFacture(facture) {
      const doc = generateFacturePDF(facture);
      doc.save(`Facture_${facture.numero}.pdf`);
    },
    
    /**
     * Génère et télécharge un contrat (objet)
     */
    downloadContrat(location) {
      const client = window.MistralGestion ? window.MistralGestion.Clients.get(location.client_id) : {};
      const clientNom = client ? `${client.nom || 'Client'}` : 'Client';
      const doc = generateContratPDF(location);
      doc.save(`Contrat_Location_${clientNom}_${location.date_debut || 'draft'}.pdf`);
    },
    
    /**
     * Ouvre la facture dans un nouvel onglet
     */
    previewFacture(facture) {
      const doc = generateFacturePDF(facture);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    },
    
    /**
     * Ouvre le contrat dans un nouvel onglet
     */
    previewContrat(location) {
      const doc = generateContratPDF(location);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  // Alias pour compatibilité avec admin-ui.js
  window.MistralGestionPDF = window.MistralPDF;

})(window);
