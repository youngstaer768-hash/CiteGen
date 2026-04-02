const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
}

// ─── URL type detector ────────────────────────────────────────────────────────

function detectSourceTypeFromUrl(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|loom\.com|twitch\.tv/.test(u)) return 'video';
  if (/netflix\.com|hulu\.com|disneyplus\.com/.test(u)) return 'tv-show-episode';
  if (/spotify\.com\/episode|podcasts\.apple\.com|podcasts\.google\.com/.test(u)) return 'podcast-episode';
  if (/twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|reddit\.com\/r\/.+\/comments/.test(u)) return 'forum-post';
  if (/reddit\.com/.test(u)) return 'forum-post';
  if (/wikipedia\.org/.test(u)) return 'wiki-entry';
  if (/merriam-webster\.com|dictionary\.com|oxfordlearnersdictionaries\.com|lexico\.com/.test(u)) return 'online-dictionary-entry';
  if (/britannica\.com|encyclopedia\.com/.test(u)) return 'online-encyclopedia-entry';
  if (/github\.com/.test(u)) return 'software';
  if (/patents\.google\.com|patentscope\.wipo\.int|espacenet\.com/.test(u)) return 'patent';
  if (/slideshare\.net|slides\.google\.com/.test(u)) return 'presentation-slides';
  if (/npr\.org|bbc\.com\/news|theguardian\.com|nytimes\.com|washingtonpost\.com/.test(u)) return 'online-magazine-article';
  return null;
}

function isValidHttpUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function extractDoi(input = '') {
  let raw = '';
  try {
    raw = decodeURIComponent(String(input || ''));
  } catch (_) {
    raw = String(input || '');
  }
  raw = raw.trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim();
  const match = raw.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match ? match[0].replace(/[)\].,;:]+$/, '') : '';
}

function isDoiResolverUrl(input = '') {
  try {
    const u = new URL(input);
    return /^(?:dx\.)?doi\.org$/i.test(u.hostname);
  } catch (_) {
    return false;
  }
}

function decodeHtml(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function pickMetaContent(html, keys = []) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
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
    return `${yyyy}-${mm}-${dd}T${timePart}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00Z`;
  return v;
}


function cleanIsbnCandidate(raw = '') {
  return decodeHtml(String(raw || ''))
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
  return candidates
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0]?.value || '';
}

function recursivelyFindKeys(node, keys, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    for (const item of node) recursivelyFindKeys(item, keys, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;

  for (const [k, v] of Object.entries(node)) {
    const lower = String(k).toLowerCase();
    const normalized = lower.replace(/[^a-z0-9]/g, '');
    if (keys.some(key => normalized === key || normalized.endsWith(key))) {
      acc.push(v);
    }
    recursivelyFindKeys(v, keys, acc);
  }
  return acc;
}

function extractJsonLikeAssignments(scriptText) {
  const results = [];
  const patterns = [
    /(\{[\s\S]{0,5000}?\})/g,
    /(\[[\s\S]{0,5000}?\])/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(scriptText)) !== null) {
      const candidate = match[1];
      try {
        const parsed = JSON.parse(candidate);
        results.push(parsed);
      } catch (_) {}
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
      while ((pair = pairRegex.exec(body)) !== null) {
        obj[pair[1]] = decodeHtml(pair[2]);
      }
      if (Object.keys(obj).length) objects.push(obj);
    }
  }

  return objects;
}

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi)];
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
        const authorName = typeof authorNode === 'string'
          ? authorNode
          : (authorNode?.name || (Array.isArray(node.creator) ? node.creator[0]?.name : node.creator?.name) || '');
        const title = node.headline || node.name || '';
        const datePublished = typeof node.datePublished === 'string' ? node.datePublished.trim() : '';
        const dateModified = typeof node.dateModified === 'string' ? node.dateModified.trim() : '';
        const score = (title ? 3 : 0) + (authorName ? 2 : 0) + (datePublished ? 2 : 0) + (dateModified ? 1 : 0);
        if (score) {
          candidates.push({ title, author: authorName, datePublished, dateModified, score });
        }
      }
    } catch (_) {}
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best ? {
    title: best.title,
    author: best.author,
    datePublished: best.datePublished,
    dateModified: best.dateModified
  } : {};
}

