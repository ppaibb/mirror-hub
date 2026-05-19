# crproxy deployment notes

This repository does not vendor crproxy. Use upstream images from DaoCloud crproxy and bind them to loopback/private ports, then expose them through nginx/caddy.

Example conceptual compose file:

```yaml
services:
  crproxy-path:
    image: ghcr.io/daocloud/crproxy/crproxy:v0.9.1
    container_name: crproxy-path
    restart: unless-stopped
    ports:
      - "127.0.0.1:18080:8080"
    environment:
      # Configure according to upstream crproxy docs.
      # This service is intended for path-style multi-registry access.
      - TZ=Asia/Shanghai

  crproxy-dhub:
    image: ghcr.io/daocloud/crproxy/crproxy:v0.9.1
    container_name: crproxy-dhub
    restart: unless-stopped
    ports:
      - "127.0.0.1:18081:8080"
    environment:
      # Configure according to upstream crproxy docs.
      # This service is intended for Docker Hub mirror access.
      - TZ=Asia/Shanghai
```

Check upstream crproxy examples for the exact environment variables and mode flags suitable for your version.

Operational recommendation:

- Keep public `80/443` on system nginx/caddy.
- Bind crproxy containers to `127.0.0.1` or private IPs.
- Route `/v2/` paths before frontend static routes.
- Add rate limits and access control for public deployments.
