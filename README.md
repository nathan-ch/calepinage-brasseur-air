# Calepinage BRASSE

Outil statique de calepinage de brasseurs d'air basé sur le guide BRASSE de l'ADEME et sur une extraction embarquée de la base BRASSE II.

Le site calcule des configurations de pose à partir des dimensions du local, propose des variantes `standard` et `low-profile`, puis remonte les modèles BRASSE II compatibles avec le calepinage retenu. Tout s'exécute côté navigateur : aucune saisie n'est stockée.

## Lancer le projet

Le runtime reste un simple site statique. L'outillage Node sert uniquement au développement et à régénérer le bundle navigateur utilisé par `index.html`.

```bash
npm install
npm run build:browser
npm run dev
```

Le site est alors servi localement sur `http://localhost:3000`.

Le fichier `index.html` peut aussi être ouvert directement dans le navigateur. Pour garder cette compatibilité, le site charge le bundle classique `dist/app.browser.js`, généré à partir des sources modulaires dans `src/`.

## Scripts disponibles

- `npm run dev` : lance un serveur statique de développement.
- `npm run build:browser` : regénère le bundle navigateur chargé par `index.html`.
- `npm run lint` : vérifie le code source JavaScript.
- `npm run format` : applique Prettier sur le projet.
- `npm run test` : exécute les tests unitaires et de non-régression.
- `npm run check` : enchaîne lint, tests puis génération du bundle navigateur.

Pour comprendre l'architecture interne et retrouver les zones de code à modifier, voir le [guide technique développeur](docs/DEVELOPER_GUIDE.md).

## Structure du projet

```text
.
├── data/                 # Données BRASSE II exposées en module ES
├── dist/                 # Bundle navigateur classique utilisé au runtime
├── scripts/              # Scripts de maintenance et génération
├── src/
│   ├── app/              # Références DOM, état et orchestration
│   ├── core/             # Calculs métier BRASSE, formatters, tri catalogue/BRASSE II
│   ├── report/           # Génération du rapport PDF imprimable
│   └── ui/               # Rendu HTML/SVG, catalogue et résultats
├── styles/               # Feuilles CSS séparées par responsabilité
├── test/                 # Tests node:test
├── index.html            # Shell statique de l'application
└── brasse2-data.js       # Jeu de données source BRASSE II
```

## Sources et données

- Source méthodologique principale : guide BRASSE V1.0 ADEME, octobre 2023.
- Données modèles : extraction embarquée de la base BRASSE II fournie avec le projet.

Le projet reste un travail personnel et n'a pas de lien officiel avec l'ADEME.
