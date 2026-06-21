# Calepinage BRASSE

Outil statique de calepinage de brasseurs d'air basé sur le guide BRASSE de l'ADEME et sur une extraction embarquée de la base BRASSE II.

Le site calcule des configurations de pose à partir des dimensions du local, propose des variantes `standard` et `low-profile`, puis remonte les modèles BRASSE II compatibles avec le calepinage retenu. Tout s'exécute côté navigateur : aucune saisie n'est stockée.

Ce projet est personnel et n'a pas de lien officiel avec l'ADEME.

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

Pour comprendre l'architecture interne, contribuer au projet et retrouver les zones de code à modifier, voir le [guide technique développeur](docs/DEVELOPER_GUIDE.md).

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

## Confidentialité

L'outil fonctionne entièrement côté navigateur. Il n'y a pas de serveur applicatif, pas de compte utilisateur, pas de base de données et aucune saisie n'est envoyée ou stockée par le projet.

## Données et attribution

- Source méthodologique principale : guide BRASSE V1.0 ADEME, octobre 2023.
- Données modèles : extraction embarquée de la base BRASSE II fournie avec le projet.
- Page source ADEME : https://librairie.ademe.fr/energies/6791-brasse.html

Les données BRASSE II embarquées restent attribuées à leurs sources d'origine. La licence du code ne relicencie pas les données, marques, noms de modèles ou contenus issus des publications BRASSE/ADEME. Voir [NOTICE.md](NOTICE.md).

## Licence

Le code source de l'outil est publié sous licence MIT. Voir [LICENSE](LICENSE).