function extractMetadataFromScripts(html) {
  const scripts = getScriptContents(html);
  const titleKeys = ['headline', 'title', 'pagetitle', 'article_title', 'contenttitle'];
  const authorKeys = ['author', 'authors', 'byline', 'creator', 'authorname'];
  const publishedKeys = ['datepublished', 'publisheddate', 'publicationdate', 'pubdate', 'publishdate', 'articlepublishedtime'];
  const modifiedKeys = ['datemodified', 'modifieddate', 'lastmodified', 'updatedat', 'updatetime', 'updatedtime'];

  const titleCandidates = [];
  const authorCandidates = [];
  const publishedCandidates = [];
  const modifiedCandidates = [];

  for (const script of scripts) {
    const decodedScript = decodeHtml(script);

    for (const key of titleKeys) {
      const regex = new RegExp(`["']${key}["']\\s*[:=]\\s*["']([^"']{3,300})["']`, 'ig');
      let match;
      while ((match = regex.exec(decodedScript)) !== null) {
        const value = decodeHtml(match[1]).trim();
        if (value) titleCandidates.push({ value, score: key === 'headline' ? 4 : 2 });
      }
    }

    for (const key of authorKeys) {
      const regex = new RegExp(`["']${key}["']\\s*[:=]\\s*["']([^"']{3,300})["']`, 'ig');
      let match;
      while ((match = regex.exec(decodedScript)) !== null) {
        const value = decodeHtml(match[1]).trim();
        if (value) authorCandidates.push({ value, score: key === 'authors' || key === 'author' ? 4 : 2 });
      }
    }

    for (const key of publishedKeys) {
      const regex = new RegExp(`["']${key}["']\\s*[:=]\\s*["']([^"']{4,80})["']`, 'ig');
      let match;
      while ((match = regex.exec(decodedScript)) !== null) {
        const candidate = scoreDateCandidate(match[1], [key]);
        if (candidate) publishedCandidates.push(candidate);
      }
    }

    for (const key of modifiedKeys) {
      const regex = new RegExp(`["']${key}["']\\s*[:=]\\s*["']([^"']{4,80})["']`, 'ig');
      let match;
      while ((match = regex.exec(decodedScript)) !== null) {
        const candidate = scoreDateCandidate(match[1], [key]);
        if (candidate) modifiedCandidates.push(candidate);
      }
    }

    const analyticsObjects = extractAnalyticsObjects(script);
    for (const parsed of analyticsObjects) {
      const titles = recursivelyFindKeys(parsed, titleKeys).flat().filter(v => typeof v === 'string');
      for (const value of titles) titleCandidates.push({ value: decodeHtml(value), score: 6 });

      const authors = recursivelyFindKeys(parsed, authorKeys).flat().filter(v => typeof v === 'string');
      for (const value of authors) authorCandidates.push({ value: decodeHtml(value), score: 6 });

      const published = recursivelyFindKeys(parsed, publishedKeys).flat().filter(v => typeof v === 'string');
      for (const value of published) {
        const candidate = scoreDateCandidate(value, publishedKeys);
        if (candidate) publishedCandidates.push({ ...candidate, score: candidate.score + 3 });
      }

      const modified = recursivelyFindKeys(parsed, modifiedKeys).flat().filter(v => typeof v === 'string');
      for (const value of modified) {
        const candidate = scoreDateCandidate(value, modifiedKeys);
        if (candidate) modifiedCandidates.push({ ...candidate, score: candidate.score + 3 });
      }
    }

    const jsonish = extractJsonLikeAssignments(script);
    for (const parsed of jsonish) {
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

// ─── Metadata lookup routes ───────────────────────────────────────────────────

app.get('/api/lookup/doi', async (req, res) => {
  const { doi } = req.query;
  const clean = extractDoi(doi);
  if (!clean) return res.status(400).json({ error: 'DOI required' });
  try {
    const r = await axios.get(
      `https://api.crossref.org/works/${encodeURIComponent(clean)}`,
      { headers: { 'User-Agent': 'CiteGen/1.0 (mailto:dev@citegen.app)' }, timeout: 8000 }
    );
    return res.json(normalizeCrossref(r.data.message));
  } catch (e) {
    return res.status(404).json({ error: 'DOI not found' });
  }
});

app.get('/api/lookup/isbn', async (req, res) => {
  const { isbn } = req.query;
  const normalized = normalizeIsbnInput(isbn || '');
  if (!normalized.valid) return res.status(400).json({ error: 'Enter a valid ISBN-10 or ISBN-13' });
  try {
    const book = await lookupBookByIsbn(normalized);
    if (!book) return res.status(404).json({ error: 'ISBN not found' });
    return res.json(book);
  } catch (e) {
    return res.status(404).json({ error: 'ISBN lookup failed' });
  }
});


async function lookupBookByIsbn(isbnInfo) {
  const normalized = typeof isbnInfo === 'string' ? normalizeIsbnInput(isbnInfo) : isbnInfo;
  if (!normalized?.valid) return null;
  const variants = [normalized.isbn13, normalized.isbn10].filter(Boolean);

  for (const candidate of variants) {
    try {
      const r = await axios.get('https://www.googleapis.com/books/v1/volumes', {
        params: { q: `isbn:${candidate}`, maxResults: 1 },
        timeout: 8000
      });
      const item = r.data?.items?.[0];
      if (item?.volumeInfo) return normalizeGoogleBooks(item, normalized);
    } catch (_) {}
  }

  for (const candidate of variants) {
    try {
      const r = await axios.get(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(candidate)}&format=json&jscmd=data`,
        { timeout: 8000 }
      );
      const book = r.data?.[`ISBN:${candidate}`];
      if (book) return normalizeOpenLibrary(book, normalized);
    } catch (_) {}
  }

  return null;
}

app.get('/api/lookup/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const r = await axios.get('https://api.crossref.org/works', {
      params: { query: q, rows: 5, select: 'title,author,published,container-title,volume,issue,page,DOI,type,publisher,ISBN' },
      headers: { 'User-Agent': 'CiteGen/1.0 (mailto:dev@citegen.app)' },
      timeout: 8000
    });
    return res.json((r.data.message.items || []).map(normalizeCrossref));
  } catch (e) {
    return res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/lookup/url', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  if (!isValidHttpUrl(url)) return res.status(400).json({ error: 'Enter a valid http(s) URL' });

  const directDoi = isDoiResolverUrl(url) ? extractDoi(url) : '';
  if (directDoi) {
    try {
      const r = await axios.get(`https://api.crossref.org/works/${encodeURIComponent(directDoi)}`, {
        headers: { 'User-Agent': 'CiteGen/1.0 (mailto:dev@citegen.app)' }, timeout: 8000
      });
      return res.json(normalizeCrossref(r.data.message));
    } catch (e) {
      return res.status(404).json({ error: 'DOI not found' });
    }
  }

  try {
    const r = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CiteGen/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: status => status >= 200 && status < 400
    });

    const finalUrl = r.request?.res?.responseUrl || url;
    const contentType = r.headers?.['content-type'] || '';

    if (looksLikePdf(finalUrl, contentType)) {
      const detected = detectSourceTypeFromUrl(finalUrl);
      return res.json({
        sourceType: detected || 'webpage',
        contributors: [{ given: '', middle: '', family: '', role: 'Author' }],
        fields: {
          title: finalUrl.split('/').pop()?.replace(/\.pdf(?:\?.*)?$/i, '') || 'PDF document',
          site_name: new URL(finalUrl).hostname.replace('www.', ''),
          acc_year: String(new Date().getFullYear()),
          acc_month: String(new Date().getMonth() + 1).padStart(2, '0'),
          acc_day: String(new Date().getDate()).padStart(2, '0'),
          url: finalUrl
        }
      });
    }

    const meta = scrapeMetaTags(String(r.data || ''), finalUrl);
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
          return res.json(bookMeta);
        }
      } catch (_) {}
    }
    const detected = detectSourceTypeFromUrl(finalUrl);
    if (detected) meta.sourceType = detected;
    return res.json(meta);
  } catch (e) {
    const status = e.response?.status;
    const detail = e.code || e.message || 'Unknown fetch error';
    return res.status(status && status >= 400 ? status : 502).json({
      error: 'Could not retrieve metadata',
      detail
    });
  }
});

