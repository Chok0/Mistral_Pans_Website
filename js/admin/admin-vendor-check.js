/* ==========================================================================
   MISTRAL PANS - Vendor Update Checker
   Verifie les mises a jour des librairies self-hosted
   ========================================================================== */

(function(window) {
  'use strict';

  // Configuration
  const CACHE_KEY = 'mistral_vendor_check';
  const CACHE_TTL = 60 * 60 * 1000; // 1 heure
  const NPM_TIMEOUT = 5000; // 5 secondes
  const VERSIONS_URL = 'js/vendor/versions.json';

  // --- Semver comparison ---

  function isNewer(current, latest) {
    const c = current.split('.').map(Number);
    const l = latest.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }

  // --- Fetch with timeout ---

  async function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  // --- Cache helpers ---

  function getCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.timestamp > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached;
    } catch (e) {
      return null;
    }
  }

  function setCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {
      if (window.MISTRAL_DEBUG) console.warn('[VendorCheck] Impossible de mettre en cache:', e);
    }
  }

  function clearCache() {
    sessionStorage.removeItem(CACHE_KEY);
  }

  // --- Time formatting ---

  function timeAgo(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'il y a quelques secondes';
    if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + 'min';
    return 'il y a ' + Math.floor(diff / 3600) + 'h';
  }

  // --- Core check logic ---

  async function check(forceRefresh) {
    // Check cache first (unless forcing)
    if (!forceRefresh) {
      const cached = getCache();
      if (cached) {
        return cached;
      }
    }

    // Load versions.json
    let versionsData;
    try {
      const res = await fetch(VERSIONS_URL + '?t=' + Date.now());
      versionsData = await res.json();
    } catch (e) {
      console.error('[VendorCheck] Impossible de charger versions.json:', e);
      return { timestamp: Date.now(), data: null, error: 'versions_load_failed' };
    }

    const libraries = versionsData.libraries;
    const results = {};
    let registryAvailable = true;

    // Check each library against npm registry
    for (const [name, info] of Object.entries(libraries)) {
      const npmPkg = info.npm_package;
      const encodedPkg = npmPkg.replace('/', '%2F');
      results[name] = {
        current: info.version,
        latest: null,
        hasUpdate: false
      };

      try {
        const res = await fetchWithTimeout(
          'https://registry.npmjs.org/' + encodedPkg + '/latest',
          NPM_TIMEOUT
        );
        if (res.ok) {
          const data = await res.json();
          results[name].latest = data.version;
          results[name].hasUpdate = isNewer(info.version, data.version);
        }
      } catch (e) {
        console.warn('[VendorCheck] Impossible de verifier ' + name + ':', e.message);
        registryAvailable = false;
      }
    }

    const result = {
      timestamp: Date.now(),
      data: {
        results: results,
        registryAvailable: registryAvailable
      }
    };

    // Cache the result
    setCache(result.data);

    return result;
  }

  // --- Render widget ---

  function render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const contentEl = document.getElementById('vendor-check-content');
    if (!contentEl) return;

    // Show loading state
    contentEl.innerHTML = '<div style="color: var(--admin-text-muted); font-size: 0.875rem;">Chargement...</div>';

    doRender(contentEl, container);
  }

  async function doRender(contentEl, container) {
    try {
      const result = await check(false);

      if (!result.data && result.error) {
        contentEl.innerHTML = '<div style="color: var(--admin-text-muted); font-size: 0.875rem;">Impossible de charger versions.json</div>';
        return;
      }

      // Handle cached result format
      const data = result.data;
      const timestamp = result.timestamp;
      const results = data.results;
      const registryAvailable = data.registryAvailable;

      // Count updates
      let updateCount = 0;
      for (const name in results) {
        if (results[name].hasUpdate) updateCount++;
      }

      // Update badge
      const badge = document.getElementById('vendor-badge');
      if (badge) {
        if (updateCount > 0) {
          badge.textContent = updateCount;
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }

      // Build HTML
      let html = '';

      // Status line
      if (!registryAvailable) {
        html += '<div style="color: var(--admin-warning); font-size: 0.8125rem; margin-bottom: 0.75rem;">';
        html += 'Verification impossible (pas de connexion au registre npm)';
        html += '</div>';
      } else if (updateCount > 0) {
        html += '<div style="color: var(--admin-warning); font-size: 0.8125rem; margin-bottom: 0.75rem;">';
        html += '\u2B06 ' + updateCount + ' mise' + (updateCount > 1 ? 's' : '') + ' a jour disponible' + (updateCount > 1 ? 's' : '');
        html += '</div>';
      } else {
        html += '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem; margin-bottom: 0.75rem;">';
        html += '<span style="color: var(--admin-success);">\u2713 Tout est a jour</span>';
        html += '<span style="color: var(--admin-text-muted);">Verifie ' + timeAgo(timestamp) + '</span>';
        html += '</div>';
      }

      // Library list
      html += '<div style="display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 0.75rem;">';
      for (const [name, info] of Object.entries(results)) {
        html += '<div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem;">';
        html += '<span style="color: var(--admin-text); min-width: 100px;">' + name + '</span>';
        html += '<span style="color: var(--admin-text-muted); font-family: \'JetBrains Mono\', monospace; font-size: 0.75rem;">' + info.current + '</span>';

        if (info.hasUpdate && info.latest) {
          html += '<span style="color: var(--admin-text-muted);">\u2192</span>';
          html += '<span style="color: var(--admin-accent); font-family: \'JetBrains Mono\', monospace; font-size: 0.75rem;">' + info.latest + '</span>';
          html += '<span style="color: var(--admin-warning);">\u2B06</span>';
        } else if (info.latest) {
          html += '<span style="color: var(--admin-success);">\u2713</span>';
        }

        html += '</div>';
      }
      html += '</div>';

      // Terminal command (only if updates available)
      if (updateCount > 0) {
        html += '<div style="font-size: 0.8125rem; color: var(--admin-text-muted); margin-bottom: 0.5rem;">Pour mettre a jour, lance dans ton terminal :</div>';
        html += '<div style="background: var(--admin-bg); border: 1px solid var(--admin-border); border-radius: var(--admin-radius-sm); padding: 0.5rem 0.75rem; font-family: \'JetBrains Mono\', monospace; font-size: 0.8125rem; color: var(--admin-accent);">';
        html += './scripts/update-vendor.sh --install';
        html += '</div>';
      }

      // Check now button
      html += '<div style="margin-top: 0.75rem;">';
      html += '<button onclick="VendorCheck.forceCheck()" style="background: none; border: 1px solid var(--admin-border); color: var(--admin-text-muted); padding: 0.375rem 0.75rem; border-radius: var(--admin-radius-sm); cursor: pointer; font-size: 0.8125rem; transition: var(--admin-transition);" onmouseover="this.style.borderColor=\'var(--admin-accent)\';this.style.color=\'var(--admin-accent)\'" onmouseout="this.style.borderColor=\'var(--admin-border)\';this.style.color=\'var(--admin-text-muted)\'">';
      html += 'Verifier maintenant';
      html += '</button>';
      html += '</div>';

      contentEl.innerHTML = html;

    } catch (e) {
      console.error('[VendorCheck] Erreur de rendu:', e);
      contentEl.innerHTML = '<div style="color: var(--admin-text-muted); font-size: 0.875rem;">Erreur lors de la verification</div>';
    }
  }

  // --- Force check (button click) ---

  function forceCheck() {
    clearCache();
    const contentEl = document.getElementById('vendor-check-content');
    if (contentEl) {
      contentEl.innerHTML = '<div style="color: var(--admin-text-muted); font-size: 0.875rem;">Verification en cours...</div>';
    }
    const container = document.getElementById('vendor-check-container');
    if (contentEl && container) {
      check(true).then(function() {
        doRender(contentEl, container);
      });
    }
  }

  // API publique
  window.VendorCheck = {
    check: check,
    render: render,
    forceCheck: forceCheck
  };

})(window);
