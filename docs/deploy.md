# Chatwerk: deploy to vps-main

Status 2026-10-10: deployed at https://chatwerk.woutkonings.com. The code is a checkout of the public repo https://github.com/woutkonings/chatwerk in `/root/chatwerk` on vps-main.

This procedure follows the vps-main runbook (`~/personal_repos/personal-life/vps-main/RUNBOOK.md`, section "Deploy a new project"). Read the runbook first. The server uses nginx and certbot, not Caddy.

## 1. Decisions

| Decision | Choice |
|---|---|
| Subdomain | `chatwerk.woutkonings.com` (until 2026-10-10 `dj-gen.woutkonings.com`; that name is gone) |
| Code on the server | A git checkout of the public repo in `/root/chatwerk`. Keep this folder name: Docker names the data volume after it. The repo is public (AGPL), so the server pulls over HTTPS and needs no deploy key. |
| API key | The same key as the local `.env` ("Wout's Individual Org"). |
| Daily model budget | The default, 1 dollar (`MUSIC_CHAT_DAILY_USD`). One turn costs about 0.0003 to 0.001 dollars, so this allows about 1,000 to 3,000 turns per day. |
| Local port | `8787` on `127.0.0.1`. |

## 2. Steps

1. **DNS.** In Namecheap, add an A record `chatwerk` with the value `162.55.164.152`. Wait until `dig +short chatwerk.woutkonings.com` gives that address.
2. **Backup.** The change only adds a container and an nginx site, so a manual backup is optional. Hetzner makes a daily backup.
3. **Code.** On the server: `git clone https://github.com/woutkonings/chatwerk.git /root/chatwerk`.
4. **Secrets.** Copy the local `.env` to the server, readable only by root. From the repo folder on your computer:
   ```
   ssh vps 'umask 077 && cat > /root/chatwerk/.env' < .env
   ```
5. **Start.** On the server: `cd /root/chatwerk && docker compose up -d --build`. The compose file publishes the port on `127.0.0.1` only and sets `restart: unless-stopped`. The SQLite file is in the Docker volume `chatwerk_music-chat-data`.
6. **Check the container.** `curl -s 127.0.0.1:8787/api/health` must give `{"ok":true,...}`.
7. **nginx.** Write `/etc/nginx/sites-available/chatwerk.woutkonings.com` with the configuration below. Then:
   ```
   ln -s /etc/nginx/sites-available/chatwerk.woutkonings.com /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```
8. **HTTPS.** Run `certbot --nginx -d chatwerk.woutkonings.com`.
9. **Security headers.** Add `include snippets/security-headers.conf;` to the HTTPS server block. The snippet sets no Content-Security-Policy, so it does not conflict with the CSP of the app. If the snippet ever gets a CSP, leave it out for this site: two CSP headers both apply, and the stricter one blocks the audio worklets or the samples.
10. **Check.** From your computer: `curl -I https://chatwerk.woutkonings.com`. Open the site, start a room, press Play and ask the band for a groove. Check that the AudioWorklets load (over HTTPS, all effects work).
11. **Notes.** Add the site to "What runs" in the vps-main README. Commit and push that repo.

## 3. nginx configuration

The WebSocket path needs the upgrade headers. The client sends a ping every 20 seconds, so the default timeouts are enough, but a long read timeout does no harm.

```
server {
    listen 80;
    server_name chatwerk.woutkonings.com;

    # The shared snippet sets these two headers, so drop the copies from the app.
    proxy_hide_header X-Content-Type-Options;
    proxy_hide_header Referrer-Policy;

    location /ws/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1h;
    }

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `Host` header must reach the app unchanged: the app accepts a WebSocket only when the `Origin` host is the same as the `Host` header, and it puts the host in the CSP `connect-src`.

## 4. Update

On the server:

Push the change to GitHub first. Then:

```
ssh vps 'cd /root/chatwerk && git pull && docker compose up -d --build'
```

The `.env` on the server is not in git, so a pull does not touch it.

## 5. Operations

- **Logs:** `docker compose logs -f music-chat`.
- **Cost:** every agent turn is in the `turns` table with its cost. For the total of today:
  ```
  docker compose exec music-chat node -e "const D=require('better-sqlite3');const d=new D('/data/music-chat.sqlite',{readonly:true});const t=new Date();t.setUTCHours(0,0,0,0);console.log(d.prepare('select count(*) n, sum(cost_usd) usd from turns where created_at>=?').get(t.getTime()))"
  ```
- **Stop the band, keep the music:** set `MUSIC_CHAT_DAILY_USD=0` in `.env` and run `docker compose up -d`.
- **Revoke the key:** in the Claude Console of the individual org. The band then answers "The band lost the thread" to every request, and the music keeps playing.
