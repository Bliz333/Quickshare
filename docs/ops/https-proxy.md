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

    # Max upload size — match application-prod.yml spring.servlet.multipart.max-file-size
    client_max_body_size 2G;

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

    # WebSocket for Quick Transfer signaling
    location /ws/transfer {
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

The certbot systemd timer handles renewal; verify the timer and nginx reload behavior on the target host.

## Notes

- Replace `your.domain.example` throughout with your actual domain.
- `client_max_body_size 2G` must not exceed the production profile's `spring.servlet.multipart.max-file-size` / `max-request-size` without an intentional application configuration change.
- `/ws/quickdrop` remains a legacy application alias. New proxies and clients should use `/ws/transfer`.
- If a TURN server is also exposed, open its configured UDP/TCP/TLS ports separately; nginx's HTTP proxy does not proxy TURN/UDP.
