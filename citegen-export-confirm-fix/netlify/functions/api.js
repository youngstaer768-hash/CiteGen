const SUPERSCRIPTS = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, {});

    const reqUrl = buildUrl(event);
    let pathname = reqUrl.pathname
      .replace(/^\/\.netlify\/functions\/api/, '')
      .replace(/^\/api/, '') || '/';

    if (pathname === '/lookup/doi' && event.httpMethod === 'GET') {
      const doi = reqUrl.searchParams.get('doi');
      const clean = extractDoi(doi);
      if (!clean) return json(400, { error: 'DOI required' });
      const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
        headers: { 'User-Agent': 'CiteGen/1.0 (mailto:dev@citegen.app)' }
      });
      return json(200, normalizeCrossref(data.message || {}));
    }

    if (pathname === '/lookup/isbn' && event.httpMethod === 'GET') {
      const isbn = reqUrl.searchParams.get('isbn');
      const normalized = normalizeIsbnInput(isbn || '');
      if (!normalized.valid) return json(400, { error: 'Enter a valid ISBN-10 or ISBN-13' });
      const book = await lookupBookByIsbn(normalized);
      if (!book) return json(404, { error: 'ISBN not found' });
      return json(200, book);
    }

    if (pathname === '/lookup/search' && event.httpMethod === 'GET') {
      const q = reqUrl.searchParams.get('q');
      if (!q) return json(400, { error: 'Query required' });
      const searchUrl = new URL('https://api.crossref.org/works');
      searchUrl.searchParams.set('query', q);
      searchUrl.searchParams.set('rows', '5');
      searchUrl.searchParams.set('select', 'title,author,published,published-print,container-title,volume,issue,page,DOI,type,publisher,ISBN');
      const data = await fetchJson(searchUrl.toString(), {
        headers: { 'User-Agent': 'CiteGen/1.0 (mailto:dev@citegen.app)' }
      });
      return json(200, (data.message?.items || []).map(normalizeCrossref));
    }

    if (pathname === '/lookup/url' && event.httpMethod === 'GET') {
      const target = reqUrl.searchParams.get('url');
      if (!target) return json(400, { error: 'URL required' });
      if (!isValidHttpUrl(target)) return json(400, { error: 'Enter a valid http(s) URL' });

      const directDoi = isDoiResolverUrl(target) ? extractDoi(target) : '';
      if (directDoi) {
        const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(directDoi)}`, {
          headers: { 'User-Agent': 'CiteGen/1.0 (mailto:dev@citegen.app)' }
        });
        return json(200, normalizeCrossref(data.message || {}));
      }

      const detected = detectSourceTypeFromUrl(target);
      let oembedMeta = null;
      if (detected === 'video') {
        try { oembedMeta = await lookupOEmbed(target); } catch {}
      }

      try {
        const resp = await fetchText(target, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeoutMs: 15000,
          redirect: 'follow'
        });

        const finalUrl = resp.url || target;
        const contentType = resp.headers.get('content-type') || '';
        if (looksLikePdf(finalUrl, contentType)) {
          return json(200, fallbackPdfMetadata(finalUrl));
        }

        const html = await resp.text();
        let meta = scrapeMetaTags(html, finalUrl);
        if (meta?.fields?.isbn) {
          try {
            const bookMeta = await lookupBookByIsbn(meta.fields.isbn);
            if (bookMeta) {
              bookMeta.fields = {
                ...bookMeta.fields,
                url: finalUrl,
                acc_year: meta.fields.acc_year,
                acc_month: meta.fields.acc_month,
                acc_day: meta.fields.acc_day,
                isbn: bookMeta.fields.isbn || meta.fields.isbn
              };
              return json(200, bookMeta);
            }
          } catch (_) {}
        }
        const finalDetected = detectSourceTypeFromUrl(finalUrl) || detected;
        if (finalDetected === 'video' && oembedMeta) meta = mergeMetadata(meta, oembedMeta);
        if (finalDetected) meta.sourceType = finalDetected;
        return json(200, meta);
      } catch (err) {
        if (oembedMeta) return json(200, oembedMeta);
        // Do not fail hard for URL lookup. Return best-effort metadata from the URL.
        return json(200, fallbackUrlMetadata(target, err));
      }
    }

    if (pathname === '/format' && event.httpMethod === 'POST') {
      const body = parseBody(event.body);
      const style = body.style;
      const sourceType = body.sourceType;
      const contributors = Array.isArray(body.contributors) ? body.contributors : [];
      const fields = body.fields || {};
      const citationNumber = Number(body.citationNumber) || 1;
      if (!style || !sourceType) return json(400, { error: 'style and sourceType required' });
      const citation = formatCitation(style, sourceType, contributors, fields);
      const intextVariants = formatIntextVariants(style, contributors, fields, citationNumber);
      const validation = validateSourceInput(sourceType, contributors, fields);
      return json(200, {
        citation,
        intext: intextVariants?.primary?.value || '',
        intextVariants,
        validation
      });
    }

    if (pathname === '/export' && event.httpMethod === 'POST') {
      const body = parseBody(event.body);
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const style = body.style || 'apa';
      if (!entries.length) return json(400, { error: 'No entries' });
      const titleMap = { apa: 'References', mla: 'Works Cited', chicago: 'Bibliography', ieee: 'References', acs: 'References', ama: 'References' };
      const header = titleMap[style] || 'References';
      const sorted = isNumericStyle(style) ? entries : entries.slice().sort((a, b) => (a.citationPlain || '').localeCompare(b.citationPlain || ''));
      const plain = sorted.map(e => stripHtmlTags(e.citation || e.citationPlain || '')).join('\n\n');
      return text(200, `${header}\n${'─'.repeat(header.length)}\n\n${plain}`, {
        'Content-Disposition': `attachment; filename="${style}-bibliography.txt"`
      });
    }

    if (pathname === '/health' && event.httpMethod === 'GET') {
      return json(200, { status: 'ok', service: 'citegen-api' });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    return json(500, {
      error: 'Function error',
      detail: err?.message || String(err)
    });
  }
};

function buildUrl(event) {
  const host = event.headers?.['x-forwarded-host'] || event.headers?.host || 'example.com';
  const proto = event.headers?.['x-forwarded-proto'] || 'https';
  if (event.rawUrl) return new URL(event.rawUrl);
  const query = event.rawQuery || '';
  return new URL(`${proto}://${host}${event.path || '/'}${query ? `?${query}` : ''}`);
}

function parseBody(body) {
  if (!body) return {};
  try { return JSON.parse(body); } catch { return {}; }
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function text(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body
  };
}

async function fetchJson(url, opts = {}) {
  const res = await fetchText(url, { ...opts, timeoutMs: opts.timeoutMs || 12000 });
  if (!res.ok) throw new Error(`Upstream request failed with ${res.status}`);
  return res.json();
}

async function fetchText(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), opts.timeoutMs || 12000);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body,
      redirect: opts.redirect || 'follow',
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

function isValidHttpUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDoi(input = '') {
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
  const sum = isbn.split('').reduce((acc, ch, idx) => {
    const value = ch === 'X' ? 10 : parseInt(ch, 10);
    return acc + value * (10 - idx);
  }, 0);
  return sum % 11 === 0;
}

