# Smart-Collect Backend API

Backend API IoT pour la plateforme **Smart-Collect** de gestion de collecte d'ordures pour **Hysacam à Douala**.

## 🎯 Description

Smart-Collect est une solution IoT complète pour la gestion optimisée de la collecte des ordures. Le backend reçoit des données provenant de capteurs IoT (ESP32) via MQTT et expose une API REST pour les applications frontend.

## 🛠️ Stack Technologique

| Composant      | Version               | Détails                       |
| -------------- | --------------------- | ----------------------------- |
| **Node.js**    | 20 LTS                | Environnement d'exécution     |
| **TypeScript** | 5                     | Mode strict uniquement        |
| **Express.js** | 4.18+                 | Framework web                 |
| **PostgreSQL** | 16                    | Base de données relationnelle |
| **Prisma**     | 5                     | ORM moderne et type-safe      |
| **MQTT**       | Eclipse Mosquitto 2.x | Communication IoT             |
| **JWT**        | -                     | Authentification stateless    |
| **Zod**        | 3.22+                 | Validation de schémas         |
| **Vitest**     | 1.1+                  | Framework de test             |
| **Swagger**    | 3.0                   | Documentation API interactive |

## 📋 Prérequis

- **Node.js**: 20 LTS ou supérieur
- **npm** ou **yarn**: Gestionnaire de paquets
- **Docker & Docker Compose**: Pour les services (PostgreSQL, Mosquitto, Redis)
- **Git**: Contrôle de version

## 🚀 Installation & Démarrage

### 1️⃣ Cloner le projet

```bash
cd backend-api
```

### 2️⃣ Installer les dépendances

```bash
npm install
```

### 3️⃣ Configurer l'environnement

```bash
# Créer le fichier .env à partir du template
cp .env.example .env

# Éditer .env avec vos valeurs (voir .env.example pour les détails)
# Important: Générer JWT_SECRET sécurisé
```

### 4️⃣ Lancer les services (PostgreSQL, Mosquitto, Redis)

```bash
# Démarrer les containers Docker
docker-compose up -d

# Vérifier le statut
docker-compose ps
```

### 5️⃣ Initialiser la base de données

```bash
# Exécuter les migrations Prisma
npm run db:migrate

# (Optionnel) Remplir la base avec les données de seed
npm run db:seed
```

### 6️⃣ Démarrer le serveur en développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

## 📖 Documentation

### Health Check

```bash
curl http://localhost:3000/health
```

### Swagger UI

Accédez à la documentation interactive:

```
http://localhost:3000/api-docs
```

## 📝 Scripts Disponibles

```bash
# Développement
npm run dev              # Lancer en mode watch avec tsx

# Build & Production
npm run build            # Compiler TypeScript en dist/
npm start                # Lancer depuis dist/

# Tests
npm test                 # Exécuter les tests (Vitest)
npm run test:watch       # Mode watch pour les tests
npm run test:coverage    # Rapport de couverture

# Base de données
npm run db:migrate       # Exécuter les migrations Prisma
npm run db:seed          # Remplir la base avec les données de seed
npm run db:reset         # Réinitialiser complètement (⚠️ perte de données)
npm run db:studio        # UI Prisma Studio (localhost:5555)

# Qualité du code
npm run lint             # ESLint
npm run format           # Prettier
npm run type-check       # Vérification des types TypeScript stricte

# IoT & Simulation
npm run iot:simulate     # Simuler des devices ESP32 envoyant des données MQTT
```

## 🏗️ Structure du Projet

