# Guide de contribution — Smart-Collect Backend

Merci de contribuer au backend Smart-Collect. Ce document définit le workflow Git, les conventions de code et les exigences qualité.

---

## Table des matières

1. [Workflow Git (GitFlow)](#workflow-git-gitflow)
2. [Conventional Commits](#conventional-commits)
3. [Pull Requests](#pull-requests)
4. [Tests](#tests)
5. [Style de code](#style-de-code)
6. [Structure d'une feature](#structure-dune-feature)

---

## Workflow Git (GitFlow)

### Branches permanentes

| Branche | Rôle |
|---------|------|
| `main` | Production stable, taguée (v1.0.0, v1.1.0…) |
| `develop` | Intégration continue, base de développement |

### Branches temporaires

| Préfixe | Exemple | Usage |
|---------|---------|-------|
| `feature/` | `feature/tours-module` | Nouvelle fonctionnalité |
| `fix/` | `fix/mqtt-reconnect` | Correction de bug |
| `hotfix/` | `hotfix/jwt-validation` | Correctif urgent en production |
| `release/` | `release/1.2.0` | Préparation d'une release |

### Flux standard

```
1. Partir de develop
   git checkout develop && git pull
   git checkout -b feature/ma-fonctionnalite

2. Développer, commiter, pousser
   git push -u origin feature/ma-fonctionnalite

3. Ouvrir une PR vers develop

4. Après revue et merge → develop

5. Release : branche release/X.Y.Z depuis develop
   → tests finaux → merge dans main ET develop
   → tag git vX.Y.Z

6. Hotfix urgent : branche hotfix/* depuis main
   → merge dans main ET develop
```

> **Capture d'écran attendue :** Diagramme GitFlow dans l'outil Git (GitKraken, GitHub) montrant `main`, `develop` et une branche `feature/stats-module` fusionnée dans `develop`.

### Règles

- Ne jamais pousser directement sur `main`
- Rebaser ou merger `develop` avant d'ouvrir une PR
- Supprimer les branches feature après merge
- Un hotfix doit toujours être rétroporté sur `develop`

---

## Conventional Commits

Format obligatoire pour tous les commits :

```
<type>(<scope>): <description courte>

[corps optionnel]

[footer optionnel]
```

### Types autorisés

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `style` | Formatage (pas de changement logique) |
| `refactor` | Refactoring sans feat/fix |
| `test` | Ajout ou modification de tests |
| `chore` | Maintenance (deps, CI, config) |
| `perf` | Amélioration de performance |

### Scopes suggérés

`bins`, `devices`, `tours`, `stats`, `mqtt`, `auth`, `db`, `api`, `ci`

### Exemples

```bash
feat(tours): ajouter la génération automatique de tournées

fix(mqtt): corriger la reconnexion exponentielle après déconnexion broker

docs(api): documenter les endpoints stats dashboard

test(stats): ajouter les tests du cache TTL 30s

chore(deps): mettre à jour prisma vers 5.22.0
```

### Breaking changes

Ajouter `!` après le type ou un footer `BREAKING CHANGE:` :

```
feat(auth)!: migrer vers JWT RS256

BREAKING CHANGE: les tokens HS256 existants ne sont plus valides.
```

---

## Pull Requests

### Avant d'ouvrir une PR

```bash
npm run type-check   # 0 erreur TypeScript
npm run lint         # 0 erreur ESLint
npm test             # Tous les tests verts
npm run build        # Build réussi
```

### Template de PR

```markdown
## Résumé
- Ajout du module Stats avec dashboard et heatmap

## Type de changement
- [ ] feat (nouvelle fonctionnalité)
- [ ] fix (correction)
- [ ] docs
- [ ] refactor

## Test plan
- [ ] `npm test` passe
- [ ] Testé manuellement avec curl / Swagger
- [ ] Migration Prisma incluse si schéma modifié

## Screenshots
<!-- Capture : dashboard stats affichant les compteurs bins/reports -->
```

### Critères de revue

| Critère | Exigence |
|---------|----------|
| Tests | Nouveaux endpoints = nouveaux tests |
| Validation | Entrées validées avec Zod |
| Auth | Routes protégées avec `requireAuth` + `requireRole` |
| Réponses | Format `{ success, data, timestamp }` |
| Migrations | Fichier Prisma migrate si schéma modifié |
| Docs | README ou docs/API.md mis à jour si API change |
| Secrets | Aucun secret dans le code ou les commits |

### Processus

1. Au moins **1 approbation** requise
2. CI verte (tests + lint + type-check)
3. Squash merge recommandé sur `develop`
4. Supprimer la branche après merge

---

## Tests

### Lancer les tests

```bash
npm test                 # Suite complète
npm run test:watch       # Mode interactif
npm run test:coverage    # Rapport de couverture
```

### Structure

```
tests/
├── api.test.ts          # Health, 404
├── devices.test.ts      # Module devices
├── tours.test.ts        # Module tours
├── stats.test.ts        # Module stats + cache
└── iot.test.ts          # Handlers MQTT
```

### Conventions de test

- Framework : **Vitest** + **Supertest**
- Mocker les services Prisma ou `@services/*` pour les tests HTTP
- Nommer les tests en français : `it('refuse /stats sans JWT', ...)`
- `beforeEach(() => vi.clearAllMocks())` systématique
- JWT de test : secret `test_jwt_secret_change_me_32_chars_min`

### Exemple — test d'endpoint

```typescript
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@services/stats.service', () => ({
  StatsService: { getDashboard: vi.fn().mockResolvedValue({ bins: { total: 10 } }) },
}));

const { default: app } = await import('../src/index');

it('retourne le dashboard pour un agent', async () => {
  const token = jwt.sign(
    { sub: 'agent-1', email: 'a@test.cm', role: 'agent' },
    'test_jwt_secret_change_me_32_chars_min',
  );

  const res = await request(app)
    .get('/stats/dashboard')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.body.success).toBe(true);
});
```

### Couverture minimale attendue

| Zone | Objectif |
|------|----------|
| Controllers | Endpoints principaux testés |
| Services | Logique métier critique (cache, permissions) |
| MQTT handlers | Validation Zod + routing |
| Migrations | Testées manuellement en staging |

---

## Style de code

### TypeScript

- Mode **strict** activé (`tsconfig.json`)
- Pas de `any` explicite (règle ESLint `error`)
- Pas de variables inutilisées
- Imports avec alias : `@/`, `@services/`, `@middleware/`, `@config/`

### Formatage — Prettier

```bash
npm run format
```

Configuration (`.prettierrc`) :
- Guillemets simples
- Point-virgule obligatoire
- Largeur 100 caractères
- 2 espaces d'indentation

### Lint — ESLint

```bash
npm run lint
```

Règles principales :
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unused-vars: error`
- `no-console: warn` (sauf `console.error` / `console.warn`)

### Architecture

```
Route → Controller → Service → Prisma
         ↓
       Schema Zod (validation)
```

- **Controllers** : HTTP uniquement (status, parsing, réponses)
- **Services** : logique métier, accès BDD
- **Schemas** : validation Zod + types inférés
- **Middleware** : auth, rate limit, erreurs

### Nommage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Fichiers | kebab-case ou dot notation | `stats.service.ts` |
| Classes / Types | PascalCase | `DashboardStats` |
| Fonctions / variables | camelCase | `getDashboard` |
| Constantes | UPPER_SNAKE | `DASHBOARD_CACHE_TTL_MS` |
| Endpoints | kebab-case | `/stats/reports/heatmap` |
| Champs JSON API | snake_case | `agent_id`, `fill_level` |

---

## Structure d'une feature

Checklist pour ajouter un module (ex. `notifications`) :

```
1. prisma/schema.prisma          → modèle Prisma
2. src/schemas/notifications.schemas.ts
3. src/services/notifications.service.ts
4. src/controllers/notifications.controller.ts
5. src/routes/notifications.routes.ts
6. src/index.ts                  → app.use('/notifications', ...)
7. tests/notifications.test.ts
8. docs/API.md                   → section module
```

Commandes de validation finale :

```bash
npx prisma migrate dev --name add_notifications
npm test
npm run type-check
npm run lint
```

---

## Questions

- Ouvrir une **issue** sur le dépôt pour les discussions d'architecture
- Contacter l'équipe Smart-Collect pour les accès CI/CD et staging
