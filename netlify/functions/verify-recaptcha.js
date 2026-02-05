// Netlify Function : Vérification reCAPTCHA v3
// Valide les tokens reCAPTCHA côté serveur

exports.handler = async (event, context) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
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

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // Récupérer la clé secrète
  const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

  if (!RECAPTCHA_SECRET_KEY) {
    console.error('RECAPTCHA_SECRET_KEY non configurée');
    // En mode développement, on peut accepter sans vérification
    if (process.env.NODE_ENV === 'development') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          score: 1.0,
          action: 'dev',
          message: 'Mode développement - vérification ignorée'
        })
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration reCAPTCHA manquante' })
    };
  }

  try {
    const { token, expectedAction } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token reCAPTCHA manquant' })
      };
    }

    // Appeler l'API Google reCAPTCHA
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token
    });

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const result = await response.json();

    console.log('Vérification reCAPTCHA:', {
      success: result.success,
      score: result.score,
      action: result.action,
      hostname: result.hostname
    });

    if (!result.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Vérification reCAPTCHA échouée',
          errorCodes: result['error-codes']
        })
      };
    }

    // Vérifier le score (0.0 = bot, 1.0 = humain)
    // Seuil recommandé : 0.5
    const SCORE_THRESHOLD = 0.5;
    const isHuman = result.score >= SCORE_THRESHOLD;

    // Vérifier l'action si spécifiée
    const actionMatch = !expectedAction || result.action === expectedAction;

    if (!isHuman) {
      console.warn('Score reCAPTCHA trop bas:', result.score);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Activité suspecte détectée',
          score: result.score
        })
      };
    }

    if (!actionMatch) {
      console.warn('Action reCAPTCHA non correspondante:', {
        expected: expectedAction,
        received: result.action
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Action non valide'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        score: result.score,
        action: result.action,
        hostname: result.hostname
      })
    };

  } catch (error) {
    console.error('Erreur vérification reCAPTCHA:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur serveur',
        details: error.message
      })
    };
  }
};
