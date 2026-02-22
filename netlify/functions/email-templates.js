/**
 * Templates Emails — Mistral Pans
 * Utilise le systeme EmailBuilder pour coherence maximale
 *
 * 13 templates couvrant tous les emails transactionnels :
 * - Contact, Invoice, Order, Rental, Payment, Shipping, Delivery
 * - Balance Request, New Order Notification, Monthly Report
 * - Rental Reservation, Rental Availability, Initiation
 */

const { EmailBuilder, EmailHelpers, DESIGN } = require('./utils/email-template-system');
const { formatPrice, formatDate, isValidEmail, escape, sanitizeEmailHeader } = EmailHelpers;

/** Taille max PDF base64 (~5 Mo decode) */
const MAX_PDF_BASE64_LENGTH = 7 * 1024 * 1024;

// ============================================================================
// 1. CONTACT
// ============================================================================

function buildContactEmail(data) {
  const { firstname, lastname, email, phone, message, type } = data;

  if (!isValidEmail(email)) throw new Error('Email invalide');

  const clientName = sanitizeEmailHeader(`${firstname} ${lastname}`);
  const safeEmail = email.trim().toLowerCase();

  const rows = [
    ['Nom', `${firstname} ${lastname}`],
    ['Email', safeEmail],
    ['Telephone', phone || 'Non renseigne']
  ];
  if (type) rows.push(['Type', type]);

  return EmailBuilder.create()
    .meta({
      to: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      replyTo: { email: safeEmail, name: clientName },
      subject: `[Mistral Pans] Message de ${sanitizeEmailHeader(firstname)} ${sanitizeEmailHeader(lastname)}${type ? ` — ${sanitizeEmailHeader(type)}` : ''}`
    })
    .header('Nouveau message', `De ${firstname} ${lastname}`)
    .content()
      .detailTable(rows)
      .heading('Message', 3)
      .raw(`<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: ${DESIGN.colors.text};">${escape(message)}</div>`)
    .close()
    .footerMinimal('Email envoye depuis le formulaire de contact de mistralpans.fr')
    .build();
}

// ============================================================================
// 2. INVOICE (FACTURE)
// ============================================================================

function buildInvoiceEmail(data) {
  const { client, facture, pdfBase64 } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);

  const email = EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      subject: `Facture ${facture.numero} — Mistral Pans`
    })
    .header('Votre facture', `Facture ${facture.numero}`)
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .text('Veuillez trouver ci-joint votre facture.')
      .heading('Details', 3)
      .detailTable([
        ['Numero', facture.numero],
        ['Date d\'emission', formatDate(facture.date_emission || facture.date)],
        ['Echeance', facture.date_echeance ? formatDate(facture.date_echeance) : 'A reception']
      ])
      .box(
        `<strong style="font-size: 18px;">${escape(formatPrice(facture.montant_ttc || facture.total || 0))}</strong>`,
        { variant: 'success', title: 'Montant total' }
      )
      .text('La facture PDF est jointe a cet email.', { color: DESIGN.colors.textLight, size: '13px' })
      .spacer('md')
      .text('Merci de votre confiance.')
      .paragraph(`Cordialement,<br><strong>Mistral Pans</strong>`)
    .close()
    .footer()
    .build();

  // Ajouter le PDF en piece jointe
  if (pdfBase64 && pdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    email.attachment = [{
      content: pdfBase64,
      name: `facture-${facture.numero}.pdf`,
      type: 'application/pdf'
    }];
  }

  return email;
}

// ============================================================================
// 3. ORDER CONFIRMATION (COMMANDE)
// ============================================================================

