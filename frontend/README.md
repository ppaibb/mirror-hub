# Gua CR Frontend

Static landing page for `https://cr.gua.cx/`.

## Build

```bash
npm install
npm run build
```

The static output is generated into `out/` because `next.config.ts` uses `output: 'export'`.

## Deploy notes

- Serve `out/` with nginx for `https://cr.gua.cx/`.
- Keep registry routes such as `/v2/` routed to crproxy before the static `location /` fallback.
- `dhub.gua.cx` should remain a Docker Hub mirror endpoint, not this frontend.
