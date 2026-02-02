// Netlify Function : Envoi d'email via Brevo
// Cette fonction reçoit les données du formulaire et envoie un email

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

    // Anti-spam : honeypot (si le champ caché est rempli, c'est un bot)
    if (data.website) {
      console.log('Bot détecté (honeypot)');
      // On retourne succès pour ne pas alerter le bot
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // Construire le sujet de l'email
    const emailSubject = subject || `[Mistral Pans] Message de ${firstname} ${lastname}`;

    // Construire le contenu HTML de l'email
    const htmlContent = `
      <h2>Nouveau message depuis mistralpans.fr</h2>
      
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Nom</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${firstname} ${lastname}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Téléphone</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${phone || 'Non renseigné'}</td>
        </tr>
        ${type ? `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Type</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${type}</td>
        </tr>
        ` : ''}
      </table>
      
      <h3 style="margin-top: 20px;">Message :</h3>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${message}</div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #888; font-size: 12px;">
        Email envoyé depuis le formulaire de contact de mistralpans.fr
      </p>
    `;

    // Appel à l'API Brevo
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
          email: email,
          name: `${firstname} ${lastname}`
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
