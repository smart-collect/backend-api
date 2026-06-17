# Smart-Collect Backend API

Backend API IoT pour la plateforme **Smart-Collect** — gestion optimisée de la collecte d'ordures pour **Hysacam** (Douala, Cameroun).

Le serveur expose une API REST pour les applications web/mobile et consomme les mesures des capteurs **ESP32** via **MQTT** (broker Mosquitto).

## Stack technique

| Composant | Version | Rôle |
|-----------|---------|------|
| Node.js | ≥ 20 LTS | Runtime |
| TypeScript | 5.x | Langage (mode strict) |
| Express | 4.18+ | Framework HTTP |
| PostgreSQL | 16 | Base relationnelle |
| Prisma | 5.x | ORM |
| Mosquitto | 2.x | Broker MQTT IoT |
| JWT | — | Authentification stateless |
| Zod | 3.22+ | Validation des entrées |
| Vitest | 1.1+ | Tests unitaires / intégration |
| Swagger UI | 3.0 | Documentation interactive |

## Prérequis

- **Node.js** 20 LTS ou supérieur
- **npm** 9+
- **Docker** & **Docker Compose** (PostgreSQL, Mosquitto, Redis)
- **Git**

## Installation rapide

```bash
# 1. Cloner et entrer dans le projet
git clone <url-du-repo> backend-api
cd backend-api

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env — voir section Variables d'environnement

# 4. Démarrer l'infrastructure Docker
docker compose up -d

# 5. Appliquer les migrations
npm run db:migrate

# 6. (Optionnel) Données de démonstration
npm run db:seed

# 7. Lancer le serveur en développement
npm run dev
```

Le serveur écoute sur **http://localhost:3000**.

> **Capture d'écran attendue :** Terminal affichant `Smart-Collect backend started` avec le port `3000` et l'URL du broker MQTT.

## Vérification

```bash
# Health check
curl http://localhost:3000/health

# Documentation Swagger (navigateur)
# http://localhost:3000/api-docs
```

Réponse health check :

```json
{
  "success": true,
  "data": { "status": "UP", "service": "Smart-Collect Backend" },
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

## Commandes npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur en mode watch (`tsx`) |
| `npm run build` | Compilation TypeScript → `dist/` |
| `npm start` | Production (`node dist/index.js`) |
| `npm test` | Suite de tests Vitest |
| `npm run test:watch` | Tests en mode watch |
| `npm run test:coverage` | Rapport de couverture |
| `npm run type-check` | Vérification TypeScript sans émission |
| `npm run lint` | ESLint sur `src/` |
| `npm run format` | Prettier sur `src/**/*.ts` |
| `npm run db:migrate` | Migrations Prisma (dev) |
| `npm run db:seed` | Seed de la base |
| `npm run db:reset` | Reset complet (⚠️ perte de données) |
| `npm run db:studio` | Prisma Studio → http://localhost:5555 |
| `npm run iot:simulate` | Simulateur ESP32 (MQTT sans hardware) |

### Simulateur IoT

```bash
# Envoi rapide (intervalle 3 s au lieu de 30 s)
npm run iot:simulate -- --speed=10 --devices=3
```

Options : `--interval=30000`, `--devices=3`, `--speed=1`.

## Structure du projet

```
backend-api/
├── src/
│   ├── config/
│   │   ├── env.ts              # Variables d'environnement (Zod)
│   │   └── swagger.ts          # Spécification OpenAPI
│   ├── controllers/              # Contrôleurs HTTP
│   ├── services/                 # Logique métier
│   ├── schemas/                  # Schémas Zod (validation)
│   ├── routes/                   # Routes Express
│   ├── middleware/
│   │   ├── auth.ts               # JWT + rôles
│   │   ├── errorHandler.ts
│   │   ├── notFound.ts
│   │   └── rateLimit.ts
│   ├── iot/
│   │   ├── mqtt.client.ts        # Client MQTT
│   │   ├── mqtt.handlers.ts      # Traitement des messages
│   │   ├── mqtt.schemas.ts       # Validation payloads IoT
│   │   └── anomaly-detector.ts   # Détection offline / batterie
│   ├── utils/logger.ts
│   └── index.ts                  # Point d'entrée
├── prisma/
│   ├── schema.prisma             # Modèles de données
│   └── seed.ts
├── scripts/
│   └── iot-simulator.ts          # Simulateur ESP32
├── tests/                        # Tests Vitest
├── docs/                         # Documentation détaillée
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── CONTRIBUTING.md
│   └── SECURITY.md
├── mosquitto/config/             # Config broker MQTT
├── docker-compose.yml
├── .env.example
└── package.json
```

## Variables d'environnement

Copier `.env.example` vers `.env`. Variables essentielles :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NODE_ENV` | Environnement | `development` |
| `PORT` | Port HTTP | `3000` |
| `DATABASE_URL` | Connexion PostgreSQL | `postgresql://user:pass@localhost:5432/smart_collect` |
| `JWT_SECRET` | Clé JWT (≥ 32 caractères) | *(générer aléatoirement)* |
| `JWT_EXPIRES_IN` | Durée du token | `15m` / `24h` |
| `MQTT_BROKER_URL` | Broker MQTT | `mqtt://localhost:1883` |
| `MQTT_USERNAME` | Auth MQTT (optionnel) | |
| `MQTT_PASSWORD` | Auth MQTT (optionnel) | |
| `MQTT_TOPICS_SUBSCRIBE` | Topics d'abonnement | `devices/+/data,devices/+/status,devices/+/alert` |
| `SWAGGER_ENABLED` | Activer Swagger UI | `true` |
| `SWAGGER_URL` | Chemin Swagger | `/api-docs` |
| `CORS_ORIGIN` | Origines autorisées | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Fenêtre rate limit | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requêtes / fenêtre | `100` |

