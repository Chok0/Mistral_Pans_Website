/**
 * Email Template System — Mistral Pans
 * Systeme modulaire pour construire des emails coherents et maintenables
 *
 * Usage :
 * const email = EmailBuilder
 *   .create()
 *   .header('Titre', 'sous-titre optionnel')
 *   .content()
 *     .heading('Section')
 *     .paragraph('Texte')
 *     .box('Contenu', { variant: 'info' })
 *   .close()
 *   .footer()
 *   .build();
 */

/**
 * Design System Mistral Pans
 */
const DESIGN = {
  colors: {
    primary: '#0D7377',
    accent: '#3D6B4A',
    warning: '#D97706',
    error: '#DC2626',
    bg: '#FDFBF7',
    bgDark: '#1A1815',
    text: '#2C2825',
    textLight: '#6B7280',
    border: '#E5E5E5',
    bgAlt: '#F8F8F8'
  },
  fonts: {
    family: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace"
  },
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    xxl: '30px'
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px'
  }
};

/**
 * EmailBuilder — API fluide pour construire des emails
 */
class EmailBuilder {
  constructor() {
    this.html = '';
    this.inContent = false;
    this._meta = {
      to: [],
      bcc: [],
      replyTo: null,
      subject: '',
      attachment: null
    };
  }

  /**
   * Cree une nouvelle instance
   */
  static create() {
    return new EmailBuilder();
  }

  /**
   * Definit les metadonnees de l'email (to, bcc, subject, etc.)
   */
  meta(config = {}) {
    Object.assign(this._meta, config);
    return this;
  }

  /**
   * Section Header (hero avec couleur)
   */
  header(title, subtitle = '', options = {}) {
    const {
      color = DESIGN.colors.primary,
      emoji = null,
      bgGradient = false
    } = options;

    const emojiHtml = emoji ? `<div style="font-size: 48px; margin-bottom: 12px; line-height: 1;">${emoji}</div>` : '';
    const bgStyle = bgGradient
      ? `background: linear-gradient(135deg, ${color} 0%, ${_darken(color, 20)} 100%);`
      : `background: ${color};`;

    this.html += `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tr><td style="${bgStyle} color: white; padding: ${DESIGN.spacing.xxl}; text-align: center; border-radius: ${DESIGN.radius.lg} ${DESIGN.radius.lg} 0 0;">
        ${emojiHtml}
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; line-height: 1.2; color: white;">
          ${_escape(title)}
        </h1>
        ${subtitle ? `<p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px; color: white;">${_escape(subtitle)}</p>` : ''}
      </td></tr>
      </table>
    `;
    return this;
  }

  /**
   * Ouvre une section de contenu
   */
  content() {
    this.inContent = true;
    this.html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;"><tr><td style="background: white; padding: ${DESIGN.spacing.xxl}; border: 1px solid ${DESIGN.colors.border}; border-top: none;">`;
    return this;
  }

  /**
   * Ferme la section de contenu
   */
  close() {
    if (this.inContent) {
      this.html += `</td></tr></table>`;
      this.inContent = false;
    }
    return this;
  }

  /**
   * Titre dans le contenu
   */
  heading(text, level = 2) {
    const sizes = { 1: '28px', 2: '20px', 3: '16px' };
    const size = sizes[level] || sizes[2];
    this.html += `<h${level} style="color: ${DESIGN.colors.primary}; font-size: ${size}; font-weight: 700; margin: ${level === 1 ? '0 0 20px 0' : '20px 0 12px 0'}; line-height: 1.3;">${_escape(text)}</h${level}>`;
    return this;
  }

  /**
   * Paragraphe de texte
   */
  paragraph(text, options = {}) {
    const { align = 'left', color = DESIGN.colors.text, size = '14px', bold = false } = options;
    const style = `margin: 0 0 ${DESIGN.spacing.md} 0; color: ${color}; font-size: ${size}; text-align: ${align}; font-weight: ${bold ? '600' : 'normal'}; line-height: 1.6;`;
    this.html += `<p style="${style}">${text}</p>`;
    return this;
  }

  /**
   * Paragraphe avec echappement automatique du texte
   */
  text(text, options = {}) {
    return this.paragraph(_escape(text), options);
  }

  /**
   * Injecte du HTML brut (pour les cas ou le contenu est deja sanitize)
   */
  raw(html) {
    this.html += html;
    return this;
  }