// ─── Format & Export ──────────────────────────────────────────────────────────

app.post('/api/format', (req, res) => {
  const { style, sourceType, contributors, fields } = req.body;
  if (!style || !sourceType) return res.status(400).json({ error: 'style and sourceType required' });
  try {
    const citation = formatCitation(style, sourceType, contributors || [], fields || {});
    const intext = formatIntext(style, contributors || [], fields || {});
    return res.json({ citation, intext });
  } catch (e) {
    return res.status(500).json({ error: 'Formatting error: ' + e.message });
  }
});

app.post('/api/export', (req, res) => {
  const { entries, style } = req.body;
  if (!entries || !entries.length) return res.status(400).json({ error: 'No entries' });
  const titles = { apa: 'References', mla: 'Works Cited', chicago: 'Bibliography', ieee: 'References' };
  const header = titles[style] || 'References';
  const sorted = style === 'ieee' ? entries : [...entries].sort((a, b) => a.citation.localeCompare(b.citation));
  const plain = sorted.map(e => e.citation.replace(/<[^>]+>/g, '')).join('\n\n');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${style}-bibliography.txt"`);
  res.send(header + '\n' + '─'.repeat(header.length) + '\n\n' + plain);
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'citegen-api' }));

// ─── Normalizers ──────────────────────────────────────────────────────────────

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

