
/* ─── Source types (alphabetical) ───────────────────────────────────────── */

const SOURCE_TYPES = [
  { id: 'conference-session',          label: 'Conference session' },
  { id: 'dataset',                     label: 'Dataset' },
  { id: 'dissertation',                label: 'Dissertation' },
  { id: 'documentary',                 label: 'Documentary' },
  { id: 'film',                        label: 'Film' },
  { id: 'forum-post',                  label: 'Forum post' },
  { id: 'generative-ai',               label: 'Generative AI' },
  { id: 'image',                       label: 'Image' },
  { id: 'journal-article',             label: 'Journal article' },
  { id: 'online-dictionary-entry',     label: 'Online dictionary entry' },
  { id: 'online-encyclopedia-entry',   label: 'Online encyclopedia entry' },
  { id: 'online-magazine-article',     label: 'Online magazine article' },
  { id: 'patent',                      label: 'Patent' },
  { id: 'podcast',                     label: 'Podcast' },
  { id: 'podcast-episode',             label: 'Podcast episode' },
  { id: 'presentation-slides',         label: 'Presentation slides' },
  { id: 'press-release',               label: 'Press release' },
  { id: 'print-dictionary-entry',      label: 'Print dictionary entry' },
  { id: 'print-encyclopedia-entry',    label: 'Print encyclopedia entry' },
  { id: 'print-magazine-article',      label: 'Print magazine article' },
  { id: 'print-newspaper-article',     label: 'Print newspaper article' },
  { id: 'report',                      label: 'Report' },
  { id: 'social-media-post',           label: 'Social media post' },
  { id: 'software',                    label: 'Software' },
  { id: 'speech',                      label: 'Speech' },
  { id: 'textbook',                    label: 'Textbook' },
  { id: 'thesis',                      label: 'Thesis' },
  { id: 'tv-show',                     label: 'TV show' },
  { id: 'tv-show-episode',             label: 'TV show episode' },
  { id: 'video',                       label: 'Video' },
  { id: 'webpage',                     label: 'Webpage' },
  { id: 'website',                     label: 'Website' },
  { id: 'wiki-entry',                  label: 'Wiki entry (Wikipedia)' },
];

/* ─── Fields per source type ────────────────────────────────────────────── */

