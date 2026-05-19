# nginx reverse proxy example

This example keeps nginx on public `80/443` and routes `/v2/` to crproxy before serving the static frontend.

Replace:

- `cr.example.com` with your multi-registry domain
- `dhub.example.com` with your Docker Hub mirror domain
- certificate paths with your own Let's Encrypt paths
- backend ports if your crproxy containers use different bindings

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

    # Registry API must be routed before static frontend.
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
