# GUA Hub 前端

这是 `mirror-hub` 的推荐前端，基于 Next.js 静态导出。

功能：

- 镜像地址转换
- Docker daemon 配置说明
- containerd 配置说明
- 服务状态页
- 使用边界说明

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

静态产物输出到：

```text
out/
```

## 部署

将 `out/` 目录部署到 nginx 静态目录。

注意：nginx 中 `/v2/` 需要优先反代到 crproxy，不能被静态前端路由接管。

示例：

```nginx
location /v2/ {
    proxy_pass http://crproxy_path_backend;
}

location / {
    root /opt/mirror-hub-frontend/current;
    try_files $uri $uri/ /index.html;
}
```

## 状态页

可选环境变量：

```bash
NEXT_PUBLIC_UPTIME_ROBOT_API_KEYS=key1,key2
```

注意：`NEXT_PUBLIC_*` 会暴露到浏览器端。如果不希望暴露 UptimeRobot key，建议服务器定时生成静态 `status.json`，前端只读取该文件。
