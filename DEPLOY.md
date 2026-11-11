# Putting the portal on a server

The site is one Node process and one SQLite file. There is no database server to install,
no npm packages to fetch, and it makes no outbound connections. That means hosting it is
mostly about two things:

1. **Node 22.13 or newer.** The app uses the built-in `node:sqlite` module, which does not
   exist in older versions. On Node 20 it will not start at all.
2. **A disk that survives restarts**, with `DATA_DIR` pointing at it.

Anything that gives you those two will run this.

---

## The one setting that matters: `DATA_DIR`

By default the database lives in `data/` next to the code. That is right on a laptop and
wrong on a server, because a deploy replaces the code folder — and would take every entry
with it.

On a server, put the data somewhere else:

```
DATA_DIR=/home/<you>/sdsi-data
```

The folder is created if it does not exist, and it ends up holding:

```
sdsi-data/
  sdsi.db                 every entry and account
  initial-passwords.txt   first-time passwords, delete once handed out
  backups/                written by backup.js
```

**Nothing else in the deploy needs to persist.** You can delete and re-clone the code at
any time without losing data.

---

## AlwaysData

AlwaysData is shared hosting: you get an account on a managed machine, not a server of
your own. It suits this app because the filesystem is persistent and you never touch an
operating system.

### 1. Make the account

Sign up for the free 100 MB plan at alwaysdata.com. The account name becomes your address,
so pick something like `sdsi` and you get `sdsi.alwaysdata.net`. No card is needed.

### 2. Get the code onto it

SSH in with the account's credentials (the panel shows the host), then:

```sh
git clone https://github.com/ayanasari/BTP-1.git ~/www/sdsi
mkdir -p ~/sdsi-data
```

To update later, `cd ~/www/sdsi && git pull` and restart the site from the panel. The data
is outside that folder, so a pull can never touch it.

### 3. Set the Node version

In the admin panel, under **Environment → Node.js**, choose **22.13 or newer**. Do this
before starting the site; the default may be older.

### 4. Create the site

In the panel, **Web → Sites → Add a site**:

| Field | Value |
| --- | --- |
| Addresses | `sdsi.alwaysdata.net` |
| Type | Node.js (a user program / long-running command) |
| Command | `node server.js` |
| Working directory | `/home/<account>/www/sdsi` |

Environment variables for the site:

| Name | Value | Why |
| --- | --- | --- |
| `DATA_DIR` | `/home/<account>/sdsi-data` | keeps data outside the deploy folder |
| `HTTPS` | `1` | marks the session cookie Secure, correct behind their HTTPS |
| `TZ` | `Asia/Kolkata` | so "today" on the server means today in Kharagpur |

Leave `PORT` alone — AlwaysData sets it, and the app already reads `process.env.PORT`.

`TZ` is not cosmetic. The entry form opens on the browser's local date; if the server
thinks it is still yesterday, entries made late at night get refused as future-dated.

### 5. Start it and check

Start the site from the panel, then:

```
https://sdsi.alwaysdata.net/healthz
```

You should get `{"ok":true,"entries":...}`. If you do, the app is up and the database is
readable. Then open the site itself and sign in.

### 6. Collect the passwords, then delete the file

The first start creates all 31 accounts and writes their passwords to
`~/sdsi-data/initial-passwords.txt`. Hand each person their own line, then delete it.
Every password works once — the site makes the person choose their own.

Lost the administrator password:

```sh
cd ~/www/sdsi && DATA_DIR=~/sdsi-data node reset-password.js admin
```

### 7. Turn on nightly backups

In the panel, **Advanced → Scheduled tasks**, add a daily job:

```sh
cd /home/<account>/www/sdsi && DATA_DIR=/home/<account>/sdsi-data node backup.js
```

That writes a dated copy into `~/sdsi-data/backups/` and keeps the last 30. Pass a number
to keep more: `node backup.js 90`.

**Download one of those backups to your own computer every so often.** A backup on the
same disk as the database protects you from a bad deploy, not from losing the account.

---

## A plain Linux server (a VM from CIC, a VPS, Oracle)

### Install and run

```sh
# Node 22.13+ must already be installed
git clone https://github.com/ayanasari/BTP-1.git /opt/sdsi
mkdir -p /var/lib/sdsi
cd /opt/sdsi && DATA_DIR=/var/lib/sdsi node server.js
```

### Make it start on boot

The point of a server is that nobody has to log in and type that. Create
`/etc/systemd/system/sdsi.service`:

```ini
[Unit]
Description=SDSI data entry portal
After=network.target

[Service]
Type=simple
User=sdsi
WorkingDirectory=/opt/sdsi
Environment=DATA_DIR=/var/lib/sdsi
Environment=PORT=4000
Environment=HTTPS=1
Environment=TZ=Asia/Kolkata
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now sdsi
sudo systemctl status sdsi
```

It now starts at boot and restarts itself if it crashes.

Set `HTTPS=1` only if something in front terminates TLS (nginx, Caddy, a load balancer).
On plain HTTP it would mark the cookie Secure and nobody could stay signed in.

### Nightly backup

```sh
sudo crontab -e
```

```
30 2 * * *  cd /opt/sdsi && DATA_DIR=/var/lib/sdsi /usr/bin/node backup.js
```

---

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV DATA_DIR=/data PORT=4000 TZ=Asia/Kolkata
VOLUME /data
EXPOSE 4000
CMD ["node", "server.js"]
```

```sh
docker build -t sdsi .
docker run -d --name sdsi -p 4000:4000 -v sdsi-data:/data --restart unless-stopped sdsi
```

The `-v sdsi-data:/data` is the part that matters. Without it the database lives inside the
container and disappears the first time it is replaced.

---

## Restoring from a backup

```sh
sudo systemctl stop sdsi                      # or stop the site in the panel
cp /var/lib/sdsi/backups/sdsi-2026-11-12-0230-00.db /var/lib/sdsi/sdsi.db
sudo systemctl start sdsi
```

A backup is an ordinary SQLite file. It opens anywhere, including on your laptop.

---

## Checklist before handing it to anyone

- [ ] `/healthz` returns `{"ok":true,...}`
- [ ] `DATA_DIR` points outside the code folder
- [ ] `TZ` is set, so late-evening entries are accepted
- [ ] A backup job runs and `backups/` actually has files in it the next day
- [ ] One backup has been copied somewhere off this machine
- [ ] `initial-passwords.txt` has been handed out and deleted
- [ ] The administrator has signed in once and set a real password
- [ ] The placeholder email addresses in `users.js` have been replaced with real ones