function isValidIsbn13(isbn = '') {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = isbn.slice(0, 12).split('').reduce((acc, ch, idx) => {
    return acc + parseInt(ch, 10) * (idx % 2 === 0 ? 1 : 3);
  }, 0);
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(isbn[12], 10);
}

function convertIsbn10To13(isbn10 = '') {
  if (!isValidIsbn10(isbn10)) return '';
  const base = '978' + isbn10.slice(0, 9);
  const sum = base.split('').reduce((acc, ch, idx) => acc + parseInt(ch, 10) * (idx % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return base + String(check);
}

function convertIsbn13To10(isbn13 = '') {
  if (!isValidIsbn13(isbn13) || !isbn13.startsWith('978')) return '';
  const base = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < base.length; i += 1) sum += parseInt(base[i], 10) * (10 - i);
  const checkValue = (11 - (sum % 11)) % 11;
  const check = checkValue === 10 ? 'X' : String(checkValue);
  const isbn10 = base + check;
  return isValidIsbn10(isbn10) ? isbn10 : '';
}

function normalizeIsbnInput(raw = '') {
  const clean = cleanIsbnCandidate(raw);
  if (!clean) return { valid: false, clean: '', isbn10: '', isbn13: '' };
  if (clean.length === 10 && isValidIsbn10(clean)) {
    return { valid: true, clean, isbn10: clean, isbn13: convertIsbn10To13(clean) };
  }
  if (clean.length === 13 && isValidIsbn13(clean)) {
    return { valid: true, clean, isbn10: convertIsbn13To10(clean), isbn13: clean };
  }
  return { valid: false, clean, isbn10: '', isbn13: '' };
}

function extractIsbnCandidatesFromText(text = '') {
  const raw = decodeHtml(String(text || ''));
  if (!raw) return [];
  const candidates = new Set();
  const patterns = [
    /\bISBN(?:-1[03])?:?\s*([0-9Xx][0-9Xx\-\s]{8,20})\b/g,
    /\b97[89][0-9\-\s]{10,20}\b/g,
    /\b[0-9]{9}[0-9Xx]\b/g
  ];
  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      const value = cleanIsbnCandidate(match[1] || match[0] || '');
      const normalized = normalizeIsbnInput(value);
      if (normalized.valid) candidates.add(normalized.isbn13 || normalized.isbn10);
    }
  }
  return [...candidates];
}

function collectIsbnCandidatesFromObject(node, acc = new Set()) {
  if (!node) return [...acc];
  if (Array.isArray(node)) {
    node.forEach(item => collectIsbnCandidatesFromObject(item, acc));
    return [...acc];
  }
  if (typeof node !== 'object') {
    extractIsbnCandidatesFromText(String(node || '')).forEach(v => acc.add(v));
    return [...acc];
  }
  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['isbn', 'isbn10', 'isbn13', 'productid', 'identifier', 'ean', 'gtin13'].includes(normalizedKey)) {
      extractIsbnCandidatesFromText(typeof value === 'string' ? value : JSON.stringify(value)).forEach(v => acc.add(v));
    }
    collectIsbnCandidatesFromObject(value, acc);
  }
  return [...acc];
}

function isDoiResolverUrl(input = '') {
  try {
    const u = new URL(input);
    return /^(?:dx\.)?doi\.org$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function detectSourceTypeFromUrl(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|loom\.com|twitch\.tv/.test(u)) return 'video';
  if (/netflix\.com|hulu\.com|disneyplus\.com/.test(u)) return 'tv-show-episode';
  if (/spotify\.com\/episode|podcasts\.apple\.com|podcasts\.google\.com/.test(u)) return 'podcast-episode';
  if (/twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|reddit\.com/.test(u)) return 'forum-post';
  if (/wikipedia\.org/.test(u)) return 'wiki-entry';
  if (/merriam-webster\.com|dictionary\.com|oxfordlearnersdictionaries\.com|lexico\.com/.test(u)) return 'online-dictionary-entry';
  if (/britannica\.com|encyclopedia\.com/.test(u)) return 'online-encyclopedia-entry';
  if (/github\.com/.test(u)) return 'software';
  if (/patents\.google\.com|patentscope\.wipo\.int|espacenet\.com/.test(u)) return 'patent';
  if (/slideshare\.net|slides\.google\.com/.test(u)) return 'presentation-slides';
  if (/nation\.africa|bbc\.com\/news|theguardian\.com|nytimes\.com|washingtonpost\.com/.test(u)) return 'online-magazine-article';
  return null;
}

function detectVideoProvider(url = '') {
  const u = String(url).toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/vimeo\.com/.test(u)) return 'vimeo';
  if (/dailymotion\.com|dai\.ly/.test(u)) return 'dailymotion';
  if (/loom\.com/.test(u)) return 'loom';
  return '';
}

async function lookupOEmbed(url) {
  const provider = detectVideoProvider(url);
  if (!provider) return null;
  const endpointMap = {
    youtube: 'https://www.youtube.com/oembed',
    vimeo: 'https://vimeo.com/api/oembed.json',
    dailymotion: 'https://www.dailymotion.com/services/oembed',
    loom: 'https://www.loom.com/v1/oembed'
  };
  const endpoint = endpointMap[provider];
  if (!endpoint) return null;
  const oembed = new URL(endpoint);
  oembed.searchParams.set('url', url);
  oembed.searchParams.set('format', 'json');
  const data = await fetchJson(oembed.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CiteGen/1.0; +https://example.com)',
      'Accept': 'application/json,text/json;q=0.9,*/*;q=0.8'
    },
    timeoutMs: 12000
  });
  const authorName = decodeHtml(data.author_name || '');
  const contributors = buildContributorsFromNames(splitAuthorNames(authorName));
  const now = new Date();
  return {
    sourceType: 'video',
    contributors,
    fields: {
      title: decodeHtml(data.title || ''),
      channel: authorName,
      site_name: decodeHtml(data.provider_name || ''),
      url,
      acc_year: String(now.getFullYear()),
      acc_month: String(now.getMonth() + 1).padStart(2, '0'),
      acc_day: String(now.getDate()).padStart(2, '0')
    }
  };
}

function mergeMetadata(base = {}, extra = {}) {
  const merged = {
    sourceType: extra.sourceType || base.sourceType || 'webpage',
    contributors: Array.isArray(extra.contributors) && extra.contributors.some(c => (c.family || c.given || '').trim())
      ? extra.contributors
      : (Array.isArray(base.contributors) ? base.contributors : []),
    fields: { ...(base.fields || {}), ...(extra.fields || {}) }
  };
  if (!merged.contributors.length) merged.contributors = [{ given: '', middle: '', family: '', role: 'Author' }];
  return merged;
}

function decodeHtml(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function pickMetaContent(html, keys = []) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=['"]${escaped}['"][^>]+content=['"]([^'"]+)['"][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=['"]([^'"]+)['"][^>]+(?:property|name)=['"]${escaped}['"][^>]*>`, 'i')
    ];
    for (const pat of patterns) {
      const match = html.match(pat);
      if (match?.[1]) return decodeHtml(match[1]);
    }
  }
  return '';
}

function getScriptContents(html) {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => (match[1] || '').trim())
    .filter(Boolean);
}

