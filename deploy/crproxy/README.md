# crproxy 部署说明

本仓库不内置 crproxy 源码，后端直接使用上游镜像：

```text
ghcr.io/daocloud/crproxy/crproxy:v0.9.1
```

推荐启动两个 crproxy 实例：

- `crproxy-path`：多源 path-style 入口
- `crproxy-dhub`：Docker Hub 专用 mirror 入口

## 最小 compose

仓库根目录的 `docker-compose.yml` 示例：

```yaml
version: '3.4'

services:
  crproxy-path:
    image: ghcr.io/daocloud/crproxy/crproxy:v0.9.1
    container_name: crproxy-path
    restart: unless-stopped
    ports:
      - "127.0.0.1:18080:8080"

  crproxy-dhub:
    image: ghcr.io/daocloud/crproxy/crproxy:v0.9.1
    container_name: crproxy-dhub
    restart: unless-stopped
    ports:
      - "127.0.0.1:18081:8080"
    command: |
      --default-registry=docker.io
```

启动：

```bash
docker compose up -d
```

## 为什么不直接监听 80/443？

生产环境建议把公网 `80/443` 留给系统级 nginx/caddy：

- 统一 TLS 证书
- 统一 HTTP 到 HTTPS 跳转
- 统一日志和限流
- 同一个域名下可以同时服务 `/v2/` registry API 和静态前端页面
- 避免容器和其他服务抢占公网端口

crproxy 容器只需要绑定到本机或内网端口，例如：

```text
127.0.0.1:18080 -> crproxy-path
127.0.0.1:18081 -> crproxy-dhub
```

然后由 nginx 反代：

```text
cr.example.com/v2/   -> 127.0.0.1:18080
dhub.example.com/v2/ -> 127.0.0.1:18081
```

## 两个入口的区别

### crproxy-path

用于完整 registry path：

```bash
docker pull cr.example.com/docker.io/library/nginx:latest
docker pull cr.example.com/ghcr.io/owner/image:tag
docker pull cr.example.com/quay.io/org/image:tag
```

### crproxy-dhub

使用 `--default-registry=docker.io`，适合 Docker Hub mirror：

```bash
docker pull dhub.example.com/library/nginx:latest
```

也适合作为 Docker daemon 的 registry mirror：

```json
{
  "registry-mirrors": ["https://dhub.example.com"]
}
```

## 运维建议

- 公网服务建议在 nginx/caddy 层加访问频率限制。
- 如需高可用，可以在 nginx upstream 中加入多个 crproxy 后端。
- 如需严格高可用，建议配合 Cloudflare Load Balancer 或其他带健康检查的负载均衡。
- 不建议把私有镜像凭据配置到公开服务中。