Liste complète : [.env.example](.env.example).

## Documentation

| Document | Contenu |
|----------|---------|
| [docs/API.md](docs/API.md) | Référence API complète, auth, exemples |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Déploiement production, Mosquitto, backup |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | GitFlow, commits, PR, tests |
| [docs/SECURITY.md](docs/SECURITY.md) | Politique de sécurité |

### Swagger UI

Documentation interactive disponible en développement :

**http://localhost:3000/api-docs**

> **Capture d'écran attendue :** Page Swagger avec les tags *Tours* et *Stats*, bouton « Authorize » pour saisir le Bearer JWT, et la liste des endpoints `GET /stats/dashboard`, `POST /tours/generate`, etc.

## Modules fonctionnels

| Module | Préfixe | Auth | Description |
|--------|---------|------|-------------|
| Health | `/health` | Non | Sonde de disponibilité |
| Bins | `/bins` | Non* | Gestion des bacs à ordures |
| Reports | `/report` | Non* | Signalements citoyens |
| Devices | `/devices` | JWT | Dispositifs ESP32 |
| Tours | `/tours` | JWT (agent+) | Tournées de collecte |
| Stats | `/stats` | JWT (agent+) | Tableaux de bord |

\* *Ces routes seront sécurisées dans une prochaine itération.*

## IoT / MQTT

Topics écoutés : `devices/{device_id}/data`, `devices/{device_id}/status`, `devices/{device_id}/alert`.

Exemple de publication (simulateur ou `mosquitto_pub`) :

```bash
mosquitto_pub -h localhost -p 1883 \
  -t devices/esp32-001/data \
  -m '{"device_id":"esp32-001","timestamp":"2026-06-16T12:00:00.000Z","fill_level":78,"temperature":32,"battery_percent":85,"rssi_wifi":-62}'
```

## Tests

```bash
npm test                 # 34 tests
npm run test:coverage    # Rapport HTML dans coverage/
```

## Liens utiles

- [Prisma Docs](https://www.prisma.io/docs)
- [Mosquitto Manual](https://mosquitto.org/documentation/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Licence

Smart-Collect Backend © 2026 — Tous droits réservés.
