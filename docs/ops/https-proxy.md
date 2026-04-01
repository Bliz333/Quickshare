# HTTPS / Reverse Proxy Setup

QuickShare listens on port 8080 (HTTP). For production, place nginx in front to terminate TLS.

## nginx configuration

```nginx
server {
    listen 80;
    server_name your.domain.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your.domain.example;

    ssl_certificate     /etc/letsencrypt/live/your.domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.example/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Max upload size — match application.yml spring.servlet.multipart.max-file-size
    client_max_body_size 10G;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for large file uploads / downloads
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 10s;
    }

    # WebSocket for QuickDrop signalling
    location /ws/quickdrop {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

## Let's Encrypt / Certbot

```bash
# Install certbot (Debian/Ubuntu)
apt install -y certbot python3-certbot-nginx

# Obtain and install certificate
certbot --nginx -d your.domain.example

# Auto-renewal is handled by the certbot systemd timer — verify:
systemctl status certbot.timer
```

Certificates auto-renew every 60 days. The nginx plugin reloads nginx automatically after renewal.

## Notes

- Replace `your.domain.example` throughout with your actual domain.
- `client_max_body_size 10G` must match the application's `spring.servlet.multipart.max-file-size` / `max-request-size`.
- If QuickDrop TURN server is also exposed, open UDP 3478 (STUN/TURN) and TCP 5349 (TURN-TLS) in the firewall separately — nginx does not proxy UDP.
