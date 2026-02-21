// Netlify Function : Envoi d'email via Brevo
// Supporte plusieurs types d'emails : contact, facture, confirmation, rapport

const { checkRateLimit, getClientIp } = require('./utils/rate-limit');

/**
 * Échappe les caractères HTML pour prévenir les attaques XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Alias used by buildBalanceRequestEmail, buildShippingNotificationEmail, buildNewOrderNotificationEmail
const sanitize = escapeHtml;

/**
 * Sanitize les en-têtes email pour prévenir l'injection
 */
function sanitizeEmailHeader(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Taille maximale d'une pièce jointe PDF en base64 (~5 Mo décodé ≈ 6.67 Mo encodé).
 * Protège contre l'épuisement mémoire par des payloads volumineux.
 */
const MAX_PDF_BASE64_LENGTH = 7 * 1024 * 1024; // ~7 Mo base64

/**
 * Valide le format d'une adresse email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Formate un prix en euros
 */
function formatPrice(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount || 0);
}

/**
 * Formate une date en français
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Non spécifiée';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Template : Email de contact
 */
function buildContactEmail(data) {
  const { firstname, lastname, email, phone, message, type } = data;

  const safeFirstname = escapeHtml(sanitizeEmailHeader(firstname));
  const safeLastname = escapeHtml(sanitizeEmailHeader(lastname));
  const safeEmail = escapeHtml(email.trim().toLowerCase());
  const safePhone = escapeHtml(sanitizeEmailHeader(phone));
  const safeMessage = escapeHtml(message);
  const safeType = escapeHtml(sanitizeEmailHeader(type));

  return {
    to: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    replyTo: {
      email: email.trim().toLowerCase(),
      name: sanitizeEmailHeader(`${firstname} ${lastname}`)
    },
    subject: `[Mistral Pans] Message de ${safeFirstname} ${safeLastname}`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          td:first-child { font-weight: bold; width: 120px; }
          .message-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 15px; white-space: pre-wrap; }
          .footer { padding: 15px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">Nouveau message</h2>
          </div>
          <div class="content">
            <table>
              <tr><td>Nom</td><td>${safeFirstname} ${safeLastname}</td></tr>
              <tr><td>Email</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              <tr><td>Téléphone</td><td>${safePhone || 'Non renseigné'}</td></tr>
              ${safeType ? `<tr><td>Type</td><td>${safeType}</td></tr>` : ''}
            </table>
            <h3>Message :</h3>
            <div class="message-box">${safeMessage}</div>
          </div>
          <div class="footer">
            Email envoyé depuis le formulaire de contact de mistralpans.fr
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Template : Facture par email
 */
function buildInvoiceEmail(data) {
  const { client, facture, pdfBase64 } = data;

  const clientEmail = client.email?.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const numero = escapeHtml(facture.numero);
  const montant = formatPrice(facture.montant_ttc || facture.total || 0);
  const dateEmission = formatDate(facture.date_emission || facture.date);
  const dateEcheance = facture.date_echeance ? formatDate(facture.date_echeance) : 'À réception';

  const emailData = {
    to: [{ email: clientEmail, name: clientName }],
    bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    subject: `Facture ${numero} - Mistral Pans`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .invoice-box { background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .invoice-box h3 { margin: 0 0 15px 0; color: #0D7377; }
          .invoice-detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .invoice-total { font-size: 24px; font-weight: bold; color: #0D7377; margin-top: 15px; }
          .cta-button { display: inline-block; background: #0D7377; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
          .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mistral Pans</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Artisan Handpan</p>
          </div>
          <div class="content">
            <p>Bonjour ${escapeHtml(client.prenom || 'cher client')},</p>

            <p>Veuillez trouver ci-joint votre facture.</p>

            <div class="invoice-box">
              <h3>Facture ${numero}</h3>
              <div class="invoice-detail">
                <span>Date d'émission</span>
                <span>${dateEmission}</span>
              </div>
              <div class="invoice-detail">
                <span>Échéance</span>
                <span>${dateEcheance}</span>
              </div>
              <div class="invoice-total">
                Montant total : ${montant}
              </div>
            </div>

            <p>La facture PDF est jointe à cet email.</p>

            <div class="signature">
              <p>Merci de votre confiance.</p>
              <p>Cordialement,<br><strong>Mistral Pans</strong></p>
            </div>
          </div>
          <div class="footer">
            <p>Mistral Pans - Artisan Handpan<br>
            Île-de-France, France<br>
            contact@mistralpans.fr</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  // Ajouter le PDF en pièce jointe si fourni (avec limite de taille)
  if (pdfBase64 && pdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    emailData.attachment = [{
      content: pdfBase64,
      name: `facture-${facture.numero}.pdf`,
      type: 'application/pdf'
    }];
  }

  return emailData;
}

/**
 * Template : Confirmation de commande
 */
function buildOrderConfirmationEmail(data) {
  const { client, order, instrument } = data;

  const clientEmail = client.email?.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const orderRef = escapeHtml(order.reference || `CMD-${order.id}`);
  const gamme = escapeHtml(instrument?.gamme || order.specifications?.gamme || 'Sur mesure');
  const taille = escapeHtml(instrument?.taille || order.specifications?.taille || '');
  const prix = formatPrice(order.montant || order.prix_total || 0);
  const acompte = formatPrice(order.acompte || 300);

  return {
    to: [{ email: clientEmail, name: clientName }],
    bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    subject: `Confirmation de commande ${orderRef} - Mistral Pans`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .success-badge { background: #3D6B4A; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin-top: 10px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .order-box { background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-detail { padding: 10px 0; border-bottom: 1px solid #eee; }
          .order-detail:last-child { border-bottom: none; }
          .label { color: #666; font-size: 14px; }
          .value { font-weight: bold; font-size: 16px; }
          .next-steps { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mistral Pans</h1>
            <div class="success-badge">✓ Commande confirmée</div>
          </div>
          <div class="content">
            <p>Bonjour ${escapeHtml(client.prenom || 'cher client')},</p>

            <p>Merci pour votre commande ! Nous sommes ravis de vous accompagner dans votre aventure musicale.</p>

            <div class="order-box">
              <h3 style="margin: 0 0 15px 0; color: #0D7377;">Récapitulatif de votre commande</h3>

              <div class="order-detail">
                <div class="label">Référence</div>
                <div class="value">${orderRef}</div>
              </div>

              <div class="order-detail">
                <div class="label">Instrument</div>
                <div class="value">${gamme} ${taille}</div>
              </div>

              <div class="order-detail">
                <div class="label">Prix total</div>
                <div class="value">${prix}</div>
              </div>

              <div class="order-detail">
                <div class="label">Acompte versé</div>
                <div class="value" style="color: #3D6B4A;">${acompte}</div>
              </div>
            </div>

            <div class="next-steps">
              <h4 style="margin: 0 0 10px 0;">Prochaines étapes</h4>
              <ol style="margin: 0; padding-left: 20px;">
                <li>Nous vous contacterons pour finaliser les détails de votre instrument</li>
                <li>Fabrication artisanale (délai estimé : 3-4 mois)</li>
                <li>Paiement du solde avant expédition</li>
                <li>Livraison de votre handpan !</li>
              </ol>
            </div>

            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>

            <p>Musicalement,<br><strong>L'équipe Mistral Pans</strong></p>
          </div>
          <div class="footer">
            <p>Mistral Pans - Artisan Handpan<br>
            Île-de-France, France<br>
            contact@mistralpans.fr</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Template : Confirmation de location
 */
function buildRentalConfirmationEmail(data) {
  const { client, rental, instrument } = data;

  const clientEmail = client.email?.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const gamme = escapeHtml(instrument?.gamme || 'Handpan');
  const loyer = formatPrice(rental.loyer || 60);
  const caution = formatPrice(rental.caution || instrument?.prix_vente || 0);
  const dateDebut = formatDate(rental.date_debut);

  return {
    to: [{ email: clientEmail, name: clientName }],
    bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    subject: `Confirmation de location - Mistral Pans`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .rental-box { background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .info-box { background: #e8f4f4; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mistral Pans</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Location d'instrument</p>
          </div>
          <div class="content">
            <p>Bonjour ${escapeHtml(client.prenom || 'cher client')},</p>

            <p>Votre demande de location a bien été enregistrée. Voici le récapitulatif :</p>

            <div class="rental-box">
              <h3 style="margin: 0 0 15px 0; color: #0D7377;">Votre location</h3>

              <div class="detail-row">
                <span>Instrument</span>
                <strong>${gamme}</strong>
              </div>

              <div class="detail-row">
                <span>Loyer mensuel</span>
                <strong>${loyer}/mois</strong>
              </div>

              <div class="detail-row">
                <span>Caution</span>
                <strong>${caution}</strong>
              </div>

              <div class="detail-row">
                <span>Date de début</span>
                <strong>${dateDebut}</strong>
              </div>
            </div>

            <div class="info-box">
              <h4 style="margin: 0 0 10px 0;">Documents requis</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Copie de pièce d'identité</li>
                <li>Justificatif de domicile</li>
                <li>RIB pour le prélèvement mensuel</li>
              </ul>
            </div>

            <p>Nous vous contacterons prochainement pour finaliser votre location et organiser le retrait ou la livraison de l'instrument.</p>

            <p>À très bientôt,<br><strong>L'équipe Mistral Pans</strong></p>
          </div>
          <div class="footer">
            <p>Mistral Pans - Artisan Handpan<br>
            Île-de-France, France<br>
            contact@mistralpans.fr</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Template : Réservation de location (avec contrat PDF et caution)
 */
function buildRentalReservationEmail(data) {
  const { client, instrument, mode, loyer, caution, frais, swiklyUrl, pdfBase64 } = data;

  const clientEmail = client.email?.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const safePrenom = escapeHtml(client.prenom || 'cher client');
  const safeGamme = escapeHtml(instrument?.gamme || 'Handpan');
  const safeTaille = escapeHtml(instrument?.taille || '');
  const safeTonalite = escapeHtml(instrument?.tonalite || '');
  const safeMateriau = escapeHtml(instrument?.materiau || '');
  const instrumentLabel = [safeGamme, safeTaille, safeTonalite].filter(Boolean).join(' — ');
  const isLivraison = mode === 'livraison';
  const modeLabel = isLivraison ? 'Livraison' : 'Retrait atelier';

  // Ligne supplémentaire frais de livraison
  const fraisRow = isLivraison && frais ? `
              <div class="detail-row">
                <span>Frais de dossier + expédition</span>
                <strong>${formatPrice(frais)}</strong>
              </div>` : '';

  // Bloc caution atelier (chèque)
  const cautionAtelierBlock = !isLivraison ? `
            <div class="info-box" style="background: #fff3cd; border-left: 4px solid #ffc107;">
              <p style="margin: 0;">Merci de prévoir un chèque de caution de <strong>${formatPrice(caution)}</strong> à l'ordre de Mistral Pans lors du retrait de l'instrument.</p>
            </div>` : '';

  // Bloc Swikly CTA (livraison)
  const swiklyBlock = isLivraison && swiklyUrl ? `
            <div style="text-align: center; margin: 24px 0;">
              <p>Pour valider votre caution en ligne, cliquez sur le bouton ci-dessous :</p>
              <a href="${escapeHtml(swiklyUrl)}" class="cta-button" style="display: inline-block; background: #0D7377; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Déposer ma caution en ligne
              </a>
              <p style="font-size: 12px; color: #888; margin-top: 10px;">La caution de ${formatPrice(caution)} sera pré-autorisée sur votre carte bancaire via Swikly (non débitée).</p>
            </div>` : '';

  const emailData = {
    to: [{ email: clientEmail, name: clientName }],
    bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    subject: 'Votre réservation de location — Mistral Pans',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .rental-box { background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .info-box { background: #e8f4f4; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .cta-button { display: inline-block; background: #0D7377; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mistral Pans</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Location d'instrument</p>
          </div>
          <div class="content">
            <p>Bonjour ${safePrenom},</p>

            <p>Votre demande de location a bien été enregistrée. Voici le récapitulatif et votre contrat de location en pièce jointe.</p>

            <div class="rental-box">
              <h3 style="margin: 0 0 15px 0; color: #0D7377;">Votre réservation</h3>

              <div class="detail-row">
                <span>Instrument</span>
                <strong>${instrumentLabel}</strong>
              </div>

              <div class="detail-row">
                <span>Loyer</span>
                <strong>${formatPrice(loyer)}/mois</strong>
              </div>

              <div class="detail-row">
                <span>Caution</span>
                <strong>${formatPrice(caution)}</strong>
              </div>

              <div class="detail-row">
                <span>Mode</span>
                <strong>${escapeHtml(modeLabel)}</strong>
              </div>
${fraisRow}
            </div>

            <div class="info-box">
              <h4 style="margin: 0 0 10px 0;">Pièces à nous fournir par retour d'email</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Copie pièce d'identité</li>
                <li>Copie justificatif de domicile</li>
              </ul>
            </div>
${cautionAtelierBlock}
${swiklyBlock}

            <p>À très bientôt,<br><strong>L'équipe Mistral Pans</strong></p>
          </div>
          <div class="footer">
            <p>Mistral Pans — Artisan Handpan<br>
            Île-de-France, France<br>
            contact@mistralpans.fr</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  // Ajouter le contrat PDF en pièce jointe si fourni (avec limite de taille)
  if (pdfBase64 && pdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    emailData.attachment = [{
      content: pdfBase64,
      name: `contrat-location-${new Date().toISOString().slice(0, 10)}.pdf`,
      type: 'application/pdf'
    }];
  }

  return emailData;
}

/**
 * Template : Notification de disponibilité location (waitlist)
 * Envoyé aux utilisateurs inscrits quand un instrument devient disponible
 */
function buildRentalAvailabilityEmail(data) {
  const { email, instrument } = data;
  const safeInstrument = escapeHtml(instrument || 'Handpan');

  return {
    to: [{ email: email.trim().toLowerCase(), name: '' }],
    subject: 'Un handpan est disponible à la location — Mistral Pans',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .instrument-box { background: #f0f9f4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #3D6B4A; text-align: center; }
          .instrument-name { font-size: 24px; font-weight: bold; color: #3D6B4A; margin: 10px 0; }
          .cta-button { display: inline-block; background: #0D7377; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; font-size: 16px; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mistral Pans</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Location d'instrument</p>
          </div>
          <div class="content">
            <p>Bonjour,</p>

            <p>Un nouvel instrument est disponible à la location :</p>

            <div class="instrument-box">
              <div class="instrument-name">${safeInstrument}</div>
            </div>

            <p>Rendez-vous sur notre page location pour le réserver.</p>

            <div style="text-align: center;">
              <a href="https://mistralpans.fr/location.html" class="cta-button">
                Voir les instruments disponibles
              </a>
            </div>

            <p style="margin-top: 30px;">À très bientôt,<br><strong>L'équipe Mistral Pans</strong></p>
          </div>
          <div class="footer">
            <p>Mistral Pans - Artisan Handpan<br>
            Île-de-France, France<br>
            contact@mistralpans.fr</p>
            <p style="font-size: 11px; color: #aaa;">Vous recevez cet email car vous avez demandé à être notifié de la disponibilité d'un instrument à la location.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Template : Confirmation de paiement
 */
function buildPaymentConfirmationEmail(data) {
  const { client, payment, order } = data;

  const clientEmail = client.email?.trim().toLowerCase();
  const clientName = sanitizeEmailHeader(`${client.prenom || ''} ${client.nom || ''}`);
  const montant = formatPrice(payment.amount || 0);
  const reference = escapeHtml(payment.reference || order?.reference || 'N/A');
  const type = payment.type === 'acompte' ? 'Acompte' :
               payment.type === 'solde' ? 'Solde' : 'Paiement';

  // Bloc retrait atelier (lien Calendly) si mode retrait
  const isRetrait = data.shippingMethod === 'retrait';
  const calendlyUrl = 'https://calendly.com/adrien-santamaria/30min';
  const retraitBlock = isRetrait ? `
            <div style="background: #FFF8F0; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #D97706; text-align: center;">
              <div style="font-size: 28px; margin-bottom: 8px;">&#128197;</div>
              <p style="font-weight: bold; color: #92400E; margin: 0 0 8px 0;">Retrait à l'atelier</p>
              <p style="color: #666; margin: 0 0 16px 0;">Planifiez un créneau pour venir récupérer votre instrument :</p>
              <a href="${calendlyUrl}" style="display: inline-block; background: #D97706; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Planifier le retrait</a>
            </div>` : '';

  return {
    to: [{ email: clientEmail, name: clientName }],
    bcc: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    subject: `Confirmation de paiement - Mistral Pans`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3D6B4A; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .checkmark { font-size: 48px; margin-bottom: 10px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .payment-box { background: #f0f9f4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #3D6B4A; text-align: center; }
          .amount { font-size: 32px; font-weight: bold; color: #3D6B4A; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="checkmark">&#10003;</div>
            <h1>Paiement reçu</h1>
          </div>
          <div class="content">
            <p>Bonjour ${escapeHtml(client.prenom || 'cher client')},</p>

            <p>Nous avons bien reçu votre paiement. Merci !</p>

            <div class="payment-box">
              <div style="color: #666; font-size: 14px;">${type}</div>
              <div class="amount">${montant}</div>
              <div style="color: #666; font-size: 14px;">Référence : ${reference}</div>
            </div>
            ${retraitBlock}
            <p>Un reçu détaillé vous sera envoyé séparément.</p>

            <p>Merci de votre confiance,<br><strong>L'équipe Mistral Pans</strong></p>
          </div>
          <div class="footer">
            <p>Mistral Pans - Artisan Handpan<br>
            contact@mistralpans.fr</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Construit l'email de demande de solde (instrument prêt)
 */
function buildBalanceRequestEmail(data) {
  const { client, order, payment } = data;
  const formatEuros = (amount) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  const trackingUrl = `https://mistralpans.fr/suivi.html?ref=${encodeURIComponent(order.reference)}&email=${encodeURIComponent(client.email)}`;

  return {
    to: [{ email: client.email, name: `${sanitize(client.prenom)} ${sanitize(client.nom)}` }],
    bcc: [{ email: 'contact@mistralpans.fr' }],
    replyTo: { email: 'contact@mistralpans.fr', name: 'Mistral Pans' },
    subject: `Votre handpan est prêt ! - Commande ${order.reference}`,
    htmlContent: `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Inter, system-ui, sans-serif; color: #2C2825; max-width: 600px; margin: 0 auto; padding: 20px;">

        <div style="background: #3D6B4A; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Votre instrument est prêt !</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Commande ${sanitize(order.reference)}</p>
        </div>

        <div style="background: #f8f8f8; padding: 24px; border: 1px solid #e5e5e5;">
          <p>Bonjour ${sanitize(client.prenom)},</p>

          <p>Votre <strong>${sanitize(order.productName || 'handpan')}</strong> a terminé son accordage et est maintenant prêt à vous rejoindre !</p>

          <div style="background: white; border: 2px solid #3D6B4A; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 0.875rem; color: #6B7280;">Solde restant</p>
            <p style="margin: 0; font-size: 1.75rem; font-weight: 700; color: #3D6B4A;">${formatEuros(payment.remainingAmount)}</p>
          </div>

          <p>Pour finaliser votre commande et déclencher l'expédition, il vous reste à régler le solde de <strong>${formatEuros(payment.remainingAmount)}</strong>.</p>

          ${payment.paymentUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${sanitize(payment.paymentUrl)}" style="display: inline-block; background: #0D7377; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Payer le solde
            </a>
          </div>
          ` : `
          <p>Nous vous enverrons un lien de paiement sécurisé dans un prochain email, ou vous pouvez nous contacter directement.</p>
          `}

          <p style="font-size: 0.875rem; color: #6B7280;">
            Vous pouvez suivre votre commande à tout moment :
            <a href="${trackingUrl}" style="color: #0D7377;">Suivi de commande</a>
          </p>
        </div>

        <div style="background: #1A1815; color: #9CA3AF; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 0.8125rem;">
          <p style="margin: 0;">Mistral Pans — Handpans artisanaux, Île-de-France</p>
          <p style="margin: 8px 0 0;"><a href="mailto:contact@mistralpans.fr" style="color: #0D7377;">contact@mistralpans.fr</a></p>
        </div>

      </body>
      </html>
    `
  };
}

/**
 * Construit l'email de notification d'expédition
 */
function buildShippingNotificationEmail(data) {
  const { client, order } = data;
  const trackingUrl = `https://mistralpans.fr/suivi.html?ref=${encodeURIComponent(order.reference)}&email=${encodeURIComponent(client.email)}`;

  return {
    to: [{ email: client.email, name: `${sanitize(client.prenom)} ${sanitize(client.nom)}` }],
    bcc: [{ email: 'contact@mistralpans.fr' }],
    replyTo: { email: 'contact@mistralpans.fr', name: 'Mistral Pans' },
    subject: `Votre handpan est en route ! - Commande ${order.reference}`,
    htmlContent: `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Inter, system-ui, sans-serif; color: #2C2825; max-width: 600px; margin: 0 auto; padding: 20px;">

        <div style="background: #0D7377; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Votre instrument est en route !</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Commande ${sanitize(order.reference)}</p>
        </div>

        <div style="background: #f8f8f8; padding: 24px; border: 1px solid #e5e5e5;">
          <p>Bonjour ${sanitize(client.prenom)},</p>

          <p>Votre <strong>${sanitize(order.productName || 'handpan')}</strong> vient d'être expédié !</p>

          ${order.trackingNumber ? `
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 0.875rem; color: #1E40AF;">Numéro de suivi</p>
            <p style="margin: 0; font-size: 1.25rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #1E40AF;">${sanitize(order.trackingNumber)}</p>
          </div>
          ` : ''}

          ${order.estimatedDelivery ? `
          <p>Livraison estimée : <strong>${sanitize(order.estimatedDelivery)}</strong></p>
          ` : ''}

          <p>Quelques conseils pour accueillir votre handpan :</p>
          <ul style="color: #4B5563; line-height: 1.8;">
            <li>Rangez-le dans sa housse après chaque session</li>
            <li>Nettoyez-le avec un chiffon doux et de l'huile de protection</li>
            <li>Évitez l'exposition prolongée au soleil ou à l'humidité</li>
          </ul>

          <p style="font-size: 0.875rem; color: #6B7280;">
            Suivez votre commande :
            <a href="${trackingUrl}" style="color: #0D7377;">Suivi de commande</a>
          </p>
        </div>

        <div style="background: #1A1815; color: #9CA3AF; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 0.8125rem;">
          <p style="margin: 0;">Mistral Pans — Handpans artisanaux, Île-de-France</p>
          <p style="margin: 8px 0 0;"><a href="mailto:contact@mistralpans.fr" style="color: #0D7377;">contact@mistralpans.fr</a></p>
        </div>

      </body>
      </html>
    `
  };
}

/**
 * Template : Email de livraison finale avec carnet d'entretien en PJ
 */
function buildInitiationConfirmationEmail(data) {
  const nom = sanitize(data.nom);
  const dateLabel = sanitize(data.dateLabel || data.date || '');
  const horaire = sanitize(data.horaire || '13h — 18h');
  const reference = sanitize(data.reference || '');
  const prix = data.prix || 60;

  return {
    to: [{ email: data.email, name: nom }],
    subject: `Confirmation de votre initiation handpan — ${dateLabel}`,
    htmlContent: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
<tr><td style="background:#0D7377;padding:2rem;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:1.5rem;">Initiation confirmée</h1>
</td></tr>
<tr><td style="padding:2rem;">
<p style="font-size:1rem;line-height:1.6;">Bonjour <strong>${nom}</strong>,</p>
<p style="font-size:1rem;line-height:1.6;">Votre inscription à l'atelier d'initiation au handpan est confirmée !</p>
<table width="100%" cellpadding="12" cellspacing="0" style="background:#f8f8f8;border-radius:8px;margin:1.5rem 0;">
<tr><td style="border-bottom:1px solid #eee;"><strong>Date</strong></td><td style="border-bottom:1px solid #eee;">${dateLabel}</td></tr>
<tr><td style="border-bottom:1px solid #eee;"><strong>Horaire</strong></td><td style="border-bottom:1px solid #eee;">${horaire}</td></tr>
<tr><td style="border-bottom:1px solid #eee;"><strong>Lieu</strong></td><td style="border-bottom:1px solid #eee;">Atelier Mistral Pans — 105 rue du bas val Mary, 95630 Mériel</td></tr>
<tr><td style="border-bottom:1px solid #eee;"><strong>Montant</strong></td><td style="border-bottom:1px solid #eee;">${prix} €</td></tr>
${reference ? `<tr><td><strong>Référence</strong></td><td>${reference}</td></tr>` : ''}
</table>
<h3 style="margin:1.5rem 0 0.5rem;">Au programme</h3>
<ul style="line-height:1.8;color:#555;">
<li>Visite de l'atelier de fabrication</li>
<li>Présentation de l'instrument et premiers pas</li>
<li>Temps de jeu collectif accompagné</li>
</ul>
<p style="font-size:0.9rem;color:#666;margin-top:1.5rem;">Pour toute question, répondez directement à cet email.</p>
</td></tr>
<tr><td style="background:#1A1815;padding:1.5rem;text-align:center;">
<p style="color:#a8a5a0;font-size:0.8rem;margin:0;">Mistral Pans — Artisan handpan en Île-de-France</p>
<p style="color:#a8a5a0;font-size:0.8rem;margin:0.5rem 0 0;"><a href="https://mistralpans.fr" style="color:#0D7377;">mistralpans.fr</a></p>
</td></tr>
</table></body></html>`
  };
}

function buildDeliveryEmail(data) {
  const { client, order, instrument, carnetPdfBase64 } = data;
  const gamme = sanitize(instrument?.gamme || order.productName || 'Sur mesure');
  const ref = sanitize(order.reference);
  const prenom = sanitize(client.prenom || 'cher client');

  const emailData = {
    to: [{ email: client.email, name: `${sanitize(client.prenom)} ${sanitize(client.nom)}` }],
    bcc: [{ email: 'contact@mistralpans.fr' }],
    replyTo: { email: 'contact@mistralpans.fr', name: 'Mistral Pans' },
    subject: `Votre handpan est prêt ! — ${ref} — Mistral Pans`,
    htmlContent: `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Inter, system-ui, sans-serif; color: #2C2825; max-width: 600px; margin: 0 auto; padding: 20px;">

        <div style="background: #0D7377; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Votre handpan est prêt !</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Commande ${ref}</p>
        </div>

        <div style="background: #f8f8f8; padding: 24px; border: 1px solid #e5e5e5;">
          <p>Bonjour ${prenom},</p>

          <p>Votre handpan <strong>${gamme}</strong> est terminé et vous attend !</p>

          <div style="background: #f0fafa; border-left: 4px solid #0D7377; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0;">Vous trouverez en pièce jointe le <strong>carnet d'entretien</strong> de votre instrument, avec toutes les informations sur sa gamme, ses notes, et les conseils pour en prendre soin.</p>
          </div>

          <p>Nous vous contacterons très prochainement pour organiser la livraison ou le retrait de votre instrument.</p>

          <p style="margin-top: 24px;">Au plaisir de vous voir jouer,</p>
          <p><strong>Mistral Pans</strong></p>
        </div>

        <div style="background: #1A1815; color: #9CA3AF; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 0.8125rem;">
          <p style="margin: 0;">Mistral Pans — Handpans artisanaux, Île-de-France</p>
          <p style="margin: 8px 0 0;"><a href="mailto:contact@mistralpans.fr" style="color: #0D7377;">contact@mistralpans.fr</a></p>
        </div>

      </body>
      </html>
    `
  };

  // Carnet d'entretien en PJ
  if (carnetPdfBase64 && carnetPdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    const filename = `Carnet_entretien_${(instrument?.gamme || 'Handpan').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    emailData.attachment = [{
      content: carnetPdfBase64,
      name: filename,
      type: 'application/pdf'
    }];
  }

  return emailData;
}

/**
 * Construit l'email de notification artisan pour une nouvelle commande
 */
function buildNewOrderNotificationEmail(data) {
  const { order, client, payment } = data;
  const isStock = order.source === 'stock';
  const sourceLabel = isStock ? 'En stock' : 'Sur mesure';
  const paymentLabel = payment.isFullPayment ? 'Paiement intégral' : 'Acompte (30%)';

  const formatEuros = (amount) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return {
    to: [{ email: 'contact@mistralpans.fr', name: 'Mistral Pans' }],
    subject: `🎵 Nouvelle commande ${order.reference} - ${sourceLabel}`,
    htmlContent: `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Inter, system-ui, sans-serif; color: #2C2825; max-width: 600px; margin: 0 auto; padding: 20px;">

        <div style="background: #0D7377; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Nouvelle commande !</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">${sanitize(order.reference)} - ${sourceLabel}</p>
        </div>

        <div style="background: #f8f8f8; padding: 24px; border: 1px solid #e5e5e5;">

          <h2 style="color: #0D7377; margin-top: 0;">Client</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Nom</td><td>${sanitize(client.prenom)} ${sanitize(client.nom)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Email</td><td><a href="mailto:${sanitize(client.email)}">${sanitize(client.email)}</a></td></tr>
            ${client.telephone ? `<tr><td style="padding: 6px 0; font-weight: 600;">Téléphone</td><td>${sanitize(client.telephone)}</td></tr>` : ''}
          </table>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">

          <h2 style="color: #0D7377;">Instrument</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Produit</td><td>${sanitize(order.productName)}</td></tr>
            ${order.gamme ? `<tr><td style="padding: 6px 0; font-weight: 600;">Gamme</td><td>${sanitize(order.gamme)}</td></tr>` : ''}
            ${order.taille ? `<tr><td style="padding: 6px 0; font-weight: 600;">Taille</td><td>${sanitize(order.taille)}</td></tr>` : ''}
            <tr><td style="padding: 6px 0; font-weight: 600;">Source</td><td><strong style="color: ${isStock ? '#3D6B4A' : '#0D7377'};">${sourceLabel}</strong></td></tr>
            ${order.instrumentId ? `<tr><td style="padding: 6px 0; font-weight: 600;">ID instrument</td><td style="font-family: monospace; font-size: 12px;">${sanitize(order.instrumentId)}</td></tr>` : ''}
          </table>

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">

          <h2 style="color: #0D7377;">Paiement</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Type</td><td>${paymentLabel}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Montant payé</td><td style="font-size: 18px; font-weight: 700; color: #3D6B4A;">${formatEuros(payment.amount)}</td></tr>
            ${!payment.isFullPayment ? `<tr><td style="padding: 6px 0; font-weight: 600;">Total commande</td><td>${formatEuros(payment.totalAmount)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Reste à payer</td><td style="color: #D97706; font-weight: 600;">${formatEuros(payment.totalAmount - payment.amount)}</td></tr>` : ''}
          </table>

        </div>

        <div style="background: #1A1815; color: white; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="margin: 0;">
            <a href="https://mistralpans.fr/admin.html#commandes" style="color: #0D7377; text-decoration: none; font-weight: 600;">
              Voir dans le panneau admin →
            </a>
          </p>
        </div>

      </body>
      </html>
    `
  };
}

/**
 * Template : Rapport comptable mensuel
 */
function buildMonthlyReportEmail(data) {
  const {
    emailDest, moisLabel, mois,
    totalBICVentes, totalBICPrestations,
    totalBIC, totalBNC, totalAvoir, totalCA,
    nbFactures, factures, config, pdfBase64
  } = data;

  // Support granulaire (3 catégories) avec fallback legacy (2 catégories)
  const bicVentes = totalBICVentes !== undefined ? totalBICVentes : (totalBIC || 0);
  const bicPrestations = totalBICPrestations !== undefined ? totalBICPrestations : 0;

  const safeMoisLabel = escapeHtml(moisLabel);
  const safeNom = escapeHtml(config?.nom || 'Mistral Pans');
  const safeSiret = escapeHtml(config?.siret || '');
  const generatedDate = formatDate(new Date().toISOString());

  // Ligne Avoir (conditionnelle)
  const avoirRow = (totalAvoir && totalAvoir > 0) ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">Avoirs</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #DC2626;">${formatPrice(totalAvoir)}</td>
              </tr>` : '';

  // Table de détail des factures
  let facturesBlock = '';
  if (factures && factures.length > 0) {
    const factureRows = factures.map(f => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${escapeHtml(f.date || '')}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${escapeHtml(f.numero || '')}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${escapeHtml(f.client || '')}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${escapeHtml(f.type || '')}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${escapeHtml(f.classification || '')}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right; font-weight: 600;">${formatPrice(f.montant || 0)}</td>
                </tr>`).join('');

    facturesBlock = `
            <h3 style="color: #0D7377; margin-top: 30px;">Détail des factures (${nbFactures || factures.length})</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">Date</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">N°</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">Client</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">Type</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">Classification</th>
                  <th style="padding: 8px; text-align: right; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">Montant</th>
                </tr>
              </thead>
              <tbody>
                ${factureRows}
              </tbody>
            </table>`;
  }

  const emailData = {
    to: [{ email: emailDest, name: 'Mistral Pans' }],
    subject: `Rapport comptable - ${safeMoisLabel}`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D7377; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Rapport Comptable Mensuel</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${safeMoisLabel}</p>
          </div>
          <div class="content">
            <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-weight: bold;">${safeNom}</p>
              ${safeSiret ? `<p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">SIRET : ${safeSiret}</p>` : ''}
            </div>

            <h3 style="color: #0D7377; margin-top: 0;">Synthèse du mois</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">BIC Ventes <span style="color:#888; font-size:12px;">(71% abattement)</span></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${formatPrice(bicVentes)}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">BIC Prestations <span style="color:#888; font-size:12px;">(50% abattement)</span></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${formatPrice(bicPrestations)}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">BNC <span style="color:#888; font-size:12px;">(34% abattement)</span></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${formatPrice(totalBNC || 0)}</td>
              </tr>${avoirRow}
              <tr style="background: #f0f9f4;">
                <td style="padding: 12px 10px; font-weight: bold; font-size: 16px;">Total CA</td>
                <td style="padding: 12px 10px; text-align: right; font-weight: bold; font-size: 16px; color: #3D6B4A;">${formatPrice(totalCA || 0)}</td>
              </tr>
            </table>

            ${facturesBlock}
          </div>
          <div class="footer">
            <p>Généré automatiquement depuis l'administration Mistral Pans</p>
            <p style="margin: 5px 0 0 0;">${generatedDate}</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  // Ajouter le PDF en pièce jointe si fourni (avec limite de taille)
  if (pdfBase64 && pdfBase64.length <= MAX_PDF_BASE64_LENGTH) {
    emailData.attachment = [{
      content: pdfBase64,
      name: `rapport-comptable-${mois || 'mensuel'}.pdf`,
      type: 'application/pdf'
    }];
  }

  return emailData;
}

/**
 * Retourne l'origine CORS autorisée
 */
function getAllowedOrigin(event) {
  const ALLOWED_ORIGINS = [
    'https://mistralpans.fr',
    'https://www.mistralpans.fr'
  ];
  if (process.env.CONTEXT !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:8000', 'http://127.0.0.1:8000');
  }
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

// Rate limiting : voir utils/rate-limit.js (persistant via Supabase)

exports.handler = async (event, context) => {
  const allowedOrigin = getAllowedOrigin(event);

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Autoriser seulement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Récupérer la clé API depuis les variables d'environnement
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY non configurée');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration serveur manquante' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { emailType } = data;

    // Anti-spam : honeypot
    if (data.website) {
      console.log('Bot détecté (honeypot)');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // Rate limiting persistant (Supabase) — fail-closed pour les emails
    const clientIp = getClientIp(event);
    const { allowed: rateLimitOk } = await checkRateLimit(clientIp, 'send-email', 5, 60000, true);
    if (!rateLimitOk) {
      console.warn(`Rate limit dépassé pour ${clientIp}`);
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Trop de requêtes. Réessayez dans une minute.' })
      };
    }

    let emailData;

    // Router vers le bon template selon le type d'email
    switch (emailType) {
      case 'invoice':
        // Validation pour facture
        if (!data.client?.email || !data.facture?.numero) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données facture manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildInvoiceEmail(data);
        break;

      case 'order_confirmation':
        if (!data.client?.email || !data.order) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données commande manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildOrderConfirmationEmail(data);
        break;

      case 'rental_confirmation':
        if (!data.client?.email || !data.rental) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données location manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildRentalConfirmationEmail(data);
        break;

      case 'rental_reservation':
        if (!data.client?.email || !data.instrument) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données réservation location manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildRentalReservationEmail(data);
        break;

      case 'rental_availability':
        if (!data.email || !isValidEmail(data.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email invalide' })
          };
        }
        emailData = buildRentalAvailabilityEmail(data);
        break;

      case 'payment_confirmation':
        if (!data.client?.email || !data.payment) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données paiement manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildPaymentConfirmationEmail(data);
        break;

      case 'new_order_notification':
        if (!data.order?.reference || !data.payment) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données notification commande manquantes' })
          };
        }
        emailData = buildNewOrderNotificationEmail(data);
        break;

      case 'balance_request':
        if (!data.client?.email || !data.order?.reference) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données demande de solde manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildBalanceRequestEmail(data);
        break;

      case 'shipping_notification':
        if (!data.client?.email || !data.order?.reference) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données notification expédition manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildShippingNotificationEmail(data);
        break;

      case 'monthly_report':
        if (!data.emailDest || !isValidEmail(data.emailDest)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email destinataire invalide' })
          };
        }
        if (!data.moisLabel) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Libellé du mois manquant' })
          };
        }
        emailData = buildMonthlyReportEmail(data);
        break;

      case 'delivery':
        if (!data.client?.email || !data.order?.reference) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Données livraison manquantes' })
          };
        }
        if (!isValidEmail(data.client.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email client invalide' })
          };
        }
        emailData = buildDeliveryEmail(data);
        break;

      case 'initiation_confirmation':
        if (!data.email || !data.nom) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email et nom requis pour la confirmation d\'initiation' })
          };
        }
        emailData = buildInitiationConfirmationEmail(data);
        break;

      case 'contact':
      default:
        // Validation pour contact
        if (!data.firstname || !data.lastname || !data.email || !data.message) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Champs obligatoires manquants' })
          };
        }
        if (!isValidEmail(data.email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Format d\'email invalide' })
          };
        }
        emailData = buildContactEmail(data);
        break;
    }

    // Construire le payload Brevo
    const brevoPayload = {
      sender: {
        name: 'Mistral Pans',
        email: 'contact@mistralpans.fr'
      },
      to: emailData.to,
      subject: emailData.subject,
      htmlContent: emailData.htmlContent
    };

    // Ajouter les champs optionnels
    if (emailData.replyTo) brevoPayload.replyTo = emailData.replyTo;
    if (emailData.bcc) brevoPayload.bcc = emailData.bcc;
    if (emailData.attachment) brevoPayload.attachment = emailData.attachment;

    // Appel à l'API Brevo
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(brevoPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erreur Brevo:', result);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erreur lors de l\'envoi' })
      };
    }

    console.log(`Email [${emailType || 'contact'}] envoyé avec succès:`, result.messageId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email envoyé avec succès',
        messageId: result.messageId
      })
    };

  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur, veuillez réessayer' })
    };
  }
};