```
backend-api/
├── src/
│   ├── config/
│   │   └── env.ts              # Validation des variables d'environnement (Zod)
│   ├── middleware/
│   │   ├── errorHandler.ts      # Gestion centralisée des erreurs
│   │   ├── notFound.ts          # Middleware 404
│   │   └── rateLimit.ts         # Rate limiting et protection brute-force
│   ├── utils/
│   │   └── logger.ts            # Logger structuré (fichiers + console)
│   ├── routes/                  # À implémenter
│   │   ├── auth.ts              # Routes d'authentification
│   │   ├── devices.ts           # Routes des devices IoT
│   │   └── collections.ts       # Routes des collectes
│   ├── controllers/             # À implémenter
│   ├── services/                # À implémenter
│   ├── types/                   # Types TypeScript personnalisés
│   └── index.ts                 # Point d'entrée Express
├── prisma/
│   ├── schema.prisma            # Schéma de données
│   └── seed.ts                  # Script de seed
├── tests/                       # Tests (Vitest)
├── dist/                        # Build compilé (généré)
├── .env.example                 # Template de variables d'environnement
├── .env                         # Variables d'environnement (À NE PAS commiter)
├── .gitignore                   # Fichiers ignorés par Git
├── docker-compose.yml           # Services Docker (PostgreSQL, Mosquitto, Redis)
├── tsconfig.json                # Configuration TypeScript (strict mode)
├── package.json                 # Dépendances et scripts
└── README.md                    # Ce fichier
```

## 🔐 Variables d'Environnement

Voir [.env.example](.env.example) pour la liste complète. Essentielles:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/smart_collect
JWT_SECRET=une_cle_tres_longue_et_aleatoire_min_32_chars
MQTT_BROKER_URL=mqtt://localhost:1883
```

## 🗄️ Base de Données

### Migrations Prisma

```bash
# Créer une nouvelle migration
npx prisma migrate dev --name add_users_table

# Appliquer les migrations en production
npx prisma migrate deploy
```

### Prisma Studio

```bash
npm run db:studio
# Ouvre l'UI à http://localhost:5555
```

## 🔌 IoT & MQTT

Le backend se connecte automatiquement au broker MQTT configuré et s'abonne aux topics définis dans `MQTT_TOPICS_SUBSCRIBE`.

### Format attendu des messages IoT

```json
{
  "deviceId": "esp32-01",
  "timestamp": "2026-06-02T10:30:00Z",
  "temperature": 28.5,
  "humidity": 65,
  "fillLevel": 87.3,
  "location": {
    "latitude": 3.8667,
    "longitude": 11.5167
  }
}
```

### Tester avec mosquitto_pub

```bash
mosquitto_pub -h localhost -p 1883 -t devices/esp32-01/data -m '{"deviceId":"esp32-01","temperature":25,"fillLevel":75}'
```

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Mode watch (rechargement auto)
npm run test:watch

# Avec couverture
npm run test:coverage
```

## 🚀 Déploiement

### Build pour production

```bash
npm run build
```

### Exécution en production

```bash
NODE_ENV=production npm start
```

## 📊 Monitoring & Logs

Les logs sont écrits dans:

- **Console**: En temps réel (développement)
- **Fichiers**: `logs/` avec séparation par niveau et date

```bash
# Voir les logs récents
tail -f logs/info-*.log
tail -f logs/error-*.log
```

## 🤝 Format de Réponse Standardisé

### Succès

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-06-02T10:30:00Z"
}
```

### Erreur

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description de l'erreur",
    "details": {}
  },
  "timestamp": "2026-06-02T10:30:00Z",
  "path": "/api/endpoint"
}
```

## 🔒 Sécurité

- ✅ **Helmet**: Headers de sécurité HTTP
- ✅ **CORS**: Whitelisting des origines
- ✅ **Rate Limiting**: Protection contre les attaques
- ✅ **JWT**: Authentification stateless
- ✅ **Bcrypt**: Hashage des mots de passe
- ✅ **Zod**: Validation stricte des entrées
- ✅ **TypeScript Strict**: Prévention des erreurs de type

## 📧 Support

Pour toute question ou problème:

- Créer une issue sur le repository
- Contacter l'équipe Smart-Collect

## 📄 Licence

Smart-Collect Backend © 2026 - Tous droits réservés