  /**
   * Box — conteneur avec variantes (info, success, warning, error)
   */
  box(content, options = {}) {
    const { variant = 'default', emoji = null, title = null } = options;

    const variants = {
      default: { bg: DESIGN.colors.bgAlt, border: DESIGN.colors.border, borderLeft: DESIGN.colors.primary },
      info: { bg: '#E8F4F4', border: '#B3D4D4', borderLeft: DESIGN.colors.primary },
      success: { bg: '#F0F9F4', border: '#A7D8A7', borderLeft: DESIGN.colors.accent },
      warning: { bg: '#FFF8F0', border: '#FFD6A8', borderLeft: DESIGN.colors.warning },
      error: { bg: '#FEF2F2', border: '#FECACA', borderLeft: DESIGN.colors.error }
    };

    const style = variants[variant] || variants.default;
    const titleHtml = title ? `<h4 style="margin: 0 0 12px 0; color: ${style.borderLeft}; font-weight: 600;">${_escape(title)}</h4>` : '';
    const emojiHtml = emoji ? `<div style="font-size: 32px; margin-bottom: 12px;">${emoji}</div>` : '';

    this.html += `
      <div style="background: ${style.bg}; border: 1px solid ${style.border}; border-left: 4px solid ${style.borderLeft}; padding: ${DESIGN.spacing.lg}; border-radius: ${DESIGN.radius.md}; margin: ${DESIGN.spacing.lg} 0;">
        ${emojiHtml}
        ${titleHtml}
        ${content}
      </div>
    `;
    return this;
  }

  /**
   * Table de details (cle-valeur)
   */
  detailTable(rows = [], options = {}) {
    const { highlight = false } = options;

    let html = '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: ' + DESIGN.spacing.lg + ' 0;">';

    rows.forEach((row, i) => {
      const [label, value] = Array.isArray(row) ? row : [row.label, row.value];
      if (!label) return;
      const isLast = i === rows.length - 1;
      const bgColor = highlight && isLast ? DESIGN.colors.bgAlt : 'transparent';
      const fontWeight = highlight && isLast ? '700' : '400';
      const fontSize = highlight && isLast ? '16px' : '14px';

      html += `
        <tr style="border-bottom: ${isLast ? 'none' : '1px solid ' + DESIGN.colors.border}; background: ${bgColor};">
          <td style="padding: ${DESIGN.spacing.sm} 0; color: ${DESIGN.colors.textLight}; font-weight: 600; width: 40%; font-size: 14px; vertical-align: top;">${_escape(label)}</td>
          <td style="padding: ${DESIGN.spacing.sm} 0; color: ${DESIGN.colors.text}; text-align: right; font-weight: ${fontWeight}; font-size: ${fontSize};">${_escape(String(value))}</td>
        </tr>
      `;
    });

    html += '</table>';
    this.html += html;
    return this;
  }

  /**
   * Table de details avec valeurs HTML brutes (deja echappees)
   */
  detailTableRaw(rows = [], options = {}) {
    const { highlight = false } = options;

    let html = '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: ' + DESIGN.spacing.lg + ' 0;">';

    rows.forEach((row, i) => {
      const [label, value] = Array.isArray(row) ? row : [row.label, row.value];
      if (!label) return;
      const isLast = i === rows.length - 1;
      const bgColor = highlight && isLast ? DESIGN.colors.bgAlt : 'transparent';
      const fontWeight = highlight && isLast ? '700' : '400';
      const fontSize = highlight && isLast ? '16px' : '14px';

      html += `
        <tr style="border-bottom: ${isLast ? 'none' : '1px solid ' + DESIGN.colors.border}; background: ${bgColor};">
          <td style="padding: ${DESIGN.spacing.sm} 0; color: ${DESIGN.colors.textLight}; font-weight: 600; width: 40%; font-size: 14px; vertical-align: top;">${_escape(label)}</td>
          <td style="padding: ${DESIGN.spacing.sm} 0; color: ${DESIGN.colors.text}; text-align: right; font-weight: ${fontWeight}; font-size: ${fontSize};">${value}</td>
        </tr>
      `;
    });

    html += '</table>';
    this.html += html;
    return this;
  }

