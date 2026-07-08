# V85.1 - Correctif génération/build

Corrections réelles :
- `main` Electron corrigé : `electron/main.cjs` au lieu de `dist-electron/main.js` inexistant.
- Configuration `electron-builder` corrigée : inclusion du dossier `electron/**`.
- Ajout d'un nom d'artefact Windows propre.
- Import audio sécurisé avec `try/catch`.
- Génération remix sécurisée avec message d'erreur clair si le moteur audio échoue.
- `package-lock.json` aligné en version 85.1.0.
- `npm run check` et `npm run build` vérifiés OK localement.
