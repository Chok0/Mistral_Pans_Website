<?php
/**
 * MISTRAL PANS - Upload d'images et videos securise
 * Compression et redimensionnement automatique pour images
 * Stockage direct pour videos
 *
 * Authentification via Supabase JWT (envoye dans X-Admin-Token)
 */

// Configuration
define('UPLOAD_DIR', '../ressources/images/galerie/');
define('THUMB_DIR', '../ressources/images/galerie/thumbs/');
define('VIDEO_DIR', '../ressources/videos/galerie/');
define('MAX_IMAGE_SIZE', 5 * 1024 * 1024); // 5 Mo
define('MAX_VIDEO_SIZE', 100 * 1024 * 1024); // 100 Mo
define('MAX_WIDTH', 1200);
define('THUMB_WIDTH', 400);
define('JPEG_QUALITY', 85);
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp']);
define('ALLOWED_VIDEO_TYPES', ['video/mp4', 'video/webm']);

// Headers CORS pour les requetes AJAX
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
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
header('Access-Control-Allow-Credentials: true');

// Gerer les requetes OPTIONS (preflight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verifier la methode
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Methode non autorisee', 405);
}

// Verifier le token admin (Supabase JWT)
$token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
if (!verifySupabaseJWT($token)) {
    sendError('Non autorise', 401);
}

// Detecter le type d'upload
$uploadType = $_GET['type'] ?? 'image';

if ($uploadType === 'video') {
    handleVideoUpload();
} else {
    handleImageUpload();
}

// =============================================================================
// UPLOAD IMAGE
// =============================================================================

function handleImageUpload() {
    // Verifier qu'un fichier a ete envoye
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = getUploadErrorMessage($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE);
        sendError($errorMsg, 400);
    }

    $file = $_FILES['image'];

    // Verifier la taille
    if ($file['size'] > MAX_IMAGE_SIZE) {
        sendError('Image trop volumineuse (max 5 Mo)', 400);
    }

    // Verifier le type MIME reel
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ALLOWED_IMAGE_TYPES)) {
        sendError('Format non autorise. Utilisez JPG, PNG ou WebP', 400);
    }

    // Creer les dossiers si necessaire
    if (!is_dir(UPLOAD_DIR)) {
        mkdir(UPLOAD_DIR, 0755, true);
    }
    if (!is_dir(THUMB_DIR)) {
        mkdir(THUMB_DIR, 0755, true);
    }

    // Generer un nom de fichier unique
    $filename = 'handpan-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.jpg';
    $filepath = UPLOAD_DIR . $filename;
    $thumbpath = THUMB_DIR . $filename;

    // Charger l'image source
    $sourceImage = createImageFromFile($file['tmp_name'], $mimeType);
    if (!$sourceImage) {
        sendError('Impossible de traiter l\'image', 500);
    }

    // Obtenir les dimensions originales
    $origWidth = imagesx($sourceImage);
    $origHeight = imagesy($sourceImage);

    // Redimensionner l'image principale si necessaire
    if ($origWidth > MAX_WIDTH) {
        $newWidth = MAX_WIDTH;
        $newHeight = intval($origHeight * (MAX_WIDTH / $origWidth));
        $mainImage = resizeImage($sourceImage, $origWidth, $origHeight, $newWidth, $newHeight);
    } else {
        $mainImage = $sourceImage;
        $newWidth = $origWidth;
        $newHeight = $origHeight;
    }

    // Creer la miniature
    $thumbHeight = intval($origHeight * (THUMB_WIDTH / $origWidth));
    $thumbImage = resizeImage($sourceImage, $origWidth, $origHeight, THUMB_WIDTH, $thumbHeight);

    // Sauvegarder les images
    $mainSaved = imagejpeg($mainImage, $filepath, JPEG_QUALITY);
    $thumbSaved = imagejpeg($thumbImage, $thumbpath, JPEG_QUALITY);

    // Liberer la memoire
    if ($mainImage !== $sourceImage) {
        imagedestroy($mainImage);
    }
    imagedestroy($thumbImage);
    imagedestroy($sourceImage);

    if (!$mainSaved || !$thumbSaved) {
        sendError('Erreur lors de la sauvegarde', 500);
    }

    // Retourner les chemins relatifs (sans le ../)
    $relativePath = str_replace('../', '', $filepath);
    $relativeThumb = str_replace('../', '', $thumbpath);

    sendSuccess([
        'src' => $relativePath,
        'thumbnail' => $relativeThumb,
        'width' => $newWidth,
        'height' => $newHeight,
        'size' => filesize($filepath)
    ]);
}

