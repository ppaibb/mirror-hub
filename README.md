# mirror-hub

基于 `crproxy` 的自托管容器镜像加速服务，包含：

- 多源镜像代理（Docker Hub / GHCR / Quay.io）
- Docker / containerd 使用文档
- 静态前端说明页
- 服务状态页

## 目录结构

- `/docker-compose.yml`：一键启动 `crproxy + nginx`。
- `/config/registrymap.json`：多源镜像映射配置。
- `/web/index.html`：前端文档页。
- `/web/status.html`：服务状态页（探测 `/api/healthz`、`/api/help`）。

## 快速开始

```bash
docker compose up -d
```

启动后访问：

- 镜像代理入口：`http://<host>:5000`
- 文档首页：`http://<host>:8080`
- 状态页：`http://<host>:8080/status.html`

## 多源镜像映射

`config/registrymap.json` 默认配置：

```json
{
  "default": "https://registry-1.docker.io",
  "docker": "https://registry-1.docker.io",
  "ghcr": "https://ghcr.io",
  "quay": "https://quay.io"
}
```

## Docker 配置示例

编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": ["http://<host>:5000"],
  "insecure-registries": ["<host>:5000"]
}
```

然后重启 Docker。

## containerd 配置示例

编辑 `/etc/containerd/certs.d/docker.io/hosts.toml`：

```toml
server = "https://registry-1.docker.io"

[host."http://<host>:5000"]
  capabilities = ["pull", "resolve"]
  skip_verify = true
```

然后重启 containerd。
