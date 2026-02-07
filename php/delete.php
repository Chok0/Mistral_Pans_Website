<?php
/**
 * MISTRAL PANS - Suppression d'images securisee
 *
 * Authentification via Supabase JWT (envoye dans X-Admin-Token)
 */

// Configuration
define('UPLOAD_DIR', '../ressources/images/galerie/');
define('THUMB_DIR', '../ressources/images/galerie/thumbs/');

// Headers CORS
$allowedOrigins = [
    'https://mistralpans.fr',
    'https://www.mistralpans.fr'
];
// Autoriser localhost uniquement si le serveur est local
$serverName = $_SERVER['SERVER_NAME'] ?? '';
if ($serverName === 'localhost' || $serverName === '127.0.0.1') {
    $allowedOrigins[] = 'http://localhost:8000';
    $allowedOrigins[] = 'http://127.0.0.1:8000';
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else if (empty($origin)) {
    // Requete same-origin (pas de header Origin)
    header('Access-Control-Allow-Origin: https://mistralpans.fr');
}

header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    sendError('Methode non autorisee', 405);
}

// Verifier le token admin (Supabase JWT)
$token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
if (!verifySupabaseJWT($token)) {
    sendError('Non autorise', 401);
}

// Recuperer le nom du fichier
$input = json_decode(file_get_contents('php://input'), true);
$filename = $input['filename'] ?? '';

if (empty($filename)) {
    sendError('Nom de fichier manquant', 400);
}

// Securite : empecher la traversee de repertoire
$filename = basename($filename);

// Verifier que le fichier est bien dans le dossier galerie
$filepath = UPLOAD_DIR . $filename;
$thumbpath = THUMB_DIR . $filename;

$deleted = false;

// Supprimer l'image principale
if (file_exists($filepath)) {
    if (unlink($filepath)) {
        $deleted = true;
    }
}

// Supprimer la miniature
if (file_exists($thumbpath)) {
    unlink($thumbpath);
}

if ($deleted) {
    sendSuccess(['message' => 'Image supprimee']);
} else {
    sendError('Image non trouvee', 404);
}

// =============================================================================
// FONCTIONS
// =============================================================================

/**
 * Verifie un JWT Supabase en appelant l'API Supabase /auth/v1/user
 */
function verifySupabaseJWT($token) {
    if (empty($token) || strlen($token) < 20) return false;

    $config = getSupabaseConfig();
    if (!$config) {
        error_log('ERREUR: Configuration Supabase manquante pour la validation JWT.');
        return false;
    }

    $ch = curl_init($config['url'] . '/auth/v1/user');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'apikey: ' . $config['anon_key']
        ],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return false;
    }

    $user = json_decode($response, true);
    return !empty($user['id']);
}

/**
 * Lit la configuration Supabase depuis un fichier local ou des variables d'env
 */
function getSupabaseConfig() {
    // Option 1: Fichier de configuration local
    $configFile = __DIR__ . '/.supabase_config';
    if (file_exists($configFile)) {
        $lines = file($configFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $config = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || $line[0] === '#') continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                $config[trim($parts[0])] = trim($parts[1]);
            }
        }
        if (!empty($config['url']) && !empty($config['anon_key'])) {
            return $config;
        }
    }

    // Option 2: Variables d'environnement
    $url = getenv('SUPABASE_URL');
    $anonKey = getenv('SUPABASE_ANON_KEY');
    if ($url && $anonKey) {
        return ['url' => $url, 'anon_key' => $anonKey];
    }

    return null;
}

function sendSuccess($data) {
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

function sendError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}
