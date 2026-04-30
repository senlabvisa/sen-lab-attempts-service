# sen-lab-attempts-service

> 🎯 **Tentatives de TP** (sessions élèves + scores) Sen Lab Visa.

**Port** : `3007` · **Schéma BDD** : `attempts_svc`

---

## Rôle

Trace **toutes les sessions de TP** lancées par les élèves :

- **Démarrage** : `POST /attempts/start` (un élève commence un TP)
- **Validation** : `POST /attempts/:id/complete` (envoi du score auto + données métier en `dataJson`)
- **Évaluation prof** : `POST /attempts/:id/evaluate` (rubrique + commentaire + note finale)
- **Publication** : `POST /attempts/:id/publish` (rend la note visible à l'élève)

L'état complet de la simulation (mesures, hypothèses, etc.) est stocké en **JSONB** (`dataJson`) pour permettre la reproduction et l'analyse pédagogique.

## Endpoints

| Méthode | Route | Rôles |
|---|---|---|
| `POST` | `/attempts/start` | student |
| `POST` | `/attempts/:id/complete` | student |
| `GET`  | `/attempts/mine` | student |
| `GET`  | `/attempts` (avec filtres) | teacher/admin |
| `GET`  | `/attempts/:id` | teacher/admin |
| `POST` | `/attempts/:id/evaluate` | teacher/admin |
| `POST` | `/attempts/:id/publish` | teacher/admin |

---

## Modèle

```ts
AttemptDto {
  id              string
  studentId       string
  simulationId    string
  status          'started' | 'completed' | 'failed'
  score           number | null      // 0-100 (auto)
  dataJson        object | null      // état de la simulation
  teacherComment  string | null
  teacherRubric   Record<string,number> | null
  publishedAt     Date | null
  createdAt, updatedAt
}
```

## Stack

- **NestJS 10**
- **Prisma 5** (PostgreSQL avec colonnes JSONB)

## Variables d'environnement

```env
PORT=3007
DATABASE_URL=postgresql://senlab:...@postgres:5432/senlab?schema=attempts_svc
JWT_SECRET=...
```

## Lancement

```bash
pnpm install
pnpm prisma:generate
pnpm start:dev
```

## Mode hors-ligne (PWA)

Le frontend Sen Lab Visa peut **démarrer/compléter une tentative en local** (IndexedDB via Dexie) quand l'élève n'a pas de connexion. La synchronisation se fait au retour réseau via le `sync-queue` côté front.

## Lien parent

🔗 [`sen-lab-infra`](https://github.com/senlabvisa/sen-lab-infra) · [`sen-lab-simulations-service`](https://github.com/senlabvisa/sen-lab-simulations-service)
