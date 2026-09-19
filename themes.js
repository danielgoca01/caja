/* Caja Casa theme preferences. Palette resolution keeps backgrounds, surfaces
 * and text in the same light/dark scheme. Accent text is checked against every
 * surface where the app uses it. Numeric/UI typography never follows the title
 * font preference. Existing theme IDs and storage keys remain compatible. */
'use strict';

var THEME_UI_FONT = "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
var THEME_DISPLAY_FONT = "'Petrona', Georgia, serif";
var THEME_PALETTES = {
  editorial: { mode:'light', bg:'#F4F1E8', surface:'#FAF8F2', raised:'#FFFFFF', ink:'#272C24', secondary:'#535B4C', muted:'#6E7665', border:'#D6DACD' },
  plum:      { mode:'dark',  bg:'#211C25', surface:'#2C2631', raised:'#352E3B', ink:'#F5F0F5', secondary:'#D4CBD7', muted:'#B7ABBB', border:'#514655' },
  paper:     { mode:'light', bg:'#F4F3EF', surface:'#FCFCF9', raised:'#FFFFFF', ink:'#252624', secondary:'#51534F', muted:'#696D65', border:'#D5D6CF' },
  blush:     { mode:'light', bg:'#F4EAE7', surface:'#FBF5F2', raised:'#FFFBF8', ink:'#36292A', secondary:'#675454', muted:'#7E6666', border:'#DFCBC8' },
  forest:    { mode:'dark',  bg:'#142820', surface:'#1D3329', raised:'#284236', ink:'#F0F2E9', secondary:'#D1DCCD', muted:'#AFC0AC', border:'#416050' },
  sky:       { mode:'light', bg:'#EAF0F2', surface:'#F5F9FA', raised:'#FDFEFE', ink:'#243038', secondary:'#52626B', muted:'#667985', border:'#CEDADF' },
  sand:      { mode:'light', bg:'#EEE7DA', surface:'#F8F3E9', raised:'#FFFCF4', ink:'#342C22', secondary:'#64594B', muted:'#7C6E5B', border:'#D8CBBB' },
  night:     { mode:'dark',  bg:'#1B221D', surface:'#252E27', raised:'#313D32', ink:'#F1F3E9', secondary:'#D2D9C8', muted:'#B2C0A8', border:'#4D5D49' },
  lilac:     { mode:'light', bg:'#EFEBF3', surface:'#F8F5FA', raised:'#FDFBFF', ink:'#302735', secondary:'#605468', muted:'#796B82', border:'#D8CFDE' },
  stone:     { mode:'light', bg:'#EBEAE4', surface:'#F7F6F1', raised:'#FEFDF8', ink:'#2E3029', secondary:'#5C5F53', muted:'#727766', border:'#D2D5C8' },
  mist:      { mode:'light', bg:'#E7EDE6', surface:'#F4F7F1', raised:'#FCFDF7', ink:'#25312A', secondary:'#536358', muted:'#687B6D', border:'#CAD8CC' }
};
var THEME_ACCENTS = {
  lilac:  { light:'#745482', dark:'#BEA5CD' },
  rose:   { light:'#99565E', dark:'#D4A0AA' },
  mint:   { light:'#407962', dark:'#A2C9B1' },
  indigo: { light:'#536D8A', dark:'#9CB9D4' },
  peach:  { light:'#99674C', dark:'#D9B193' },
  sage:   { light:'#55714F', dark:'#ADC39B' },
  slate:  { light:'#626E78', dark:'#B4BEC5' },
  amber:  { light:'#8D6B37', dark:'#D3BD8C' },
  lime:   { light:'#617846', dark:'#B4C58E' }
};
var THEMES = [
  { id:'editorial', name:'Editorial', sub:'Papel y oliva', palette:'editorial', accent:'sage', meta:'#F4F1E8' },
  { id:'noche-lila', name:'Noche Lila', sub:'Ciruela al anochecer', palette:'plum', accent:'lilac', meta:'#211C25' },
  { id:'papel', name:'Papel', sub:'Blanco cálido y tinta', palette:'paper', accent:'slate', meta:'#F4F3EF' },
  { id:'rosado', name:'Rosado', sub:'Rosa suave y arcilla', palette:'blush', accent:'rose', meta:'#F4EAE7' },
  { id:'bosque', name:'Bosque', sub:'Verde profundo y salvia', palette:'forest', accent:'sage', meta:'#142820' },
  { id:'cielo', name:'Cielo', sub:'Azul claro y pizarra', palette:'sky', accent:'indigo', meta:'#EAF0F2' },
  { id:'duna', name:'Duna', sub:'Arena y ocre', palette:'sand', accent:'amber', meta:'#EEE7DA' },
  { id:'neon-noche', name:'Neón', sub:'Noche y lima serena', palette:'night', accent:'lime', meta:'#1B221D' }
];
var GRANULAR_BG = [
  { v:'lilac', label:'Lila claro', c:'#EFEBF3', palette:'lilac' },
  { v:'cream', label:'Crema', c:'#F4F1E8', palette:'editorial' },
  { v:'sand', label:'Arena', c:'#EEE7DA', palette:'sand' },
  { v:'blush', label:'Rosa suave', c:'#F4EAE7', palette:'blush' },
  { v:'stone', label:'Piedra', c:'#EBEAE4', palette:'stone' },
  { v:'paper', label:'Papel', c:'#F4F3EF', palette:'paper' },
  { v:'sky', label:'Cielo', c:'#EAF0F2', palette:'sky' },
  { v:'mist', label:'Bruma', c:'#E7EDE6', palette:'mist' }
];
var GRANULAR_ACCENT = [
  { v:'lilac', label:'Lila', c:'#745482' }, { v:'rose', label:'Rosa', c:'#99565E' },
  { v:'mint', label:'Menta', c:'#407962' }, { v:'indigo', label:'Azul', c:'#536D8A' },
  { v:'peach', label:'Arcilla', c:'#99674C' }, { v:'sage', label:'Salvia', c:'#55714F' },
  { v:'slate', label:'Pizarra', c:'#626E78' }, { v:'amber', label:'Ocre', c:'#8D6B37' }
];
var GRANULAR_KEYS = ['bg', 'accent', 'font'];

