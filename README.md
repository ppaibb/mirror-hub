# mirror-hub

Self-hosted container registry mirror hub powered by [DaoCloud crproxy](https://github.com/DaoCloud/crproxy), with a modern static frontend, usage docs, and a service-status page.

`mirror-hub` 是一个可自托管的容器镜像加速入口方案：底层使用 crproxy 代理 Docker Hub、GHCR、Quay.io 等镜像源，前端提供镜像地址转换、Docker/containerd 配置说明、服务状态展示和使用边界说明。

## Features

- Multi-registry path proxy, e.g. `cr.example.com/docker.io/library/nginx:latest`
- Docker Hub mirror endpoint, e.g. `dhub.example.com/library/nginx:latest`
- Modern static frontend built with Next.js static export
- Image address converter for common registries
- Docker daemon and containerd configuration docs
- Optional UptimeRobot-based status page
- Shared front-door nginx layout: keep system nginx on `80/443`, bind crproxy backends to loopback/private ports

## Recommended architecture

```text
Internet
  |
  |  HTTPS 443
  v
system nginx / caddy
  |-- cr.example.com/       -> static frontend
  |-- cr.example.com/v2/    -> crproxy path backend, e.g. 127.0.0.1:18080
  |-- dhub.example.com/     -> redirect to frontend docs
  `-- dhub.example.com/v2/  -> crproxy Docker Hub backend, e.g. 127.0.0.1:18081
```

The live GUA Hub deployment uses this pattern so application containers do not occupy public `80/443` directly.

## Repository layout

```text
frontend/        Next.js static frontend
部署/nginx?      See deploy/nginx for reverse-proxy examples
deploy/crproxy/  crproxy compose examples and notes
docs/            operational docs
scripts/         helper scripts
```

## Quick start: frontend

```bash
cd frontend
npm install
npm run build
```

The static output is generated into:

```text
frontend/out/
```

Deploy `frontend/out/` to your web root, for example:

```bash
rsync -a frontend/out/ root@example.com:/opt/mirror-hub-frontend/current/
```

## Environment variables

Frontend status page can optionally call UptimeRobot directly from the browser:

```bash
NEXT_PUBLIC_UPTIME_ROBOT_API_KEYS=key1,key2
```

This value is exposed in the static JavaScript bundle. For public production sites, prefer generating a static `status.json` server-side and letting the frontend read it, to avoid API-key exposure, CORS issues, and rate limits.

## Image usage examples

Path-style multi-registry entry:

```bash
docker pull cr.example.com/docker.io/library/nginx:latest
docker pull cr.example.com/ghcr.io/owner/image:tag
docker pull cr.example.com/quay.io/org/image:tag
```

Docker Hub-only mirror endpoint:

```bash
docker pull dhub.example.com/library/nginx:latest
```

Docker daemon mirror:

```json
{
  "registry-mirrors": ["https://dhub.example.com"]
}
```

Do not overwrite an existing `/etc/docker/daemon.json`; merge the `registry-mirrors` field manually.

## Security and operation notes

- Do not expose crproxy backend containers directly unless you understand the risk.
- Put nginx/caddy in front for TLS, routing, logging, and rate limits.
- For public service, add access control or rate limiting if abuse becomes possible.
- Do not commit real UptimeRobot keys, Cloudflare tokens, Docker credentials, or registry credentials.
- crproxy is an upstream project; this repository packages an opinionated deployment and frontend around it.

## License

MIT, unless otherwise specified by upstream dependencies.
