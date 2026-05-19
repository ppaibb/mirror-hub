# nginx 反向代理示例

这个示例使用系统级 nginx 作为公网入口：

- `cr.example.com/` 服务静态前端
- `cr.example.com/v2/` 反代到多源 crproxy
- `dhub.example.com/v2/` 反代到 Docker Hub mirror crproxy
- `dhub.example.com/` 跳转到 `cr.example.com/`

请按实际情况替换：

- `cr.example.com`
- `dhub.example.com`
- TLS 证书路径
- crproxy 后端端口
- 静态前端目录

```nginx
upstream crproxy_path_backend {
    server 127.0.0.1:18080;
}

upstream crproxy_dhub_backend {
    server 127.0.0.1:18081;
}

server {
    listen 80;
    server_name cr.example.com dhub.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cr.example.com;

    ssl_certificate /etc/letsencrypt/live/cr.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cr.example.com/privkey.pem;

    # Registry API 必须优先匹配，不能被静态前端吞掉。
    location /v2/ {
        proxy_pass http://crproxy_path_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 900;
        proxy_send_timeout 900;
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

    ssl_certificate /etc/letsencrypt/live/dhub.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dhub.example.com/privkey.pem;

    location /v2/ {
        proxy_pass http://crproxy_dhub_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 900;
        proxy_send_timeout 900;
        proxy_request_buffering off;
        client_max_body_size 0;
    }

    location / {
        return 302 https://cr.example.com$request_uri;
    }
}
```

## 多后端示例

如果有多台 crproxy 后端，可以加 upstream：

```nginx
upstream crproxy_path_backend {
    ip_hash;
    server 127.0.0.1:18080;
    server 10.0.0.91:18080;
}
```

可配合：

```nginx
proxy_next_upstream error timeout http_502 http_503 http_504;
```

实现简单故障转移。严格高可用建议使用带健康检查的负载均衡。
