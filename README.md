# mirror-hub

`mirror-hub` 是一个基于 [DaoCloud crproxy](https://github.com/DaoCloud/crproxy) 的自托管容器镜像加速方案。

它包含两部分：

- **crproxy 后端**：提供 Docker Registry v2 协议代理能力，支持 Docker Hub、GHCR、Quay.io 等镜像源。
- **静态前端页面**：提供镜像地址转换、Docker/containerd 配置说明、服务状态页和使用边界说明。

这个仓库的目标不是重新实现一个 registry proxy，而是把 crproxy、nginx 前门、静态文档页和常见部署方式整理成一套可复用项目。

## 公开可用地址

当前已部署一组公开可用的 GUA Hub 镜像加速入口：

```text
文档首页：      https://cr.gua.cx/
多源镜像入口：  cr.gua.cx
Docker Hub 镜像：dhub.gua.cx
状态页面：      https://cr.gua.cx/status
```

可直接使用以下命令测试：

```bash
# 多源 path-style 入口
docker pull cr.gua.cx/docker.io/library/nginx:latest
docker pull cr.gua.cx/ghcr.io/owner/image:tag
docker pull cr.gua.cx/quay.io/org/image:tag

# Docker Hub 专用入口
docker pull dhub.gua.cx/library/nginx:latest
```

Docker daemon 可将 Docker Hub mirror 配置为：

```json
{
  "registry-mirrors": ["https://dhub.gua.cx"]
}
```

注意：这是公开自用/共享服务，适合公开镜像加速、临时拉取和低频使用；不建议作为私有镜像、敏感镜像或生产强依赖的唯一上游。

## 项目结构

```text
mirror-hub/
├── frontend/              # 当前推荐前端：Next.js 静态导出页面
├── deploy/
│   ├── nginx/             # 生产环境 nginx 前门示例
│   └── crproxy/           # crproxy 部署说明
├── docs/                  # 运维/部署文档
├── docker-compose.yml     # crproxy 后端示例，监听本机 18080/18081
├── web/                   # 早期简单静态页，仅作参考，不是推荐前端
├── config/                # 早期实验配置，仅作参考
└── README.md
```

推荐使用：

- `frontend/` 作为正式前端
- `docker-compose.yml` 启动 crproxy 后端
- `deploy/nginx/README.md` 中的 nginx 结构作为公网入口

`web/` 目录是后续 PR 带入的极简 HTML 页面，功能和视觉效果都不如 `frontend/`，暂时保留作参考，后续可以删除或归档。

## 推荐架构

```text
Internet
  |
  | HTTPS 443
  v
system nginx / caddy
  |-- cr.example.com/       -> frontend/out 静态前端
  |-- cr.example.com/v2/    -> crproxy-path，127.0.0.1:18080
  |-- dhub.example.com/     -> 跳转到 cr.example.com
  `-- dhub.example.com/v2/  -> crproxy-dhub，127.0.0.1:18081
```

推荐让系统级 nginx/caddy 占用公网 `80/443`，crproxy 容器只绑定到 `127.0.0.1` 或内网 IP。这样更方便统一 TLS、访问日志、限流、前端静态页和多服务复用。

## crproxy 后端

仓库根目录提供了一个最小示例：

```bash
docker compose up -d
```

默认会启动两个 crproxy 容器：

```text
crproxy-path  -> 127.0.0.1:18080
crproxy-dhub  -> 127.0.0.1:18081
```

两个入口用途不同：

- `crproxy-path`：多源 path-style 代理，用于 `cr.example.com/docker.io/library/nginx:latest` 这种格式。
- `crproxy-dhub`：Docker Hub 专用 mirror，用于 Docker daemon 的 `registry-mirrors`，以及 `dhub.example.com/library/nginx:latest` 这种格式。

注意：不要直接把 crproxy 容器端口暴露到公网，建议统一从 nginx/caddy 的 `/v2/` 反代进入。

## 前端构建

```bash
cd frontend
npm install
npm run build
```

因为 `frontend/next.config.ts` 使用了静态导出：

```ts
output: 'export'
```

所以构建产物在：

```text
frontend/out/
```

生产部署时，把 `frontend/out/` 发布到服务器静态目录，例如：

```bash
rsync -a frontend/out/ root@example.com:/opt/mirror-hub-frontend/releases/版本号/
ln -sfn /opt/mirror-hub-frontend/releases/版本号 /opt/mirror-hub-frontend/current
nginx -t && systemctl reload nginx
```

线上 nginx 的 `location /` 指向 `/opt/mirror-hub-frontend/current` 即可。

## nginx 公网入口

核心原则：`/v2/` 必须优先反代到 crproxy，其他路径再交给静态前端。

简化示例：

```nginx
upstream crproxy_path_backend {
    server 127.0.0.1:18080;
}

upstream crproxy_dhub_backend {
    server 127.0.0.1:18081;
}

server {
    listen 443 ssl http2;
    server_name cr.example.com;

    location /v2/ {
        proxy_pass http://crproxy_path_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        client_max_body_size 0;
    }

    location / {
        root /opt/mirror-hub-frontend/current;
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl http2;
    server_name dhub.example.com;

    location /v2/ {
        proxy_pass http://crproxy_dhub_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        client_max_body_size 0;
    }

    location / {
        return 302 https://cr.example.com$request_uri;
    }
}
```

完整示例见：

```text
deploy/nginx/README.md
```

## 使用示例

如果只是想直接使用当前公开服务，可以使用 GUA Hub 地址：

多源 path-style 入口：

```bash
docker pull cr.gua.cx/docker.io/library/nginx:latest
docker pull cr.gua.cx/ghcr.io/owner/image:tag
docker pull cr.gua.cx/quay.io/org/image:tag
```

Docker Hub 专用 mirror 入口：

```bash
docker pull dhub.gua.cx/library/nginx:latest
```

Docker daemon mirror 配置：

```json
{
  "registry-mirrors": ["https://dhub.gua.cx"]
}
```

如果是自部署，把上面的 `cr.gua.cx` / `dhub.gua.cx` 替换成自己的域名即可。

注意：不要直接覆盖已有的 `/etc/docker/daemon.json`，应手动合并配置。

配置后重启 Docker：

```bash
systemctl daemon-reload
systemctl restart docker
```

containerd 建议使用 `certs.d` / `config_path` 方式配置，具体可参考前端页面中的说明。

## 服务状态页

当前前端支持通过 UptimeRobot 获取状态信息。

可选环境变量：

```bash
NEXT_PUBLIC_UPTIME_ROBOT_API_KEYS=key1,key2
```

注意：`NEXT_PUBLIC_*` 会进入浏览器端静态 JS。公开站点如果不希望暴露 UptimeRobot key，推荐用服务器定时任务生成静态 `status.json`，前端只读取 `status.json`。

## 安全建议

- 不要把 crproxy 容器端口直接暴露到公网。
- 公网入口建议使用 nginx/caddy 统一处理 TLS、日志、限流和访问控制。
- 对公开服务建议增加速率限制，避免被滥用。
- 不要提交 Cloudflare Token、UptimeRobot Key、Docker/Registry 登录凭据。
- `crproxy` 是上游项目，本仓库只是围绕它提供部署模板和前端页面。

## 当前线上参考

GUA Hub 当前线上形态：

```text
cr.gua.cx/       -> 静态前端
cr.gua.cx/v2/    -> 多源 crproxy
dhub.gua.cx/     -> 跳转到 cr.gua.cx
dhub.gua.cx/v2/  -> Docker Hub mirror
```

## License

MIT。上游项目和依赖仍遵循各自许可证。
