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

  // ============================================================================
  // GÉNÉRATION FACTURE
  // ============================================================================
  
  /**
   * Génère une facture PDF
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
    
    // Nom de l'entreprise
    doc.setFontSize(24);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(config.marque || 'Mistral Pan', margin, y + 8);
    
    // Type de facture (aligné à droite)
    doc.setFontSize(20);
    doc.setTextColor(...PDF_CONFIG.colors.primary);
    const typeLabel = facture.type === 'avoir' ? 'AVOIR' : 'FACTURE';
    doc.text(typeLabel, pageWidth - margin, y + 8, { align: 'right' });
    
    y += 15;
    
    // Numéro de facture
    doc.setFontSize(11);
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text(`N° ${facture.numero}`, pageWidth - margin, y, { align: 'right' });
    
    y += 5;
    
    // Date
    const dateFormatted = new Date(facture.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Date : ${dateFormatted}`, pageWidth - margin, y, { align: 'right' });
    
    y += 15;
    
    // ========== INFORMATIONS VENDEUR / CLIENT ==========
    
    // Bloc vendeur (gauche)
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('ÉMETTEUR', margin, y);
    
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.text(config.nom || 'Adrien Santamaria', margin, y);
    
    y += 5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.text(config.adresse || '', margin, y);
    y += 4;
    doc.text(`${config.codePostal || ''} ${config.ville || ''}`, margin, y);
    y += 4;
    doc.text(`SIRET : ${config.siret || ''}`, margin, y);
    
    // Bloc client (droite)
    const clientX = pageWidth / 2 + 10;
    let clientY = y - 18;
    
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('DESTINATAIRE', clientX, clientY);
    
    clientY += 5;
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    
    const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Client';
    doc.text(clientNom, clientX, clientY);
    
    clientY += 5;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    if (client && client.adresse) {
      const adresseLines = client.adresse.split('\n');
      adresseLines.forEach(line => {
        doc.text(line.trim(), clientX, clientY);
        clientY += 4;
      });
    }
    
    y += 20;
    
    // ========== TABLEAU DES LIGNES ==========
    
    // En-tête du tableau
    const colWidths = {
      description: contentWidth - 60,
      qte: 15,
      pu: 25,
      total: 20
    };
    
    doc.setFillColor(...PDF_CONFIG.colors.primary);
    doc.rect(margin, y, contentWidth, 8, 'F');
    
    doc.setFontSize(9);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.white);
    
    let colX = margin + 3;
    doc.text('Désignation', colX, y + 5.5);
    colX += colWidths.description;
    doc.text('Qté', colX, y + 5.5, { align: 'center' });
    colX += colWidths.qte;
    doc.text('P.U. HT', colX + colWidths.pu / 2, y + 5.5, { align: 'center' });
    colX += colWidths.pu;
    doc.text('Total HT', colX + colWidths.total / 2, y + 5.5, { align: 'center' });
    
    y += 10;
    
    // Lignes du tableau
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setTextColor(...PDF_CONFIG.colors.text);
    
    const lignes = facture.lignes || [];
    lignes.forEach((ligne, index) => {
      // Alternance de couleur de fond
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 1, contentWidth, 7, 'F');
      }
      
      colX = margin + 3;
      
      // Description (avec retour à la ligne si nécessaire)
      const descLines = doc.splitTextToSize(ligne.description || '', colWidths.description - 5);
      doc.text(descLines[0] || '', colX, y + 4);
      
      colX += colWidths.description;
      doc.text(String(ligne.quantite || 1), colX, y + 4, { align: 'center' });
      
      colX += colWidths.qte;
      doc.text(formatPricePDF(ligne.prix_unitaire), colX + colWidths.pu - 3, y + 4, { align: 'right' });
      
      colX += colWidths.pu;
      doc.text(formatPricePDF(ligne.total), colX + colWidths.total - 3, y + 4, { align: 'right' });
      
      y += 7;
      
      // Lignes supplémentaires de description
      if (descLines.length > 1) {
        for (let i = 1; i < descLines.length; i++) {
          doc.text(descLines[i], margin + 3, y + 4);
          y += 5;
        }
      }
    });
    
    // Ligne de séparation
    y += 3;
    doc.setDrawColor(...PDF_CONFIG.colors.light);
    doc.line(margin, y, margin + contentWidth, y);
    
    y += 8;
    
    // ========== TOTAUX ==========
    
    const totalX = pageWidth - margin - 60;
    
    // Sous-total
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('Sous-total HT', totalX, y);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.text(formatPricePDF(facture.sous_total), pageWidth - margin, y, { align: 'right' });
    
    y += 6;
    
    // Acomptes déduits (si applicable)
    if (facture.acomptes_deduits && facture.acomptes_deduits > 0) {
      doc.setTextColor(...PDF_CONFIG.colors.muted);
      doc.text('Acomptes déduits', totalX, y);
      doc.setTextColor(...PDF_CONFIG.colors.text);
      doc.text(`- ${formatPricePDF(facture.acomptes_deduits)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }
    
    // Total
    doc.setFillColor(...PDF_CONFIG.colors.primary);
    doc.rect(totalX - 5, y - 1, 65, 10, 'F');
    
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PDF_CONFIG.colors.white);
    doc.text('TOTAL NET À PAYER', totalX, y + 6);
    doc.text(formatPricePDF(facture.total), pageWidth - margin - 2, y + 6, { align: 'right' });
    
    y += 15;
    
    // Mention TVA
    doc.setFont(PDF_CONFIG.fonts.normal, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text('TVA non applicable, article 293 B du Code Général des Impôts', margin, y);
    
    y += 15;
    
    // ========== INFORMATIONS DE PAIEMENT ==========
    
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 35, 'F');
    
    y += 6;
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text('Informations de paiement', margin + 5, y);
    
    y += 6;
    doc.setFont(PDF_CONFIG.fonts.normal, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    
    doc.text(`Titulaire : ${config.nom || ''}`, margin + 5, y);
    y += 5;
    doc.text(`IBAN : ${config.iban || ''}`, margin + 5, y);
    y += 5;
    doc.text(`BIC : ${config.bic || ''}`, margin + 5, y);
    y += 5;
    doc.text(`Banque : ${config.banque || ''}`, margin + 5, y);
    
    // ========== PIED DE PAGE ==========
    
    const footerY = PDF_CONFIG.pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text(
      `${config.marque || 'Mistral Pan'} – ${config.nom || ''} – SIRET ${config.siret || ''}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.text(
      `${config.email || ''} – ${config.telephone || ''}`,
      pageWidth / 2,
      footerY + 4,
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
    
    // Logo / Nom de l'entreprise
    doc.setFontSize(14);
    doc.setFont(PDF_CONFIG.fonts.bold, 'bold');
    doc.setTextColor(...PDF_CONFIG.colors.dark);
    doc.text(config.marque || 'Mistral Pan', margin, y + 8);
    
    y += 20;
    
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
    doc.text(`Entre la société ${config.marque || 'Mistral Pan'} domiciliée au ${config.adresse || ''} - ${config.codePostal || ''} ${config.ville || ''}`, margin, y);
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
  // API PUBLIQUE
  // ============================================================================
  
  window.MistralPDF = {
    generateFacturePDF,
    generateContratPDF,
    
    /**
     * Génère et télécharge une facture par ID
     */
    generateFacture(id) {
      if (!window.MistralGestion) {
        console.error('MistralGestion non disponible');
        return;
      }
      const facture = window.MistralGestion.Factures.get(id);
      if (!facture) {
        console.error('Facture non trouvée:', id);
        return;
      }
      const doc = generateFacturePDF(facture);
      doc.save(`Facture_${facture.numero || id}.pdf`);
    },
    
    /**
     * Génère et télécharge un contrat par ID
     */
    generateContrat(id) {
      if (!window.MistralGestion) {
        console.error('MistralGestion non disponible');
        return;
      }
      const location = window.MistralGestion.Locations.get(id);
      if (!location) {
        console.error('Location non trouvée:', id);
        return;
      }
      const client = window.MistralGestion.Clients.get(location.client_id);
      const clientNom = client ? `${client.nom || 'Client'}` : 'Client';
      const doc = generateContratPDF(location);
      doc.save(`Contrat_Location_${clientNom}_${location.date_debut || 'draft'}.pdf`);
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

  console.log('✅ MistralPDF chargé');
  
  // Alias pour compatibilité avec admin-ui.js
  window.MistralGestionPDF = window.MistralPDF;

})(window);
