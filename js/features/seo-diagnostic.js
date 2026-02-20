/**
 * SEO Diagnostic Tool - Mistral Pans
 * Analyse automatique des pages du site pour le référencement
 */
(function() {
  'use strict';

  // Pages publiques à analyser
  const PAGES = [
    { url: 'index.html', label: 'Accueil', priority: 'haute' },
    { url: 'boutique.html', label: 'Boutique / Configurateur', priority: 'haute' },
    { url: 'commander.html', label: 'Commander', priority: 'haute' },
    { url: 'location.html', label: 'Location', priority: 'haute' },
    { url: 'apprendre.html', label: 'Apprendre', priority: 'moyenne' },
    { url: 'galerie.html', label: 'Galerie', priority: 'moyenne' },
    { url: 'blog.html', label: 'Blog', priority: 'moyenne' },
    { url: 'article.html', label: 'Article (template)', priority: 'moyenne' },
    { url: 'suivi.html', label: 'Suivi commande', priority: 'basse' },
    { url: 'mentions-legales.html', label: 'Mentions légales', priority: 'basse' },
    { url: 'cgv.html', label: 'CGV', priority: 'basse' }
  ];

  // Fichiers techniques
  const TECH_FILES = [
    { url: 'robots.txt', label: 'robots.txt' },
    { url: 'sitemap.xml', label: 'sitemap.xml' }
  ];

  let results = [];
  let globalScore = 0;

  // ── Lancement ──
  window.runSEODiagnostic = async function() {
    const container = document.getElementById('seo-results');
    const scoreEl = document.getElementById('seo-global-score');
    const progressEl = document.getElementById('seo-progress');
    const btnRun = document.getElementById('btn-run-diagnostic');

    container.innerHTML = '';
    btnRun.disabled = true;
    btnRun.textContent = 'Analyse en cours...';
    progressEl.style.display = 'block';
    results = [];

    // 1. Vérification fichiers techniques
    const techResults = await checkTechnicalFiles();

    // 2. Analyse de chaque page
    const total = PAGES.length;
    for (let i = 0; i < total; i++) {
      progressEl.textContent = 'Analyse ' + (i + 1) + '/' + total + ' : ' + PAGES[i].label + '...';
      const result = await analyzePage(PAGES[i]);
      results.push(result);
    }

    // 3. Calcul du score global
    globalScore = calculateGlobalScore(results, techResults);

    // 4. Affichage
    renderGlobalScore(scoreEl, globalScore);
    renderTechnicalFiles(container, techResults);
    renderResults(container, results);
    renderRecommendations(container, results, techResults);

    progressEl.style.display = 'none';
    btnRun.disabled = false;
    btnRun.textContent = 'Relancer le diagnostic';
  };

  // ── Vérification fichiers techniques ──
  async function checkTechnicalFiles() {
    const techResults = [];
    for (let i = 0; i < TECH_FILES.length; i++) {
      const file = TECH_FILES[i];
      try {
        const response = await fetch(file.url, { method: 'HEAD' });
        techResults.push({
          label: file.label,
          exists: response.ok,
          status: response.status
        });
      } catch (e) {
        techResults.push({ label: file.label, exists: false, status: 0 });
      }
    }
    return techResults;
  }

  // ── Analyse d'une page ──
  async function analyzePage(page) {
    const result = {
      page: page,
      checks: [],
      score: 0,
      error: null
    };

    try {
      const response = await fetch(page.url);
      if (!response.ok) {
        result.error = 'HTTP ' + response.status;
        return result;
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // ── Checks ──
      result.checks.push(checkTitle(doc));
      result.checks.push(checkMetaDescription(doc));
      result.checks.push(checkCanonical(doc, page.url));
      result.checks.push(checkLang(doc));
      result.checks.push(checkViewport(doc));
      result.checks.push(checkH1(doc));
      result.checks.push(checkHeadingHierarchy(doc));
      result.checks.push(checkOGTags(doc));
      result.checks.push(checkTwitterCard(doc));
      result.checks.push(checkStructuredData(doc));
      result.checks.push(checkImagesAlt(doc));
      result.checks.push(checkInternalLinks(doc));
      result.checks.push(checkRobotsMeta(doc));

      // Score par page
      const passed = result.checks.filter(function(c) { return c.status === 'ok'; }).length;
      const warnings = result.checks.filter(function(c) { return c.status === 'warning'; }).length;
      result.score = Math.round(((passed + warnings * 0.5) / result.checks.length) * 100);

    } catch (e) {
      result.error = e.message;
    }

    return result;
  }

  // ── Individual checks ──

  function checkTitle(doc) {
    const title = doc.querySelector('title');
    if (!title || !title.textContent.trim()) {
      return { name: 'Balise <title>', status: 'error', detail: 'Absente' };
    }
    const len = title.textContent.trim().length;
    if (len < 30) {
      return { name: 'Balise <title>', status: 'warning', detail: 'Trop courte (' + len + ' car.) - viser 30-60 caractères', value: title.textContent.trim() };
    }
    if (len > 60) {
      return { name: 'Balise <title>', status: 'warning', detail: 'Trop longue (' + len + ' car.) - viser 30-60 caractères', value: title.textContent.trim() };
    }
    return { name: 'Balise <title>', status: 'ok', detail: len + ' caractères', value: title.textContent.trim() };
  }

  function checkMetaDescription(doc) {
    const meta = doc.querySelector('meta[name="description"]');
    if (!meta || !meta.content.trim()) {
      return { name: 'Meta description', status: 'error', detail: 'Absente' };
    }
    const len = meta.content.trim().length;
    if (len < 70) {
      return { name: 'Meta description', status: 'warning', detail: 'Trop courte (' + len + ' car.) - viser 70-160 caractères', value: meta.content.trim() };
    }
    if (len > 160) {
      return { name: 'Meta description', status: 'warning', detail: 'Trop longue (' + len + ' car.) - viser 70-160 caractères', value: meta.content.trim() };
    }
    return { name: 'Meta description', status: 'ok', detail: len + ' caractères', value: meta.content.trim() };
  }

  function checkCanonical(doc, pageUrl) {
    const link = doc.querySelector('link[rel="canonical"]');
    if (!link || !link.href) {
      return { name: 'URL canonique', status: 'error', detail: 'Absente - risque de contenu dupliqué' };
    }
    const href = link.getAttribute('href');
    if (!href.startsWith('https://')) {
      return { name: 'URL canonique', status: 'warning', detail: 'Non HTTPS : ' + href };
    }
    return { name: 'URL canonique', status: 'ok', detail: href };
  }

  function checkLang(doc) {
    const html = doc.querySelector('html');
    if (!html || !html.getAttribute('lang')) {
      return { name: 'Attribut lang', status: 'error', detail: 'Absent sur <html>' };
    }
    const lang = html.getAttribute('lang');
    if (lang !== 'fr') {
      return { name: 'Attribut lang', status: 'warning', detail: 'Valeur "' + lang + '" (attendu "fr")' };
    }
    return { name: 'Attribut lang', status: 'ok', detail: 'lang="fr"' };
  }

  function checkViewport(doc) {
    const meta = doc.querySelector('meta[name="viewport"]');
    if (!meta) {
      return { name: 'Meta viewport', status: 'error', detail: 'Absente - problème mobile' };
    }
    return { name: 'Meta viewport', status: 'ok', detail: meta.content };
  }

  function checkH1(doc) {
    const h1s = doc.querySelectorAll('h1');
    if (h1s.length === 0) {
      return { name: 'Balise H1', status: 'error', detail: 'Aucun H1 trouvé' };
    }
    if (h1s.length > 1) {
      return { name: 'Balise H1', status: 'warning', detail: h1s.length + ' H1 trouvés (recommandé : 1 seul)', value: Array.from(h1s).map(function(h) { return h.textContent.trim(); }).join(' | ') };
    }
    const text = h1s[0].textContent.trim();
    return { name: 'Balise H1', status: 'ok', detail: '1 H1 trouvé', value: text };
  }

  function checkHeadingHierarchy(doc) {
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      return { name: 'Hiérarchie Hn', status: 'warning', detail: 'Aucun titre trouvé' };
    }

    const issues = [];
    let prevLevel = 0;
    headings.forEach(function(h) {
      const level = parseInt(h.tagName.substring(1));
      if (prevLevel > 0 && level > prevLevel + 1) {
        issues.push('Saut de H' + prevLevel + ' à H' + level);
      }
      prevLevel = level;
    });

    if (issues.length > 0) {
      return { name: 'Hiérarchie Hn', status: 'warning', detail: issues.join(', '), value: headings.length + ' titres' };
    }
    return { name: 'Hiérarchie Hn', status: 'ok', detail: headings.length + ' titres, hiérarchie correcte' };
  }

  function checkOGTags(doc) {
    const required = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
    const missing = [];
    required.forEach(function(prop) {
      const tag = doc.querySelector('meta[property="' + prop + '"]');
      if (!tag || !tag.content.trim()) missing.push(prop);
    });

    if (missing.length === required.length) {
      return { name: 'Open Graph', status: 'error', detail: 'Aucune balise OG trouvée' };
    }
    if (missing.length > 0) {
      return { name: 'Open Graph', status: 'warning', detail: 'Manquant : ' + missing.join(', ') };
    }
    return { name: 'Open Graph', status: 'ok', detail: 'Toutes les balises essentielles présentes' };
  }

  function checkTwitterCard(doc) {
    const card = doc.querySelector('meta[name="twitter:card"]');
    if (!card) {
      return { name: 'Twitter Card', status: 'warning', detail: 'Absente (utilise OG en fallback)' };
    }
    const required = ['twitter:title', 'twitter:description', 'twitter:image'];
    const missing = [];
    required.forEach(function(name) {
      const tag = doc.querySelector('meta[name="' + name + '"]');
      if (!tag || !tag.content.trim()) missing.push(name);
    });

    if (missing.length > 0) {
      return { name: 'Twitter Card', status: 'warning', detail: 'Manquant : ' + missing.join(', ') };
    }
    return { name: 'Twitter Card', status: 'ok', detail: 'Complète (' + card.content + ')' };
  }

  function checkStructuredData(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    if (scripts.length === 0) {
      return { name: 'Données structurées (JSON-LD)', status: 'warning', detail: 'Aucun schema trouvé' };
    }

    const types = [];
    scripts.forEach(function(script) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type']) types.push(data['@type']);
      } catch (e) {
        types.push('(JSON invalide)');
      }
    });

    return { name: 'Données structurées (JSON-LD)', status: 'ok', detail: types.join(', ') };
  }

  function checkImagesAlt(doc) {
    const images = doc.querySelectorAll('img');
    if (images.length === 0) {
      return { name: 'Images alt', status: 'ok', detail: 'Aucune image dans le HTML statique' };
    }

    let noAlt = 0;
    let emptyAlt = 0;
    images.forEach(function(img) {
      if (!img.hasAttribute('alt')) noAlt++;
      else if (!img.alt.trim()) emptyAlt++;
    });

    const total = images.length;
    if (noAlt > 0) {
      return { name: 'Images alt', status: 'error', detail: noAlt + '/' + total + ' image(s) sans attribut alt' };
    }
    if (emptyAlt > 0) {
      return { name: 'Images alt', status: 'warning', detail: emptyAlt + '/' + total + ' image(s) avec alt vide (décoratif ?)' };
    }
    return { name: 'Images alt', status: 'ok', detail: total + ' image(s), toutes avec alt' };
  }

  function checkInternalLinks(doc) {
    const links = doc.querySelectorAll('a[href]');
    const broken = [];
    let external = 0;
    let noOpener = 0;

    links.forEach(function(a) {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('http')) {
        external++;
        if (a.target === '_blank' && (!a.rel || !a.rel.includes('noopener'))) {
          noOpener++;
        }
      }
    });

    if (noOpener > 0) {
      return { name: 'Liens', status: 'warning', detail: noOpener + ' lien(s) externe(s) target="_blank" sans rel="noopener"' };
    }
    return { name: 'Liens', status: 'ok', detail: links.length + ' liens, ' + external + ' externe(s)' };
  }

  function checkRobotsMeta(doc) {
    const meta = doc.querySelector('meta[name="robots"]');
    if (!meta) {
      return { name: 'Meta robots', status: 'ok', detail: 'Absente (indexation par défaut)' };
    }
    const content = meta.content.toLowerCase();
    if (content.includes('noindex')) {
      return { name: 'Meta robots', status: 'warning', detail: 'noindex détecté - page non indexée', value: meta.content };
    }
    return { name: 'Meta robots', status: 'ok', detail: meta.content };
  }

  // ── Score global ──

  function calculateGlobalScore(results, techResults) {
    let totalPoints = 0;
    let maxPoints = 0;

    // Fichiers techniques (20 points chacun)
    techResults.forEach(function(t) {
      maxPoints += 20;
      if (t.exists) totalPoints += 20;
    });

    // Score des pages (pondéré par priorité)
    results.forEach(function(r) {
      const weight = r.page.priority === 'haute' ? 3 : r.page.priority === 'moyenne' ? 2 : 1;
      maxPoints += 100 * weight;
      totalPoints += (r.score || 0) * weight;
    });

    return Math.round((totalPoints / maxPoints) * 100);
  }

  // ── Rendu ──

  function renderGlobalScore(el, score) {
    const color = score >= 80 ? '#3D6B4A' : score >= 60 ? '#D97706' : '#DC2626';
    const label = score >= 80 ? 'Bon' : score >= 60 ? 'Moyen' : 'Faible';

    el.innerHTML =
      '<div class="seo-score-circle" style="--score-color: ' + color + ';">' +
        '<svg viewBox="0 0 120 120">' +
          '<circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8"/>' +
          '<circle cx="60" cy="60" r="54" fill="none" stroke="' + color + '" stroke-width="8" ' +
            'stroke-dasharray="' + (339.3 * score / 100) + ' 339.3" ' +
            'stroke-linecap="round" transform="rotate(-90 60 60)" style="transition: stroke-dasharray 1s ease;"/>' +
        '</svg>' +
        '<div class="seo-score-value">' +
          '<span class="seo-score-number">' + score + '</span>' +
          '<span class="seo-score-unit">/100</span>' +
        '</div>' +
      '</div>' +
      '<div class="seo-score-label" style="color: ' + color + ';">' + label + '</div>';
  }

  function renderTechnicalFiles(container, techResults) {
    let html = '<div class="seo-section">' +
      '<h2>Fichiers techniques</h2>' +
      '<div class="seo-checks-grid">';

    techResults.forEach(function(t) {
      const icon = t.exists ? '&#10003;' : '&#10007;';
      const cls = t.exists ? 'seo-check--ok' : 'seo-check--error';
      html += '<div class="seo-check ' + cls + '">' +
        '<span class="seo-check__icon">' + icon + '</span>' +
        '<span class="seo-check__name">' + escapeHtml(t.label) + '</span>' +
        '<span class="seo-check__detail">' + (t.exists ? 'Présent' : 'Manquant') + '</span>' +
      '</div>';
    });

    html += '</div></div>';
    container.insertAdjacentHTML('beforeend', html);
  }

  function renderResults(container, results) {
    results.forEach(function(r) {
      const statusClass = r.score >= 80 ? 'seo-page--good' : r.score >= 60 ? 'seo-page--medium' : 'seo-page--poor';
      let html = '<div class="seo-section seo-page ' + statusClass + '">' +
        '<div class="seo-page__header" onclick="this.parentElement.classList.toggle(\'seo-page--open\')">' +
          '<div class="seo-page__info">' +
            '<h3>' + escapeHtml(r.page.label) + '</h3>' +
            '<span class="seo-page__url">' + escapeHtml(r.page.url) + '</span>' +
            '<span class="seo-page__priority seo-page__priority--' + r.page.priority + '">' + r.page.priority + '</span>' +
          '</div>' +
          '<div class="seo-page__score">' +
            '<span class="seo-page__score-value">' + (r.error ? '?' : r.score) + '</span>' +
            '<span class="seo-page__score-unit">/100</span>' +
          '</div>' +
        '</div>';

      if (r.error) {
        html += '<div class="seo-page__body"><p class="seo-check seo-check--error">Erreur : ' + escapeHtml(r.error) + '</p></div>';
      } else {
        html += '<div class="seo-page__body"><div class="seo-checks-list">';
        r.checks.forEach(function(c) {
          const icon = c.status === 'ok' ? '&#10003;' : c.status === 'warning' ? '&#9888;' : '&#10007;';
          html += '<div class="seo-check seo-check--' + c.status + '">' +
            '<span class="seo-check__icon">' + icon + '</span>' +
            '<div class="seo-check__content">' +
              '<span class="seo-check__name">' + escapeHtml(c.name) + '</span>' +
              '<span class="seo-check__detail">' + escapeHtml(c.detail) + '</span>' +
              (c.value ? '<span class="seo-check__value">' + escapeHtml(c.value) + '</span>' : '') +
            '</div>' +
          '</div>';
        });
        html += '</div></div>';
      }

      html += '</div>';
      container.insertAdjacentHTML('beforeend', html);
    });
  }

  function renderRecommendations(container, results, techResults) {
    const recs = [];

    // Fichiers techniques manquants
    techResults.forEach(function(t) {
      if (!t.exists) {
        recs.push({ priority: 'critique', text: 'Créer le fichier ' + t.label + ' à la racine du site' });
      }
    });

    // Problèmes par page
    results.forEach(function(r) {
      if (r.error) {
        recs.push({ priority: 'critique', text: r.page.label + ' : erreur de chargement (' + r.error + ')' });
        return;
      }
      r.checks.forEach(function(c) {
        if (c.status === 'error') {
          recs.push({ priority: 'haute', text: r.page.label + ' - ' + c.name + ' : ' + c.detail });
        }
      });
      r.checks.forEach(function(c) {
        if (c.status === 'warning') {
          recs.push({ priority: 'moyenne', text: r.page.label + ' - ' + c.name + ' : ' + c.detail });
        }
      });
    });

    if (recs.length === 0) return;

    let html = '<div class="seo-section seo-recommendations">' +
      '<h2>Recommandations</h2>' +
      '<div class="seo-recs-list">';

    const grouped = { critique: [], haute: [], moyenne: [] };
    recs.forEach(function(r) { grouped[r.priority].push(r); });

    ['critique', 'haute', 'moyenne'].forEach(function(prio) {
      if (grouped[prio].length === 0) return;
      html += '<div class="seo-recs-group">' +
        '<h4 class="seo-recs-priority seo-recs-priority--' + prio + '">' +
        (prio === 'critique' ? 'Critique' : prio === 'haute' ? 'Priorité haute' : 'Priorité moyenne') +
        ' (' + grouped[prio].length + ')</h4>';
      grouped[prio].forEach(function(r) {
        html += '<div class="seo-rec-item seo-rec-item--' + prio + '">' + escapeHtml(r.text) + '</div>';
      });
      html += '</div>';
    });

    html += '</div></div>';
    container.insertAdjacentHTML('beforeend', html);
  }

  const escapeHtml = MistralUtils.escapeHtml;

  // Bind button (CSP-safe)
  const btnRun = document.getElementById('btn-run-diagnostic');
  if (btnRun) btnRun.addEventListener('click', window.runSEODiagnostic);

})();