function normalizeDateString(value = '') {
  const v = decodeHtml(String(value || '')).trim();
  if (!v) return '';
  if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(v)) {
    const [datePart, timePart] = v.split(/\s+/);
    const [dd, mm, yyyy] = datePart.split('-');
    return `${yyyy}-${mm}-${dd}T${timePart}:00Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00Z`;
  return v;
}


const SURNAME_PARTICLES = new Set([
  'da','de','del','della','der','di','du','la','le','van','von','den','ten','ter','st.','st','bin','al'
]);

function parseHumanName(name = '') {
  const raw = decodeHtml(String(name || '')).replace(/^by\s+/i, '').trim();
  if (!raw) return null;

  if (raw.includes(',')) {
    const [familyPart, givenPart] = raw.split(',').map(part => part.trim()).filter(Boolean);
    const tokens = (givenPart || '').split(/\s+/).filter(Boolean);
    return {
      given: tokens[0] || '',
      middle: tokens.slice(1).join(' '),
      family: familyPart || '',
      role: 'Author'
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) {
    return { given: '', middle: '', family: parts[0], role: 'Author' };
  }

  let familyStart = parts.length - 1;
  while (familyStart > 0 && SURNAME_PARTICLES.has(parts[familyStart - 1].toLowerCase())) {
    familyStart -= 1;
  }

  const givenTokens = parts.slice(0, familyStart);
  const familyTokens = parts.slice(familyStart);
  return {
    given: givenTokens[0] || '',
    middle: givenTokens.slice(1).join(' '),
    family: familyTokens.join(' '),
    role: 'Author'
  };
}

function splitAuthorNames(raw = '') {
  const cleaned = decodeHtml(String(raw || '')).replace(/^by\s+/i, '').trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s*(?:,|\band\b|&|;|\|)\s*/i)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(name => !/^(staff|admin|editorial team)$/i.test(name));
}

function buildContributorsFromNames(names = []) {
  const contributors = names.map(parseHumanName)
    .filter(Boolean)
    .filter(c => c.family || c.given);
  return contributors.length ? contributors : [{ given: '', middle: '', family: '', role: 'Author' }];
}

function scoreDateCandidate(value = '', preferredKeys = []) {
  const normalized = normalizeDateString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  let score = 1;
  const lower = preferredKeys.join(' ').toLowerCase();
  if (/published|publication|issued|pubdate/.test(lower)) score += 3;
  if (/modified|updated|lastmodified/.test(lower)) score += 2;
  return { value: normalized, score };
}

function pickBestCandidate(candidates = []) {
  return candidates.filter(Boolean).sort((a, b) => b.score - a.score)[0]?.value || '';
}

function recursivelyFindKeys(node, keys, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    for (const item of node) recursivelyFindKeys(item, keys, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  for (const [k, v] of Object.entries(node)) {
    const normalized = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keys.some(key => normalized === key || normalized.endsWith(key))) acc.push(v);
    recursivelyFindKeys(v, keys, acc);
  }
  return acc;
}

function extractJsonLikeAssignments(scriptText) {
  const results = [];
  const patterns = [/({[\s\S]{0,5000}?})/g, /(\[[\s\S]{0,5000}?\])/g];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(scriptText)) !== null) {
      const candidate = match[1];
      try { results.push(JSON.parse(candidate)); } catch {}
    }
  }
  return results;
}

function extractAnalyticsObjects(scriptText) {
  const objects = [];
  const wrappers = [
    /gtag\(\s*['\"]event['\"]\s*,\s*['\"][^'\"]+['\"]\s*,\s*(\{[\s\S]*?\})\s*\)/gi,
    /dataLayer\.push\(\s*(\{[\s\S]*?\})\s*\)/gi
  ];
  for (const wrapper of wrappers) {
    let match;
    while ((match = wrapper.exec(scriptText)) !== null) {
      const body = match[1] || '';
      const obj = {};
      const pairRegex = /['\"]([^'\"]+)['\"]\s*:\s*['\"]([\s\S]*?)['\"]/g;
      let pair;
      while ((pair = pairRegex.exec(body)) !== null) obj[pair[1]] = decodeHtml(pair[2]);
      if (Object.keys(obj).length) objects.push(obj);
    }
  }
  return objects;
}

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];
  for (const script of scripts) {
    try {
      const raw = script[1].trim();
      if (!raw) continue;
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : (Array.isArray(data['@graph']) ? data['@graph'] : [data]);
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const authorNode = Array.isArray(node.author) ? node.author[0] : node.author;
        const authorName = typeof authorNode === 'string' ? authorNode : authorNode?.name || '';
        candidates.push({
          title: decodeHtml(node.headline || node.name || ''),
          author: decodeHtml(authorName),
          datePublished: normalizeDateString(node.datePublished || ''),
          dateModified: normalizeDateString(node.dateModified || '')
        });
      }
    } catch {}
  }
  return candidates.sort((a,b) => ((b.title?.length || 0) - (a.title?.length || 0)))[0] || {};
}

function extractMetadataFromScripts(html) {
  const scripts = getScriptContents(html);
  const titleKeys = ['title', 'headline', 'name'];
  const authorKeys = ['author', 'authors', 'byline', 'writer', 'creator'];
  const publishedKeys = ['datepublished', 'pubdate', 'publishedtime', 'publishdate', 'issued', 'datecreated'];
  const modifiedKeys = ['datemodified', 'lastmodified', 'updatedat', 'modifiedtime', 'updatedtime'];
  const titleCandidates = [];
  const authorCandidates = [];
  const publishedCandidates = [];
  const modifiedCandidates = [];

  for (const script of scripts) {
    for (const parsed of extractAnalyticsObjects(script)) {
      const titles = recursivelyFindKeys(parsed, titleKeys).flat().filter(v => typeof v === 'string');
      for (const value of titles) titleCandidates.push({ value: decodeHtml(value), score: 8 });
      const authors = recursivelyFindKeys(parsed, authorKeys).flat().filter(v => typeof v === 'string');
      for (const value of authors) authorCandidates.push({ value: decodeHtml(value), score: 8 });
      const published = recursivelyFindKeys(parsed, publishedKeys).flat().filter(v => typeof v === 'string');
      for (const value of published) {
        const candidate = scoreDateCandidate(value, publishedKeys);
        if (candidate) publishedCandidates.push({ ...candidate, score: candidate.score + 6 });
      }
      const modified = recursivelyFindKeys(parsed, modifiedKeys).flat().filter(v => typeof v === 'string');
      for (const value of modified) {
        const candidate = scoreDateCandidate(value, modifiedKeys);
        if (candidate) modifiedCandidates.push({ ...candidate, score: candidate.score + 6 });
      }
    }

    for (const parsed of extractJsonLikeAssignments(script)) {
      const titles = recursivelyFindKeys(parsed, titleKeys).flat().filter(v => typeof v === 'string');
      for (const value of titles) titleCandidates.push({ value: decodeHtml(value), score: 2 });
      const authors = recursivelyFindKeys(parsed, authorKeys).flat().filter(v => typeof v === 'string');
      for (const value of authors) authorCandidates.push({ value: decodeHtml(value), score: 2 });
      const published = recursivelyFindKeys(parsed, publishedKeys).flat().filter(v => typeof v === 'string');
      for (const value of published) {
        const candidate = scoreDateCandidate(value, publishedKeys);
        if (candidate) publishedCandidates.push(candidate);
      }
      const modified = recursivelyFindKeys(parsed, modifiedKeys).flat().filter(v => typeof v === 'string');
      for (const value of modified) {
        const candidate = scoreDateCandidate(value, modifiedKeys);
        if (candidate) modifiedCandidates.push(candidate);
      }
    }
  }

  return {
    title: titleCandidates.sort((a, b) => (b.score - a.score) || ((b.value?.length || 0) - (a.value?.length || 0)))[0]?.value || '',
    author: authorCandidates.sort((a, b) => (b.score - a.score) || ((b.value?.length || 0) - (a.value?.length || 0)))[0]?.value || '',
    datePublished: pickBestCandidate(publishedCandidates),
    dateModified: pickBestCandidate(modifiedCandidates)
  };
}