const SOURCE_FIELDS = {
  'conference-session':        ['title','conference','location','pub_year','pub_month','pub_day','pages','url','acc_year','acc_month','acc_day','annotation'],
  'dataset':                   ['title','publisher','pub_year','pub_month','pub_day','doi','url','acc_year','acc_month','acc_day','annotation'],
  'dissertation':              ['title','institution','pub_year','database','doi','url','annotation'],
  'documentary':               ['title','studio','pub_year','url','annotation'],
  'film':                      ['title','studio','pub_year','annotation'],
  'forum-post':                ['content_preview','site_name','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'generative-ai':             ['title','model','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'image':                     ['title','museum','site_name','pub_year','url','acc_year','acc_month','acc_day','annotation'],
  'journal-article':           ['title','journal','pub_year','volume','issue','pages','doi','url','acc_year','acc_month','acc_day','annotation'],
  'online-dictionary-entry':   ['title','dictionary','publisher','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'online-encyclopedia-entry': ['title','encyclopedia','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'online-magazine-article':   ['title','magazine','site_name','pub_year','pub_month','pub_day','pages','url','acc_year','acc_month','acc_day','annotation'],
  'patent':                    ['title','patent_number','publisher','pub_year','pub_month','pub_day','doi','url','annotation'],
  'podcast':                   ['title','network','publisher','pub_year','url','acc_year','acc_month','acc_day','annotation'],
  'podcast-episode':           ['title','podcast','episode','season','network','publisher','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'presentation-slides':       ['title','institution','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'press-release':             ['title','site_name','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'print-dictionary-entry':    ['title','dictionary','publisher','city','pub_year','pages','annotation'],
  'print-encyclopedia-entry':  ['title','encyclopedia','publisher','city','pub_year','volume','pages','edition','annotation'],
  'print-magazine-article':    ['title','magazine','pub_year','pub_month','pub_day','pages','annotation'],
  'print-newspaper-article':   ['title','newspaper','pub_year','pub_month','pub_day','pages','annotation'],
  'report':                    ['title','report_number','institution','publisher','pub_year','doi','url','acc_year','acc_month','acc_day','annotation'],
  'social-media-post':         ['content_preview','platform','handle','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'software':                  ['title','version','publisher','pub_year','url','acc_year','acc_month','acc_day','annotation'],
  'speech':                    ['title','conference','institution','pub_year','pub_month','pub_day','url','annotation'],
  'textbook':                  ['title','publisher','city','pub_year','edition','isbn','doi','url','annotation'],
  'thesis':                    ['title','institution','pub_year','database','doi','url','annotation'],
  'tv-show':                   ['title','show_title','network','pub_year','url','annotation'],
  'tv-show-episode':           ['title','show_title','season','episode','network','pub_year','pub_month','pub_day','url','annotation'],
  'video':                     ['title','channel','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'webpage':                   ['title','site_name','publisher','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'website':                   ['title','site_name','publisher','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
  'wiki-entry':                ['title','encyclopedia','pub_year','pub_month','pub_day','url','acc_year','acc_month','acc_day','annotation'],
};

const FIELD_META = {
  title:            { label: 'Title', full: true },
  journal:          { label: 'Journal name', full: true },
  magazine:         { label: 'Magazine name', full: true },
  newspaper:        { label: 'Newspaper name', full: true },
  conference:       { label: 'Conference name', full: true },
  podcast:          { label: 'Podcast series title', full: true },
  show_title:       { label: 'Show title', full: true },
  dictionary:       { label: 'Dictionary name', full: false },
  encyclopedia:     { label: 'Encyclopedia name', full: false },
  site_name:        { label: 'Website / site name', full: false },
  museum:           { label: 'Museum / collection', full: false },
  model:            { label: 'AI model (e.g. ChatGPT)', full: false },
  platform:         { label: 'Platform (e.g. Twitter/X)', full: false },
  handle:           { label: 'Handle (e.g. @name)', full: false },
  content_preview:  { label: 'Post / content (first 20 words)', full: true, type: 'textarea' },
  pub_year:         { label: 'Publication year', full: false, type: 'text', placeholder: 'YYYY' },
  pub_month:        { label: 'Publication month', full: false, type: 'select', options: ['','01','02','03','04','05','06','07','08','09','10','11','12'], optionLabels: ['Month','January','February','March','April','May','June','July','August','September','October','November','December'] },
  pub_day:          { label: 'Publication day', full: false, type: 'text', placeholder: 'DD' },
  acc_year:         { label: 'Access year', full: false, type: 'text', placeholder: 'YYYY', group: 'access' },
  acc_month:        { label: 'Access month', full: false, type: 'select', options: ['','01','02','03','04','05','06','07','08','09','10','11','12'], optionLabels: ['Month','January','February','March','April','May','June','July','August','September','October','November','December'], group: 'access' },
  acc_day:          { label: 'Access day', full: false, type: 'text', placeholder: 'DD', group: 'access' },
  volume:           { label: 'Volume', full: false },
  issue:            { label: 'Issue', full: false },
  pages:            { label: 'Pages (e.g. 12–25)', full: false },
  doi:              { label: 'DOI', full: true },
  url:              { label: 'URL', full: true },
  publisher:        { label: 'Publisher', full: false },
  edition:          { label: 'Edition', full: false, placeholder: 'e.g. 3' },
  city:             { label: 'City of publication', full: false },
  isbn:             { label: 'ISBN', full: false },
  report_number:    { label: 'Report number', full: false },
  patent_number:    { label: 'Patent number', full: false },
  institution:      { label: 'Institution / university', full: false },
  database:         { label: 'Database / repository', full: false },
  network:          { label: 'Network / platform', full: false },
  studio:           { label: 'Studio / distributor', full: false },
  channel:          { label: 'Channel / uploader', full: false },
  season:           { label: 'Season number', full: false },
  episode:          { label: 'Episode number', full: false },
  version:          { label: 'Version number', full: false },
  location:         { label: 'Location / city', full: false },
  annotation:       { label: 'Annotation (optional note about this source)', full: true, type: 'textarea' },
};

const CONTRIBUTOR_ROLES = ['Author','Director','Editor','Illustrator','Interviewer','Translator','Uploader'];

const STYLE_ORDER = ['apa', 'mla', 'chicago', 'ieee', 'acs', 'ama'];
const STYLE_META = {
  apa: { preview: 'APA 7th — References', heading: 'APA', title: 'References', sub: 'APA 7th edition — sorted alphabetically' },
  mla: { preview: 'MLA 9th — Works Cited', heading: 'MLA', title: 'Works Cited', sub: 'MLA 9th edition — sorted alphabetically' },
  chicago: { preview: 'Chicago 17th — Bibliography', heading: 'Chicago', title: 'Bibliography', sub: 'Chicago 17th edition — sorted alphabetically' },
  ieee: { preview: 'IEEE — References', heading: 'IEEE', title: 'References', sub: 'IEEE — numeric order' },
  acs: { preview: 'ACS — References', heading: 'ACS', title: 'References', sub: 'ACS — numeric order' },
  ama: { preview: 'AMA — References', heading: 'AMA', title: 'References', sub: 'AMA — numeric order' },
};

const REQUIRED_FIELDS = {
  'conference-session': ['title', 'conference', 'pub_year'],
  'dataset': ['title'],
  'dissertation': ['title', 'institution', 'pub_year'],
  'documentary': ['title', 'studio', 'pub_year'],
  'film': ['title', 'studio', 'pub_year'],
  'forum-post': ['content_preview', 'url'],
  'generative-ai': ['title', 'model', 'url'],
  'image': ['title', 'url'],
  'journal-article': ['title', 'journal', 'pub_year'],
  'online-dictionary-entry': ['title', 'dictionary', 'url'],
  'online-encyclopedia-entry': ['title', 'encyclopedia', 'url'],
  'online-magazine-article': ['title', 'url'],
  'patent': ['title', 'patent_number', 'pub_year'],
  'podcast': ['title', 'url'],
  'podcast-episode': ['title', 'podcast', 'url'],
  'presentation-slides': ['title', 'url'],
  'press-release': ['title', 'url'],
  'print-dictionary-entry': ['title', 'dictionary', 'publisher', 'pub_year'],
  'print-encyclopedia-entry': ['title', 'encyclopedia', 'publisher', 'pub_year'],
  'print-magazine-article': ['title', 'magazine', 'pub_year'],
  'print-newspaper-article': ['title', 'newspaper', 'pub_year'],
  'report': ['title', 'pub_year'],
  'social-media-post': ['content_preview', 'platform', 'url'],
  'software': ['title', 'url'],
  'speech': ['title', 'conference', 'pub_year'],
  'textbook': ['title', 'publisher', 'pub_year'],
  'thesis': ['title', 'institution', 'pub_year'],
  'tv-show': ['title', 'show_title', 'pub_year'],
  'tv-show-episode': ['title', 'show_title', 'pub_year'],
  'video': ['title', 'url'],
  'webpage': ['title', 'url'],
  'website': ['title', 'url'],
  'wiki-entry': ['title', 'url'],
};

/* ─── State ─────────────────────────────────────────────────────────────── */

const state = {
  style: 'apa',
  sourceType: 'journal-article',
  contributors: [{ given: '', middle: '', family: '', role: 'Author' }],
  fields: {},
  bibliography: [],
  debounceTimer: null,
  previewIntextVariants: null,
  previewCitationHtml: '',
  previewCitationPlain: '',
  validationErrors: {},
  activePanel: 'generate',
  editingEntryId: null,
  confirmAction: null,
};

/* ─── Init ──────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  buildSourceTypeDropdown();
  renderContributors();
  renderFields();
  ensureValidationSummary();
  attachStaticEvents();
  updateBibHeader();
  updateActionButtonText();
  renderIntextPreview(null);
  refreshPreview();
});

function attachStaticEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  document.querySelectorAll('.style-item').forEach(btn => {
    btn.addEventListener('click', () => setStyle(btn.dataset.style));
  });

  document.getElementById('source-type-select').addEventListener('change', e => {
    setSourceType(e.target.value);
  });

  document.getElementById('autocite-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doAutocite();
  });

  document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-delete-btn')?.addEventListener('click', confirmModalAction);
  document.getElementById('confirm-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'confirm-overlay') closeConfirmModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('confirm-overlay')?.classList.contains('show')) {
      closeConfirmModal();
    }
  });
}

function ensureValidationSummary() {
  if (document.getElementById('validation-summary')) return;
  const row = document.querySelector('.action-row');
  const div = document.createElement('div');
  div.id = 'validation-summary';
  div.className = 'validation-summary';
  div.style.display = 'none';
  row?.before(div);
}

/* ─── Rendering ─────────────────────────────────────────────────────────── */

function buildSourceTypeDropdown() {
  const sel = document.getElementById('source-type-select');
  sel.innerHTML = '';
  SOURCE_TYPES.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id;
    opt.textContent = st.label;
    if (st.id === state.sourceType) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderContributors() {
  const el = document.getElementById('contributors-list');
  el.innerHTML = '';

  state.contributors.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'contributor-row';
    row.id = `contributor-row-${i}`;
    row.innerHTML = `
      <div class="contributor-inputs">
        <input class="inp-given" placeholder="First / given" value="${esc(c.given)}" data-index="${i}" data-key="given">
        <input class="inp-middle" placeholder="Middle" value="${esc(c.middle)}" data-index="${i}" data-key="middle">
        <input class="inp-family" placeholder="Last / family" value="${esc(c.family)}" data-index="${i}" data-key="family">
        <select class="inp-role" data-index="${i}" data-key="role">
          ${CONTRIBUTOR_ROLES.map(r => `<option value="${r}"${c.role === r ? ' selected' : ''}>${r}</option>`).join('')}
        </select>
        ${state.contributors.length > 1 ? `<button class="rm-btn" type="button" data-remove-index="${i}" title="Remove">×</button>` : '<div class="rm-placeholder"></div>'}
      </div>
      <div class="field-error contributor-error" id="contributor-error-${i}" style="display:none"></div>
    `;
    el.appendChild(row);
  });

  el.querySelectorAll('input[data-index], select[data-index]').forEach(input => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, e => {
      const idx = Number(e.target.dataset.index);
      const key = e.target.dataset.key;
      state.contributors[idx][key] = e.target.value;
      debouncedPreview();
    });
  });

  el.querySelectorAll('[data-remove-index]').forEach(btn => {
    btn.addEventListener('click', () => removeContributor(Number(btn.dataset.removeIndex)));
  });
}

function renderFields() {
  const grid = document.getElementById('fields-grid');
  grid.innerHTML = '';
  const fields = SOURCE_FIELDS[state.sourceType] || [];
  let accessHeaderAdded = false;

  fields.forEach(fieldId => {
    const meta = FIELD_META[fieldId];
    if (!meta) return;

    if (fieldId === 'pub_year') {
      grid.appendChild(makeGroupHeader('Publication date'));
    }
    if (meta.group === 'access' && !accessHeaderAdded) {
      grid.appendChild(makeGroupHeader('Date accessed'));
      accessHeaderAdded = true;
    }

    const wrap = document.createElement('div');
    wrap.className = 'field' + (meta.full ? ' full' : '');
    wrap.id = `field-wrap-${fieldId}`;

    const label = `<label for="field-${fieldId}">${meta.label}</label>`;
    let control = '';
    const value = state.fields[fieldId] || '';

    if (meta.type === 'select') {
      control = `
        <select id="field-${fieldId}" data-field-id="${fieldId}">
          ${meta.options.map((opt, index) => `<option value="${opt}"${opt === value ? ' selected' : ''}>${meta.optionLabels[index]}</option>`).join('')}
        </select>`;
    } else if (meta.type === 'textarea') {
      control = `<textarea id="field-${fieldId}" data-field-id="${fieldId}" rows="3" placeholder="${esc(meta.placeholder || meta.label)}">${esc(value)}</textarea>`;
    } else {
      control = `<input id="field-${fieldId}" data-field-id="${fieldId}" type="text" placeholder="${esc(meta.placeholder || meta.label)}" value="${esc(value)}">`;
    }

    wrap.innerHTML = `${label}${control}<div class="field-error" id="field-error-${fieldId}" style="display:none"></div>`;
    grid.appendChild(wrap);
  });

  grid.querySelectorAll('[data-field-id]').forEach(input => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, e => {
      state.fields[e.target.dataset.fieldId] = e.target.value;
      debouncedPreview();
    });
  });
}

function makeGroupHeader(text) {
  const hdr = document.createElement('div');
  hdr.className = 'field-group-header';
  hdr.textContent = text;
  return hdr;
}

/* ─── Navigation & style ────────────────────────────────────────────────── */

function switchPanel(name) {
  state.activePanel = name;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  if (name === 'bibliography') {
    updateBibHeader();
    renderBib();
  }
}

function setStyle(style) {
  state.style = style;
  document.querySelectorAll('.style-item').forEach(btn => btn.classList.toggle('active', btn.dataset.style === style));
  document.getElementById('preview-label').textContent = STYLE_META[style]?.preview || STYLE_META.apa.preview;
  updateBibHeader();
  debouncedPreview();
}

function setSourceType(type) {
  state.sourceType = type;
  state.fields = {};
  renderFields();
  debouncedPreview();
}

function updateBibHeader() {
  const meta = STYLE_META[state.style] || STYLE_META.apa;
  const titleEl = document.getElementById('bib-title');
  const subtitleEl = document.getElementById('bib-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subtitleEl) subtitleEl.textContent = meta.sub;
}

function updateActionButtonText() {
  const btn = document.getElementById('add-bib-btn');
  if (!btn) return;
  btn.textContent = state.editingEntryId ? 'Update bibliography entry' : 'Add to bibliography';
}

/* ─── Contributor actions ───────────────────────────────────────────────── */

window.addContributor = function addContributor() {
  state.contributors.push({ given: '', middle: '', family: '', role: 'Author' });
  renderContributors();
  refreshValidationUI(state.validationErrors || {});
};

function removeContributor(index) {
  state.contributors.splice(index, 1);
  if (!state.contributors.length) {
    state.contributors = [{ given: '', middle: '', family: '', role: 'Author' }];
  }
  renderContributors();
  debouncedPreview();
}

/* ─── API helpers ───────────────────────────────────────────────────────── */

async function apiJson(url, options = {}) {
  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...options,
  });

  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    let message = 'Request failed';
    try {
      if (contentType.includes('application/json')) {
        const body = await resp.json();
        message = body.detail ? `${body.error || message}: ${body.detail}` : (body.error || message);
      } else {
        const text = await resp.text();
        if (/Initializing Failed/i.test(text)) message = 'Netlify function failed to initialize.';
        else if (/<!doctype html|<html/i.test(text)) message = 'API route returned HTML instead of JSON.';
      }
    } catch (_) {}
    throw new Error(message);
  }

  if (!contentType.includes('application/json')) {
    const text = await resp.text();
    if (/Initializing Failed/i.test(text)) throw new Error('Netlify function failed to initialize.');
    throw new Error('API route returned HTML instead of JSON.');
  }

  return resp.json();
}

