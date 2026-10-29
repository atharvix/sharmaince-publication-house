# Deploying Nightingale on an Ubuntu Server PC

This guide puts the whole site (database, API, website) on one Ubuntu Server machine. You run it
over SSH. Visitors reach it at **your own domain over HTTPS** through a **Cloudflare Tunnel**.
The tunnel is an outgoing connection from the PC to Cloudflare, so you don't need port-forwarding,
a static IP, or open ports on the network.

```
visitor ──https──▶ Cloudflare ══tunnel══▶ this PC :8080 (nginx) ──▶ API ──▶ PostgreSQL
                  yourdomain.in            (cloudflared)
```

Run every command below **on the server**, over SSH, unless it says otherwise. Replace the
`<placeholders>` with your own values.

> **Folder name:** the commands assume the code is in `~/night-prod`. If you cloned it somewhere
> else, use that path wherever you see `~/night-prod`.

> **Network rules:** if this PC sits on a university or office network, check that you're allowed
> to host a public site from it. Network admins can block tunnels at any time.

---

## 1. Prepare the machine

If downloads are slow or keep dropping, switch to Ubuntu's mirror in India first:

```bash
sudo sed -i 's#http://archive.ubuntu.com#http://in.archive.ubuntu.com#g' /etc/apt/sources.list.d/ubuntu.sources
```

Then:

```bash
sudo apt update
sudo apt -o Acquire::Retries=5 upgrade -y --fix-missing
sudo apt -o Acquire::Retries=5 install -y git curl ufw unattended-upgrades

# Firewall: allow SSH only. Visitors arrive through the tunnel, so no web ports are opened.
sudo ufw allow OpenSSH
sudo ufw --force enable

# Install security updates automatically
sudo dpkg-reconfigure -plow unattended-upgrades

# A server must never go to sleep
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

sudo reboot
```

After the reboot, SSH back in. Also set the PC's BIOS to **power on after a power cut**
("Restore on AC power loss"). Otherwise the site stays down after any outage until someone
presses the button.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
```

If that script fails (it can lag behind brand-new Ubuntu releases like 26.04), use Ubuntu's own packages instead:

```bash
sudo apt install -y docker.io docker-compose-v2
```

Then, either way:

```bash
sudo usermod -aG docker $USER
```

Log out and SSH back in so the `docker` group takes effect, then check it:

```bash
docker run --rm hello-world
docker compose version
```

## 3. Get the code onto the server

```bash
git clone -b production-hardening https://github.com/atharvix/sharmaince-publication-house.git ~/night-prod
```

**No GitHub access?** Copy it straight from your laptop instead. Run the first two commands **on the laptop**, inside the project folder:

```bash
git bundle create nightingale.bundle production-hardening
scp nightingale.bundle <user>@<server-ip>:~
```

Then on the server:

```bash
git clone -b production-hardening ~/nightingale.bundle ~/night-prod
```

## 4. Install cloudflared and check the network allows it

GitHub is usually reachable even on restricted networks, so download it from there:

```bash
curl -fL --retry 5 -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

Quick test, which needs no account or domain:

```bash
cloudflared tunnel --protocol http2 --url http://localhost:8080
```

- **It works** if you see a box containing an `https://….trycloudflare.com` address. Press Ctrl+C and carry on.
- **It's blocked** if it keeps logging connection errors. This network won't allow hosting, so you'd
  need a different connection or a small cloud server.

`--protocol http2` sends the tunnel over ordinary HTTPS (port 443), which restrictive networks
usually allow. The permanent tunnel in step 6 uses the same setting.

## 5. Buy a domain and add it to Cloudflare

