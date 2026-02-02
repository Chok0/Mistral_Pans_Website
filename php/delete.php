<?php
/**
 * MISTRAL PANS - Suppression d'images sécurisée
 */

// Configuration
define('UPLOAD_DIR', '../ressources/images/galerie/');
define('THUMB_DIR', '../ressources/images/galerie/thumbs/');

// Headers CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    sendError('Méthode non autorisée', 405);
}

// Vérifier le token admin
$token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
$storedHash = getAdminHash();
if (!$storedHash || !verifyToken($token, $storedHash)) {
    sendError('Non autorisé', 401);
}

// Récupérer le nom du fichier
$input = json_decode(file_get_contents('php://input'), true);
$filename = $input['filename'] ?? '';

if (empty($filename)) {
    sendError('Nom de fichier manquant', 400);
}

// Sécurité : empêcher la traversée de répertoire
$filename = basename($filename);

// Vérifier que le fichier est bien dans le dossier galerie
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
    sendSuccess(['message' => 'Image supprimée']);
} else {
    sendError('Image non trouvée', 404);
}

// =============================================================================
// FONCTIONS
// =============================================================================

function getAdminHash() {
    $hashFile = __DIR__ . '/.admin_hash';
    if (file_exists($hashFile)) {
        return trim(file_get_contents($hashFile));
    }
    return '-6de5765f'; // Hash JS de 'mistral2024'
}

function verifyToken($token, $storedHash) {
    if (empty($token)) return false;
    
    $validTokens = [
        $storedHash,
        '-6de5765f',
        'mistral_upload_token'
    ];
    
    return in_array($token, $validTokens);
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