function buildOrderConfirmationEmail(data) {
  const { client, order, instrument } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const orderRef = order.reference || `CMD-${order.id}`;
  const gamme = instrument?.gamme || order.specifications?.gamme || 'Sur mesure';
  const taille = instrument?.taille || order.specifications?.taille || '';
  const prix = formatPrice(order.montant || order.prix_total || 0);
  const acompte = formatPrice(order.acompte || 300);
  const trackingUrl = `https://mistralpans.fr/suivi.html?ref=${encodeURIComponent(orderRef)}&email=${encodeURIComponent(clientEmail)}`;

  return EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      subject: `Commande ${orderRef} confirmee — Mistral Pans`
    })
    .header('Commande confirmee !', orderRef, { color: DESIGN.colors.accent })
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`, { bold: true })
      .text('Merci pour votre commande ! Nous sommes ravis de vous accompagner dans votre aventure musicale.')
      .heading('Recapitulatif', 3)
      .detailTable([
        ['Reference', orderRef],
        ['Instrument', [gamme, taille].filter(Boolean).join(' ')],
        ['Prix total', prix],
        ['Acompte verse', acompte]
      ], { highlight: true })
      .divider()
      .heading('Prochaines etapes', 3)
      .list([
        'Nous vous contacterons pour finaliser les details de votre instrument',
        'Fabrication artisanale (delai estime : 4-8 semaines)',
        'Paiement du solde avant expedition',
        'Livraison de votre handpan !'
      ], { ordered: true })
      .box(
        `<a href="${escape(trackingUrl)}" style="color: ${DESIGN.colors.primary}; font-weight: 600;">Suivre ma commande &rarr;</a>`,
        { variant: 'info', title: 'Suivi de commande' }
      )
      .text('Si vous avez des questions, n\'hesitez pas a nous contacter.', { color: DESIGN.colors.textLight, size: '13px' })
      .spacer('md')
      .paragraph(`Musicalement,<br><strong>L'equipe Mistral Pans</strong>`)
    .close()
    .footer()
    .build();
}

// ============================================================================
// 4. RENTAL CONFIRMATION (LOCATION)
// ============================================================================

function buildRentalConfirmationEmail(data) {
  const { client, rental, instrument } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);

  return EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      subject: 'Confirmation de location — Mistral Pans'
    })
    .header('Location confirmee', 'Bienvenue a Mistral Pans')
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .text('Votre demande de location a bien ete enregistree. Voici le recapitulatif :')
      .heading('Votre location', 3)
      .detailTable([
        ['Instrument', instrument?.gamme || 'Handpan'],
        ['Loyer mensuel', `${formatPrice(rental.loyer || 60)}/mois`],
        ['Caution', formatPrice(rental.caution || instrument?.prix_vente || 0)],
        ['Date de debut', formatDate(rental.date_debut)]
      ])
      .heading('Documents requis', 3)
      .list([
        'Copie de piece d\'identite',
        'Justificatif de domicile',
        'RIB pour le prelevement mensuel'
      ])
      .box(
        'Nous vous contacterons prochainement pour finaliser votre location et organiser le retrait ou la livraison de l\'instrument.',
        { variant: 'info' }
      )
      .spacer('md')
      .paragraph(`A tres bientot,<br><strong>L'equipe Mistral Pans</strong>`)
    .close()
    .footer()
    .build();
}

// ============================================================================
// 5. RENTAL RESERVATION (avec contrat PDF et caution Swikly)
// ============================================================================

function buildRentalReservationEmail(data) {
  const { client, instrument, mode, loyer, caution, frais, swiklyUrl, pdfBase64 } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const instrumentLabel = [instrument?.gamme, instrument?.taille, instrument?.tonalite]
    .filter(Boolean).join(' — ') || 'Handpan';
  const isLivraison = mode === 'livraison';
  const modeLabel = isLivraison ? 'Livraison' : 'Retrait atelier';

  const rows = [
    ['Instrument', instrumentLabel],
    ['Loyer', `${formatPrice(loyer)}/mois`],
    ['Caution', formatPrice(caution)],
    ['Mode', modeLabel]
  ];
  if (isLivraison && frais) {
    rows.push(['Frais de dossier + expedition', formatPrice(frais)]);
  }

  let email = EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      subject: 'Votre reservation de location — Mistral Pans'
    })
    .header('Reservation de location', 'Votre contrat en piece jointe')
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .text('Votre demande de location a bien ete enregistree. Voici le recapitulatif et votre contrat de location en piece jointe.')
      .heading('Votre reservation', 3)
      .detailTable(rows)
      .heading('Pieces a fournir par retour d\'email', 3)
      .list([
        'Copie piece d\'identite',
        'Copie justificatif de domicile'
      ]);

  // Bloc caution selon le mode
  if (isLivraison && swiklyUrl) {
    email
      .button('Deposer ma caution en ligne', swiklyUrl)
      .text(
        `La caution de ${formatPrice(caution)} sera pre-autorisee sur votre carte bancaire via Swikly (non debitee).`,
        { color: DESIGN.colors.textLight, size: '12px', align: 'center' }
      );
  } else if (!isLivraison) {
    email.box(
      `Merci de prevoir un cheque de caution de <strong>${escape(formatPrice(caution))}</strong> a l'ordre de Mistral Pans lors du retrait de l'instrument.`,
      { variant: 'warning' }
    );
  }

  const result = email
    .spacer('md')
    .paragraph(`A tres bientot,<br><strong>L'equipe Mistral Pans</strong>`)
    .close()
    .footer()
    .build();

  // Contrat PDF en piece jointe
  if (pdfBase64 && pdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    result.attachment = [{
      content: pdfBase64,
      name: `contrat-location-${new Date().toISOString().slice(0, 10)}.pdf`,
      type: 'application/pdf'
    }];
  }

  return result;
}