  /**
   * Table complete avec headers (pour rapports)
   */
  dataTable(headers = [], rows = [], options = {}) {
    const { compact = false } = options;
    const padding = compact ? '8px' : '10px';

    let html = '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: ' + DESIGN.spacing.lg + ' 0;">';

    // Header
    html += '<thead><tr style="background: #f0f0f0;">';
    headers.forEach(h => {
      const align = h.align || 'left';
      html += `<th style="padding: ${padding}; text-align: ${align}; font-size: 12px; color: #666; border-bottom: 2px solid #ddd;">${_escape(h.label || h)}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach((cell, ci) => {
        const align = headers[ci]?.align || 'left';
        const weight = headers[ci]?.bold ? '600' : 'normal';
        html += `<td style="padding: ${padding}; border-bottom: 1px solid #eee; font-size: 13px; text-align: ${align}; font-weight: ${weight};">${_escape(String(cell))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    this.html += html;
    return this;
  }

  /**
   * Bouton CTA
   */
  button(text, url, options = {}) {
    const { variant = 'primary', centered = true } = options;
    const colors = {
      primary: { bg: DESIGN.colors.primary, text: 'white' },
      success: { bg: DESIGN.colors.accent, text: 'white' },
      warning: { bg: DESIGN.colors.warning, text: 'white' }
    };
    const style = colors[variant] || colors.primary;
    const align = centered ? 'center' : 'left';

    this.html += `
      <div style="text-align: ${align}; margin: ${DESIGN.spacing.xl} 0;">
        <a href="${_escape(url)}" style="display: inline-block; background: ${style.bg}; color: ${style.text}; padding: 14px ${DESIGN.spacing.xxl}; border-radius: ${DESIGN.radius.md}; text-decoration: none; font-weight: 600; font-size: 16px;">${_escape(text)}</a>
      </div>
    `;
    return this;
  }

  /**
   * Liste a puces ou numerotee
   */
  list(items = [], options = {}) {
    const { ordered = false, color = DESIGN.colors.text } = options;
    const tag = ordered ? 'ol' : 'ul';

    let html = `<${tag} style="margin: ${DESIGN.spacing.md} 0; padding-left: ${DESIGN.spacing.xl}; color: ${color}; line-height: 1.8;">`;
    items.forEach(item => {
      html += `<li style="margin-bottom: 4px;">${_escape(item)}</li>`;
    });
    html += `</${tag}>`;

    this.html += html;
    return this;
  }

  /**
   * Separateur visuel
   */
  divider() {
    this.html += `<hr style="border: none; border-top: 1px solid ${DESIGN.colors.border}; margin: ${DESIGN.spacing.xl} 0;" />`;
    return this;
  }

  /**
   * Espaceur vertical
   */
  spacer(size = 'md') {
    const height = DESIGN.spacing[size] || size;
    this.html += `<div style="height: ${height};"></div>`;
    return this;
  }

  /**
   * Footer (pied de page)
   */
  footer(options = {}) {
    const {
      company = 'Mistral Pans',
      tagline = 'Handpans artisanaux',
      location = 'Ile-de-France, France',
      email = 'contact@mistralpans.fr',
      website = 'mistralpans.fr',
      note = null
    } = options;

    this.html += `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tr><td style="background: ${DESIGN.colors.bgDark}; color: #9CA3AF; padding: ${DESIGN.spacing.xl}; text-align: center; border-radius: 0 0 ${DESIGN.radius.lg} ${DESIGN.radius.lg}; font-size: 12px;">
        <p style="margin: 0; color: #9CA3AF;">${_escape(company)} &mdash; ${_escape(tagline)}, ${_escape(location)}</p>
        <p style="margin: 8px 0 0;">
          <a href="mailto:${_escape(email)}" style="color: ${DESIGN.colors.primary}; text-decoration: none;">${_escape(email)}</a>
          &nbsp;&middot;&nbsp;
          <a href="https://${_escape(website)}" style="color: ${DESIGN.colors.primary}; text-decoration: none;">${_escape(website)}</a>
        </p>
        ${note ? `<p style="margin: 8px 0 0; font-size: 11px; color: #6B7280;">${_escape(note)}</p>` : ''}
      </td></tr>
      </table>
    `;
    return this;
  }

  /**
   * Footer simplifie (pour emails internes / rapports)
   */
  footerMinimal(text) {
    this.html += `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tr><td style="padding: ${DESIGN.spacing.lg}; text-align: center; color: #888; font-size: 12px; border-top: 1px solid ${DESIGN.colors.border};">
        <p style="margin: 0;">${_escape(text)}</p>
      </td></tr>
      </table>
    `;
    return this;
  }

  /**
   * Construit le HTML final complet
   */
  build() {
    // Fermer le contenu si oublie
    if (this.inContent) {
      this.close();
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: ${DESIGN.fonts.family};
      background: ${DESIGN.colors.bg};
      color: ${DESIGN.colors.text};
      -webkit-text-size-adjust: 100%;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    a { color: ${DESIGN.colors.primary}; }
    @media (max-width: 600px) {
      .email-container { padding: 10px !important; }
      table { width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${this.html}
  </div>
</body>
</html>`;

    const result = {
      to: this._meta.to,
      subject: this._meta.subject,
      htmlContent: fullHtml
    };

    if (this._meta.bcc && this._meta.bcc.length > 0) result.bcc = this._meta.bcc;
    if (this._meta.replyTo) result.replyTo = this._meta.replyTo;
    if (this._meta.attachment) result.attachment = this._meta.attachment;

    return result;
  }
}

// --- Fonctions utilitaires (exportees) ---

/**
 * Echappe les caracteres HTML pour prevenir XSS
 */
function _escape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize les en-tetes email pour prevenir l'injection
 */
function sanitizeEmailHeader(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Assombrit une couleur hex d'un pourcentage donne
 */
function _darken(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + (0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

// --- Helpers ---

const EmailHelpers = {
  formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return 'Non specifiee';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  escape: _escape,
  sanitizeEmailHeader
};

module.exports = { EmailBuilder, EmailHelpers, DESIGN };
