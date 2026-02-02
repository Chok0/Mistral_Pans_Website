<?php
/**
 * MISTRAL PANS - Upload d'images et vidéos sécurisé
 * Compression et redimensionnement automatique pour images
 * Stockage direct pour vidéos
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

// Headers CORS pour les requêtes AJAX
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

// Gérer les requêtes OPTIONS (preflight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Vérifier la méthode
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Méthode non autorisée', 405);
}

// Vérifier le token admin (simple vérification)
$token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
$storedHash = getAdminHash();
if (!$storedHash || !verifyToken($token, $storedHash)) {
    sendError('Non autorisé', 401);
}

// Détecter le type d'upload
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
    // Vérifier qu'un fichier a été envoyé
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = getUploadErrorMessage($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE);
        sendError($errorMsg, 400);
    }

    $file = $_FILES['image'];

    // Vérifier la taille
    if ($file['size'] > MAX_IMAGE_SIZE) {
        sendError('Image trop volumineuse (max 5 Mo)', 400);
    }

    // Vérifier le type MIME réel
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ALLOWED_IMAGE_TYPES)) {
        sendError('Format non autorisé. Utilisez JPG, PNG ou WebP', 400);
    }

    // Créer les dossiers si nécessaire
    if (!is_dir(UPLOAD_DIR)) {
        mkdir(UPLOAD_DIR, 0755, true);
    }
    if (!is_dir(THUMB_DIR)) {
        mkdir(THUMB_DIR, 0755, true);
    }

    // Générer un nom de fichier unique
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

    // Redimensionner l'image principale si nécessaire
    if ($origWidth > MAX_WIDTH) {
        $newWidth = MAX_WIDTH;
        $newHeight = intval($origHeight * (MAX_WIDTH / $origWidth));
        $mainImage = resizeImage($sourceImage, $origWidth, $origHeight, $newWidth, $newHeight);
    } else {
        $mainImage = $sourceImage;
        $newWidth = $origWidth;
        $newHeight = $origHeight;
    }

    // Créer la miniature
    $thumbHeight = intval($origHeight * (THUMB_WIDTH / $origWidth));
    $thumbImage = resizeImage($sourceImage, $origWidth, $origHeight, THUMB_WIDTH, $thumbHeight);

    // Sauvegarder les images
    $mainSaved = imagejpeg($mainImage, $filepath, JPEG_QUALITY);
    $thumbSaved = imagejpeg($thumbImage, $thumbpath, JPEG_QUALITY);

    // Libérer la mémoire
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
    // Vérifier qu'un fichier vidéo a été envoyé
    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = getUploadErrorMessage($_FILES['video']['error'] ?? UPLOAD_ERR_NO_FILE);
        sendError($errorMsg, 400);
    }

    $file = $_FILES['video'];

    // Vérifier la taille
    if ($file['size'] > MAX_VIDEO_SIZE) {
        sendError('Vidéo trop volumineuse (max 100 Mo)', 400);
    }

    // Vérifier le type MIME
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ALLOWED_VIDEO_TYPES)) {
        sendError('Format vidéo non autorisé. Utilisez MP4 ou WebM', 400);
    }

    // Créer les dossiers si nécessaire
    if (!is_dir(VIDEO_DIR)) {
        mkdir(VIDEO_DIR, 0755, true);
    }
    if (!is_dir(THUMB_DIR)) {
        mkdir(THUMB_DIR, 0755, true);
    }

    // Déterminer l'extension
    $extension = ($mimeType === 'video/webm') ? 'webm' : 'mp4';
    $filename = 'video-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
    $filepath = VIDEO_DIR . $filename;

    // Déplacer le fichier
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        sendError('Erreur lors de la sauvegarde de la vidéo', 500);
    }

    // Gérer la miniature (envoyée par le JS)
    $thumbnailPath = '';
    if (isset($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
        $thumbFilename = 'thumb-' . pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
        $thumbnailPath = THUMB_DIR . $thumbFilename;
        move_uploaded_file($_FILES['thumbnail']['tmp_name'], $thumbnailPath);
        $thumbnailPath = str_replace('../', '', $thumbnailPath);
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
    
    // Préserver la transparence pour PNG
    imagealphablending($newImage, false);
    imagesavealpha($newImage, true);
    
    // Redimensionner avec interpolation de haute qualité
    imagecopyresampled($newImage, $source, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
    
    return $newImage;
}

function getAdminHash() {
    // Lire le hash depuis un fichier local (plus sécurisé que dans le code)
    $hashFile = __DIR__ . '/.admin_hash';
    if (file_exists($hashFile)) {
        return trim(file_get_contents($hashFile));
    }
    
    // Fallback : accepte le hash JS de 'mistral2024'
    // Le hash simple JS de 'mistral2024' = '-6de5765f'
    return '-6de5765f';
}

function verifyToken($token, $storedHash) {
    if (empty($token)) return false;
    
    // Accepte le hash stocké ou des tokens alternatifs
    $validTokens = [
        $storedHash,
        '-6de5765f', // Hash JS de 'mistral2024'
        'mistral_upload_token' // Token de secours
    ];
    
    return in_array($token, $validTokens);
}

function getUploadErrorMessage($errorCode) {
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'Fichier trop volumineux (limite serveur)',
        UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux',
        UPLOAD_ERR_PARTIAL => 'Upload interrompu',
        UPLOAD_ERR_NO_FILE => 'Aucun fichier sélectionné',
        UPLOAD_ERR_NO_TMP_DIR => 'Erreur serveur (tmp)',
        UPLOAD_ERR_CANT_WRITE => 'Erreur d\'écriture',
        UPLOAD_ERR_EXTENSION => 'Extension bloquée'
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