// ============================================================================
// 6. RENTAL AVAILABILITY (WAITLIST)
// ============================================================================

function buildRentalAvailabilityEmail(data) {
  const { email, instrument } = data;

  if (!isValidEmail(email)) throw new Error('Email invalide');

  return EmailBuilder.create()
    .meta({
      to: [{ email: email.trim().toLowerCase(), name: '' }],
      subject: 'Un handpan est disponible a la location — Mistral Pans'
    })
    .header('Instrument disponible !', 'Location', { color: DESIGN.colors.accent })
    .content()
      .text('Bonjour,')
      .text('Un nouvel instrument est disponible a la location :')
      .box(
        `<div style="text-align: center; font-size: 20px; font-weight: 700; color: ${DESIGN.colors.accent};">${escape(instrument || 'Handpan')}</div>`,
        { variant: 'success' }
      )
      .text('Rendez-vous sur notre page location pour le reserver.')
      .button('Voir les instruments disponibles', 'https://mistralpans.fr/location.html')
      .spacer('md')
      .paragraph(`A tres bientot,<br><strong>L'equipe Mistral Pans</strong>`)
    .close()
    .footer({ note: 'Vous recevez cet email car vous avez demande a etre notifie de la disponibilite d\'un instrument a la location.' })
    .build();
}

// ============================================================================
// 7. PAYMENT CONFIRMATION
// ============================================================================

function buildPaymentConfirmationEmail(data) {
  const { client, payment, order } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const typeLabel = payment.type === 'acompte' ? 'Acompte' :
                    payment.type === 'solde' ? 'Solde' : 'Paiement';
  const isRetrait = data.shippingMethod === 'retrait';
  const calendlyUrl = 'https://calendly.com/adrien-santamaria/30min';

  let email = EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      subject: `Confirmation de paiement — Mistral Pans`
    })
    .header('Paiement recu !', typeLabel, { color: DESIGN.colors.accent })
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .text('Nous avons bien recu votre paiement. Merci !', { bold: true })
      .detailTable([
        ['Type', typeLabel],
        ['Montant', formatPrice(payment.amount || 0)],
        ['Reference', payment.reference || order?.reference || '—']
      ], { highlight: true });

  if (isRetrait) {
    email.box(
      `Vous avez choisi le <strong>retrait a l'atelier</strong>.<br><br>
       <a href="${escape(calendlyUrl)}" style="color: ${DESIGN.colors.primary}; font-weight: 600;">Planifier votre creneau &rarr;</a>`,
      { variant: 'warning', title: 'Retrait atelier' }
    );
  }

  return email
    .spacer('md')
    .text('Un recu detaille vous sera envoye separement.', { color: DESIGN.colors.textLight, size: '13px' })
    .spacer('md')
    .paragraph(`Merci de votre confiance,<br><strong>L'equipe Mistral Pans</strong>`)
    .close()
    .footer()
    .build();
}

// ============================================================================
// 8. NEW ORDER NOTIFICATION (ARTISAN)
// ============================================================================

