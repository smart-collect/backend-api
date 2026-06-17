# Politique de sécurité — Smart-Collect Backend

## Signalement de vulnérabilités

La sécurité de la plateforme Smart-Collect et des données des citoyens de Douala est une priorité.

### Comment signaler

**Ne pas** ouvrir d'issue publique pour les vulnérabilités de sécurité.

Envoyer un rapport à :

- **Email :** security@hysacam.cm *(à configurer)*
- **Objet :** `[SECURITY] Smart-Collect Backend — <résumé court>`

### Contenu du rapport

Inclure autant d'éléments que possible :

1. Description de la vulnérabilité
2. Étapes de reproduction
3. Impact potentiel (confidentialité, intégrité, disponibilité)
4. Version affectée (commit, tag)
5. Correctif suggéré (optionnel)
6. Vos coordonnées pour le suivi

### Engagement de réponse

| Délai | Action |
|-------|--------|
| 48 h | Accusé de réception |
| 7 jours | Évaluation initiale et classification |
| 30 jours | Correctif ou plan de mitigation |
| 90 jours | Divulgation coordonnée (si applicable) |

Nous accueillons les rapports de chercheurs en sécurité dans le cadre d'une divulgation responsable.

---

## Périmètre

### Dans le périmètre

- API REST Smart-Collect (`/bins`, `/devices`, `/tours`, `/stats`, `/report`, `/health`)
- Authentification JWT
- Broker MQTT Mosquitto (configuration, ACL, TLS)
- Base PostgreSQL (injections, accès non autorisé)
- Simulateur IoT (`scripts/iot-simulator.ts`)
- Dépendances npm avec CVE critique

### Hors périmètre

- Attaques par déni de service à grande échelle (DDoS)
- Ingénierie sociale, phishing
- Vulnérabilités des firmwares ESP32 (signalées au fabricant)
- Applications frontend non maintenues par l'équipe backend
- Problèmes nécessitant un accès physique au serveur

---

## Mesures de sécurité en place

### Authentification et autorisation

| Mesure | Implémentation |
|--------|----------------|
| JWT stateless | `jsonwebtoken` + secret ≥ 32 caractères |
| Contrôle d'accès par rôle | `citizen`, `agent`, `admin` via `requireRole()` |
| Isolation des tournées | Un agent ne voit que ses propres tournées |
| Expiration des tokens | Configurable via `JWT_EXPIRES_IN` |

```typescript
// src/middleware/auth.ts
Authorization: Bearer <token>
// Payload : { sub, email, role }
```

### Protection HTTP

| Mesure | Implémentation |
|--------|----------------|
| Headers de sécurité | `helmet` |
| CORS restrictif | Whitelist via `CORS_ORIGIN` |
| Rate limiting global | 100 req / 15 min par IP (`express-rate-limit`) |
| Rate limiting auth | 5 tentatives / 15 min (`authLimiter`) |
| Rate limiting upload | 10 uploads / heure (`uploadLimiter`) |
| Health check exempté | `/health` non limité |

### Validation des entrées

| Mesure | Implémentation |
|--------|----------------|
| Validation schémas | **Zod** sur tous les modules récents |
| TypeScript strict | Prévention erreurs de type à la compilation |
| Payload MQTT | `mqttMeasurementSchema`, `mqttStatusSchema` |
| Rejet messages invalides | Log `WARN`, pas de traitement |

### Données sensibles

| Mesure | Implémentation |
|--------|----------------|
| Mots de passe MQTT devices | Générés aléatoirement (`crypto.randomBytes`) |
| Variables d'environnement | Validées au démarrage (Zod), jamais commitées |
| `.env` dans `.gitignore` | Template via `.env.example` uniquement |
| Swagger désactivable | `SWAGGER_ENABLED=false` en production |

### IoT / MQTT

| Mesure | Implémentation |
|--------|----------------|
| Topics structurés | `devices/{id}/data|status|alert` |
| Validation device_id | Device doit exister en BDD |
| Détection offline | Scan toutes les 5 min, seuil 30 min |
| Alertes batterie | Notifications < 20 % et < 10 % |
| Reconnexion MQTT | Backoff exponentiel (1 s → 30 s max) |
| TLS production | Port 8883 (`mqtts://`) recommandé |

### Base de données

| Mesure | Implémentation |
|--------|----------------|
| ORM paramétré | Prisma (protection injection SQL) |
| Requêtes raw paramétrées | `$queryRaw` avec paramètres liés |
| Index | Sur colonnes fréquemment filtrées |
| Cascade contrôlée | `onDelete: Cascade` / `SetNull` explicites |

### Journalisation

| Mesure | Implémentation |
|--------|----------------|
| Logger structuré | `src/utils/logger.ts` |
| Niveaux configurables | `LOG_LEVEL` (debug → error) |
| Erreurs 5xx loguées | Stack trace côté serveur uniquement |
| Pas de secrets dans les logs | Mots de passe MQTT jamais logués |

---

## Recommandations production

Ces mesures ne sont pas toutes activées par défaut en développement :

- [ ] `JWT_SECRET` aléatoire ≥ 64 caractères
- [ ] `SWAGGER_ENABLED=false`
- [ ] HTTPS via Nginx (TLS 1.2+)
- [ ] Mosquitto : `allow_anonymous false` + ACL par device
- [ ] MQTT TLS (port 8883 uniquement)
- [ ] PostgreSQL : utilisateur applicatif à privilèges minimaux
- [ ] Firewall : ports 3000 et 5432 non exposés publiquement
- [ ] Backups chiffrés et testés
- [ ] Rotation des secrets JWT et MQTT périodique
- [ ] `npm audit` dans la CI

---

## Gestion des dépendances

```bash
# Audit des vulnérabilités
npm audit

# Mise à jour sécurisée
npm audit fix

# Vérifier les CVE critiques avant chaque release
npm audit --audit-level=critical
```

Les mises à jour de dépendances avec CVE critique doivent être traitées en **hotfix** si elles affectent la production.

---

## Classification des vulnérabilités

| Niveau | Exemples | Délai de correctif |
|--------|----------|-------------------|
| **Critique** | Bypass auth, injection SQL, RCE | 48 h |
| **Élevé** | IDOR sur tournées, fuite de données MQTT | 7 jours |
| **Moyen** | Rate limit contournable, enumeration | 30 jours |
| **Faible** | Headers manquants, info disclosure mineure | Prochaine release |

---

## Historique des versions sécurisées

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-06 | Release initiale — JWT, Helmet, rate limit, Zod |

---

## Contact

- **Équipe technique :** dev@hysacam.cm *(à configurer)*
- **Signalement sécurité :** security@hysacam.cm *(à configurer)*

---

*Dernière mise à jour : juin 2026*
