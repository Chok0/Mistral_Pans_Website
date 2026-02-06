/* ==========================================================================
   MISTRAL PANS - Statistiques Anonymes (RGPD Compliant)
   Comptage agrÃ©gÃ© sans tracking individuel
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    STORAGE_KEY: 'mistral_stats_anonymous',
    RETENTION_DAYS: 90,
    
    PAGES: {
      '/': 'Accueil',
      '/index.html': 'Accueil',
      '/boutique.html': 'Boutique',
      '/galerie.html': 'Galerie',
      '/apprendre.html': 'Apprendre',
      '/blog.html': 'Blog',
      '/commander.html': 'Commander',
      '/location.html': 'Location'
    }
  };

  // ============================================================================
  // UTILITAIRES
  // ============================================================================
  
  function getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  function getCurrentHour() {
    return new Date().getHours();
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    return CONFIG.PAGES[path] || path.replace(/^\/|\.html$/g, '') || 'Autre';
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablette';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Autre';
  }

  function getTrafficSource() {
    const referrer = document.referrer;
    if (!referrer) return 'Direct';
    
    try {
      const url = new URL(referrer);
      if (url.hostname === window.location.hostname) return 'Interne';
      
      const domain = url.hostname.toLowerCase();
      if (domain.includes('google') || domain.includes('bing') || domain.includes('duckduckgo')) return 'Recherche';
      if (domain.includes('facebook') || domain.includes('instagram') || domain.includes('linkedin')) return 'RÃ©seaux sociaux';
      return 'Autre site';
    } catch {
      return 'Direct';
    }
  }

  // ============================================================================
  // STOCKAGE
  // ============================================================================
  
  function getStats() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
      return stored ? JSON.parse(stored) : { daily: {} };
    } catch {
      return { daily: {} };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('Stats storage error:', e);
    }
  }

  // ============================================================================
  // TRACKING ANONYME
  // ============================================================================
  
  function trackPageView() {
    const stats = getStats();
    const today = getTodayKey();
    const page = getCurrentPage();
    const hour = getCurrentHour();
    const device = getDeviceType();
    const browser = getBrowser();
    const source = getTrafficSource();

    // Initialiser le jour si nÃ©cessaire
    if (!stats.daily[today]) {
      stats.daily[today] = {
        totalViews: 0,
        pages: {},
        hours: {},
        devices: {},
        browsers: {},
        sources: {}
      };
    }

    const day = stats.daily[today];

    // IncrÃ©menter les compteurs (agrÃ©gÃ©s, anonymes)
    day.totalViews++;
    day.pages[page] = (day.pages[page] || 0) + 1;
    day.hours[hour] = (day.hours[hour] || 0) + 1;
    day.devices[device] = (day.devices[device] || 0) + 1;
    day.browsers[browser] = (day.browsers[browser] || 0) + 1;
    
    // Ne compter la source que pour les entrÃ©es (pas navigation interne)
    if (source !== 'Interne') {
      day.sources[source] = (day.sources[source] || 0) + 1;
    }

    saveStats(stats);
  }

  function trackCTA(name) {
    const stats = getStats();
    const today = getTodayKey();

    if (!stats.daily[today]) {
      stats.daily[today] = { totalViews: 0, pages: {}, hours: {}, devices: {}, browsers: {}, sources: {} };
    }

    if (!stats.daily[today].cta) {
      stats.daily[today].cta = {};
    }

    stats.daily[today].cta[name] = (stats.daily[today].cta[name] || 0) + 1;
    saveStats(stats);
  }

  // ============================================================================
  // NETTOYAGE
  // ============================================================================
  
  function cleanup() {
    const stats = getStats();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.RETENTION_DAYS);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    let cleaned = false;
    Object.keys(stats.daily).forEach(date => {
      if (date < cutoff) {
        delete stats.daily[date];
        cleaned = true;
      }
    });

    if (cleaned) {
      saveStats(stats);
    }
  }

  // ============================================================================
  // RAPPORTS
  // ============================================================================
  
  const Reports = {
    /**
     * RÃ©sumÃ© sur une pÃ©riode
     */
    getSummary(days = 30) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      let totalViews = 0;
      let daysWithData = 0;

      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey) {
          totalViews += data.totalViews || 0;
          daysWithData++;
        }
      });

      return {
        totalViews,
        avgViewsPerDay: daysWithData > 0 ? Math.round(totalViews / daysWithData) : 0,
        daysWithData
      };
    },

    /**
     * Top pages
     */
    getTopPages(days = 30, limit = 10) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      const pages = {};
      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey && data.pages) {
          Object.entries(data.pages).forEach(([page, count]) => {
            pages[page] = (pages[page] || 0) + count;
          });
        }
      });

      return Object.entries(pages)
        .map(([page, views]) => ({ page, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);
    },

    /**
     * Sources de trafic
     */
    getTrafficSources(days = 30) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      const sources = {};
      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey && data.sources) {
          Object.entries(data.sources).forEach(([source, count]) => {
            sources[source] = (sources[source] || 0) + count;
          });
        }
      });

      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      return Object.entries(sources)
        .map(([source, count]) => ({
          source,
          count,
          percent: total > 0 ? Math.round(count / total * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);
    },

    /**
     * RÃ©partition par appareil
     */
    getDevices(days = 30) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      const devices = {};
      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey && data.devices) {
          Object.entries(data.devices).forEach(([device, count]) => {
            devices[device] = (devices[device] || 0) + count;
          });
        }
      });

      const total = Object.values(devices).reduce((a, b) => a + b, 0);
      return Object.entries(devices)
        .map(([device, count]) => ({
          device,
          count,
          percent: total > 0 ? Math.round(count / total * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);
    },

    /**
     * RÃ©partition par navigateur
     */
    getBrowsers(days = 30) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      const browsers = {};
      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey && data.browsers) {
          Object.entries(data.browsers).forEach(([browser, count]) => {
            browsers[browser] = (browsers[browser] || 0) + count;
          });
        }
      });

      const total = Object.values(browsers).reduce((a, b) => a + b, 0);
      return Object.entries(browsers)
        .map(([browser, count]) => ({
          browser,
          count,
          percent: total > 0 ? Math.round(count / total * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);
    },

    /**
     * Heures de pointe
     */
    getPeakHours(days = 30) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      const hours = {};
      for (let i = 0; i < 24; i++) hours[i] = 0;

      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey && data.hours) {
          Object.entries(data.hours).forEach(([hour, count]) => {
            hours[hour] = (hours[hour] || 0) + count;
          });
        }
      });

      return Object.entries(hours)
        .map(([hour, count]) => ({
          hour: `${hour.toString().padStart(2, '0')}h`,
          count
        }));
    },

    /**
     * Tendance quotidienne
     */
    getDailyTrend(days = 30) {
      const stats = getStats();
      const result = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        const data = stats.daily[key];
        
        result.push({
          date: key,
          views: data?.totalViews || 0
        });
      }

      return result;
    },

    /**
     * Performance CTA
     */
    getCTAPerformance(days = 30) {
      const stats = getStats();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      const ctas = {};
      Object.entries(stats.daily).forEach(([date, data]) => {
        if (date >= cutoffKey && data.cta) {
          Object.entries(data.cta).forEach(([name, count]) => {
            ctas[name] = (ctas[name] || 0) + count;
          });
        }
      });

      return Object.entries(ctas)
        .map(([name, clicks]) => ({ name, clicks }))
        .sort((a, b) => b.clicks - a.clicks);
    }
  };

  // ============================================================================
  // ADMINISTRATION
  // ============================================================================
  
  const Admin = {
    clearAll() {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      console.log('Statistiques effacÃ©es');
    },

    cleanup() {
      cleanup();
    },

    getStorageUsage() {
      const item = localStorage.getItem(CONFIG.STORAGE_KEY);
      const bytes = item ? item.length * 2 : 0;
      return {
        bytes,
        kb: Math.round(bytes / 1024 * 100) / 100
      };
    },

    getRawData() {
      return getStats();
    }
  };

  // ============================================================================
  // EXPORT
  // ============================================================================
  
  const Export = {
    toJSON() {
      return {
        exportDate: new Date().toISOString(),
        data: getStats()
      };
    },

    toCSV(days = 30) {
      const trend = Reports.getDailyTrend(days);
      const headers = ['Date', 'Pages vues'];
      const rows = trend.map(d => [d.date, d.views]);
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    },

    download(filename, content, type = 'application/json') {
      const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // ============================================================================
  // AUTO-TRACKING
  // ============================================================================
  
  function initAutoTracking() {
    // Tracker les clics sur les CTA marquÃ©s
    document.addEventListener('click', function(e) {
      const cta = e.target.closest('[data-track-cta]');
      if (cta) {
        const name = cta.getAttribute('data-track-cta');
        trackCTA(name);
      }
    });
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================
  
  function init() {
    // Ne pas tracker la page admin
    if (window.location.pathname.includes('admin')) return;

    // Nettoyer les anciennes donnÃ©es
    cleanup();

    // Tracker la page vue
    trackPageView();

    // Initialiser l'auto-tracking
    initAutoTracking();
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================
  
  window.MistralStats = {
    // Tracking manuel
    trackCTA,

    // Rapports
    Reports,

    // Administration
    Admin,

    // Export
    Export
  };

})(window);