function buildNewOrderNotificationEmail(data) {
  const { order, client, payment } = data;
  const isStock = order.source === 'stock';
  const sourceLabel = isStock ? 'En stock' : 'Sur mesure';
  const paymentLabel = payment.isFullPayment ? 'Paiement integral' : 'Acompte (30%)';

  const instrumentRows = [
    ['Produit', order.productName || '—']
  ];
  if (order.gamme) instrumentRows.push(['Gamme', order.gamme]);
  if (order.taille) instrumentRows.push(['Taille', order.taille]);
  instrumentRows.push(['Source', sourceLabel]);
  if (order.instrumentId) instrumentRows.push(['ID instrument', order.instrumentId]);

  const financialRows = [
    ['Type', paymentLabel],
    ['Montant paye', formatPrice(payment.amount)]
  ];
  if (!payment.isFullPayment) {
    financialRows.push(['Total commande', formatPrice(payment.totalAmount)]);
    financialRows.push(['Reste a payer', formatPrice(payment.totalAmount - payment.amount)]);
  }

  const clientRows = [
    ['Nom', `${client.prenom || ''} ${client.nom || ''}`],
    ['Email', client.email]
  ];
  if (client.telephone) clientRows.push(['Telephone', client.telephone]);

  return EmailBuilder.create()
    .meta({
      to: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
      subject: `Nouvelle commande ${order.reference} — ${sourceLabel}`
    })
    .header('Nouvelle commande !', `${order.reference} — ${sourceLabel}`)
    .content()
      .heading('Client', 3)
      .detailTable(clientRows)
      .divider()
      .heading('Instrument', 3)
      .detailTable(instrumentRows)
      .divider()
      .heading('Paiement', 3)
      .detailTable(financialRows, { highlight: true })
      .spacer('lg')
      .box(
        `<a href="https://mistralpans.fr/admin.html#commandes" style="color: ${DESIGN.colors.primary}; font-weight: 600;">Voir dans le panneau admin &rarr;</a>`,
        { variant: 'info', title: 'Action rapide' }
      )
    .close()
    .footer()
    .build();
}

// ============================================================================
// 9. BALANCE REQUEST (DEMANDE DE SOLDE)
// ============================================================================

function buildBalanceRequestEmail(data) {
  const { client, order, payment } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const trackingUrl = `https://mistralpans.fr/suivi.html?ref=${encodeURIComponent(order.reference)}&email=${encodeURIComponent(clientEmail)}`;

  let email = EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr' }],
      replyTo: { email: 'contact@mistralpans.fr', name: 'Mistral Pans' },
      subject: `Votre handpan est pret ! — Commande ${order.reference}`
    })
    .header('Votre instrument est pret !', `Commande ${order.reference}`, { color: DESIGN.colors.accent })
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .paragraph(`Votre <strong>${escape(order.productName || 'handpan')}</strong> a termine son accordage et est maintenant pret a vous rejoindre !`)
      .heading('Finalisation', 3)
      .detailTable([
        ['Solde restant', formatPrice(payment.remainingAmount)],
        ['Montant deja paye', formatPrice(payment.amount || 0)],
        ['Total commande', formatPrice(payment.totalAmount || 0)]
      ], { highlight: false });

  // Solde mis en avant
  email.box(
    `<div style="text-align: center;">
       <div style="font-size: 12px; color: ${DESIGN.colors.textLight}; margin-bottom: 4px;">Solde restant</div>
       <div style="font-size: 24px; font-weight: 700; color: ${DESIGN.colors.accent};">${escape(formatPrice(payment.remainingAmount))}</div>
     </div>`,
    { variant: 'success' }
  );

  if (payment.paymentUrl) {
    email.button('Payer le solde', payment.paymentUrl, { variant: 'success' });
  } else {
    email.text('Nous vous enverrons un lien de paiement securise dans un prochain email, ou vous pouvez nous contacter directement.');
  }

  return email
    .box(
      `<a href="${escape(trackingUrl)}" style="color: ${DESIGN.colors.primary}; font-weight: 600;">Suivre ma commande &rarr;</a>`,
      { variant: 'info', title: 'Suivi de commande' }
    )
    .close()
    .footer()
    .build();
}

// ============================================================================
// 10. SHIPPING NOTIFICATION
// ============================================================================