function scrapeMetaTags(html, url) {
  const titleFromMeta = pickMetaContent(html, ['og:title', 'twitter:title', 'citation_title', 'parsely-title']);
  const titleFromTag = decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).replace(/\s+/g, ' ').trim();
  const site = pickMetaContent(html, ['og:site_name', 'application-name']) || new URL(url).hostname.replace('www.','');
  const author = pickMetaContent(html, ['author', 'article:author', 'citation_author', 'parsely-author', 'dc.creator']);
  const publishedDateStr = pickMetaContent(html, [
    'article:published_time',
    'date',
    'citation_publication_date',
    'citation_online_date',
    'citation_date',
    'dc.date',
    'dc.date.issued',
    'dcterms.issued',
    'parsely-pub-date'
  ]);
  const modifiedDateStr = pickMetaContent(html, [
    'article:modified_time',
    'og:updated_time',
    'last-modified',
    'citation_modified_date',
    'dc.date.modified',
    'dcterms.modified',
    'dateModified'
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
  const finalAuthor = author || jsonLd.author || scriptMeta.author || '';
  const publicationDate = normalizeDateString(publishedDateStr || jsonLd.datePublished || scriptMeta.datePublished || modifiedDateStr || jsonLd.dateModified || scriptMeta.dateModified || '');
  const modifiedDate = normalizeDateString(modifiedDateStr || jsonLd.dateModified || scriptMeta.dateModified || '');
  const date = publicationDate ? new Date(publicationDate) : null;
  const modified = modifiedDate ? new Date(modifiedDate) : null;
  const contributors = buildContributorsFromNames(splitAuthorNames(finalAuthor));

  return {
    sourceType: 'webpage',
    contributors,
    fields: {
      title: finalTitle,
      site_name: site,
      pub_year: date && !isNaN(date) ? String(date.getFullYear()) : '',
      pub_month: date && !isNaN(date) ? String(date.getMonth()+1).padStart(2,'0') : '',
      pub_day: date && !isNaN(date) ? String(date.getDate()).padStart(2,'0') : '',
      mod_year: modified && !isNaN(modified) ? String(modified.getFullYear()) : '',
      mod_month: modified && !isNaN(modified) ? String(modified.getMonth()+1).padStart(2,'0') : '',
      mod_day: modified && !isNaN(modified) ? String(modified.getDate()).padStart(2,'0') : '',
      acc_year: String(new Date().getFullYear()),
      acc_month: String(new Date().getMonth()+1).padStart(2,'0'),
      acc_day: String(new Date().getDate()).padStart(2,'0'),
      url,
      isbn: finalIsbn
    }
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function getContribsByRole(contributors, roles) {
  const matches = contributors.filter(c => roles.includes(c.role));
  return matches.length ? matches : contributors.filter(c => c.family?.trim());
}

function formatContributorList(contribs, style) {
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
  if (style === 'ieee') {
    return valid.map(c => `${ini(c)}${midIni(c) ? ' '+midIni(c) : ''} ${c.family}`.trim()).join(', ');
  }
  return valid[0].family;
}

function formatIntext(style, contributors, fields) {
  const valid = contributors.filter(c => c.family?.trim());
  const y = pubDateStr(fields) || 'n.d.';
  if (style === 'apa') {
    const a = !valid.length ? 'Author'
      : valid.length <= 2 ? valid.map(c => c.family).join(' &amp; ')
      : valid[0].family + ' et al.';
    return `(${a}, ${y})`;
  }
  if (style === 'mla') {
    const a = !valid.length ? 'Author' : valid[0].family;
    const pg = fields.pages ? fields.pages.split(/[-–]/)[0] : '';
    return `(${a}${pg ? ' ' + pg : ''})`;
  }
  if (style === 'chicago') {
    const a = !valid.length ? 'Author'
      : valid.length <= 2 ? valid.map(c => c.family).join(' and ')
      : valid[0].family + ' et al.';
    return `(${a} ${y})`;
  }
  if (style === 'ieee') return '[N]';
  return '';
}

function pubDateStr(f) {
  return f.pub_year || '';
}

function fullPubDate(f, style) {
  if (!f.pub_year) return 'n.d.';
  if (style === 'apa') {
    let s = f.pub_year;
    if (f.pub_month) s += ', ' + monthName(f.pub_month);
    if (f.pub_day) s += ' ' + parseInt(f.pub_day);
    return s;
  }
  if (style === 'mla') {
    let parts = [];
    if (f.pub_day) parts.push(parseInt(f.pub_day));
    if (f.pub_month) parts.push(monthName(f.pub_month));
    if (f.pub_year) parts.push(f.pub_year);
    return parts.join(' ');
  }
  if (style === 'chicago') {
    let parts = [];
    if (f.pub_month) parts.push(monthName(f.pub_month));
    if (f.pub_day) parts.push(parseInt(f.pub_day) + ',');
    if (f.pub_year) parts.push(f.pub_year);
    return parts.join(' ');
  }
  return f.pub_year;
}

function accDateStr(f, style) {
  if (!f.acc_year) return '';
  if (style === 'apa') {
    let s = monthName(f.acc_month) + ' ' + parseInt(f.acc_day||'1') + ', ' + f.acc_year;
    return `Retrieved ${s}, from`;
  }
  if (style === 'mla') {
    return `Accessed ${[f.acc_day ? parseInt(f.acc_day):'', f.acc_month?monthName(f.acc_month):'', f.acc_year].filter(Boolean).join(' ')}.`;
  }
  if (style === 'chicago') {
    return `Accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day||'1')}, ${f.acc_year}.`;
  }
  return '';
}

function monthName(m) {
  if (!m) return '';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const idx = parseInt(m) - 1;
  return months[idx] || m;
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
  return s.split(' ').map((w,i)=>
    i===0||!minor.has(w.toLowerCase()) ? w.charAt(0).toUpperCase()+w.slice(1) : w.toLowerCase()
  ).join(' ');
}

function ordinal(n) {
  const s=['th','st','nd','rd'], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

// ─── Main formatter dispatcher ────────────────────────────────────────────────

function formatCitation(style, sourceType, contributors, fields) {
  const authors = getContribsByRole(contributors, ['Author','Uploader']);
  const authStr = formatContributorList(authors, style) || '[Author]';
  const t = fields.title || '[Title]';
  const y = pubDateStr(fields) || 'n.d.';

  // Map all source types to a formatting function
  const formatters = {
    'apa': apaFormat,
    'mla': mlaFormat,
    'chicago': chicagoFormat,
    'ieee': ieeeFormat
  };
  const fn = formatters[style];
  if (!fn) return '';
  return fn(sourceType, authStr, t, y, fields, contributors);
}

// ─── APA formatter ────────────────────────────────────────────────────────────

function apaFormat(type, auth, t, y, f, contributors) {
  const dateInParen = fullPubDate(f, 'apa');
  const doi = f.doi ? ` https://doi.org/${f.doi.replace(/^https?:\/\/doi\.org\//i,'')}` : '';
  const url = f.url && !f.doi ? ` ${f.url}` : '';
  const acc = f.acc_year ? ` ${accDateStr(f,'apa')} ${f.url||''}` : (doi || url);
  const editors = getContribsByRole(contributors, ['Editor']);
  const edStr = editors.length ? formatContributorList(editors,'apa') : '';

  const base = `${auth} (${dateInParen}).`;

  switch(type) {
    case 'journal-article':
      return `${base} ${sentenceCase(t)}.` +
        (f.journal ? ` <em>${f.journal}</em>` : '') +
        (f.volume ? `, <em>${f.volume}</em>` : '') +
        (f.issue ? `(${f.issue})` : '') +
        (f.pages ? `, ${f.pages}` : '') + '.' + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'textbook': case 'print-encyclopedia-entry': case 'print-dictionary-entry':
      return `${base} <em>${sentenceCase(t)}</em>` +
        (f.edition ? ` (${ordinal(parseInt(f.edition)||1)} ed.)` : '') +
        (edStr ? ` (${edStr}, Ed${editors.length>1?'s':''}.),` : '') +
        '. ' + (f.publisher||'[Publisher]') + '.' + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'website': case 'webpage': case 'press-release':
      return `${base} <em>${sentenceCase(t)}</em>.` +
        (f.site_name ? ` ${f.site_name}.` : '') +
        (f.acc_year ? ` ${accDateStr(f,'apa')} ${f.url||''}` : (url)) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'online-magazine-article': case 'print-magazine-article':
      return `${base} ${sentenceCase(t)}.` +
        (f.journal||f.magazine ? ` <em>${f.journal||f.magazine}</em>` : '') +
        (f.pages ? `, ${f.pages}` : '') + '.' + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'print-newspaper-article': case 'online-newspaper-article':
      return `${base} ${sentenceCase(t)}.` +
        (f.newspaper ? ` <em>${f.newspaper}</em>` : '') +
        (f.pages ? `, ${f.pages}` : '') + '.' + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'conference-session':
      return `${base} ${sentenceCase(t)} [Conference session].` +
        (f.conference ? ` <em>${f.conference}</em>.` : '') +
        (f.location ? ` ${f.location}.` : '') + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'dataset':
      return `${base} <em>${sentenceCase(t)}</em> [Data set].` +
        (f.publisher ? ` ${f.publisher}.` : '') + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'film': case 'documentary': {
      const dirs = getContribsByRole(contributors,['Director']);
      const dirStr = dirs.length ? formatContributorList(dirs,'apa') : auth;
      return `${dirStr} (Director). (${dateInParen}). <em>${sentenceCase(t)}</em> [Film].` +
        (f.studio||f.publisher ? ` ${f.studio||f.publisher}.` : '') +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');
    }

    case 'forum-post':
      return `${base} ${sentenceCase(t)} [Forum post].` +
        (f.site_name ? ` ${f.site_name}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'image':
      return `${base} <em>${sentenceCase(t)}</em> [Image].` +
        (f.museum||f.site_name ? ` ${f.museum||f.site_name}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'online-dictionary-entry':
      return `${base} ${sentenceCase(t)}. In <em>${f.dictionary||'Dictionary'}</em>.` +
        (f.acc_year ? ` ${accDateStr(f,'apa')} ${f.url||''}` : url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'online-encyclopedia-entry': case 'wiki-entry':
      return `${base} ${sentenceCase(t)}. In <em>${f.encyclopedia||f.site_name||'Encyclopedia'}</em>.` +
        (f.acc_year ? ` ${accDateStr(f,'apa')} ${f.url||''}` : url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'patent':
      return `${base} <em>${sentenceCase(t)}</em> (${f.patent_number||'Patent No. XXXXXXX'}).` +
        (f.publisher ? ` ${f.publisher}.` : '') + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'podcast':
      return `${base} <em>${sentenceCase(t)}</em> [Podcast].` +
        (f.publisher||f.network ? ` ${f.publisher||f.network}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'podcast-episode':
      return `${base} ${sentenceCase(t)} [Audio podcast episode]. In <em>${f.podcast||'Podcast Title'}</em>.` +
        (f.publisher||f.network ? ` ${f.publisher||f.network}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'presentation-slides':
      return `${base} <em>${sentenceCase(t)}</em> [Slides].` +
        (f.institution||f.publisher ? ` ${f.institution||f.publisher}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'report':
      return `${base} <em>${sentenceCase(t)}</em>` +
        (f.report_number ? ` (Report No. ${f.report_number})` : '') + '.' +
        (f.institution||f.publisher ? ` ${f.institution||f.publisher}.` : '') + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'software':
      return `${base} <em>${sentenceCase(t)}</em>` +
        (f.version ? ` (Version ${f.version})` : '') + ' [Software].' +
        (f.publisher ? ` ${f.publisher}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'speech':
      return `${base} <em>${sentenceCase(t)}</em> [Speech].` +
        (f.conference||f.institution ? ` ${f.conference||f.institution}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'thesis': case 'dissertation':
      return `${base} <em>${sentenceCase(t)}</em>` +
        ` [${type==='dissertation'?'Doctoral dissertation':'Master\'s thesis'}, ${f.institution||'Institution'}].` +
        (f.database||f.publisher ? ` ${f.database||f.publisher}.` : '') + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'tv-show':
      return `${auth} (Executive Producer${contributors.filter(c=>c.role==='Director').length>1?'s':''}). (${dateInParen}). <em>${sentenceCase(t)}</em> [TV series].` +
        (f.network||f.publisher ? ` ${f.network||f.publisher}.` : '') +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'tv-show-episode': {
      const dirs = getContribsByRole(contributors,['Director']);
      const dirStr = dirs.length ? formatContributorList(dirs,'apa') : auth;
      return `${dirStr} (Director). (${dateInParen}). ${sentenceCase(t)} (Season ${f.season||'#'}, Episode ${f.episode||'#'}) [TV series episode]. In <em>${f.show_title||'Show Title'}</em>.` +
        (f.network||f.publisher ? ` ${f.network||f.publisher}.` : '') +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');
    }

    case 'generative-ai':
      return `${auth} (${dateInParen}). ${sentenceCase(t)} [AI-generated content].` +
        (f.model ? ` ${f.model}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'video':
      return `${base} <em>${sentenceCase(t)}</em> [Video]. ${f.channel||''}` + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    case 'social-media-post':
      return `${base} ${(f.content_preview||'').split(' ').slice(0,20).join(' ')} [Post].` +
        (f.platform ? ` ${f.platform}.` : '') + (url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');

    default:
      return `${base} ${sentenceCase(t)}.` + (doi||url) +
        (f.annotation ? `\n\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>Note: ${f.annotation}</em>` : '');
  }
}

// ─── MLA formatter ────────────────────────────────────────────────────────────

function mlaFormat(type, auth, t, y, f, contributors) {
  const dateStr = fullPubDate(f, 'mla');
  const acc = f.acc_year ? ' ' + accDateStr(f,'mla') : '';
  const urlStr = f.url ? ` ${f.url}.` : '';

  switch(type) {
    case 'journal-article':
      return `${auth}. "${titleCase(t)}." <em>${f.journal||'Journal'}</em>` +
        (f.volume ? `, vol. ${f.volume}` : '') + (f.issue ? `, no. ${f.issue}` : '') +
        `, ${dateStr}` + (f.pages ? `, pp. ${f.pages}` : '') + '.' +
        (f.doi ? ` DOI: ${f.doi}.` : urlStr) +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'textbook':
      return `${auth}. <em>${titleCase(t)}</em>. ${f.publisher||'Publisher'}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'website': case 'webpage':
      return `${auth}. "${titleCase(t)}." <em>${f.site_name||'Site Name'}</em>, ${dateStr}.${urlStr}${acc}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'online-magazine-article': case 'print-magazine-article':
      return `${auth}. "${titleCase(t)}." <em>${f.journal||f.magazine||'Magazine'}</em>, ${dateStr}` +
        (f.pages ? `, pp. ${f.pages}` : '') + '.' + (urlStr||'') + acc +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'print-newspaper-article':
      return `${auth}. "${titleCase(t)}." <em>${f.newspaper||'Newspaper'}</em>, ${dateStr}` +
        (f.pages ? `, pp. ${f.pages}` : '') + '.' +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'conference-session':
      return `${auth}. "${titleCase(t)}." <em>${f.conference||'Conference'}</em>, ${dateStr}` +
        (f.location ? `, ${f.location}` : '') + '.' + urlStr +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'film': case 'documentary': {
      const dirs = getContribsByRole(contributors,['Director']);
      const dirStr = dirs.length ? `Directed by ${dirs.map(d=>`${d.given} ${d.family}`).join(', ')}` : '';
      return `<em>${titleCase(t)}</em>. ${dirStr ? dirStr + ', ' : ''}${f.studio||f.publisher||''}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');
    }

    case 'forum-post':
      return `${auth}. "${titleCase(t)}." <em>${f.site_name||'Forum'}</em>, ${dateStr}.${urlStr}${acc}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'online-dictionary-entry': case 'print-dictionary-entry':
      return `"${titleCase(t)}." <em>${f.dictionary||'Dictionary'}</em>, ${f.publisher||'Publisher'}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'online-encyclopedia-entry': case 'print-encyclopedia-entry': case 'wiki-entry':
      return `"${titleCase(t)}." <em>${f.encyclopedia||f.site_name||'Encyclopedia'}</em>, ${dateStr}.${urlStr}${acc}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'podcast':
      return `${auth}. <em>${titleCase(t)}</em>. ${f.network||f.publisher||''}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'podcast-episode':
      return `${auth}. "${titleCase(t)}." <em>${f.podcast||'Podcast'}</em>, season ${f.season||'#'}, episode ${f.episode||'#'}, ${f.network||f.publisher||''}, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'thesis': case 'dissertation':
      return `${auth}. "${titleCase(t)}." ${type==='dissertation'?'Dissertation':'Thesis'}, ${f.institution||'Institution'}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'report':
      return `${auth}. <em>${titleCase(t)}</em>. ${f.institution||f.publisher||'Publisher'}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'software':
      return `${auth}. <em>${titleCase(t)}</em>${f.version ? ', version ' + f.version : ''}. ${f.publisher||''}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'tv-show':
      return `<em>${titleCase(t)}</em>. Created by ${auth}, ${f.network||f.publisher||''}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'tv-show-episode': {
      const dirs = getContribsByRole(contributors,['Director']);
      const dirStr = dirs.length ? `Directed by ${dirs.map(d=>`${d.given} ${d.family}`).join(', ')}, ` : '';
      return `"${titleCase(t)}." <em>${f.show_title||'Show Title'}</em>, ${dirStr}season ${f.season||'#'}, episode ${f.episode||'#'}, ${f.network||f.publisher||''}, ${dateStr}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');
    }

    case 'video':
      return `${auth}. "${titleCase(t)}." <em>YouTube</em>${f.channel ? ', uploaded by ' + f.channel : ''}, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'patent':
      return `${auth}. "${titleCase(t)}." ${f.patent_number||'Patent No. XXXXXXX'}, ${f.publisher||''}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'generative-ai':
      return `${auth}. "${titleCase(t)}." <em>${f.model||'AI Tool'}</em>, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'social-media-post':
      return `${auth}. "${(f.content_preview||'').split(' ').slice(0,20).join(' ')}." <em>${f.platform||'Platform'}</em>, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    default:
      return `${auth}. <em>${titleCase(t)}</em>. ${f.publisher||''}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');
  }
}

// ─── Chicago formatter ────────────────────────────────────────────────────────

function chicagoFormat(type, auth, t, y, f, contributors) {
  const dateStr = fullPubDate(f, 'chicago');
  const urlStr = f.url ? ` ${f.url}.` : '';
  const acc = f.acc_year ? ' ' + accDateStr(f,'chicago') : '';

  switch(type) {
    case 'journal-article':
      return `${auth}. "${titleCase(t)}." <em>${f.journal||'Journal'}</em>` +
        (f.volume ? ` ${f.volume}` : '') + (f.issue ? `, no. ${f.issue}` : '') +
        ` (${y})` + (f.pages ? ': ' + f.pages : '') + '.' +
        (f.doi ? ` https://doi.org/${f.doi}.` : urlStr) +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'textbook':
      return `${auth}. <em>${titleCase(t)}</em>. ` +
        (f.city ? f.city + ': ' : '') + (f.publisher||'Publisher') + ', ' + y + '.' +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'website': case 'webpage':
      return `${auth}. "${titleCase(t)}." <em>${f.site_name||'Site Name'}</em>. ${dateStr}.${urlStr}${acc}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'online-magazine-article': case 'print-magazine-article':
      return `${auth}. "${titleCase(t)}." <em>${f.journal||f.magazine||'Magazine'}</em>, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'print-newspaper-article':
      return `${auth}. "${titleCase(t)}." <em>${f.newspaper||'Newspaper'}</em>, ${dateStr}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'conference-session':
      return `${auth}. "${titleCase(t)}." Paper presented at ${f.conference||'Conference'}, ${f.location||''}, ${dateStr}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'thesis': case 'dissertation':
      return `${auth}. "${titleCase(t)}." ${type==='dissertation'?'PhD diss':'Master\'s thesis'}., ${f.institution||'Institution'}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'report':
      return `${auth}. <em>${titleCase(t)}</em>${f.report_number ? '. Report No. ' + f.report_number : ''}. ${f.institution||f.publisher||'Publisher'}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'film': case 'documentary': {
      const dirs = getContribsByRole(contributors,['Director']);
      const dirStr = dirs.length ? `Directed by ${dirs.map(d=>`${d.given} ${d.family}`).join(', ')}` : '';
      return `<em>${titleCase(t)}</em>. ${dirStr ? dirStr + '. ' : ''}${f.studio||f.publisher||''}, ${y}.` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');
    }

    case 'podcast-episode':
      return `${auth}. "${titleCase(t)}." <em>${f.podcast||'Podcast'}</em>. Podcast audio, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'online-encyclopedia-entry': case 'wiki-entry':
      return `"${titleCase(t)}." <em>${f.encyclopedia||f.site_name||'Encyclopedia'}</em>. ${dateStr}.${urlStr}${acc}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'software':
      return `${auth}. <em>${titleCase(t)}</em>${f.version ? ', version ' + f.version : ''}. ${f.publisher||''}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'social-media-post':
      return `${auth}. "${(f.content_preview||'').split(' ').slice(0,20).join(' ')}." ${f.platform||'Platform'}, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'video':
      return `${auth}. "${titleCase(t)}." Video, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    case 'generative-ai':
      return `${auth}. "${titleCase(t)}." AI-generated content. ${f.model||'AI Tool'}, ${dateStr}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');

    default:
      return `${auth}. <em>${titleCase(t)}</em>. ${f.publisher||''}, ${y}.${urlStr}` +
        (f.annotation ? `\n\n\t${f.annotation}` : '');
  }
}

// ─── IEEE formatter ───────────────────────────────────────────────────────────

function ieeeFormat(type, auth, t, y, f, contributors) {
  switch(type) {
    case 'journal-article':
      return `${auth}, "${t}," <em>${f.journal||'Journal'}</em>` +
        (f.volume ? `, vol. ${f.volume}` : '') + (f.issue ? `, no. ${f.issue}` : '') +
        (f.pages ? `, pp. ${f.pages}` : '') + `, ${y}` +
        (f.doi ? `. DOI: ${f.doi}` : (f.url ? `. [Online]. Available: ${f.url}` : '')) + '.';

    case 'textbook':
      return `${auth}, <em>${t}</em>${f.edition ? ', ' + ordinal(parseInt(f.edition)||1) + ' ed.' : ''}. ` +
        (f.city ? f.city + ': ' : '') + (f.publisher||'Publisher') + ', ' + y + '.';

    case 'conference-session':
      return `${auth}, "${t}," in <em>${f.conference||'Proceedings'}</em>, ${f.location||''}, ${y}` +
        (f.pages ? `, pp. ${f.pages}` : '') + '.';

    case 'website': case 'webpage':
      return `${auth}, "${t}," <em>${f.site_name||'Website'}</em>. [Online]. Available: ${f.url||'[URL]'}.` +
        (f.acc_year ? ` Accessed: ${f.acc_day||'01'}/${f.acc_month||'01'}/${f.acc_year}.` : '');

    case 'report':
      return `${auth}, "${t},"${f.report_number ? ' Rep. ' + f.report_number + ',' : ''} ${f.institution||f.publisher||'Publisher'}, ${y}.`;

    case 'thesis': case 'dissertation':
      return `${auth}, "${t}," ${type==='dissertation'?'Ph.D. dissertation':'M.S. thesis'}, ${f.institution||'Institution'}, ${y}.`;

    case 'software':
      return `${auth}, <em>${t}</em>${f.version ? ' (version ' + f.version + ')' : ''}. [Software]. ${f.publisher||''}, ${y}.` +
        (f.url ? ` Available: ${f.url}` : '');

    case 'patent':
      return `${auth}, "${t}," ${f.patent_number||'Patent XXXXXXX'}, ${f.pub_month||''}. ${f.pub_day||''}, ${y}.`;

    default:
      return `${auth}, "${t},"${f.url ? ' [Online]. Available: ' + f.url : ''}, ${y}.`;
  }
}

// ─── Start / Export ───────────────────────────────────────────────────────────

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`CiteGen API running on http://localhost:${PORT}`));
}


// ─── Extended style support & in-text variants overrides ─────────────────────

function stripHtmlTags(str = '') {
  return String(str).replace(/<[^>]+>/g, '');
}

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

function maybePeriod(str = '') {
  return str && /[.!?]$/.test(str.trim()) ? str.trim() : (str ? str.trim() + '.' : '');
}

function editionText(value = '', style = 'generic') {
  if (!value) return '';
  if (/ed\.?$/i.test(value) || /edition/i.test(value)) return value;
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) {
    if (style === 'ama') return `${ordinal(n)} ed.`;
    return `${ordinal(n)} ed.`;
  }
  return value;
}

function normalizePageRange(pages = '', style = 'generic') {
  if (!pages) return '';
  return style === 'ama' ? pages.replace(/–/g, '-').replace(/\s+/g, '') : pages.replace(/-/g, '–');
}

function isoDateFromFields(f = {}) {
  if (!f.pub_year) return '';
  const month = (f.pub_month || '01').padStart(2, '0');
  const day = (f.pub_day || '01').padStart(2, '0');
  return `${f.pub_year}-${month}-${day}`;
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

function toSuperscriptNumber(n) {
  return String(n).split('').map(d => ({'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'})[d] || d).join('');
}

function authorLeadForNarrative(contributors = []) {
  const valid = contributors.filter(c => c.family?.trim());
  if (!valid.length) return 'Author';
  if (valid.length === 1) return valid[0].family;
  if (valid.length === 2) return `${valid[0].family} and ${valid[1].family}`;
  return `${valid[0].family} et al.`;
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
  if (style === 'ieee') {
    return {
      primary: { label: 'Bracketed', value: `[${citationNumber}]` },
      secondary: { label: 'Superscript', value: toSuperscriptNumber(citationNumber) }
    };
  }
  if (style === 'acs') {
    return {
      primary: { label: 'Superscript', value: toSuperscriptNumber(citationNumber) },
      secondary: { label: 'Parenthetical', value: `(${citationNumber})` }
    };
  }
  if (style === 'ama') {
    return {
      primary: { label: 'Superscript', value: toSuperscriptNumber(citationNumber) },
      secondary: { label: 'Bracketed', value: `[${citationNumber}]` }
    };
  }
  return { primary: { label: 'In-text', value: '' }, secondary: { label: '', value: '' } };
}

function formatIntext(style, contributors, fields, citationNumber = 1) {
  return formatIntextVariants(style, contributors, fields, citationNumber)?.primary?.value || '';
}

function formatContributorList(contribs, style) {
  if (style === 'acs') return formatAuthorsForACS(contribs);
  if (style === 'ama') return formatAuthorsForAMA(contribs);
  return (function originalFormatContributorList(contribs, style) {
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
    if (style === 'ieee') {
      return valid.map(c => `${ini(c)}${midIni(c) ? ' '+midIni(c) : ''} ${c.family}`.trim()).join(', ');
    }
    return valid[0].family;
  })(contribs, style);
}

function formatCitation(style, sourceType, contributors, fields) {
  const authors = getContribsByRole(contributors, ['Author','Uploader']);
  const authStr = formatContributorList(authors, style) || '[Author]';
  const t = fields.title || '[Title]';
  const y = pubDateStr(fields) || 'n.d.';
  const formatters = {
    apa: apaFormat,
    mla: mlaFormat,
    chicago: chicagoFormat,
    ieee: ieeeFormat,
    acs: acsFormat,
    ama: amaFormat
  };
  const fn = formatters[style];
  if (!fn) return '';
  return fn(sourceType, authStr, t, y, fields, contributors);
}

function acsFormat(type, auth, t, y, f, contributors) {
  const cleanDoi = (f.doi || '').replace(/^https?:\/\/doi\.org\//i, '');
  const doi = cleanDoi ? ` DOI: ${cleanDoi}.` : '';
  const url = f.url && !cleanDoi ? ` ${f.url}` + (f.acc_year ? ` (accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}).` : '.') : '';
  const year = f.pub_year || y;
  const pages = normalizePageRange(f.pages, 'acs');
  const bookEd = editionText(f.edition, 'acs');
  const patentDate = isoDateFromFields(f);
  switch (type) {
    case 'journal-article':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${f.journal ? `<em>${f.journal}</em> ` : ''}${year}` +
        (f.volume ? `, ${f.volume}` : '') +
        (f.issue ? ` (${f.issue})` : '') +
        (pages ? `, ${pages}` : '') + '.' + doi + (doi ? '' : url);
    case 'textbook': case 'print-dictionary-entry': case 'print-encyclopedia-entry':
      return `${auth}. <em>${titleCase(t)}</em>` + (bookEd ? `, ${bookEd}` : '') + `; ${f.publisher || '[Publisher]'}` + (f.city ? `: ${f.city}` : '') + `, ${year}.`;
    case 'thesis': case 'dissertation':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${type === 'dissertation' ? 'Ph.D. Thesis' : 'Thesis'}, ${f.institution || 'Institution'}, ${year}.`;
    case 'website': case 'webpage': case 'press-release':
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (f.site_name ? ` ${f.site_name}.` : '') + (year ? ` ${year}.` : '') + (f.url ? ` ${f.url}` : '') + (f.acc_year ? ` (accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}).` : '');
    case 'dataset':
      return `${auth}. ${sentenceCase(t)}.` + (f.publisher ? ` ${f.publisher}.` : '') + (cleanDoi ? ` DOI: ${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    case 'patent':
      return `${auth}. ${sentenceCase(t)}. ${(f.publisher || 'U.S.')} Patent ${f.patent_number || 'XXXXXXX'}, ${patentDate || year}.`;
    case 'video':
      return `${auth}. ${titleCase(t)} [Video].` + (f.channel ? ` ${f.channel}.` : '') + (f.url ? ` ${f.url}` : '') + (f.acc_year ? ` (accessed ${monthName(f.acc_month)} ${parseInt(f.acc_day || '1', 10)}, ${f.acc_year}).` : '.');
    case 'conference-session':
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (f.conference ? ` ${f.conference};` : '') + (year ? ` ${year};` : '') + (f.location ? ` ${f.location};` : '') + (pages ? ` pp ${pages}.` : '.');
    case 'report':
      return `${auth}. <em>${titleCase(t)}</em>` + (f.report_number ? `; Report ${f.report_number}` : '') + `; ${f.institution || f.publisher || 'Publisher'}, ${year}.` + (cleanDoi ? ` DOI: ${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    default:
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (cleanDoi ? ` DOI: ${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
  }
}

function amaFormat(type, auth, t, y, f, contributors) {
  const cleanDoi = (f.doi || '').replace(/^https?:\/\/doi\.org\//i, '');
  const pages = normalizePageRange(f.pages, 'ama');
  const bookEd = editionText(f.edition, 'ama');
  const access = accessDateLong(f);
  const fullDate = fullPubDateAMA(f);
  switch (type) {
    case 'journal-article':
      return `${auth}. ${maybePeriod(sentenceCase(t))} ${f.journal ? `<em>${f.journal}</em>. ` : ''}${y}` +
        (f.volume ? `;${f.volume}` : '') +
        (f.issue ? `(${f.issue})` : '') +
        (pages ? `:${pages}` : '') + '.' +
        (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    case 'textbook': case 'print-dictionary-entry': case 'print-encyclopedia-entry':
      return `${auth}. <em>${titleCase(t)}</em>` + (bookEd ? ` ${bookEd}` : '') + `. ` + (f.city ? `${f.city}: ` : '') + `${f.publisher || '[Publisher]'}; ${y}.`;
    case 'thesis': case 'dissertation':
      return `${auth}. ${sentenceCase(t)} [` + (type === 'dissertation' ? 'dissertation' : 'thesis') + `]. ${f.institution || 'Institution'}; ${y}.`;
    case 'website': case 'webpage': case 'press-release':
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (fullDate ? ` Published ${fullDate}.` : '') + (access ? ` Accessed ${access}.` : '') + (f.url ? ` ${f.url}.` : '');
    case 'dataset':
      return `${auth}. ${sentenceCase(t)}.` + (f.publisher ? ` ${f.publisher}.` : '') + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    case 'patent':
      return `${auth}. ${sentenceCase(t)}. ${(f.publisher || 'U.S.')} Patent ${f.patent_number || 'XXXXXXX'}. ${fullDate || y}.`;
    case 'video':
      return `${auth}. ${sentenceCase(t)} [video].` + (access ? ` Accessed ${access}.` : '') + (f.url ? ` ${f.url}.` : '');
    case 'conference-session':
      return `${auth}. ${maybePeriod(sentenceCase(t))} In: ${f.conference || 'Conference proceedings'}.` + (y ? ` ${y}` : '') + (pages ? `:${pages}` : '') + '.';
    case 'report':
      return `${auth}. <em>${sentenceCase(t)}</em>.` + (f.institution || f.publisher ? ` ${f.institution || f.publisher};` : '') + ` ${y}.` + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
    default:
      return `${auth}. ${maybePeriod(sentenceCase(t))}` + (cleanDoi ? ` doi:${cleanDoi}.` : (f.url ? ` ${f.url}.` : ''));
  }
}
