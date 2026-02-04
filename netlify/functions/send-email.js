// Netlify Function : Envoi d'email via Brevo
// Cette fonction reçoit les données du formulaire et envoie un email

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
  // Supprimer les caractères de contrôle et sauts de ligne
  return String(str)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
    .substring(0, 100); // Limiter la longueur
}

/**
 * Valide le format d'une adresse email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

exports.handler = async (event, context) => {
  // Autoriser seulement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  // Récupérer la clé API depuis les variables d'environnement
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY non configurée');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Configuration serveur manquante' })
    };
  }

  try {
    // Parser les données du formulaire
    const data = JSON.parse(event.body);
    const { firstname, lastname, email, phone, message, subject, type } = data;

    // Validation basique
    if (!firstname || !lastname || !email || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Champs obligatoires manquants' })
      };
    }

    // Validation de l'email
    if (!isValidEmail(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Format d\'email invalide' })
      };
    }

    // Anti-spam : honeypot (si le champ caché est rempli, c'est un bot)
    if (data.website) {
      console.log('Bot détecté (honeypot)');
      // On retourne succès pour ne pas alerter le bot
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // Sanitize toutes les entrées utilisateur
    const safeFirstname = escapeHtml(sanitizeEmailHeader(firstname));
    const safeLastname = escapeHtml(sanitizeEmailHeader(lastname));
    const safeEmail = escapeHtml(email.trim().toLowerCase());
    const safePhone = escapeHtml(sanitizeEmailHeader(phone));
    const safeMessage = escapeHtml(message);
    const safeType = escapeHtml(sanitizeEmailHeader(type));
    const safeSubject = sanitizeEmailHeader(subject);

    // Construire le sujet de l'email (sanitizé)
    const emailSubject = safeSubject || `[Mistral Pans] Message de ${safeFirstname} ${safeLastname}`;

    // Construire le contenu HTML de l'email (toutes les valeurs sont échappées)
    const htmlContent = `
      <h2>Nouveau message depuis mistralpans.fr</h2>

      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Nom</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${safeFirstname} ${safeLastname}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Téléphone</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${safePhone || 'Non renseigné'}</td>
        </tr>
        ${safeType ? `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Type</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${safeType}</td>
        </tr>
        ` : ''}
      </table>

      <h3 style="margin-top: 20px;">Message :</h3>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${safeMessage}</div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #888; font-size: 12px;">
        Email envoyé depuis le formulaire de contact de mistralpans.fr
      </p>
    `;

    // Appel à l'API Brevo avec valeurs sanitizées
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: 'Mistral Pans - Site Web',
          email: 'contact@mistralpans.fr'
        },
        to: [
          {
            email: 'contact@mistralpans.fr',
            name: 'Mistral Pans'
          }
        ],
        replyTo: {
          email: email.trim().toLowerCase(), // Email brut (validé) pour reply-to
          name: sanitizeEmailHeader(`${firstname} ${lastname}`) // Nom sanitizé sans HTML
        },
        subject: emailSubject,
        htmlContent: htmlContent
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erreur Brevo:', result);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Erreur lors de l\'envoi', details: result.message })
      };
    }

    console.log('Email envoyé avec succès:', result.messageId);
    
    return {
      statusCode: 200,
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
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};