function buildShippingNotificationEmail(data) {
  const { client, order } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const trackingUrl = `https://mistralpans.fr/suivi.html?ref=${encodeURIComponent(order.reference)}&email=${encodeURIComponent(clientEmail)}`;

  let email = EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr' }],
      replyTo: { email: 'contact@mistralpans.fr', name: 'Mistral Pans' },
      subject: `Votre handpan est en route ! — Commande ${order.reference}`
    })
    .header('Votre instrument est en route !', `Commande ${order.reference}`)
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .paragraph(`Votre <strong>${escape(order.productName || 'handpan')}</strong> vient d'etre expedie !`);

  if (order.trackingNumber) {
    email.box(
      `<div style="text-align: center;">
         <div style="font-size: 12px; color: #1E40AF; margin-bottom: 8px;">Numero de suivi</div>
         <div style="font-family: ${DESIGN.fonts.mono}; font-size: 18px; font-weight: 700; color: #1E40AF; letter-spacing: 2px; word-break: break-all;">${escape(order.trackingNumber)}</div>
       </div>`,
      { variant: 'info' }
    );
  }

  if (order.estimatedDelivery) {
    email.paragraph(`Livraison estimee : <strong>${escape(order.estimatedDelivery)}</strong>`);
  }

  return email
    .heading('Conseils d\'entretien', 3)
    .list([
      'Rangez votre handpan dans sa housse apres chaque session',
      'Nettoyez-le avec un chiffon doux et de l\'huile de protection',
      'Evitez l\'exposition prolongee au soleil ou a l\'humidite'
    ])
    .box(
      `<a href="${escape(trackingUrl)}" style="color: ${DESIGN.colors.primary}; font-weight: 600;">Suivre ma livraison &rarr;</a>`,
      { variant: 'success', title: 'Suivi' }
    )
    .close()
    .footer()
    .build();
}

// ============================================================================
// 11. DELIVERY (LIVRAISON FINALE + CARNET ENTRETIEN)
// ============================================================================

