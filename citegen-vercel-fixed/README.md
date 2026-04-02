# CiteGen — Citation Generator

Full-stack citation generator. **Frontend → Netlify. Backend → Render.**

## Local Development

```bash
npm install
npm start
# → http://localhost:3000
```

---

## Deployment (3 steps)

### Step 1 — Deploy backend to Render

1. Push this whole repo to GitHub
2. Go to render.com → New → Web Service → connect your repo
3. Render auto-detects render.yaml — click Deploy
4. Copy your live URL e.g. https://citegen-api.onrender.com

### Step 2 — Set your backend URL

Edit `public/js/config.js`, replace the placeholder:
```js
: 'https://citegen-api.onrender.com'  // ← your actual Render URL
```

### Step 3 — Deploy frontend to Netlify

Drag & drop the `public/` folder at netlify.com → Deploy manually.
OR use the Netlify CLI: `netlify deploy --dir=public --prod`

The netlify.toml is already configured. The _redirects file handles SPA routing.

---

## Structure

```
citegen/
├── public/           ← Deploy this to Netlify
│   ├── index.html
│   ├── _redirects
│   ├── css/style.css
│   └── js/
│       ├── config.js   ← SET YOUR RENDER URL HERE
│       └── app.js
├── server/
│   └── index.js      ← Runs on Render
├── netlify.toml
├── render.yaml
└── package.json
```


## Netlify deployment

This project is configured to deploy as a single Netlify site.
The static frontend is published from `public/`, and `/api/*` is routed to `netlify/functions/api.js`.
No separate Render backend is required.