function themeById(id) { return THEMES.find(function(theme) { return theme.id === id; }) || THEMES[0]; }
function themeRgb(hex) { return [1,3,5].map(function(index) { return parseInt(hex.slice(index, index + 2), 16); }); }
function themeHex(rgb) { return '#' + rgb.map(function(value) { return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0'); }).join('').toUpperCase(); }
function themeMix(first, second, amount) {
  var a = themeRgb(first), b = themeRgb(second);
  return themeHex(a.map(function(value, index) { return value + (b[index] - value) * amount; }));
}
function themeLuminance(color) {
  return themeRgb(color).map(function(value) { value /= 255; return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4); })
    .reduce(function(sum, value, index) { return sum + value * [0.2126, 0.7152, 0.0722][index]; }, 0);
}
function themeContrast(first, second) {
  var a = themeLuminance(first), b = themeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function themeReadable(color, surfaces, mode, threshold) {
  var target = mode === 'dark' ? '#FFFFFF' : '#000000';
  for (var step = 0; step <= 100; step++) {
    var candidate = themeMix(color, target, step / 100);
    if (surfaces.every(function(surface) { return themeContrast(candidate, surface) >= threshold; })) return candidate;
  }
  throw new Error('La paleta necesita superficies con un contraste coherente.');
}
function themeButtonInk(background) { return themeContrast('#FFFFFF', background) >= themeContrast('#171A16', background) ? '#FFFFFF' : '#171A16'; }
function themeValidGranular(key, value) {
  if (key === 'font') return value === 'serif' || value === 'sans';
  return (key === 'bg' ? GRANULAR_BG : key === 'accent' ? GRANULAR_ACCENT : []).some(function(item) { return item.v === value; });
}
/* Pure resolution is also the contrast test boundary: no DOM or persistence. */
function resolveTheme(themeId, custom) {
  custom = custom || {};
  var theme = themeById(themeId);
  var customBg = GRANULAR_BG.find(function(item) { return item.v === custom.bg; });
  var palette = THEME_PALETTES[customBg ? customBg.palette : theme.palette];
  var accentName = themeValidGranular('accent', custom.accent) ? custom.accent : theme.accent;
  var seed = THEME_ACCENTS[accentName][palette.mode];
  var dark = palette.mode === 'dark';
  var tint = themeMix(palette.surface, seed, dark ? 0.13 : 0.09);
  var posBg = themeMix(palette.surface, dark ? '#8DBE97' : '#719777', dark ? 0.11 : 0.07);
  var negBg = themeMix(palette.surface, dark ? '#D4A29A' : '#AC766B', dark ? 0.11 : 0.07);
  var textSurfaces = [palette.bg, palette.surface, palette.raised, tint, posBg, negBg];
  var accentSurfaces = [palette.bg, palette.surface, palette.raised, tint];
  var ink = themeReadable(palette.ink, textSurfaces, palette.mode, 4.8);
  var secondary = themeReadable(palette.secondary, textSurfaces, palette.mode, 4.8);
  var muted = themeReadable(palette.muted, textSurfaces, palette.mode, 4.8);
  var accent = themeReadable(seed, accentSurfaces, palette.mode, 4.8);
  var strong = themeReadable(seed, accentSurfaces, palette.mode, 5.6);
  var pos = themeReadable(dark ? '#AAC7AD' : '#41694F', [palette.bg, palette.surface, palette.raised, posBg], palette.mode, 4.8);
  var neg = themeReadable(dark ? '#E4AAA0' : '#984D49', [palette.bg, palette.surface, palette.raised, negBg], palette.mode, 4.8);
  var danger = dark ? '#D89A8E' : '#9C4542';
  var display = custom.font === 'sans' ? THEME_UI_FONT : THEME_DISPLAY_FONT;
  var tokens = {
    '--bg':palette.bg, '--surface':palette.surface, '--surface-raised':palette.raised,
    '--ink':ink, '--ink-2':secondary, '--ink-3':muted, '--border':palette.border,
    '--accent':accent, '--accent-strong':strong, '--accent-ink':themeButtonInk(accent), '--tint':tint,
    '--pos':pos, '--pos-bg':posBg, '--neg':neg, '--neg-bg':negBg,
    '--danger-button':danger, '--danger-ink':themeButtonInk(danger),
    '--font':THEME_UI_FONT, '--ui-font':THEME_UI_FONT, '--font-numeric':THEME_UI_FONT,
    '--display-font':display, '--display-weight':'500', '--display-style':'normal',
    '--color-scheme':palette.mode,
    // Compatibility with stable app selectors while the visual layer migrates.
    '--bg-grad':palette.bg, '--card':palette.surface, '--pill':palette.raised,
    '--accent-deep':strong, '--accent-soft':themeMix(palette.surface, accent, 0.32),
    '--accent-rgb':themeRgb(accent).join(','), '--shell':themeMix(palette.bg, ink, 0.035),
    '--shell-line':palette.border, '--track':themeMix(palette.surface, ink, 0.055),
    '--glass':palette.bg, '--glass-line':palette.border, '--shadow-card':'none',
    '--hero-bg':palette.surface, '--hero-ink':ink, '--hero-ink-2':secondary,
    '--hero-line':palette.border, '--hero-glow':'transparent',
    '--mint':pos, '--mint-soft':posBg, '--rose':neg, '--rose-soft':negBg,
    '--blue-av':accent, '--pink-av':strong, '--b1':tint, '--b2':accent, '--b3':strong, '--b4':ink
  };
  return { id:theme.id, mode:palette.mode, background:palette.bg, tokens:tokens };
}
function themeReadPreference(key) { try { return localStorage.getItem(key); } catch (error) { return null; } }
function themeWritePreference(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (error) {} }
function applyThemePreferences() {
  var root = document.documentElement, theme = themeById(root.getAttribute('data-theme'));
  var custom = {};
  GRANULAR_KEYS.forEach(function(key) { var value = root.getAttribute('data-' + key); if (themeValidGranular(key, value)) custom[key] = value; });
  var resolved = resolveTheme(theme.id, custom);
  Object.keys(resolved.tokens).forEach(function(key) { root.style.setProperty(key, resolved.tokens[key]); });
  root.style.colorScheme = resolved.mode;
  root.setAttribute('data-color-scheme', resolved.mode);
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = resolved.background;
  var label = document.getElementById('themeLabel');
  if (label) label.textContent = theme.name + ' · ' + (custom.bg || custom.accent || custom.font ? 'Personalizado' : theme.sub);
  _syncApSelected(theme.id); _syncGranularSel();
  return resolved;
}
function setTheme(id) {
  var theme = themeById(id), root = document.documentElement;
  if (theme.id === 'editorial') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme.id);
  themeWritePreference('cajaTheme', theme.id);
  GRANULAR_KEYS.forEach(function(key) { root.removeAttribute('data-' + key); themeWritePreference('caja_' + key, null); });
  applyThemePreferences();
}
function initTheme() {
  var root = document.documentElement, theme = themeById(themeReadPreference('cajaTheme'));
  if (theme.id === 'editorial') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme.id);
  GRANULAR_KEYS.forEach(function(key) {
    var value = themeReadPreference('caja_' + key);
    if (themeValidGranular(key, value)) root.setAttribute('data-' + key, value); else root.removeAttribute('data-' + key);
  });
  return applyThemePreferences();
}
function themeEscape(value) { return String(value).replace(/[&<>"']/g, function(character) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]; }); }
function renderApGrid() {
  var grid = document.getElementById('apGrid'); if (!grid) return;
  grid.innerHTML = THEMES.map(function(theme) {
    var tokens = resolveTheme(theme.id).tokens;
    var previewStyle = '--preview-bg:' + tokens['--bg'] + ';--preview-surface:' + tokens['--surface'] + ';--preview-ink:' + tokens['--ink'] + ';--preview-accent:' + tokens['--accent-strong'] + ';--preview-font:var(--display-font)';
    return '<button class="ap-card" data-t="' + theme.id + '" aria-pressed="false" onclick="setTheme(\'' + theme.id + '\')" style="' + previewStyle + '">'
      + '<span class="ap-preview" aria-hidden="true"><span class="ap-preview-title">Casa</span><span class="ap-preview-number">$ 128.500</span><span class="ap-preview-rule"></span></span>'
      + '<span class="ap-name">' + themeEscape(theme.name) + '</span><span class="ap-sub">' + themeEscape(theme.sub) + '</span><span class="ap-check" aria-hidden="true" hidden>✓</span></button>';
  }).join('');
  var backgrounds = document.getElementById('gBgRow');
  if (backgrounds) backgrounds.innerHTML = GRANULAR_BG.map(function(item) { return '<button class="g-bg" data-v="' + item.v + '" aria-label="Fondo ' + item.label + '" aria-pressed="false" title="' + item.label + '" style="--swatch:' + item.c + ';background:' + item.c + '" onclick="setBg(\'' + item.v + '\')"></button>'; }).join('');
  var accents = document.getElementById('gAccentRow');
  if (accents) accents.innerHTML = GRANULAR_ACCENT.map(function(item) { return '<button class="g-accent" data-v="' + item.v + '" aria-label="Acento ' + item.label + '" aria-pressed="false" title="' + item.label + '" style="--swatch:' + item.c + ';background:' + item.c + '" onclick="setAccent(\'' + item.v + '\')"></button>'; }).join('');
  _syncApSelected(themeById(document.documentElement.getAttribute('data-theme')).id); _syncGranularSel();
}
function _syncApSelected(id) {
  var cards = document.querySelectorAll('.ap-card');
  for (var index = 0; index < cards.length; index++) {
    var selected = cards[index].getAttribute('data-t') === id;
    cards[index].classList.toggle('selected', selected); cards[index].setAttribute('aria-pressed', String(selected));
    var check = cards[index].querySelector('.ap-check'); if (check) check.hidden = !selected;
  }
}
function _syncGranularSel() {
  GRANULAR_KEYS.forEach(function(key) {
    var current = document.documentElement.getAttribute('data-' + key) || (key === 'font' ? 'serif' : '');
    var selector = key === 'bg' ? '.g-bg' : key === 'accent' ? '.g-accent' : '.g-font';
    var buttons = document.querySelectorAll(selector);
    for (var index = 0; index < buttons.length; index++) { var selected = buttons[index].getAttribute('data-v') === current; buttons[index].classList.toggle('active', selected); buttons[index].setAttribute('aria-pressed', String(selected)); }
  });
}
function _setGranular(key, value) {
  if (!themeValidGranular(key, value)) return;
  document.documentElement.setAttribute('data-' + key, value); themeWritePreference('caja_' + key, value);
  applyThemePreferences();
}
function setBg(value) { _setGranular('bg', value); }
function setAccent(value) { _setGranular('accent', value); }
function setFont(value) { _setGranular('font', value); }
function resetCustom() {
  GRANULAR_KEYS.forEach(function(key) { document.documentElement.removeAttribute('data-' + key); themeWritePreference('caja_' + key, null); });
  applyThemePreferences(); if (typeof toast === 'function') toast('Ambiente restaurado');
}
function openAppariencia() {
  _syncApSelected(themeById(document.documentElement.getAttribute('data-theme')).id); _syncGranularSel();
  open_('apparienciaModal');
}
