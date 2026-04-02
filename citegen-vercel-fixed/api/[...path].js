const { handler } = require('../netlify/functions/api');

module.exports = async (req, res) => {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const rawUrl = `${proto}://${host}${req.url}`;
    const parsed = new URL(rawUrl);

    const event = {
      httpMethod: req.method,
      headers: req.headers,
      rawUrl,
      path: parsed.pathname,
      rawQuery: parsed.search ? parsed.search.slice(1) : '',
      body: req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))
    };

    const result = await handler(event);
    const headers = result && result.headers ? result.headers : {};

    res.status(result && result.statusCode ? result.statusCode : 200);
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined) res.setHeader(key, value);
    });

    const contentType = String(headers['Content-Type'] || headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      return res.send(result && typeof result.body === 'string' ? result.body : JSON.stringify(result?.body ?? {}));
    }

    return res.send(result && result.body !== undefined ? result.body : '');
  } catch (err) {
    return res.status(500).json({
      error: 'Function error',
      detail: err && err.message ? err.message : String(err)
    });
  }
};
