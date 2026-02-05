// Netlify Function : Envoi d'email via Brevo
// Supporte plusieurs types d'emails : contact, facture, confirmation, rapport

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

  // Ajouter le PDF en pièce jointe si fourni
  if (pdfBase64) {
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
          .success-badge { background: #4A7C59; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin-top: 10px; }
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
                <div class="value" style="color: #4A7C59;">${acompte}</div>
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
          .header { background: #4A7C59; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .checkmark { font-size: 48px; margin-bottom: 10px; }
          .content { background: #fff; border: 1px solid #e0e0e0; padding: 30px; }
          .payment-box { background: #f0f9f4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4A7C59; text-align: center; }
          .amount { font-size: 32px; font-weight: bold; color: #4A7C59; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="checkmark">✓</div>
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

exports.handler = async (event, context) => {
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
    'Access-Control-Allow-Origin': '*',
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
        body: JSON.stringify({ error: 'Erreur lors de l\'envoi', details: result.message })
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
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};
