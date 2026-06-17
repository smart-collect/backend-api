# Guide de déploiement — Smart-Collect Backend

Ce document décrit le déploiement en **production** de l'API Smart-Collect, du broker MQTT Mosquitto et de PostgreSQL.

---

## Table des matières

1. [Prérequis serveur](#prérequis-serveur)
2. [Architecture cible](#architecture-cible)
3. [Variables d'environnement production](#variables-denvironnement-production)
4. [Étapes de déploiement](#étapes-de-déploiement)
5. [Mosquitto en production](#mosquitto-en-production)
6. [Monitoring](#monitoring)
7. [Sauvegarde et restauration](#sauvegarde-et-restauration)
8. [Checklist pré-mise en production](#checklist-pré-mise-en-production)

---

## Prérequis serveur

### Matériel minimum (VPS)

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 Go | 4 Go |
| Disque | 20 Go SSD | 50 Go SSD |
| Réseau | 100 Mbps | 1 Gbps |

### Logiciels

| Logiciel | Version | Usage |
|----------|---------|-------|
| Ubuntu Server | 22.04 / 24.04 LTS | OS recommandé |
| Node.js | ≥ 20 LTS | API backend |
| PostgreSQL | 16 | Base de données |
| Mosquitto | 2.x | Broker MQTT |
| Nginx | 1.24+ | Reverse proxy TLS |
| PM2 ou systemd | — | Gestion de processus |
| Docker (optionnel) | 24+ | Conteneurisation |

### Ports réseau

| Port | Service | Exposition |
|------|---------|------------|
| 443 | Nginx (HTTPS API) | Public |
| 3000 | Node.js | Interne uniquement |
| 5432 | PostgreSQL | Interne uniquement |
| 1883 | MQTT (non-TLS) | **Ne pas exposer** en prod |
| 8883 | MQTT over TLS | Réseau IoT / VPN |
| 9001 | MQTT WebSocket | Si nécessaire (frontend) |

> **Capture d'écran attendue :** Schéma réseau montrant Internet → Nginx (443) → Node.js (3000) → PostgreSQL (5432), et les ESP32 connectés à Mosquitto (8883) via VPN ou réseau dédié.

---

## Architecture cible

```
                    ┌─────────────┐
   ESP32 (IoT) ───► │  Mosquitto  │ :8883 (TLS)
                    │   (MQTT)    │
                    └──────┬──────┘
                           │ subscribe
                    ┌──────▼──────┐
  Clients HTTPS ──► │   Nginx     │ :443
                    │  (TLS term) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Node.js    │ :3000
                    │  (PM2)      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │ :5432
                    └─────────────┘
```

---

## Variables d'environnement production

Créer `/opt/smart-collect/.env` (permissions `600`, propriétaire `smart-collect`) :

```env
# Application
NODE_ENV=production
PORT=3000
APP_NAME=Smart-Collect Backend

# Base de données
DATABASE_URL=postgresql://smart_collect_app:MOT_DE_PASSE_FORT@localhost:5432/smart_collect

# JWT — OBLIGATOIRE : générer une clé aléatoire ≥ 64 caractères
JWT_SECRET=<openssl rand -base64 64>
JWT_EXPIRES_IN=15m

# MQTT — TLS en production
MQTT_BROKER_URL=mqtts://localhost:8883
MQTT_USERNAME=backend_service
MQTT_PASSWORD=<mot_de_passe_mqtt>
MQTT_TOPICS_SUBSCRIBE=devices/+/data,devices/+/status,devices/+/alert

# Sécurité HTTP
CORS_ORIGIN=https://app.hysacam.cm,https://admin.hysacam.cm
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Logs
LOG_LEVEL=info
LOG_DIR=/var/log/smart-collect

# Swagger — désactiver en production publique
SWAGGER_ENABLED=false
SWAGGER_URL=/api-docs

# Fichiers
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/var/smart-collect/uploads
```

### Génération de secrets

```bash
# JWT secret
openssl rand -base64 64

# Mot de passe PostgreSQL
openssl rand -base64 32
```

---

## Étapes de déploiement

### 1. Préparer le serveur

```bash
# Utilisateur dédié
sudo useradd -r -m -s /bin/bash smart-collect
sudo mkdir -p /opt/smart-collect /var/log/smart-collect /var/smart-collect/uploads
sudo chown -R smart-collect:smart-collect /opt/smart-collect /var/log/smart-collect /var/smart-collect
```

### 2. Installer Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v20.x
```

### 3. Cloner et builder

```bash
sudo -u smart-collect -i
cd /opt/smart-collect
git clone <url-du-repo> .
npm ci --omit=dev
cp .env.example .env
# Éditer .env avec les valeurs production
npm run build
```

### 4. Base de données PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER smart_collect_app WITH PASSWORD 'MOT_DE_PASSE_FORT';
CREATE DATABASE smart_collect OWNER smart_collect_app;
GRANT ALL PRIVILEGES ON DATABASE smart_collect TO smart_collect_app;
SQL
```

### 5. Migrations Prisma

```bash
cd /opt/smart-collect
npx prisma migrate deploy
npx prisma generate
```

> **Important :** Utiliser `migrate deploy` en production, jamais `migrate dev`.

### 6. Démarrer avec PM2

```bash
npm install -g pm2

# ecosystem.config.cjs
cat > /opt/smart-collect/ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [{
    name: 'smart-collect-api',
    script: 'dist/index.js',
    cwd: '/opt/smart-collect',
    instances: 2,
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '512M',
    error_file: '/var/log/smart-collect/pm2-error.log',
    out_file: '/var/log/smart-collect/pm2-out.log',
  }],
};
EOF

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 7. Nginx reverse proxy

```nginx
# /etc/nginx/sites-available/smart-collect
server {
    listen 443 ssl http2;
    server_name api.hysacam.cm;

    ssl_certificate     /etc/letsencrypt/live/api.hysacam.cm/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hysacam.cm/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/smart-collect /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Vérification post-déploiement

```bash
curl https://api.hysacam.cm/health
# {"success":true,"data":{"status":"UP",...}}

pm2 status
pm2 logs smart-collect-api --lines 50
```

> **Capture d'écran attendue :** Sortie `pm2 status` montrant 2 instances `online` et `curl /health` retournant `"status":"UP"`.

---

## Mosquitto en production

### Configuration TLS + authentification

Éditer `mosquitto/config/mosquitto.conf` :

```conf
# Désactiver l'accès anonyme
allow_anonymous false
password_file /mosquitto/config/passwd
acl_file /mosquitto/config/acl

# MQTT TLS (production)
listener 8883
protocol mqtt
certfile /mosquitto/certs/fullchain.pem
keyfile /mosquitto/certs/privkey.pem
require_certificate false

# Pas d'écoute sur 1883 en production
# listener 1883  ← commenté

persistence true
persistence_location /mosquitto/data/
autosave_interval 300

log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice
```

### Créer les utilisateurs MQTT

```bash
# Utilisateur backend (subscribe)
mosquitto_passwd -c /mosquitto/config/passwd backend_service

# Utilisateur par device ESP32 (publish restreint)
mosquitto_passwd /mosquitto/config/passwd esp32-001
```

### ACL (exemple)

```
# /mosquitto/config/acl

# Backend : lecture sur tous les devices
user backend_service
topic read devices/+/data
topic read devices/+/status
topic read devices/+/alert

# Device ESP32 : écriture uniquement sur son topic
user esp32-001
topic write devices/esp32-001/data
topic write devices/esp32-001/status
topic write devices/esp32-001/alert
```

### Certificats TLS

```bash
# Let's Encrypt (si broker exposé publiquement)
sudo certbot certonly --standalone -d mqtt.hysacam.cm

# Copier vers Mosquitto
sudo cp /etc/letsencrypt/live/mqtt.hysacam.cm/fullchain.pem /mosquitto/certs/
sudo cp /etc/letsencrypt/live/mqtt.hysacam.cm/privkey.pem /mosquitto/certs/
```

### Démarrer Mosquitto (Docker)

```bash
docker compose up -d mosquitto
docker compose logs -f mosquitto
```

### Test de connexion TLS

```bash
mosquitto_pub -h mqtt.hysacam.cm -p 8883 \
  --cafile /etc/ssl/certs/ca-certificates.crt \
  -u esp32-001 -P '<password>' \
  -t devices/esp32-001/data \
  -m '{"device_id":"esp32-001","timestamp":"2026-06-16T12:00:00.000Z","fill_level":50}'
```

---

## Monitoring

### Health check

Configurer un moniteur externe (UptimeRobot, Datadog, etc.) sur :

```
GET https://api.hysacam.cm/health
Intervalle : 60 s
Alerte si status ≠ 200 ou data.status ≠ "UP"
```

### Logs applicatifs

```bash
# Logs PM2
pm2 logs smart-collect-api

# Logs fichiers
tail -f /var/log/smart-collect/info-*.log
tail -f /var/log/smart-collect/error-*.log

# Logs Mosquitto
docker compose logs -f mosquitto
```

### Métriques recommandées

| Métrique | Seuil d'alerte |
|----------|----------------|
| CPU Node.js | > 80 % pendant 5 min |
| RAM | > 85 % |
| Disque | > 90 % |
| Latence `/health` | > 500 ms |
| Devices OFFLINE | > 20 % du parc |
| Erreurs MQTT | > 10 / heure |
| Connexions PostgreSQL | > 80 % du pool |

### Détection d'anomalies intégrée

Le backend exécute un scan toutes les **5 minutes** :
- Devices `ONLINE` sans mesure depuis **30 min** → marqués `OFFLINE` + notification
- Batterie < 20 % → notification `WARNING`
- Batterie < 10 % → notification `CRITICAL`

> **Capture d'écran attendue :** Dashboard de monitoring (Grafana ou équivalent) avec courbes CPU/RAM, compteur devices online/offline, et graphique du taux d'erreur HTTP 5xx.

---

## Sauvegarde et restauration

### PostgreSQL — sauvegarde quotidienne

```bash
#!/bin/bash
# /opt/smart-collect/scripts/backup-db.sh
BACKUP_DIR=/var/backups/smart-collect
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

pg_dump -U smart_collect_app -h localhost smart_collect \
  | gzip > "$BACKUP_DIR/smart_collect_$DATE.sql.gz"

# Rétention 30 jours
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

Cron :

```cron
0 2 * * * /opt/smart-collect/scripts/backup-db.sh >> /var/log/smart-collect/backup.log 2>&1
```

### Restauration PostgreSQL

```bash
gunzip -c /var/backups/smart-collect/smart_collect_20260616_020000.sql.gz \
  | psql -U smart_collect_app -h localhost smart_collect
```

### Mosquitto — persistance

Les messages retained et sessions persistent dans le volume Docker `mosquitto_data`.

```bash
# Sauvegarde du volume
docker run --rm \
  -v backend-api_mosquitto_data:/data \
  -v /var/backups/smart-collect:/backup \
  alpine tar czf /backup/mosquitto_$(date +%Y%m%d).tar.gz -C /data .
```

### Fichiers uploadés

```bash
rsync -avz /var/smart-collect/uploads/ backup-server:/backups/uploads/
```

---

## Checklist pré-mise en production

- [ ] `JWT_SECRET` unique et ≥ 64 caractères
- [ ] `SWAGGER_ENABLED=false`
- [ ] `NODE_ENV=production`
- [ ] PostgreSQL : utilisateur dédié, pas de `postgres` superuser pour l'app
- [ ] Mosquitto : `allow_anonymous false`, TLS sur 8883, port 1883 fermé
- [ ] Nginx : TLS 1.2+, HSTS activé
- [ ] CORS limité aux domaines de production
- [ ] Rate limiting configuré
- [ ] Backups PostgreSQL automatisés et testés (restauration)
- [ ] Monitoring `/health` actif
- [ ] Logs centralisés ou rotation configurée
- [ ] Firewall : seuls 443 et 8883 (si nécessaire) ouverts
- [ ] `prisma migrate deploy` exécuté
- [ ] Tests `npm test` passés sur la branche de release

---

## Mise à jour (rolling)

```bash
cd /opt/smart-collect
git pull origin main
npm ci --omit=dev
npm run build
npx prisma migrate deploy
pm2 reload smart-collect-api
curl https://api.hysacam.cm/health
```

En cas d'échec : `pm2 reload` effectue un reload zero-downtime ; revenir à la version précédente via `git checkout <tag>` si nécessaire.
