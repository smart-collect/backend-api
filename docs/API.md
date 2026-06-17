# Référence API — Smart-Collect Backend

Base URL par défaut : `http://localhost:3000`

Documentation interactive : **http://localhost:3000/api-docs**

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [Format des réponses](#format-des-réponses)
4. [Codes d'erreur](#codes-derreur)
5. [Endpoints système](#endpoints-système)
6. [Module Bins](#module-bins)
7. [Module Reports](#module-reports)
8. [Module Devices](#module-devices)
9. [Module Tours](#module-tours)
10. [Module Stats](#module-stats)
11. [MQTT IoT](#mqtt-iot)

---

## Vue d'ensemble

L'API REST suit une architecture modulaire. Les modules **Devices**, **Tours** et **Stats** exigent un JWT Bearer. Les modules **Bins** et **Reports** sont actuellement publics (évolution prévue).

| Méthode | Endpoint | Auth | Rôle minimum |
|---------|----------|------|--------------|
| GET | `/health` | — | — |
| GET/POST | `/bins` | — | — |
| GET/POST | `/report` | — | — |
| GET/POST/PATCH/DELETE | `/devices/*` | JWT | agent (lecture) / admin (écriture) |
| GET/POST | `/tours/*` | JWT | agent, admin |
| GET | `/stats/*` | JWT | agent, admin |

> **Capture d'écran attendue :** Tableau de bord agent affichant les cartes « Bacs pleins », « Signalements en attente » et un graphique d'historique — alimenté par `GET /stats/dashboard` et `GET /stats/bins/:id/history`.

---

## Authentification

### JWT Bearer

Les routes protégées attendent l'en-tête :

```http
Authorization: Bearer <token>
```

### Payload JWT

```json
{
  "sub": "agent-42",
  "email": "agent@hysacam.cm",
  "role": "agent"
}
```

| Rôle | Permissions |
|------|-------------|
| `citizen` | Accès limité (signalements — à venir) |
| `agent` | Devices (lecture), ses tournées, stats, génération de tournée pour soi |
| `admin` | Accès complet, création devices, toutes les tournées |

### Exemple — token de test (développement)

```bash
# Générer un token agent (Node.js)
node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign(
  { sub: 'agent-1', email: 'agent@test.cm', role: 'agent' },
  process.env.JWT_SECRET || 'test_jwt_secret_change_me_32_chars_min',
  { expiresIn: '15m' }
));
"
```

### Erreurs d'authentification

**401 — Token absent ou invalide**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Header Authorization: Bearer <token> requis"
  },
  "timestamp": "2026-06-16T10:00:00.000Z",
  "path": "/devices"
}
```

**403 — Rôle insuffisant**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Role insuffisant pour cette action"
  },
  "timestamp": "2026-06-16T10:00:00.000Z",
  "path": "/devices"
}
```

---

## Format des réponses

### Succès (modules standardisés)

```json
{
  "success": true,
  "data": { },
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

### Erreur

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Payload invalide",
    "details": { }
  },
  "timestamp": "2026-06-16T10:00:00.000Z",
  "path": "/tours"
}
```

> **Note :** Les modules `/bins` et `/report` renvoient encore un format simplifié (tableau ou objet direct). Migration vers le format standard prévue.

---

## Codes d'erreur

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | JWT absent ou invalide |
| `FORBIDDEN` | 403 | Rôle insuffisant |
| `VALIDATION_ERROR` | 400 | Payload Zod invalide |
| `BIN_NOT_FOUND` | 404 | Bac introuvable |
| `DEVICE_NOT_FOUND` | 404 | Dispositif introuvable |
| `TOUR_NOT_FOUND` | 404 | Tournée introuvable |
| `TOUR_FORBIDDEN` | 403 | Tournée d'un autre agent |
| `RATE_LIMIT_EXCEEDED` | 429 | Trop de requêtes |
| `INTERNAL_SERVER_ERROR` | 500 | Erreur serveur |

---

## Endpoints système

### GET /health

Sonde de disponibilité (non limitée par le rate limiter).

```bash
curl http://localhost:3000/health
```

```json
{
  "success": true,
  "data": {
    "status": "UP",
    "service": "Smart-Collect Backend"
  },
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

---

## Module Bins

Préfixe : `/bins` — **Sans authentification** (provisoire)

### GET /bins

Liste tous les bacs avec leurs signalements.

```bash
curl http://localhost:3000/bins
```

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "longitude": 9.7679,
    "latitude": 4.0511,
    "status": "HALF",
    "fillLevel": 62.5,
    "lastMeasurementAt": "2026-06-16T08:30:00.000Z",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-06-16T08:30:00.000Z",
    "reports": []
  }
]
```

### POST /bins

Crée un bac à une position GPS.

```bash
curl -X POST http://localhost:3000/bins \
  -H "Content-Type: application/json" \
  -d '{"longitude": 9.7680, "latitude": 4.0512}'
```

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "longitude": 9.768,
  "latitude": 4.0512,
  "status": "EMPTY",
  "fillLevel": 0,
  "lastMeasurementAt": null,
  "createdAt": "2026-06-16T10:00:00.000Z",
  "updatedAt": "2026-06-16T10:00:00.000Z"
}
```

**Statuts de bac :** `EMPTY`, `HALF`, `FULL`, `CRITICAL`

---

## Module Reports

Préfixe : `/report` — **Sans authentification** (provisoire)

### GET /report

```bash
curl http://localhost:3000/report
```

### POST /report

Crée un signalement citoyen lié à un bac.

```bash
curl -X POST http://localhost:3000/report \
  -H "Content-Type: application/json" \
  -d '{
    "binId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "description": "Bac débordant rue Akwa",
    "imageUrl": "https://cdn.example.com/photo.jpg"
  }'
```

```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "description": "Bac débordant rue Akwa",
  "imageUrl": "https://cdn.example.com/photo.jpg",
  "status": "PENDING",
  "binId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2026-06-16T10:05:00.000Z"
}
```

**Statuts :** `PENDING`, `VALIDATED`, `RESOLVED`, `REJECTED`

---

## Module Devices

Préfixe : `/devices` — **JWT requis**

### GET /devices

Rôles : `agent`, `admin`

```bash
curl http://localhost:3000/devices \
  -H "Authorization: Bearer <token>"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "d4e5f6a7-b8c9-0123-def0-234567890123",
      "deviceId": "esp32-001",
      "name": "ESP32 Akwa Nord",
      "mqttUsername": "esp32-001",
      "status": "ONLINE",
      "batteryPercent": 72,
      "lastSeenAt": "2026-06-16T09:55:00.000Z",
      "binId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "bin": { "id": "...", "latitude": 4.0511, "longitude": 9.7679, "status": "FULL" }
    }
  ],
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

### GET /devices/:id

Détail d'un dispositif avec dernière mesure.

### GET /devices/:id/measurements?limit=100

Historique des mesures (1–500).

```bash
curl "http://localhost:3000/devices/d4e5f6a7-b8c9-0123-def0-234567890123/measurements?limit=10" \
  -H "Authorization: Bearer <token>"
```

### POST /devices

Rôle : `admin` uniquement.

```bash
curl -X POST http://localhost:3000/devices \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32-002",
    "name": "ESP32 Bonanjo",
    "bin_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

```json
{
  "success": true,
  "data": {
    "id": "...",
    "deviceId": "esp32-002",
    "name": "ESP32 Bonanjo",
    "mqttUsername": "esp32-002",
    "mqttPassword": "xK9mP2nQ7vR4sT8wY1zA3bC5dE6f",
    "status": "OFFLINE",
    "binId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

> Le `mqttPassword` est généré automatiquement à la création. Le conserver pour configurer l'ESP32.

### PATCH /devices/:id/associate

Rôle : `admin`. Associe ou dissocie un bac.

```bash
curl -X PATCH http://localhost:3000/devices/<id>/associate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"bin_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'
```

Dissocier : `{"bin_id": null}`

### DELETE /devices/:id

Rôle : `admin`. Supprime le dispositif.

---

## Module Tours

Préfixe : `/tours` — **JWT requis** — Rôles : `agent`, `admin`

> **Capture d'écran attendue :** Application mobile agent montrant une tournée avec une liste ordonnée de bacs sur carte, statut `IN_PROGRESS`, boutons « Démarrer » et « Marquer visité ».

### GET /tours

- **Agent** : ses tournées uniquement
- **Admin** : toutes les tournées

```bash
curl http://localhost:3000/tours \
  -H "Authorization: Bearer <token>"
```

### GET /tours/:id

Détail avec bacs ordonnés par `orderIndex`.

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Tournée Akwa Matin",
    "agentId": "agent-1",
    "status": "PLANNED",
    "startedAt": null,
    "completedAt": null,
    "bins": [
      {
        "orderIndex": 0,
        "status": "PENDING",
        "binId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "bin": { "latitude": 4.0511, "longitude": 9.7679, "status": "FULL", "fillLevel": 94 }
      }
    ]
  },
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

### POST /tours

Création manuelle. Un agent ne peut créer que pour son propre `agent_id`.

```bash
curl -X POST http://localhost:3000/tours \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tournée Akwa Matin",
    "agent_id": "agent-1",
    "bin_ids": [
      { "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "order_index": 0 },
      { "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901", "order_index": 1 }
    ]
  }'
```

### POST /tours/generate

Génération automatique V1.

| `priority` | Algorithme |
|------------|------------|
| `full_first` | Bacs `FULL`/`CRITICAL`/`HALF` d'abord, tri lat/lon |
| `nearest_first` | Glouton plus proche voisin (haversine) |

```bash
curl -X POST http://localhost:3000/tours/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-1",
    "max_bins": 15,
    "priority": "full_first"
  }'
```

### POST /tours/:id/start

Passe le statut à `IN_PROGRESS`. Requiert `PLANNED`.

### POST /tours/:id/bins/:bin_id/visit

Marque le bac `VISITED`, remet le bac à `EMPTY` / `fillLevel: 0`.

```bash
curl -X POST http://localhost:3000/tours/11111111-1111-1111-1111-111111111111/bins/a1b2c3d4-e5f6-7890-abcd-ef1234567890/visit \
  -H "Authorization: Bearer <token>"
```

### POST /tours/:id/complete

Termine la tournée (`COMPLETED`). Requiert `IN_PROGRESS`.

**Cycle de vie :** `PLANNED` → `IN_PROGRESS` → `COMPLETED`

---

## Module Stats

Préfixe : `/stats` — **JWT requis** — Rôles : `agent`, `admin`

### GET /stats/dashboard

Tableau de bord agrégé. **Cache mémoire 30 secondes.**

```bash
curl http://localhost:3000/stats/dashboard \
  -H "Authorization: Bearer <token>"
```

```json
{
  "success": true,
  "data": {
    "bins": {
      "total": 120,
      "normal": 80,
      "almost_full": 20,
      "full": 15,
      "fire": 2,
      "offline": 8
    },
    "reports": {
      "pending": 12,
      "assigned": 5,
      "collected_today": 3,
      "rejected_total": 1
    },
    "performance": {
      "avg_collection_time_hours": 2.25,
      "reports_per_day_avg": 4.2
    }
  },
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

| Champ bins | Mapping BDD |
|------------|-------------|
| `normal` | `EMPTY` |
| `almost_full` | `HALF` |
| `full` | `FULL` |
| `fire` | `CRITICAL` |
| `offline` | Devices absents ou tous `OFFLINE` |

> **Capture d'écran attendue :** Dashboard web avec 6 indicateurs colorés (total, normal, presque plein, plein, incendie, hors ligne) et deux graphiques de performance.

### GET /stats/bins/:id/history?days=30

Série journalière du niveau de remplissage (moyenne par jour).

```bash
curl "http://localhost:3000/stats/bins/a1b2c3d4-e5f6-7890-abcd-ef1234567890/history?days=7" \
  -H "Authorization: Bearer <token>"
```

```json
{
  "success": true,
  "data": [
    { "date": "2026-06-10", "fill_level": 35.2 },
    { "date": "2026-06-11", "fill_level": 48.7 },
    { "date": "2026-06-12", "fill_level": 62.1 }
  ],
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

### GET /stats/reports/heatmap

Signalements groupés par zone ~100 m (grille 0,0009°).

```bash
curl http://localhost:3000/stats/reports/heatmap \
  -H "Authorization: Bearer <token>"
```

```json
{
  "success": true,
  "data": [
    { "latitude": 4.0512, "longitude": 9.7678, "count": 14 },
    { "latitude": 4.0521, "longitude": 9.7687, "count": 8 }
  ],
  "timestamp": "2026-06-16T10:00:00.000Z"
}
```

> **Capture d'écran attendue :** Carte de Douala avec des cercles rouges proportionnels au `count` de chaque zone heatmap.

---

## MQTT IoT

Le backend s'abonne automatiquement aux topics configurés dans `MQTT_TOPICS_SUBSCRIBE`.

### Topics

| Topic | Description |
|-------|-------------|
| `devices/{device_id}/data` | Mesure capteur |
| `devices/{device_id}/status` | Statut ONLINE/OFFLINE |
| `devices/{device_id}/alert` | Alerte (traité comme mesure) |

### Payload mesure (`/data`)

```json
{
  "device_id": "esp32-001",
  "timestamp": "2026-06-16T12:00:00.000Z",
  "fill_level": 78,
  "fill_central": 76,
  "fill_lateral": 80,
  "temperature": 32.5,
  "battery_voltage": 3.85,
  "battery_percent": 72,
  "lid_opens_since_last": 2,
  "rssi_wifi": -63
}
```

### Payload statut (`/status`)

```json
{
  "device_id": "esp32-001",
  "timestamp": "2026-06-16T12:00:00.000Z",
  "status": "ONLINE",
  "battery_percent": 72,
  "rssi_wifi": -63
}
```

### Effets côté serveur

- Mise à jour du `fillLevel` et `status` du bac associé
- Enregistrement dans `Measurement`
- Notifications si batterie faible, device offline (> 30 min), niveau critique

### Test sans hardware

```bash
npm run iot:simulate -- --speed=10 --devices=3
```

---

## Rate limiting

Par défaut : **100 requêtes / 15 minutes** par IP. Exclut `/health`.

Réponse 429 :

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Trop de requêtes, veuillez réessayer plus tard"
  },
  "timestamp": "2026-06-16T10:00:00.000Z",
  "path": "/devices"
}
```
