// Netlify Function : Sitemap XML dynamique
// Génère un sitemap combinant pages statiques + contenus dynamiques (articles, instruments)

const BASE_URL = 'https://mistralpans.fr';

// Pages statiques avec priorité et fréquence de mise à jour
const STATIC_PAGES = [
  { path: '/',                   changefreq: 'weekly',  priority: '1.0' },
  { path: '/boutique.html',      changefreq: 'weekly',  priority: '0.9' },
  { path: '/commander.html',     changefreq: 'monthly', priority: '0.8' },
  { path: '/location.html',      changefreq: 'monthly', priority: '0.8' },
  { path: '/apprendre.html',     changefreq: 'monthly', priority: '0.7' },
  { path: '/galerie.html',       changefreq: 'monthly', priority: '0.6' },
  { path: '/blog.html',          changefreq: 'weekly',  priority: '0.7' },
  { path: '/suivi.html',         changefreq: 'yearly',  priority: '0.3' },
  { path: '/mentions-legales.html', changefreq: 'yearly', priority: '0.2' },
  { path: '/cgv.html',           changefreq: 'yearly',  priority: '0.2' }
];

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  return {
    url,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Récupère les articles publiés depuis Supabase
 * @returns {Array<{ slug: string, updated_at?: string }>}
 */
async function fetchPublishedArticles(sb) {
  try {
    const response = await fetch(
      `${sb.url}/rest/v1/articles?status=eq.published&select=slug,updated_at`,
      { method: 'GET', headers: sb.headers }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    console.warn('Sitemap: erreur fetch articles:', e.message);
    return [];
  }
}

/**
 * Récupère les instruments en stock depuis Supabase
 * @returns {Array<{ id: string, updated_at?: string }>}
 */
async function fetchAvailableInstruments(sb) {
  try {
    const response = await fetch(
      `${sb.url}/rest/v1/instruments?statut=eq.en_ligne&select=id,updated_at`,
      { method: 'GET', headers: sb.headers }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    console.warn('Sitemap: erreur fetch instruments:', e.message);
    return [];
  }
}

/**
 * Formate une date ISO en YYYY-MM-DD pour le sitemap
 */
function formatDate(isoDate) {
  if (!isoDate) return null;
  try {
    return new Date(isoDate).toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

/**
 * Échappe les caractères spéciaux XML
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Génère une entrée <url> pour le sitemap
 */
function urlEntry(loc, changefreq, priority, lastmod) {
  let xml = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n`;
  if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
  xml += `    <changefreq>${changefreq}</changefreq>\n`;
  xml += `    <priority>${priority}</priority>\n`;
  xml += `  </url>`;
  return xml;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600'
  };

  // Pages statiques
  const urls = STATIC_PAGES.map(page =>
    urlEntry(`${BASE_URL}${page.path}`, page.changefreq, page.priority)
  );

  // Contenus dynamiques depuis Supabase
  const sb = getSupabaseConfig();
  if (sb) {
    const [articles, instruments] = await Promise.all([
      fetchPublishedArticles(sb),
      fetchAvailableInstruments(sb)
    ]);

    // Articles de blog
    for (const article of articles) {
      if (!article.slug) continue;
      const lastmod = formatDate(article.updated_at);
      urls.push(urlEntry(
        `${BASE_URL}/article.html?slug=${escapeXml(article.slug)}`,
        'monthly', '0.6', lastmod
      ));
    }

    // Instruments en stock (fiches produit)
    for (const inst of instruments) {
      if (!inst.id) continue;
      const lastmod = formatDate(inst.updated_at);
      urls.push(urlEntry(
        `${BASE_URL}/annonce.html?ref=${escapeXml(inst.id)}`,
        'weekly', '0.8', lastmod
      ));
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>'
  ].join('\n');

  return { statusCode: 200, headers, body: xml };
};