function extractDoiCandidate(input = '') {
  let raw = '';
  try {
    raw = decodeURIComponent(String(input || ''));
  } catch {
    raw = String(input || '');
  }
  raw = raw.trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim();
  const match = raw.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match ? match[0].replace(/[)\].,;:]+$/, '') : '';
}


function cleanIsbnCandidate(input = '') {
  return String(input || '')
    .replace(/\bISBN(?:-1[03])?:?\s*/ig, '')
    .replace(/[^0-9Xx]/g, '')
    .toUpperCase();
}

function isValidIsbn10(isbn = '') {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = isbn.split('').reduce((acc, ch, idx) => acc + (ch === 'X' ? 10 : parseInt(ch, 10)) * (10 - idx), 0);
  return sum % 11 === 0;
}

function isValidIsbn13(isbn = '') {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = isbn.slice(0, 12).split('').reduce((acc, ch, idx) => acc + parseInt(ch, 10) * (idx % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(isbn[12], 10);
}

function extractIsbnCandidate(input = '') {
  const clean = cleanIsbnCandidate(input);
  if (clean.length === 10 && isValidIsbn10(clean)) return clean;
  if (clean.length === 13 && isValidIsbn13(clean)) return clean;
  return '';
}

/* ─── Autocite ──────────────────────────────────────────────────────────── */

window.doAutocite = async function doAutocite() {
  const q = document.getElementById('autocite-input').value.trim();
  const errEl = document.getElementById('autocite-error');
  const resultsEl = document.getElementById('search-results');
  errEl.style.display = 'none';
  resultsEl.style.display = 'none';
  resultsEl.innerHTML = '';

  if (!q) {
    errEl.textContent = 'Please enter a DOI, ISBN, URL, or title.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('autocite-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    let data = null;

    const doiCandidate = extractDoiCandidate(q);
    const isbnCandidate = extractIsbnCandidate(q);

    if (doiCandidate) {
      data = await apiJson(`${window.API_BASE}/api/lookup/doi?doi=${encodeURIComponent(doiCandidate)}`);
    } else if (isbnCandidate) {
      data = await apiJson(`${window.API_BASE}/api/lookup/isbn?isbn=${encodeURIComponent(isbnCandidate)}`);
    } else if (/^https?:\/\//i.test(q)) {
      data = await apiJson(`${window.API_BASE}/api/lookup/url?url=${encodeURIComponent(q)}`);
    } else {
      const results = await apiJson(`${window.API_BASE}/api/lookup/search?q=${encodeURIComponent(q)}`);
      if (results.length) {
        showSearchResults(results);
      } else {
        errEl.textContent = 'No results found. Try a DOI or fill in manually.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (data) {
      applyMetadata(data);
      showToast('Citation data loaded');
    } else {
      errEl.textContent = 'Could not retrieve metadata. Please fill in manually.';
      errEl.style.display = 'block';
    }
  } catch (error) {
    errEl.textContent = error?.message || 'Search failed. Check your connection and try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Search';
  }
};

function showSearchResults(results) {
  const el = document.getElementById('search-results');
  el.style.display = 'block';
  el.innerHTML = results.map((item, index) => {
    const title = escapeHtml(item?.fields?.title || `Result ${index + 1}`);
    const year = escapeHtml(item?.fields?.pub_year || 'n.d.');
    const sourceType = escapeHtml(item?.sourceType || 'source');
    return `
      <div class="result-item" data-result-index="${index}">
        <div class="result-title">${title}</div>
        <div class="result-meta">${sourceType} · ${year}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('[data-result-index]').forEach(node => {
    node.addEventListener('click', () => {
      applyMetadata(results[Number(node.dataset.resultIndex)]);
      el.style.display = 'none';
      showToast('Citation data loaded');
    });
  });
}

function applyMetadata(data) {
  if (!data || typeof data !== 'object') return;
  if (data.sourceType && SOURCE_FIELDS[data.sourceType]) {
    state.sourceType = data.sourceType;
    const sel = document.getElementById('source-type-select');
    if (sel) sel.value = data.sourceType;
  }

  state.contributors = deepClone(data.contributors && data.contributors.length ? data.contributors : [{ given: '', middle: '', family: '', role: 'Author' }]);
  state.fields = deepClone(data.fields || {});
  state.editingEntryId = null;

  renderContributors();
  renderFields();
  updateActionButtonText();
  refreshPreview();
}

/* ─── Validation ────────────────────────────────────────────────────────── */

function validateState() {
  const errors = {};
  const required = REQUIRED_FIELDS[state.sourceType] || ['title'];

  required.forEach(fieldId => {
    const value = (state.fields[fieldId] || '').trim();
    if (!value) {
      errors[fieldId] = `${FIELD_META[fieldId]?.label || fieldId} is required.`;
    }
  });

  Object.entries(state.fields).forEach(([key, value]) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;

    if ((key === 'pub_year' || key === 'acc_year') && !/^\d{4}$/.test(trimmed)) {
      errors[key] = `${FIELD_META[key]?.label || key} must be a 4-digit year.`;
    }
    if ((key === 'pub_day' || key === 'acc_day') && !/^(0?[1-9]|[12][0-9]|3[01])$/.test(trimmed)) {
      errors[key] = `${FIELD_META[key]?.label || key} must be a valid day.`;
    }
    if (key === 'url' && trimmed && !/^https?:\/\//i.test(trimmed)) {
      errors[key] = 'URL must start with http:// or https://.';
    }
  });

  state.contributors.forEach((c, index) => {
    const given = String(c.given || '').trim();
    const middle = String(c.middle || '').trim();
    const family = String(c.family || '').trim();
    if ((given || middle || family) && !family) {
      errors[`contributor-${index}`] = 'Contributor last / family name is required when a contributor is added.';
    }
  });

  return errors;
}

function refreshValidationUI(errors) {
  state.validationErrors = errors;

  document.querySelectorAll('.field').forEach(field => field.classList.remove('has-error'));
  document.querySelectorAll('.field-error').forEach(node => {
    node.style.display = 'none';
    node.textContent = '';
  });
  document.querySelectorAll('.contributor-row').forEach(row => row.classList.remove('has-error'));

  const summary = document.getElementById('validation-summary');
  const messages = [];

  Object.entries(errors).forEach(([key, message]) => {
    messages.push(message);
    if (key.startsWith('contributor-')) {
      const index = key.split('-')[1];
      document.getElementById(`contributor-row-${index}`)?.classList.add('has-error');
      const err = document.getElementById(`contributor-error-${index}`);
      if (err) {
        err.textContent = message;
        err.style.display = 'block';
      }
      return;
    }

    document.getElementById(`field-wrap-${key}`)?.classList.add('has-error');
    const err = document.getElementById(`field-error-${key}`);
    if (err) {
      err.textContent = message;
      err.style.display = 'block';
    }
  });

  if (summary) {
    if (messages.length) {
      summary.innerHTML = `<strong>Required before adding:</strong><ul>${messages.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}</ul>`;
      summary.style.display = 'block';
    } else {
      summary.innerHTML = '';
      summary.style.display = 'none';
    }
  }

  const addBtn = document.getElementById('add-bib-btn');
  if (addBtn) addBtn.disabled = messages.length > 0 || !state.previewCitationPlain || /Fill in the form/i.test(state.previewCitationPlain);
}

/* ─── Preview ───────────────────────────────────────────────────────────── */

function debouncedPreview() {
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(refreshPreview, 220);
}

async function refreshPreview() {
  const clientErrors = validateState();
  try {
    const data = await apiJson(`${window.API_BASE}/api/format`, {
      method: 'POST',
      body: JSON.stringify({
        style: state.style,
        sourceType: state.sourceType,
        contributors: state.contributors,
        fields: state.fields,
        citationNumber: nextCitationNumberForStyle(state.style)
      })
    });

    state.previewCitationHtml = data.citation || '';
    state.previewCitationPlain = stripHtml((data.citation || '').replace(/&amp;/g, '&')).trim();
    state.previewIntextVariants = data.intextVariants || null;
    document.getElementById('preview-cite').innerHTML = data.citation || 'Fill in the form to preview your citation';
    renderIntextPreview(state.previewIntextVariants);

    const serverErrors = data.validation?.errors || {};
    refreshValidationUI({ ...clientErrors, ...serverErrors });
  } catch (error) {
    state.previewCitationHtml = '';
    state.previewCitationPlain = '';
    state.previewIntextVariants = null;
    document.getElementById('preview-cite').textContent = 'Preview unavailable right now.';
    renderIntextPreview(null);
    refreshValidationUI(clientErrors);
  }
}

function renderIntextPreview(variants) {
  const container = document.getElementById('preview-intext-variants');
  if (!variants || (!variants.primary?.value && !variants.secondary?.value)) {
    container.innerHTML = '<div class="intext-empty">Fill in the form to preview your in-text citation.</div>';
    return;
  }

  const entries = [variants.primary, variants.secondary].filter(item => item?.value);
  container.innerHTML = entries.map((variant, index) => {
    const which = index === 0 ? 'primary' : 'secondary';
    return `
      <div class="intext-variant">
        <div class="intext-variant-head">
          <span class="intext-variant-label">${escapeHtml(variant.label || `Variant ${index + 1}`)}</span>
          <button class="btn-copy-small" type="button" data-copy-preview-intext="${which}">Copy</button>
        </div>
        <div class="intext-variant-value">${escapeHtml(variant.value)}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-copy-preview-intext]').forEach(btn => {
    btn.addEventListener('click', () => copyPreviewIntext(btn.dataset.copyPreviewIntext));
  });
}

window.copyPreview = function copyPreview() {
  if (!state.previewCitationPlain) {
    showToast('Nothing to copy yet');
    return;
  }
  navigator.clipboard.writeText(state.previewCitationPlain).then(() => showToast('Copied!')).catch(() => {});
};

function copyPreviewIntext(which) {
  const value = state.previewIntextVariants?.[which]?.value;
  if (!value) {
    showToast('Nothing to copy yet');
    return;
  }
  navigator.clipboard.writeText(value).then(() => showToast('Copied!')).catch(() => {});
}
window.copyPreviewIntext = copyPreviewIntext;

/* ─── Bibliography ──────────────────────────────────────────────────────── */

window.addToBib = function addToBib() {
  const errors = validateState();
  refreshValidationUI(errors);
  if (Object.keys(errors).length) {
    showToast('Please fill in the required fields first');
    return;
  }
  if (!state.previewCitationPlain || /Fill in the form|Preview unavailable/i.test(state.previewCitationPlain)) {
    showToast('Preview is not ready yet');
    return;
  }

  const entry = {
    id: state.editingEntryId || Date.now(),
    style: state.style,
    sourceType: state.sourceType,
    contributors: deepClone(state.contributors),
    fields: deepClone(state.fields),
    citation: state.previewCitationHtml,
    citationPlain: state.previewCitationPlain,
    intextVariants: deepClone(state.previewIntextVariants || {}),
    createdAt: new Date().toISOString(),
  };

  const existingIndex = state.bibliography.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) {
    state.bibliography.splice(existingIndex, 1, entry);
  } else {
    state.bibliography.push(entry);
  }

  state.editingEntryId = null;
  updateActionButtonText();
  updateBibBadge();
  if (state.activePanel === 'bibliography') renderBib();
  showToast(existingIndex >= 0 ? 'Bibliography entry updated' : 'Added to bibliography');
}

function renderBib() {
  const el = document.getElementById('bib-list');
  if (!state.bibliography.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No citations yet</p><p class="empty-sub">Generate citations and add them here</p></div>`;
    return;
  }

  el.innerHTML = STYLE_ORDER.map(style => {
    const entries = getEntriesForStyle(style);
    if (!entries.length) return '';

    const cards = entries.map((entry, index) => {
      const variants = getEntryDisplayVariants(entry, index);
      const refBadge = isNumericStyle(style) ? `[${index + 1}]` : `${index + 1}.`;
      const intextButtons = [variants.primary, variants.secondary]
        .map((variant, idx) => variant?.value ? `<button class="btn-copy-small" type="button" data-copy-entry-intext="${entry.id}:${idx === 0 ? 'primary' : 'secondary'}">Copy ${escapeHtml(variant.label)}</button>` : '')
        .join('');
      const chips = [variants.primary, variants.secondary].filter(v => v?.value)
        .map(v => `<span class="bib-chip"><strong>${escapeHtml(v.label)}:</strong> ${escapeHtml(v.value)}</span>`)
        .join('');

      return `
        <div class="bib-entry-card">
          <div class="bib-entry-top">
            <span class="bib-num">${refBadge}</span>
            <div class="bib-content">
              <div class="bib-text">${entry.citation}</div>
              ${chips ? `<div class="bib-intext-preview">${chips}</div>` : ''}
              <div class="bib-actions">
                <button class="btn-copy-small" type="button" data-copy-entry-ref="${entry.id}">Copy reference</button>
                ${intextButtons}
                <button class="btn-ghost" type="button" data-edit-entry="${entry.id}" style="padding:4px 8px;font-size:12px;">Edit</button>
                <button class="btn-ghost danger" type="button" data-remove-entry="${entry.id}" style="padding:4px 8px;font-size:12px;">✕</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <section class="bib-group">
        <div class="bib-group-header">
          <h3>${STYLE_META[style].heading}</h3>
          <p>${escapeHtml(STYLE_META[style].sub)}</p>
        </div>
        ${cards}
      </section>`;
  }).filter(Boolean).join('');

  el.querySelectorAll('[data-copy-entry-ref]').forEach(btn => btn.addEventListener('click', () => copyEntryRef(Number(btn.dataset.copyEntryRef))));
  el.querySelectorAll('[data-copy-entry-intext]').forEach(btn => {
    const [id, which] = btn.dataset.copyEntryIntext.split(':');
    btn.addEventListener('click', () => copyEntryIntext(Number(id), which));
  });
  el.querySelectorAll('[data-edit-entry]').forEach(btn => btn.addEventListener('click', () => editEntry(Number(btn.dataset.editEntry))));
  el.querySelectorAll('[data-remove-entry]').forEach(btn => btn.addEventListener('click', () => removeEntry(Number(btn.dataset.removeEntry))));
}

function getEntriesForStyle(style) {
  const entries = state.bibliography.filter(entry => entry.style === style);
  if (isNumericStyle(style)) return entries.slice();
  return entries.slice().sort((a, b) => (a.citationPlain || '').localeCompare(b.citationPlain || ''));
}

function getEntryDisplayVariants(entry, indexWithinStyle) {
  if (!entry) return {};
  if (isNumericStyle(entry.style)) {
    if (entry.style === 'ieee') {
      return {
        primary: { label: 'Bracketed', value: `[${indexWithinStyle + 1}]` },
        secondary: { label: 'Superscript', value: toSuperscript(indexWithinStyle + 1) },
      };
    }
    if (entry.style === 'acs') {
      return {
        primary: { label: 'Superscript', value: toSuperscript(indexWithinStyle + 1) },
        secondary: { label: 'Parenthetical', value: `(${indexWithinStyle + 1})` },
      };
    }
    if (entry.style === 'ama') {
      return {
        primary: { label: 'Superscript', value: toSuperscript(indexWithinStyle + 1) },
        secondary: { label: 'Bracketed', value: `[${indexWithinStyle + 1}]` },
      };
    }
  }
  return entry.intextVariants || {};
}

function updateBibBadge() {
  const badge = document.getElementById('bib-badge');
  badge.textContent = String(state.bibliography.length);
  badge.style.display = state.bibliography.length ? 'inline' : 'none';
}

function copyEntryRef(id) {
  const entry = state.bibliography.find(item => item.id === id);
  if (!entry) return;
  navigator.clipboard.writeText(entry.citationPlain || '').then(() => showToast('Copied!')).catch(() => {});
}

function copyEntryIntext(id, which) {
  const entry = state.bibliography.find(item => item.id === id);
  if (!entry) return;
  const entries = getEntriesForStyle(entry.style);
  const index = entries.findIndex(item => item.id === id);
  const variants = getEntryDisplayVariants(entry, index);
  const value = variants?.[which]?.value;
  if (!value) {
    showToast('Nothing to copy');
    return;
  }
  navigator.clipboard.writeText(value).then(() => showToast('Copied!')).catch(() => {});
}

function editEntry(id) {
  const entry = state.bibliography.find(item => item.id === id);
  if (!entry) return;

  state.editingEntryId = id;
  state.style = entry.style;
  state.sourceType = entry.sourceType;
  state.contributors = deepClone(entry.contributors);
  state.fields = deepClone(entry.fields);

  document.querySelectorAll('.style-item').forEach(btn => btn.classList.toggle('active', btn.dataset.style === entry.style));
  document.getElementById('source-type-select').value = entry.sourceType;

  renderContributors();
  renderFields();
  updateActionButtonText();
  updateBibHeader();
  switchPanel('generate');
  refreshPreview();
  showToast('Loaded entry for editing');
}

function removeEntry(id) {
  const entry = state.bibliography.find(item => item.id === id);
  if (!entry) return;
  openConfirmModal({
    title: 'Delete this reference?',
    message: 'This reference and its in-text citations will be removed from the bibliography.',
    confirmLabel: 'Delete',
    onConfirm: () => {
      state.bibliography = state.bibliography.filter(item => item.id !== id);
      updateBibBadge();
      renderBib();
      showToast('Reference deleted');
    }
  });
}

window.copyAllBib = function copyAllBib() {
  if (!state.bibliography.length) {
    showToast('Bibliography is empty');
    return;
  }
  navigator.clipboard.writeText(buildGroupedBibliographyText()).then(() => showToast('Bibliography copied!')).catch(() => {});
};

window.exportBib = function exportBib() {
  if (!state.bibliography.length) {
    showToast('Bibliography is empty');
    return;
  }
  const blob = new Blob([buildGroupedBibliographyText()], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bibliography.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Exported!');
};

window.clearBib = function clearBib() {
  if (!state.bibliography.length) return;
  openConfirmModal({
    title: 'Delete all bibliography entries?',
    message: 'This will remove every saved reference and its in-text citations from the bibliography.',
    confirmLabel: 'Delete',
    onConfirm: () => {
      state.bibliography = [];
      updateBibBadge();
      renderBib();
      showToast('Bibliography cleared');
    }
  });
};

function buildGroupedBibliographyText() {
  return STYLE_ORDER.map(style => {
    const entries = getEntriesForStyle(style);
    if (!entries.length) return '';
    const body = entries.map((entry, index) => {
      const prefix = isNumericStyle(style) ? `[${index + 1}] ` : `${index + 1}. `;
      const variants = getEntryDisplayVariants(entry, index);
      const lines = [`${prefix}${entry.citationPlain}`];
      if (variants?.primary?.value) lines.push(`${variants.primary.label}: ${variants.primary.value}`);
      if (variants?.secondary?.value) lines.push(`${variants.secondary.label}: ${variants.secondary.value}`);
      return lines.join('\n');
    }).join('\n\n');
    return `${STYLE_META[style].heading}\n${body}`;
  }).filter(Boolean).join('\n\n');
}

function openConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm }) {
  const overlay = document.getElementById('confirm-overlay');
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (!overlay || !titleEl || !messageEl || !confirmBtn) {
    if (typeof onConfirm === 'function') onConfirm();
    return;
  }

  titleEl.textContent = title || 'Are you sure?';
  messageEl.textContent = message || '';
  confirmBtn.textContent = confirmLabel;
  state.confirmAction = typeof onConfirm === 'function' ? onConfirm : null;
  overlay.classList.add('show');
  document.body.classList.add('modal-open');
}

function closeConfirmModal() {
  const overlay = document.getElementById('confirm-overlay');
  overlay?.classList.remove('show');
  document.body.classList.remove('modal-open');
  state.confirmAction = null;
}

function confirmModalAction() {
  const action = state.confirmAction;
  closeConfirmModal();
  if (typeof action === 'function') action();
}

window.clearForm = function clearForm() {
  state.editingEntryId = null;
  state.contributors = [{ given: '', middle: '', family: '', role: 'Author' }];
  state.fields = {};
  state.previewIntextVariants = null;
  state.previewCitationHtml = '';
  state.previewCitationPlain = '';
  document.getElementById('autocite-input').value = '';
  document.getElementById('autocite-error').style.display = 'none';
  document.getElementById('search-results').style.display = 'none';
  renderContributors();
  renderFields();
  updateActionButtonText();
  refreshPreview();
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function nextCitationNumberForStyle(style) {
  const entries = state.bibliography.filter(entry => entry.style === style);
  if (state.editingEntryId) {
    const existing = entries.findIndex(entry => entry.id === state.editingEntryId);
    if (existing >= 0) return existing + 1;
  }
  return entries.length + 1;
}

function isNumericStyle(style) {
  return ['ieee', 'acs', 'ama'].includes(style);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtml(value) {
  return esc(value);
}

function stripHtml(value) {
  const div = document.createElement('div');
  div.innerHTML = value || '';
  return div.textContent || div.innerText || '';
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function toSuperscript(number) {
  const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(number).split('').map(ch => map[ch] || ch).join('');
}
