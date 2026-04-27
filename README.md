# Wyatt’s NYC Recs

A static, mobile-friendly NYC recommendations map/list for visiting friends.

Deploy target:

```text
https://nyc-recs.w4w.dev
```

## Structure

```text
NYC-recs/
├── assets/
│   ├── app.js
│   └── styles.css
├── data/
│   └── recs.json
├── .gitignore
├── DEPLOYMENT.md
├── README.md
├── index.html
└── vercel.json
```

## Local preview

No build step is required.

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

## Deploy summary

```bash
npx vercel@latest link --yes --project nyc-recs
npx vercel@latest deploy --prod --yes
npx vercel@latest domains add nyc-recs.w4w.dev nyc-recs || true
npx vercel@latest domains inspect nyc-recs.w4w.dev
```

Then configure Cloudflare DNS:

```text
CNAME nyc-recs -> cname.vercel-dns.com
```

Keep the Cloudflare record DNS-only while Vercel verifies the domain. See `DEPLOYMENT.md` for the full flow.