function buildDeliveryEmail(data) {
  const { client, order, instrument, carnetPdfBase64 } = data;

  if (!isValidEmail(client.email)) throw new Error('Email client invalide');

  const clientEmail = client.email.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const gamme = instrument?.gamme || order.productName || 'Sur mesure';

  const result = EmailBuilder.create()
    .meta({
      to: [{ email: clientEmail, name: clientName }],
      bcc: [{ email: 'contact@mistralpans.fr' }],
      replyTo: { email: 'contact@mistralpans.fr', name: 'Mistral Pans' },
      subject: `Votre handpan est pret ! — ${order.reference} — Mistral Pans`
    })
    .header('Votre handpan est pret !', `Commande ${order.reference}`)
    .content()
      .text(`Bonjour ${client.prenom || 'cher client'},`)
      .paragraph(`Votre handpan <strong>${escape(gamme)}</strong> est termine et vous attend !`)
      .box(
        'Vous trouverez en piece jointe le <strong>carnet d\'entretien</strong> de votre instrument, avec toutes les informations sur sa gamme, ses notes, et les conseils pour en prendre soin.',
        { variant: 'info' }
      )
      .text('Nous vous contacterons tres prochainement pour organiser la livraison ou le retrait de votre instrument.')
      .spacer('lg')
      .paragraph(`Au plaisir de vous voir jouer,<br><strong>Mistral Pans</strong>`)
    .close()
    .footer()
    .build();

  // Carnet d'entretien en PJ
  if (carnetPdfBase64 && carnetPdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    const filename = `Carnet_entretien_${(gamme).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    result.attachment = [{
      content: carnetPdfBase64,
      name: filename,
      type: 'application/pdf'
    }];
  }

  return result;
}

// ============================================================================
// 12. INITIATION CONFIRMATION
// ============================================================================

function buildInitiationConfirmationEmail(data) {
  const { email, nom, dateLabel, horaire, prix, reference } = data;

  if (!isValidEmail(email)) throw new Error('Email invalide');

  const rows = [
    ['Date', dateLabel || data.date || 'A confirmer'],
    ['Horaire', horaire || '13h — 18h'],
    ['Lieu', 'Atelier Mistral Pans — 105 rue du bas val Mary, 95630 Meriel'],
    ['Montant', `${prix || 60} EUR`]
  ];
  if (reference) rows.push(['Reference', reference]);

  return EmailBuilder.create()
    .meta({
      to: [{ email: email.trim(), name: nom }],
      subject: `Confirmation de votre initiation handpan — ${sanitizeEmailHeader(dateLabel || data.date || '')}`
    })
    .header('Initiation confirmee !', dateLabel || data.date || '', { color: DESIGN.colors.accent })
    .content()
      .text(`Bonjour ${nom},`)
      .text('Votre inscription a l\'atelier d\'initiation au handpan est confirmee !')
      .heading('Votre atelier', 3)
      .detailTable(rows)
      .heading('Au programme', 3)
      .list([
        'Visite de l\'atelier de fabrication',
        'Presentation de l\'instrument et premiers pas',
        'Temps de jeu collectif accompagne'
      ])
      .text('Pour toute question, repondez directement a cet email.', { color: DESIGN.colors.textLight, size: '13px' })
    .close()
    .footer()
    .build();
}

// ============================================================================
// 13. MONTHLY REPORT (RAPPORT COMPTABLE)
// ============================================================================

function buildMonthlyReportEmail(data) {
  const {
    emailDest, moisLabel, mois,
    totalBICVentes, totalBICPrestations,
    totalBIC, totalBNC, totalAvoir, totalCA,
    nbFactures, factures, config, pdfBase64
  } = data;

  if (!isValidEmail(emailDest)) throw new Error('Email destinataire invalide');

  // Support granulaire (3 categories) avec fallback legacy (2 categories)
  const bicVentes = totalBICVentes !== undefined ? totalBICVentes : (totalBIC || 0);
  const bicPrestations = totalBICPrestations !== undefined ? totalBICPrestations : 0;

  const summaryRows = [
    ['BIC Ventes (71% abattement)', formatPrice(bicVentes)],
    ['BIC Prestations (50% abattement)', formatPrice(bicPrestations)],
    ['BNC (34% abattement)', formatPrice(totalBNC || 0)]
  ];
  if (totalAvoir && totalAvoir > 0) {
    summaryRows.push(['Avoirs', formatPrice(totalAvoir)]);
  }
  summaryRows.push(['Total CA', formatPrice(totalCA || 0)]);

  let email = EmailBuilder.create()
    .meta({
      to: [{ email: emailDest, name: 'Mistral Pans' }],
      subject: `Rapport comptable — ${sanitizeEmailHeader(moisLabel)}`
    })
    .header('Rapport Comptable Mensuel', moisLabel)
    .content();

  // Bloc entreprise
  if (config?.nom || config?.siret) {
    email.box(
      `<strong>${escape(config?.nom || 'Mistral Pans')}</strong>${config?.siret ? `<br><span style="color: ${DESIGN.colors.textLight}; font-size: 13px;">SIRET : ${escape(config.siret)}</span>` : ''}`,
      { variant: 'default' }
    );
  }

  email
    .heading('Synthese du mois', 3)
    .detailTable(summaryRows, { highlight: true });

  // Detail des factures
  if (factures && factures.length > 0) {
    const headers = [
      { label: 'Date' },
      { label: 'N°' },
      { label: 'Client' },
      { label: 'Type' },
      { label: 'Classification' },
      { label: 'Montant', align: 'right', bold: true }
    ];
    const tableRows = factures.map(f => [
      f.date || '',
      f.numero || '',
      f.client || '',
      f.type || '',
      f.classification || '',
      formatPrice(f.montant || 0)
    ]);

    email
      .heading(`Detail des factures (${nbFactures || factures.length})`, 3)
      .dataTable(headers, tableRows, { compact: true });
  }

  const result = email
    .close()
    .footerMinimal(`Genere automatiquement depuis l'administration Mistral Pans — ${formatDate(new Date().toISOString())}`)
    .build();

  // PDF en piece jointe
  if (pdfBase64 && pdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    result.attachment = [{
      content: pdfBase64,
      name: `rapport-comptable-${mois || 'mensuel'}.pdf`,
      type: 'application/pdf'
    }];
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  buildContactEmail,
  buildInvoiceEmail,
  buildOrderConfirmationEmail,
  buildRentalConfirmationEmail,
  buildRentalReservationEmail,
  buildRentalAvailabilityEmail,
  buildPaymentConfirmationEmail,
  buildNewOrderNotificationEmail,
  buildBalanceRequestEmail,
  buildShippingNotificationEmail,
  buildDeliveryEmail,
  buildInitiationConfirmationEmail,
  buildMonthlyReportEmail
};
