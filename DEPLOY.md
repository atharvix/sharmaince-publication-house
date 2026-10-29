# Deploying Nightingale on an Ubuntu Server PC

This guide puts the whole site (database, API, website) on one Ubuntu Server machine. You run it
over SSH, and visitors reach it at a free, permanent HTTPS address from **Tailscale Funnel**. You
don't need a domain or any router port-forwarding.

```
visitor ──https──▶ Tailscale Funnel ──▶ this PC :8080 (nginx) ──▶ API ──▶ PostgreSQL
                    https://<name>.<tailnet>.ts.net
```

Run every command below **on the server**, over SSH, unless it says otherwise. Replace the
`<placeholders>` with your own values.

---

## 1. Prepare the machine

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw unattended-upgrades

# Firewall: allow SSH only. The site is reached through Tailscale, so no web ports are opened.
sudo ufw allow OpenSSH
sudo ufw --force enable

# Install security updates automatically
sudo dpkg-reconfigure -plow unattended-upgrades

# A server must never go to sleep
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

Also set the PC's BIOS to **power on after a power cut** ("Restore on AC power loss").
Otherwise the site stays down after any outage until someone presses the button.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and SSH back in so the `docker` group takes effect, then check it worked:

```bash
docker run --rm hello-world
```

## 3. Get the code onto the server

Use **one** of these:

**A. From GitHub** (once the `production-hardening` branch has been pushed):

```bash
git clone -b production-hardening https://github.com/atharvix/sharmaince-publication-house.git
cd sharmaince-publication-house
```

**B. Straight from your laptop, without GitHub.** Run the first two commands **on the laptop**:

```bash
# on the laptop, inside the project folder
git bundle create nightingale.bundle production-hardening
scp nightingale.bundle <user>@<server-ip>:~
```

Then on the server:

```bash
git clone -b production-hardening ~/nightingale.bundle sharmaince-publication-house
cd sharmaince-publication-house
```

## 4. Get a public HTTPS address (Tailscale Funnel)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up            # prints a login link: open it and sign in (a free account is fine)
```

In the Tailscale admin console (https://login.tailscale.com/admin):

1. **DNS** → enable **MagicDNS** and **HTTPS Certificates**.
2. Then run this on the server. The first time, it prints a link that enables Funnel for the machine:

```bash
sudo tailscale funnel --bg 8080
tailscale funnel status      # shows your address, e.g. https://nightingale.tail1234.ts.net
```

Write that `https://…ts.net` address down. The next step calls it `<SITE_URL>`.
Optional: rename the machine to `nightingale` in the admin console first, so the address reads nicely.

## 5. Create the production settings file

```bash
cd ~/sharmaince-publication-house/server
cp .env.example .env
nano .env
```

Set these values. Anything not listed can stay as it is in the example.

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `<SITE_URL>` |
| `PUBLIC_WEB_URL` | `<SITE_URL>` |
| `TRUST_PROXY` | `2` (Tailscale and nginx are the two proxies in front of the API) |
| `JWT_ACCESS_SECRET` | output of `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | a **different** `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | add this line, with the output of `openssl rand -hex 24` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys (test keys are fine to start) |
| `RAZORPAY_WEBHOOK_SECRET` | a random string you choose; you'll enter the same one in Razorpay (step 8) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | your email provider (see below) |
| `EMAIL_FROM` | e.g. `Nightingale Academic Press <orders@yourmail.com>` |

You can delete the `DATABASE_URL` line. Docker builds the database address from `POSTGRES_PASSWORD`.

**Email (SMTP), if you don't have a provider yet:**
- **Brevo** (free tier): host `smtp-relay.brevo.com`, port `587`, with the login and SMTP key from its dashboard.
- **Gmail**: host `smtp.gmail.com`, port `587`, user = your Gmail address, password = an
  [App Password](https://myaccount.google.com/apppasswords) (needs 2-step verification on).

Lock the file down. It holds your secrets:

```bash
chmod 600 .env
```

> The API **refuses to start** in production if a Razorpay key, the webhook secret or SMTP is
> missing, if the JWT secrets are short or identical, or if `PUBLIC_WEB_URL` isn't `https://`.
> That's on purpose. If it won't start, step 9 shows how to see exactly which setting is wrong.

## 6. Start everything

```bash
cd ~/sharmaince-publication-house/server
docker compose up -d --build
```

The first build takes a few minutes. Then check it:

```bash
docker compose ps                         # postgres, api and web should be "Up"; migrate "Exited (0)"
curl -s localhost:8080/api/ready          # {"status":"ready"}
```

Now open `<SITE_URL>` on your phone, on mobile data, to confirm it's reachable from outside your network.

## 7. Add content and your admin account

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

## 8. Connect Razorpay

In the Razorpay Dashboard → **Settings → Webhooks → Add new webhook**:

- **URL:** `<SITE_URL>/api/payments/webhook`
- **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET` in your `.env`
- **Events:** `payment.captured` and `payment.failed`

Before taking real money:
- **Test first.** Use Razorpay **test** keys and place an order with a test card. Check that it
  shows as Paid in the admin and that the confirmation email arrives.
- **Go live.** Razorpay must approve your business (KYC) and website before it issues live keys.
  Once it does, put the live keys in `.env` and run `docker compose up -d` again.

## 9. Day-to-day operation

**See what's happening:**

```bash
docker compose ps
docker compose logs -f api        # live API logs (Ctrl+C to stop)
docker compose logs --tail 50 migrate
```

**Ship an update:**

```bash
cd ~/sharmaince-publication-house
git pull                          # or copy over a fresh bundle, as in step 3B
cd server && docker compose up -d --build
```

Database migrations run automatically before the new API starts.

**Restart or stop:** `docker compose restart` / `docker compose down`. Your data is kept in
Docker volumes. Never add `-v` to `down`: that deletes the database.

## 10. Backups (do this on day one)

The database and the uploaded cover images live on this one PC. Back them up nightly:

```bash
mkdir -p ~/backups
crontab -e
```

Add this line. It runs at 02:30 every night and keeps 14 days of backups:

```
30 2 * * * cd ~/sharmaince-publication-house/server && docker compose exec -T postgres pg_dump -U nightingale nightingale | gzip > ~/backups/db-$(date +\%F).sql.gz && docker run --rm -v server_uploads_data:/u -v ~/backups:/b alpine tar czf /b/uploads-$(date +\%F).tgz -C /u . && find ~/backups -mtime +14 -delete
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
| Site loads but every page shows errors | `CORS_ORIGIN` and `PUBLIC_WEB_URL` must exactly match `<SITE_URL>` (https, no trailing slash) |
| You get logged out quickly | You're on plain `http://` rather than the `https://…ts.net` address |
| Address doesn't load from outside | `tailscale funnel status`; re-run `sudo tailscale funnel --bg 8080` |
| Payments stay "Pending" | Razorpay → Webhooks shows delivery attempts and responses; check the URL and secret |
| No emails | `docker compose logs api \| grep -i mail`, and check the SMTP login |

## Known limits of this setup

- **One machine, one copy.** If the PC or its internet goes down, so does the site. Backups (step 10) are your safety net.
- **The address is a `ts.net` name.** If you buy a domain later, you can move to Cloudflare Tunnel
  or a normal web host. Only `CORS_ORIGIN`, `PUBLIC_WEB_URL` and the Razorpay webhook URL change.
- **Home upload speed** limits how fast pages and cover images load for visitors.