// =============================================================================
// UPLOAD VIDEO
// =============================================================================

function handleVideoUpload() {
    // Verifier qu'un fichier video a ete envoye
    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = getUploadErrorMessage($_FILES['video']['error'] ?? UPLOAD_ERR_NO_FILE);
        sendError($errorMsg, 400);
    }

    $file = $_FILES['video'];

    // Verifier la taille
    if ($file['size'] > MAX_VIDEO_SIZE) {
        sendError('Video trop volumineuse (max 100 Mo)', 400);
    }

    // Verifier le type MIME
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ALLOWED_VIDEO_TYPES)) {
        sendError('Format video non autorise. Utilisez MP4 ou WebM', 400);
    }

    // Creer les dossiers si necessaire
    if (!is_dir(VIDEO_DIR)) {
        mkdir(VIDEO_DIR, 0755, true);
    }
    if (!is_dir(THUMB_DIR)) {
        mkdir(THUMB_DIR, 0755, true);
    }

    // Determiner l'extension
    $extension = ($mimeType === 'video/webm') ? 'webm' : 'mp4';
    $filename = 'video-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
    $filepath = VIDEO_DIR . $filename;

    // Deplacer le fichier
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        sendError('Erreur lors de la sauvegarde de la video', 500);
    }

    // Gerer la miniature (envoyee par le JS)
    $thumbnailPath = '';
    if (isset($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
        // Valider le type MIME de la miniature
        $thumbFinfo = finfo_open(FILEINFO_MIME_TYPE);
        $thumbMime = finfo_file($thumbFinfo, $_FILES['thumbnail']['tmp_name']);
        finfo_close($thumbFinfo);

        if (in_array($thumbMime, ALLOWED_IMAGE_TYPES)) {
            $thumbFilename = 'thumb-' . pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
            $thumbnailPath = THUMB_DIR . $thumbFilename;
            move_uploaded_file($_FILES['thumbnail']['tmp_name'], $thumbnailPath);
            $thumbnailPath = str_replace('../', '', $thumbnailPath);
        }
    }

    // Retourner les chemins
    sendSuccess([
        'src' => str_replace('../', '', $filepath),
        'thumbnail' => $thumbnailPath,
        'size' => filesize($filepath)
    ]);
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

function createImageFromFile($path, $mimeType) {
    switch ($mimeType) {
        case 'image/jpeg':
            return imagecreatefromjpeg($path);
        case 'image/png':
            return imagecreatefrompng($path);
        case 'image/webp':
            return imagecreatefromwebp($path);
        default:
            return false;
    }
}

function resizeImage($source, $origW, $origH, $newW, $newH) {
    $newImage = imagecreatetruecolor($newW, $newH);

    // Preserver la transparence pour PNG
    imagealphablending($newImage, false);
    imagesavealpha($newImage, true);

    // Redimensionner avec interpolation de haute qualite
    imagecopyresampled($newImage, $source, 0, 0, 0, 0, $newW, $newH, $origW, $origH);

    return $newImage;
}

/**
 * Verifie un JWT Supabase en appelant l'API Supabase /auth/v1/user
 * Retourne true si le token est valide et correspond a un utilisateur.
 */
function verifySupabaseJWT($token) {
    if (empty($token) || strlen($token) < 20) return false;

    // Lire la configuration Supabase
    $config = getSupabaseConfig();
    if (!$config) {
        error_log('ERREUR: Configuration Supabase manquante pour la validation JWT.');
        return false;
    }

    // Appeler Supabase /auth/v1/user pour valider le token
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
    // Verifier que la reponse contient un ID utilisateur valide
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

function getUploadErrorMessage($errorCode) {
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'Fichier trop volumineux (limite serveur)',
        UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux',
        UPLOAD_ERR_PARTIAL => 'Upload interrompu',
        UPLOAD_ERR_NO_FILE => 'Aucun fichier selectionne',
        UPLOAD_ERR_NO_TMP_DIR => 'Erreur serveur (tmp)',
        UPLOAD_ERR_CANT_WRITE => 'Erreur d\'ecriture',
        UPLOAD_ERR_EXTENSION => 'Extension bloquee'
    ];
    return $messages[$errorCode] ?? 'Erreur inconnue';
}

function sendSuccess($data) {
    echo json_encode([
        'success' => true,
        'data' => $data
    ]);
    exit;
}

function sendError($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $message
    ]);
    exit;
}