function looksLikePdf(url, contentType = '') {
  return /application\/pdf/i.test(contentType) || /\.pdf(?:[?#]|$)/i.test(url);
}


async function lookupBookByIsbn(isbnInfo) {
  const normalized = typeof isbnInfo === 'string' ? normalizeIsbnInput(isbnInfo) : isbnInfo;
  if (!normalized?.valid) return null;
  const variants = [normalized.isbn13, normalized.isbn10].filter(Boolean);

  for (const candidate of variants) {
    try {
      const googleUrl = new URL('https://www.googleapis.com/books/v1/volumes');
      googleUrl.searchParams.set('q', `isbn:${candidate}`);
      googleUrl.searchParams.set('maxResults', '1');
      const data = await fetchJson(googleUrl.toString());
      const item = data?.items?.[0];
      if (item?.volumeInfo) return normalizeGoogleBooks(item, normalized);
    } catch (_) {}
  }

  for (const candidate of variants) {
    try {
      const data = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(candidate)}&format=json&jscmd=data`);
      const book = data?.[`ISBN:${candidate}`];
      if (book) return normalizeOpenLibrary(book, normalized);
    } catch (_) {}
  }

  return null;
}

function fallbackPdfMetadata(finalUrl) {
  const now = new Date();
  return {
    sourceType: detectSourceTypeFromUrl(finalUrl) || 'webpage',
    contributors: [{ given: '', middle: '', family: '', role: 'Author' }],
    fields: {
      title: decodeURIComponent(finalUrl.split('/').pop()?.replace(/\.pdf(?:\?.*)?$/i, '') || 'PDF document').replace(/[-_]+/g, ' '),
      site_name: new URL(finalUrl).hostname.replace('www.', ''),
      acc_year: String(now.getFullYear()),
      acc_month: String(now.getMonth() + 1).padStart(2, '0'),
      acc_day: String(now.getDate()).padStart(2, '0'),
      url: finalUrl
    }
  };
}

function fallbackUrlMetadata(url, err) {
  const now = new Date();
  const u = new URL(url);
  const slug = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ').trim();
  return {
    sourceType: detectSourceTypeFromUrl(url) || 'webpage',
    contributors: [{ given: '', middle: '', family: '', role: 'Author' }],
    fields: {
      title: slug ? titleCase(slug) : u.hostname.replace('www.', ''),
      site_name: u.hostname.replace('www.', ''),
      acc_year: String(now.getFullYear()),
      acc_month: String(now.getMonth() + 1).padStart(2, '0'),
      acc_day: String(now.getDate()).padStart(2, '0'),
      url
    },
    warning: 'Live metadata fetch failed. Basic fields were inferred from the URL.',
    detail: err?.message || String(err)
  };
}

function scrapeMetaTags(html, url) {
  const detectedType = detectSourceTypeFromUrl(url) || 'webpage';
  const titleFromMeta = pickMetaContent(html, ['og:title', 'twitter:title', 'citation_title', 'parsely-title']);
  const titleFromTag = decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).replace(/\s+/g, ' ').trim();
  const site = pickMetaContent(html, ['og:site_name', 'application-name']) || new URL(url).hostname.replace('www.','');
  const author = pickMetaContent(html, ['author', 'article:author', 'citation_author', 'parsely-author', 'dc.creator']);
  const channel = pickMetaContent(html, ['og:video:director', 'video:director', 'twitter:creator', 'twitter:site']);
  const publishedDateStr = pickMetaContent(html, [
    'article:published_time','date','citation_publication_date','citation_online_date','citation_date','dc.date','dc.date.issued','dcterms.issued','parsely-pub-date','uploadDate'
  ]);
  const modifiedDateStr = pickMetaContent(html, [
    'article:modified_time','og:updated_time','last-modified','citation_modified_date','dc.date.modified','dcterms.modified','dateModified'
  ]);
  const jsonLd = extractJsonLd(html);
  const scriptMeta = extractMetadataFromScripts(html);
  const isbnCandidates = [
    ...extractIsbnCandidatesFromText(pickMetaContent(html, ['book:isbn', 'citation_isbn', 'isbn'])),
    ...collectIsbnCandidatesFromObject(jsonLd),
    ...collectIsbnCandidatesFromObject(scriptMeta),
    ...extractIsbnCandidatesFromText(html)
  ];
  const finalIsbn = isbnCandidates.find(Boolean) || '';
  const finalTitle = titleFromMeta || jsonLd.title || scriptMeta.title || titleFromTag;
  const finalAuthor = author || channel || jsonLd.author || scriptMeta.author || '';
  const publicationDate = normalizeDateString(publishedDateStr || jsonLd.datePublished || scriptMeta.datePublished || modifiedDateStr || jsonLd.dateModified || scriptMeta.dateModified || '');
  const modifiedDate = normalizeDateString(modifiedDateStr || jsonLd.dateModified || scriptMeta.dateModified || '');
  const date = publicationDate ? new Date(publicationDate) : null;
  const modified = modifiedDate ? new Date(modifiedDate) : null;
  const contributors = buildContributorsFromNames(splitAuthorNames(finalAuthor));
  const now = new Date();
  const fields = {
    title: finalTitle,
    site_name: site,
    pub_year: date && !isNaN(date) ? String(date.getFullYear()) : '',
    pub_month: date && !isNaN(date) ? String(date.getMonth()+1).padStart(2,'0') : '',
    pub_day: date && !isNaN(date) ? String(date.getDate()).padStart(2,'0') : '',
    mod_year: modified && !isNaN(modified) ? String(modified.getFullYear()) : '',
    mod_month: modified && !isNaN(modified) ? String(modified.getMonth()+1).padStart(2,'0') : '',
    mod_day: modified && !isNaN(modified) ? String(modified.getDate()).padStart(2,'0') : '',
    acc_year: String(now.getFullYear()),
    acc_month: String(now.getMonth()+1).padStart(2,'0'),
    acc_day: String(now.getDate()).padStart(2,'0'),
    url,
    isbn: finalIsbn
  };
  if (detectedType === 'video') fields.channel = finalAuthor || '';
  if (detectedType === 'online-magazine-article') fields.magazine = site;

  return {
    sourceType: detectedType,
    contributors,
    fields
  };
}

function normalizeCrossref(msg) {
  const contributors = (msg.author || []).map(a => {
    const givenParts = String(a.given || '').trim().split(/\s+/).filter(Boolean);
    return {
      given: givenParts[0] || '',
      middle: givenParts.slice(1).join(' '),
      family: a.family || '',
      role: 'Author'
    };
  }).filter(a => a.family);
  const dpRaw = msg.published?.['date-parts'] || msg['published-print']?.['date-parts'];
  const dp = dpRaw?.[0] || [];
  const typeMap = {
    'journal-article': 'journal-article',
    'book': 'textbook',
    'monograph': 'textbook',
    'book-chapter': 'journal-article',
    'proceedings-article': 'conference-session',
    'dataset': 'dataset',
    'report': 'report',
    'dissertation': 'dissertation',
    'thesis': 'thesis'
  };
  return {
    sourceType: typeMap[msg.type] || 'journal-article',
    contributors: contributors.length ? contributors : [{ given: '', middle: '', family: '', role: 'Author' }],
    fields: {
      title: msg.title?.[0] || '',
      journal: msg['container-title']?.[0] || '',
      pub_year: dp[0] ? String(dp[0]) : '',
      pub_month: dp[1] ? String(dp[1]).padStart(2,'0') : '',
      pub_day: dp[2] ? String(dp[2]).padStart(2,'0') : '',
      volume: msg.volume || '',
      issue: msg.issue || '',
      pages: msg.page || '',
      doi: msg.DOI || '',
      publisher: msg.publisher || '',
      isbn: cleanIsbnCandidate(msg.ISBN?.[0] || '')
    }
  };
}

function normalizeGoogleBooks(item, normalized = {}) {
  const info = item?.volumeInfo || {};
  const contributors = (info.authors || []).map(name => parseHumanName(name || '')).filter(a => a?.family || a?.given);
  const identifiers = info.industryIdentifiers || [];
  const isbn13 = identifiers.find(id => id?.type === 'ISBN_13')?.identifier || normalized.isbn13 || '';
  const isbn10 = identifiers.find(id => id?.type === 'ISBN_10')?.identifier || normalized.isbn10 || '';
  const pubMatch = String(info.publishedDate || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  return {
    sourceType: 'textbook',
    contributors: contributors.length ? contributors : [{ given: '', middle: '', family: '', role: 'Author' }],
    fields: {
      title: info.title || '',
      publisher: info.publisher || '',
      pub_year: pubMatch?.[1] || '',
      pub_month: pubMatch?.[2] || '',
      pub_day: pubMatch?.[3] || '',
      city: '',
      edition: info.contentVersion && /\d/.test(info.contentVersion) ? info.contentVersion : '',
      isbn: cleanIsbnCandidate(isbn13 || isbn10),
      url: info.infoLink || item?.selfLink || '',
      annotation: info.description || ''
    }
  };
}

function normalizeOpenLibrary(book, normalized = {}) {
  const contributors = (book.authors || []).map(a => parseHumanName(a.name || '')).filter(a => a?.family || a?.given);
  const foundIsbn = collectIsbnCandidatesFromObject(book)[0] || normalized.isbn13 || normalized.isbn10 || '';
  return {
    sourceType: 'textbook',
    contributors: contributors.length ? contributors : [{ given: '', middle: '', family: '', role: 'Author' }],
    fields: {
      title: book.title || '',
      publisher: (book.publishers||[])[0]?.name || '',
      pub_year: book.publish_date?.match(/\d{4}/)?.[0] || '',
      city: (book.publish_places||[])[0]?.name || '',
      isbn: cleanIsbnCandidate(foundIsbn),
      url: book.url || ''
    }
  };
}

function stripHtmlTags(str = '') { return String(str).replace(/<[^>]+>/g, ''); }
function isNumericStyle(style) { return ['ieee','acs','ama'].includes(style); }
function getContribsByRole(contributors, roles) {
  const matches = contributors.filter(c => roles.includes(c.role));
  return matches.length ? matches : contributors.filter(c => c.family?.trim());
}
function pubDateStr(f) { return f.pub_year || ''; }
function monthName(m) {
  if (!m) return '';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[parseInt(m, 10) - 1] || m;
}
function sentenceCase(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    .replace(/\.\s+([a-z])/g,(m,c)=>m.replace(c,c.toUpperCase()))
    .replace(/:\s+([a-z])/g,(m,c)=>m.replace(c,c.toUpperCase()));
}
function titleCase(s) {
  if (!s) return '';
  const minor = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as']);
  return s.split(' ').map((w,i)=> i===0||!minor.has(w.toLowerCase()) ? w.charAt(0).toUpperCase()+w.slice(1) : w.toLowerCase()).join(' ');
}
function ordinal(n) { const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function maybePeriod(str='') { return str && /[.!?]$/.test(str.trim()) ? str.trim() : (str ? str.trim() + '.' : ''); }
function editionText(value = '', style = 'generic') {
  if (!value) return '';
  if (/ed\.?$/i.test(value) || /edition/i.test(value)) return value;
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) return `${ordinal(n)} ed.`;
  return value;
}
function normalizePageRange(pages = '', style = 'generic') {
  if (!pages) return '';
  return style === 'ama' ? pages.replace(/–/g, '-').replace(/\s+/g, '') : pages.replace(/-/g, '–');
}
function isoDateFromFields(f = {}) {
  if (!f.pub_year) return '';
  const month = String(f.pub_month || '01').padStart(2, '0');
  const day = String(f.pub_day || '01').padStart(2, '0');
  return `${f.pub_year}-${month}-${day}`;
}
function fullPubDate(f, style) {
  if (!f.pub_year) return 'n.d.';
  if (style === 'apa') {
    let s = f.pub_year;
    if (f.pub_month) s += ', ' + monthName(f.pub_month);
    if (f.pub_day) s += ' ' + parseInt(f.pub_day, 10);
    return s;
  }
  if (style === 'mla') {
    const parts = [];
    if (f.pub_day) parts.push(parseInt(f.pub_day, 10));
    if (f.pub_month) parts.push(monthName(f.pub_month));
    if (f.pub_year) parts.push(f.pub_year);
    return parts.join(' ');
  }
  if (style === 'chicago') {
    const parts = [];
    if (f.pub_month) parts.push(monthName(f.pub_month));
    if (f.pub_day) parts.push(parseInt(f.pub_day, 10) + ',');
    if (f.pub_year) parts.push(f.pub_year);
    return parts.join(' ');
  }
  return f.pub_year;
}
function accDateStr(f, style) {
  if (!f.acc_year) return '';
  if (style === 'apa') return `Retrieved ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}, from`;
  if (style === 'mla') return `Accessed ${[f.acc_day ? parseInt(f.acc_day,10):'', f.acc_month?monthName(f.acc_month):'', f.acc_year].filter(Boolean).join(' ')}.`;
  if (style === 'chicago') return `Accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1',10)}, ${f.acc_year}.`;
  return '';
}
function fullPubDateAMA(f = {}) {
  if (!f.pub_year) return '';
  const parts = [];
  if (f.pub_month) parts.push(monthName(f.pub_month));
  if (f.pub_day) parts.push(String(parseInt(f.pub_day, 10)) + ',');
  parts.push(f.pub_year);
  return parts.join(' ').replace(/\s+,/g, ',');
}
function accessDateLong(f = {}) {
  if (!f.acc_year) return '';
  const month = monthName(f.acc_month) || '';
  const day = f.acc_day ? String(parseInt(f.acc_day, 10)) : '';
  return [month, day ? day + ',' : '', f.acc_year].filter(Boolean).join(' ').replace(/\s+,/g, ',');
}
function authorLeadForNarrative(contributors = []) {
  const valid = contributors.filter(c => c.family?.trim());
  if (!valid.length) return 'Author';
  if (valid.length === 1) return valid[0].family;
  if (valid.length === 2) return `${valid[0].family} and ${valid[1].family}`;
  return `${valid[0].family} et al.`;
}
function toSuperscriptNumber(n) { return String(n).split('').map(d => SUPERSCRIPTS[d] || d).join(''); }
function formatAuthorsForACS(contribs) {
  const valid = contribs.filter(c => c.family?.trim());
  if (!valid.length) return '[Author]';
  const slice = valid.slice(0, 6).map(c => {
    const initials = [c.given, c.middle].filter(Boolean).map(name => name.split(/\s+/).filter(Boolean).map(part => part[0]?.toUpperCase() + '.').join(' ')).filter(Boolean).join(' ');
    return `${c.family}, ${initials}`.trim().replace(/,\s*$/, '');
  });
  return slice.join('; ') + (valid.length > 6 ? '; et al.' : '');
}
function formatAuthorsForAMA(contribs) {
  const valid = contribs.filter(c => c.family?.trim());
  if (!valid.length) return '[Author]';
  const toAma = c => {
    const initials = [c.given, c.middle].filter(Boolean).map(name => name.split(/\s+/).filter(Boolean).map(part => part[0]?.toUpperCase()).join('')).join('');
    return `${c.family} ${initials}`.trim();
  };
  if (valid.length > 6) return valid.slice(0, 3).map(toAma).join(', ') + ', et al';
  return valid.map(toAma).join(', ');
}
function formatContributorList(contribs, style) {
  if (style === 'acs') return formatAuthorsForACS(contribs);
  if (style === 'ama') return formatAuthorsForAMA(contribs);
  const valid = contribs.filter(c => c.family?.trim());
  if (!valid.length) return null;
  const ini = c => c.given ? c.given[0].toUpperCase() + '.' : '';
  const midIni = c => c.middle ? c.middle[0].toUpperCase() + '.' : '';
  if (style === 'apa') {
    const fmt = c => `${c.family}, ${ini(c)}${midIni(c) ? ' ' + midIni(c) : ''}`.trim().replace(/,\s*$/, '');
    if (valid.length === 1) return fmt(valid[0]);
    if (valid.length === 2) return `${fmt(valid[0])}, &amp; ${fmt(valid[1])}`;
    if (valid.length <= 20) return valid.slice(0,-1).map(fmt).join(', ') + ', &amp; ' + fmt(valid.at(-1));
    return valid.slice(0,19).map(fmt).join(', ') + ', . . . ' + fmt(valid.at(-1));
  }
  if (style === 'mla') {
    const full0 = `${valid[0].family}${valid[0].given ? ', ' + valid[0].given + (valid[0].middle ? ' ' + valid[0].middle : '') : ''}`;
    if (valid.length === 1) return full0;
    if (valid.length === 2) {
      const n1 = `${valid[1].given ? valid[1].given + (valid[1].middle?' '+valid[1].middle:'') + ' ' : ''}${valid[1].family}`;
      return `${full0}, and ${n1}`;
    }
    return `${full0}, et al.`;
  }
  if (style === 'chicago') {
    const full0 = `${valid[0].family}${valid[0].given ? ', ' + valid[0].given + (valid[0].middle ? ' ' + valid[0].middle : '') : ''}`;
    if (valid.length === 1) return full0;
    if (valid.length <= 3) {
      const rest = valid.slice(1).map(c => `${c.given ? c.given+(c.middle?' '+c.middle:'') + ' ' : ''}${c.family}`);
      return `${full0}, and ${rest.join(', and ')}`;
    }
    return `${full0}, et al.`;
  }
  if (style === 'ieee') return valid.map(c => `${ini(c)}${midIni(c) ? ' '+midIni(c) : ''} ${c.family}`.trim()).join(', ');
  return valid[0].family;
}
function formatIntextVariants(style, contributors, fields, citationNumber = 1) {
  const valid = contributors.filter(c => c.family?.trim());
  const year = pubDateStr(fields) || 'n.d.';
  if (style === 'apa') {
    const names = !valid.length ? 'Author' : valid.length <= 2 ? valid.map(c => c.family).join(' & ') : `${valid[0].family} et al.`;
    return {
      primary: { label: 'Parenthetical', value: `(${names}, ${year})` },
      secondary: { label: 'Narrative', value: `${names.replace(' & ', ' and ')} (${year})` }
    };
  }
  if (style === 'mla') {
    const lead = authorLeadForNarrative(valid);
    const pg = fields.pages ? fields.pages.split(/[-–]/)[0] : '';
    return {
      primary: { label: 'Parenthetical', value: `(${lead}${pg ? ' ' + pg : ''})` },
      secondary: { label: 'Narrative', value: lead }
    };
  }
  if (style === 'chicago') {
    const lead = authorLeadForNarrative(valid);
    return {
      primary: { label: 'Parenthetical', value: `(${lead} ${year})` },
      secondary: { label: 'Narrative', value: `${lead} (${year})` }
    };
  }
  if (style === 'ieee') return { primary: { label: 'Bracketed', value: `[${citationNumber}]` }, secondary: { label: 'Superscript', value: toSuperscriptNumber(citationNumber) } };
  if (style === 'acs') return { primary: { label: 'Superscript', value: toSuperscriptNumber(citationNumber) }, secondary: { label: 'Parenthetical', value: `(${citationNumber})` } };
  if (style === 'ama') return { primary: { label: 'Superscript', value: toSuperscriptNumber(citationNumber) }, secondary: { label: 'Bracketed', value: `[${citationNumber}]` } };
  return { primary: { label: 'In-text', value: '' }, secondary: { label: '', value: '' } };
}

function validateSourceInput(sourceType, contributors, fields) {
  const requiredByType = {
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
    'wiki-entry': ['title', 'url']
  };

  const fieldLabels = {
    title: 'Title', content_preview: 'Post / content', conference: 'Conference name', pub_year: 'Publication year',
    institution: 'Institution / university', studio: 'Studio / distributor', model: 'AI model', url: 'URL',
    journal: 'Journal name', dictionary: 'Dictionary name', encyclopedia: 'Encyclopedia name', patent_number: 'Patent number',
    podcast: 'Podcast series title', publisher: 'Publisher', magazine: 'Magazine name', newspaper: 'Newspaper name',
    platform: 'Platform', show_title: 'Show title'
  };

  const errors = {};
  const required = requiredByType[sourceType] || ['title'];
  required.forEach(field => {
    if (!String(fields?.[field] || '').trim()) {
      errors[field] = `${fieldLabels[field] || field} is required.`;
    }
  });

  Object.entries(fields || {}).forEach(([field, value]) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    if ((field === 'pub_year' || field === 'acc_year') && !/^\d{4}$/.test(trimmed)) {
      errors[field] = `${fieldLabels[field] || field} must be a 4-digit year.`;
    }
    if ((field === 'pub_day' || field === 'acc_day') && !/^(0?[1-9]|[12][0-9]|3[01])$/.test(trimmed)) {
      errors[field] = `${fieldLabels[field] || field} must be a valid day.`;
    }
    if (field === 'url' && trimmed && !/^https?:\/\//i.test(trimmed)) {
      errors[field] = 'URL must start with http:// or https://.';
    }
  });

  (Array.isArray(contributors) ? contributors : []).forEach((contrib, index) => {
    const hasAny = ['given', 'middle', 'family'].some(key => String(contrib?.[key] || '').trim());
    if (hasAny && !String(contrib?.family || '').trim()) {
      errors[`contributor-${index}`] = 'Contributor last / family name is required when a contributor is added.';
    }
  });

  return { isValid: Object.keys(errors).length === 0, errors };
}

function formatCitation(style, sourceType, contributors, fields) {
  const authors = getContribsByRole(contributors, ['Author','Uploader']);
  const authStr = formatContributorList(authors, style) || '[Author]';
  const t = fields.title || fields.content_preview || '[Title]';
  const y = pubDateStr(fields) || 'n.d.';
  const formatters = { apa: apaFormat, mla: mlaFormat, chicago: chicagoFormat, ieee: ieeeFormat, acs: acsFormat, ama: amaFormat };
  const fn = formatters[style];
  return fn ? fn(sourceType, authStr, t, y, fields, contributors) : '';
}
function apaFormat(type, auth, t, y, f) {
  const dateInParen = fullPubDate(f, 'apa');
  const doi = f.doi ? ` https://doi.org/${String(f.doi).replace(/^https?:\/\/doi\.org\//i,'')}` : '';
  const url = f.url && !f.doi ? ` ${f.url}` : '';
  const acc = f.acc_year ? ` ${accDateStr(f,'apa')} ${f.url||''}` : (doi || url);
  switch (type) {
    case 'journal-article':
      return `${auth}. (${dateInParen}). ${sentenceCase(t)}. <em>${f.journal || '[Journal]'}</em>, <em>${f.volume || ''}</em>${f.issue ? `(${f.issue})` : ''}${f.pages ? `, ${f.pages}` : ''}.${doi || url}`;
    case 'website': case 'webpage': case 'press-release': case 'online-magazine-article': case 'wiki-entry':
      return `${auth}. (${dateInParen}). <em>${sentenceCase(t)}</em>. ${f.site_name || f.publisher || ''}.${acc}`.trim();
    case 'textbook':
      return `${auth}. (${y}). <em>${titleCase(t)}</em>${f.edition ? ` (${editionText(f.edition)})` : ''}. ${f.publisher || ''}.` + (doi || url);
    case 'video':
      return `${auth}. (${dateInParen}). <em>${sentenceCase(t)}</em> [Video]. ${f.channel || f.site_name || ''}.` + (url || doi);
    case 'podcast':
      return `${auth}. (${dateInParen}). <em>${sentenceCase(t)}</em> [Audio podcast]. ${f.network || f.publisher || ''}.` + (url || doi);
    case 'podcast-episode':
      return `${auth}. (${dateInParen}). ${sentenceCase(t)} [Audio podcast episode]. In <em>${f.podcast || '[Podcast]'}</em>. ${f.network || f.publisher || ''}.` + (url || doi);
    case 'software':
      return `${auth}. (${y}). <em>${titleCase(t)}</em>${f.version ? ` (Version ${f.version})` : ''} [Computer software]. ${f.publisher || ''}.` + (url || doi);
    case 'film': case 'documentary':
      return `${auth}. (${y}). <em>${titleCase(t)}</em> [Film]. ${f.studio || ''}.` + (url || doi);
    case 'presentation-slides':
      return `${auth}. (${dateInParen}). <em>${sentenceCase(t)}</em> [Presentation slides]. ${f.institution || ''}.` + (url || doi);
    case 'report':
      return `${auth}. (${y}). <em>${sentenceCase(t)}</em>${f.report_number ? ` (${f.report_number})` : ''}. ${f.institution || f.publisher || ''}.` + (doi || url);
    case 'thesis': case 'dissertation':
      return `${auth}. (${y}). <em>${sentenceCase(t)}</em> [${type === 'dissertation' ? 'Doctoral dissertation' : 'Thesis'}, ${f.institution || 'Institution'}].` + (doi || url);
    default:
      return `${auth}. (${dateInParen}). <em>${sentenceCase(t)}</em>.` + (doi || url);
  }
}
function mlaFormat(type, auth, t, y, f) {
  switch (type) {
    case 'journal-article':
      return `${auth}. "${titleCase(t)}." <em>${f.journal || '[Journal]'}</em>, vol. ${f.volume || ''}${f.issue ? `, no. ${f.issue}` : ''}, ${y}${f.pages ? `, pp. ${normalizePageRange(f.pages)}` : ''}.` + (f.doi ? ` DOI: ${String(f.doi).replace(/^https?:\/\/doi\.org\//i,'')}.` : (f.url ? ` ${f.url}.` : ''));
    case 'website': case 'webpage': case 'press-release': case 'online-magazine-article': case 'wiki-entry':
      return `${auth}. "${titleCase(t)}." <em>${f.site_name || f.publisher || 'Website'}</em>, ${fullPubDate(f,'mla')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'mla')}` : '');
    case 'video':
      return `${auth}. "${titleCase(t)}." <em>${f.site_name || f.channel || 'Video'}</em>, ${fullPubDate(f,'mla')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'mla')}` : '');
    case 'podcast':
      return `${auth}. "${titleCase(t)}." <em>${f.network || f.publisher || 'Podcast'}</em>, ${fullPubDate(f,'mla')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'mla')}` : '');
    case 'podcast-episode':
      return `${auth}. "${titleCase(t)}." <em>${f.podcast || 'Podcast'}</em>, ${f.network || f.publisher || ''}, ${fullPubDate(f,'mla')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'mla')}` : '');
    case 'software':
      return `${auth}. <em>${titleCase(t)}</em>` + (f.version ? `, version ${f.version}` : '') + `. ${f.publisher || ''}, ${y}.` + (f.url ? ` ${f.url}.` : '');
    default:
      return `${auth}. <em>${titleCase(t)}</em>. ${y}.` + (f.url ? ` ${f.url}.` : '');
  }
}
function chicagoFormat(type, auth, t, y, f) {
  switch (type) {
    case 'journal-article':
      return `${auth}. "${titleCase(t)}." <em>${f.journal || '[Journal]'}</em> ${f.volume || ''}${f.issue ? `, no. ${f.issue}` : ''} (${y})${f.pages ? `: ${normalizePageRange(f.pages)}` : ''}.` + (f.doi ? ` https://doi.org/${String(f.doi).replace(/^https?:\/\/doi\.org\//i,'')}.` : (f.url ? ` ${f.url}.` : ''));
    case 'website': case 'webpage': case 'press-release': case 'online-magazine-article': case 'wiki-entry':
      return `${auth}. "${titleCase(t)}." ${f.site_name || f.publisher || 'Website'}. ${fullPubDate(f,'chicago')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'chicago')}` : '');
    case 'video':
      return `${auth}. "${titleCase(t)}." ${f.site_name || f.channel || 'Video'}. ${fullPubDate(f,'chicago')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'chicago')}` : '');
    case 'podcast':
      return `${auth}. "${titleCase(t)}." ${f.network || f.publisher || 'Podcast'}. ${fullPubDate(f,'chicago')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'chicago')}` : '');
    case 'podcast-episode':
      return `${auth}. "${titleCase(t)}." ${f.podcast || 'Podcast'}. ${fullPubDate(f,'chicago')}. ${f.url || ''}` + (f.acc_year ? ` ${accDateStr(f,'chicago')}` : '');
    default:
      return `${auth}. <em>${titleCase(t)}</em>. ${y}.` + (f.url ? ` ${f.url}.` : '');
  }
}
function ieeeFormat(type, auth, t, y, f) {
  switch (type) {
    case 'journal-article':
      return `${auth}, "${sentenceCase(t)}," <em>${f.journal || '[Journal]'}</em>, vol. ${f.volume || ''}${f.issue ? `, no. ${f.issue}` : ''}${f.pages ? `, pp. ${normalizePageRange(f.pages)}` : ''}, ${y}.` + (f.doi ? ` doi: ${String(f.doi).replace(/^https?:\/\/doi\.org\//i,'')}.` : (f.url ? ` ${f.url}.` : ''));
    case 'website': case 'webpage': case 'press-release': case 'online-magazine-article': case 'wiki-entry':
      return `${auth}, "${sentenceCase(t)}," ${f.site_name || f.publisher || 'Website'}, ${y}. [Online]. Available: ${f.url || ''}.`;
    case 'video':
      return `${auth}, "${sentenceCase(t)}," ${f.site_name || f.channel || 'Video'}, ${y}. [Online]. Available: ${f.url || ''}.`;
    case 'podcast':
      return `${auth}, "${sentenceCase(t)}," ${f.network || f.publisher || 'Podcast'}, ${y}. [Online]. Available: ${f.url || ''}.`;
    case 'podcast-episode':
      return `${auth}, "${sentenceCase(t)}," in <em>${f.podcast || 'Podcast'}</em>, ${y}. [Online]. Available: ${f.url || ''}.`;
    case 'software':
      return `${auth}, <em>${titleCase(t)}</em>` + (f.version ? `, ver. ${f.version}` : '') + `, ${y}. [Online]. Available: ${f.url || ''}.`;
    default:
      return `${auth}, "${sentenceCase(t)}," ${y}.` + (f.url ? ` ${f.url}.` : '');
  }
}
function acsFormat(type, auth, t, y, f) {
  const cleanDoi = String(f.doi || '').replace(/^https?:\/\/doi\.org\//i, '');
  const doi = cleanDoi ? ` DOI: ${cleanDoi}.` : '';
  const url = f.url && !cleanDoi ? ` ${f.url}` + (f.acc_year ? ` (accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}).` : '.') : '';
  const year = f.pub_year || y;
  const pages = normalizePageRange(f.pages, 'acs');
  const bookEd = editionText(f.edition, 'acs');
  const patentDate = isoDateFromFields(f);
  switch (type) {
    case 'journal-article':
    case 'online-magazine-article':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${f.journal || f.site_name || f.magazine ? `<em>${f.journal || f.site_name || f.magazine}</em> ` : ''}${year}` + (f.volume ? `, ${f.volume}` : '') + (f.issue ? ` (${f.issue})` : '') + (pages ? `, ${pages}` : '') + '.' + doi + (doi ? '' : url);
    case 'textbook':
      return `${auth}. <em>${titleCase(t)}</em>` + (bookEd ? `, ${bookEd}` : '') + `; ${f.publisher || '[Publisher]'}` + (f.city ? `: ${f.city}` : '') + `, ${year}.`;
    case 'thesis': case 'dissertation':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${type === 'dissertation' ? 'Ph.D. Thesis' : 'Thesis'}, ${f.institution || 'Institution'}, ${year}.`;
    case 'website': case 'webpage': case 'press-release': case 'wiki-entry':
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (f.site_name ? ` ${f.site_name}.` : '') + (year ? ` ${year}.` : '') + (f.url ? ` ${f.url}` : '') + (f.acc_year ? ` (accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}).` : '');
    case 'dataset':
      return `${auth}. ${sentenceCase(t)}.` + (f.publisher ? ` ${f.publisher}.` : '') + (cleanDoi ? ` DOI: ${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    case 'patent':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${(f.publisher || 'U.S.')} Patent ${f.patent_number || 'XXXXXXX'}, ${patentDate || year}.`;
    case 'video':
      return `${auth}. ${sentenceCase(t)} [Video].` + (f.channel ? ` ${f.channel}.` : '') + (f.site_name ? ` ${f.site_name}.` : '') + (f.url ? ` ${f.url}` : '') + (f.acc_year ? ` (accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}).` : '');
    case 'conference-session':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${f.conference ? `In ${f.conference}; ` : ''}${year}` + (pages ? `; pp ${pages}` : '') + '.';
    case 'report':
      return `${auth}. <em>${titleCase(t)}</em>` + (f.report_number ? `; Report ${f.report_number}` : '') + `; ${f.institution || f.publisher || 'Publisher'}, ${year}.` + (cleanDoi ? ` DOI: ${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    default:
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (cleanDoi ? ` DOI: ${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
  }
}
function amaFormat(type, auth, t, y, f) {
  const cleanDoi = String(f.doi || '').replace(/^https?:\/\/doi\.org\//i, '');
  const pages = normalizePageRange(f.pages, 'ama');
  const bookEd = editionText(f.edition, 'ama');
  const access = accessDateLong(f);
  const fullDate = fullPubDateAMA(f);
  switch (type) {
    case 'journal-article':
    case 'online-magazine-article':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${f.journal || f.site_name || f.magazine ? `<em>${f.journal || f.site_name || f.magazine}</em>. ` : ''}${y}` + (f.volume ? `;${f.volume}` : '') + (f.issue ? `(${f.issue})` : '') + (pages ? `:${pages}` : '') + '.' + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    case 'textbook':
      return `${auth}. <em>${titleCase(t)}</em>` + (bookEd ? ` ${bookEd}` : '') + `. ` + (f.city ? `${f.city}: ` : '') + `${f.publisher || '[Publisher]'}; ${y}.`;
    case 'thesis': case 'dissertation':
      return `${auth}. ${sentenceCase(t)} [${type === 'dissertation' ? 'dissertation' : 'thesis'}]. ${f.institution || 'Institution'}; ${y}.`;
    case 'website': case 'webpage': case 'press-release': case 'wiki-entry':
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (fullDate ? ` Published ${fullDate}.` : '') + (access ? ` Accessed ${access}.` : '') + (f.url ? ` ${f.url}.` : '');
    case 'dataset':
      return `${auth}. ${sentenceCase(t)}.` + (f.publisher ? ` ${f.publisher}.` : '') + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    case 'patent':
      return `${auth}. ${sentenceCase(t)}. ${(f.publisher || 'U.S.')} Patent ${f.patent_number || 'XXXXXXX'}. ${fullDate || y}.`;
    case 'video':
      return `${auth}. ${sentenceCase(t)} [video].` + (f.channel ? ` ${f.channel}.` : '') + (access ? ` Accessed ${access}.` : '') + (f.url ? ` ${f.url}.` : '');
    case 'conference-session':
      return `${auth}. ${maybePeriod(sentenceCase(t))} In: ${f.conference || 'Conference proceedings'}.` + (y ? ` ${y}` : '') + (pages ? `:${pages}` : '') + '.';
    case 'report':
      return `${auth}. <em>${sentenceCase(t)}</em>.` + (f.institution || f.publisher ? ` ${f.institution || f.publisher};` : '') + ` ${y}.` + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    default:
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
  }
}