1. **Buy the domain.**
   - A `.com` can be bought on **Cloudflare Registrar** at cost, and is then already on Cloudflare.
   - A `.in` (Cloudflare doesn't sell these) can come from GoDaddy, Hostinger, Namecheap or BigRock.
   - Check the **renewal** price, not just the first-year deal. Skip add-ons like "SSL", "hosting" and "privacy": Cloudflare covers HTTPS for free.
2. **Create a free Cloudflare account** at https://dash.cloudflare.com → **Add a domain** → choose the **Free** plan.
3. Cloudflare shows you **two nameservers**. In your registrar's dashboard, replace the domain's
   nameservers with those two. You can skip this if you bought it on Cloudflare.
4. Wait until Cloudflare shows the domain as **Active**. That's usually under an hour, occasionally up to a day.

From here on, `<SITE_URL>` means `https://yourdomain.in`, or `https://www.yourdomain.in` if you use `www`.

## 6. Create the permanent tunnel

1. In Cloudflare: **Zero Trust → Networks → Tunnels → Create a tunnel** → choose **Cloudflared** → name it `nightingale`.
2. On the "Install connector" screen, choose **Debian** and copy the command that looks like
   `sudo cloudflared service install eyJ…`. Run it on the server. This installs the tunnel as a service that starts on every boot.
3. Make it use ordinary HTTPS (port 443), then restart it:

   ```bash
   sudo mkdir -p /etc/systemd/system/cloudflared.service.d
   printf '[Service]\nEnvironment=TUNNEL_TRANSPORT_PROTOCOL=http2\n' | sudo tee /etc/systemd/system/cloudflared.service.d/protocol.conf
   sudo systemctl daemon-reload && sudo systemctl restart cloudflared
   systemctl status cloudflared --no-pager | head -5     # should say "active (running)"
   ```

4. Back in the dashboard, the tunnel should show as **Healthy**. Open its **Public Hostname** tab → **Add a public hostname**:
   - **Subdomain:** leave blank (or `www`)
   - **Domain:** your domain
   - **Service type:** `HTTP`, **URL:** `localhost:8080`
5. In Cloudflare → your domain → **SSL/TLS → Edge Certificates**, turn on **Always Use HTTPS**.

## 7. Create the production settings file

```bash
cd ~/night-prod/server
cp .env.example .env
nano .env
```

Set these values. Anything not listed can stay as it is in the example.

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `<SITE_URL>` (exactly, no trailing slash) |
| `PUBLIC_WEB_URL` | `<SITE_URL>` |
| `TRUST_PROXY` | `2` (Cloudflare and nginx are the two proxies in front of the API) |
| `JWT_ACCESS_SECRET` | output of `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | a **different** `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | add this line, with the output of `openssl rand -hex 24` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys (test keys are fine to start) |
| `RAZORPAY_WEBHOOK_SECRET` | a random string you choose; you'll enter the same one in Razorpay (step 10) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | your email provider (see below) |
| `EMAIL_FROM` | e.g. `Nightingale Academic Press <orders@yourdomain.in>` |

You can delete the `DATABASE_URL` line. Docker builds the database address from `POSTGRES_PASSWORD`.

**Email on your domain:**
- **Sending** (order confirmations, password resets): add your domain to **Brevo** (free tier) and
  follow its DNS steps (it gives you records to add in Cloudflare). Then use host
  `smtp-relay.brevo.com`, port `587`, and the login and SMTP key from its dashboard.
- **Receiving** at `orders@yourdomain.in`: Cloudflare → your domain → **Email → Email Routing**
  can forward it to your Gmail for free.
- **No domain email yet?** Gmail also works for sending: host `smtp.gmail.com`, port `587`,
  user = your Gmail address, password = an [App Password](https://myaccount.google.com/apppasswords)
  (needs 2-step verification on). It's more likely to land in spam.

Lock the file down. It holds your secrets:

```bash
chmod 600 .env
```

> The API **refuses to start** in production if a Razorpay key, the webhook secret or SMTP is
> missing, if the JWT secrets are short or identical, or if `PUBLIC_WEB_URL` isn't `https://`.
> That's on purpose. If it won't start, step 11 shows how to see exactly which setting is wrong.

## 8. Start everything

```bash
cd ~/night-prod/server
docker compose up -d --build
```

The first build takes a few minutes. Then check it:

```bash
docker compose ps                         # postgres, api and web should be "Up"; migrate "Exited (0)"
curl -s localhost:8080/api/ready          # {"status":"ready"}
```

Now open `<SITE_URL>` on your phone, on mobile data, to confirm it's reachable from outside.

## 9. Add content and your admin account

**Optional sample catalogue.** This loads the 12 sample books, the subjects and the FAQs. Skip it
if you'll enter your real books through the admin. In production it never creates demo logins.

```bash
docker compose run --rm tools npm run prisma:seed
```

**Create your administrator.** The password is typed at a hidden prompt, so it never lands in your shell history:

```bash
read -rp "Admin email: " ADMIN_EMAIL; read -rp "Admin name: " ADMIN_NAME; read -rsp "Admin password: " ADMIN_PASSWORD; echo
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
docker compose run --rm -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD tools npm run create-admin
unset ADMIN_PASSWORD
```

The password needs 8+ characters with an uppercase letter, a lowercase letter and a number. Then
sign in at `<SITE_URL>/login`, which takes you to the admin workspace.

## 10. Connect Razorpay

In the Razorpay Dashboard → **Settings → Webhooks → Add new webhook**:

- **URL:** `<SITE_URL>/api/payments/webhook`
- **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET` in your `.env`
- **Events:** `payment.captured` and `payment.failed`

Before taking real money:
- **Test first.** Use Razorpay **test** keys and place an order with a test card. Check that it
  shows as Paid in the admin and that the confirmation email arrives.
- **Go live.** Razorpay must approve your business (KYC) and website before it issues live keys.
  Make sure the site's About, Contact, Shipping, Returns, Privacy and Terms pages have real
  details first; reviewers check them. Then put the live keys in `.env` and run `docker compose up -d` again.

## 11. Day-to-day operation

**See what's happening:**

```bash
cd ~/night-prod/server
docker compose ps
docker compose logs -f api        # live API logs (Ctrl+C to stop)
docker compose logs --tail 50 migrate
systemctl status cloudflared --no-pager
```

**Ship an update:**

```bash
cd ~/night-prod
git pull                          # or copy over a fresh bundle, as in step 3
cd server && docker compose up -d --build
```

Database migrations run automatically before the new API starts.

**Restart or stop:** `docker compose restart` / `docker compose down`. Your data is kept in
Docker volumes. Never add `-v` to `down`: that deletes the database.

## 12. Backups (do this on day one)

The database and the uploaded cover images live on this one PC. Back them up nightly:

```bash
mkdir -p ~/backups
crontab -e
```

Add this line. It runs at 02:30 every night and keeps 14 days of backups:

```
30 2 * * * cd ~/night-prod/server && docker compose exec -T postgres pg_dump -U nightingale nightingale | gzip > ~/backups/db-$(date +\%F).sql.gz && docker run --rm -v server_uploads_data:/u -v ~/backups:/b alpine tar czf /b/uploads-$(date +\%F).tgz -C /u . && find ~/backups -mtime +14 -delete
```

Copy `~/backups` somewhere else regularly (another computer, Google Drive). A backup that lives
on the same disk dies with that disk.

**Restore a database backup:**

```bash
gunzip -c ~/backups/db-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U nightingale nightingale
```

## Troubleshooting

| Symptom | Check |
|---|---|
| `api` keeps restarting | `docker compose logs api`. An "Invalid environment configuration" line names the bad setting. |
| Site loads but every page shows errors | `CORS_ORIGIN` and `PUBLIC_WEB_URL` must exactly match `<SITE_URL>` (https, same `www` or not, no trailing slash) |
| Cloudflare error 1033 / "tunnel not found" | `systemctl status cloudflared`; `sudo journalctl -u cloudflared -n 50` |
| Cloudflare error 502 | The tunnel works but the site isn't answering: `docker compose ps`, `curl localhost:8080/api/ready` |
| Domain doesn't load at all | Cloudflare still shows the domain as "Pending" (nameservers not changed yet), or the Public Hostname is missing |
| Downloads time out (`apt`, `curl`) | Flaky network. Retry, use the India mirror (step 1), or check the cable/Wi-Fi |
| Payments stay "Pending" | Razorpay → Webhooks shows delivery attempts and responses; check the URL and secret |
| No emails | `docker compose logs api \| grep -i mail`, and check the SMTP login |

## Known limits of this setup

- **One machine, one copy.** If the PC or its internet goes down, so does the site. Backups (step 12) are your safety net.
- **Home or campus upload speed** limits how fast pages and cover images load for visitors.
- **Moving later is easy.** If you outgrow this PC, the same `docker compose` setup runs on any
  cloud server. Install cloudflared there with the same tunnel token, and the domain and settings stay the same.
