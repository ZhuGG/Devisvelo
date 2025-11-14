# Consignes pour le dépôt Devisvelo

## Structure générale
- L'application est une page statique dont le point d'entrée est `index.html`.
- Le style vit dans `assets/css/` et le JavaScript modulaire dans `assets/js/`.
- Lors de nouvelles fonctionnalités, conserve cette séparation (pas de style ni de script inline).
- Utilise des modules ES (imports relatifs) pour tout nouveau code JavaScript côté client.

## JavaScript
- Préfère des fonctions pures réutilisables dans `assets/js/` (ex. logique d'analyse, helpers).
- Le fichier `main.js` doit rester l'orchestrateur léger : branchements d'événements, appels aux helpers.
- Si tu ajoutes des dépendances externes, documente-les dans `README.md` et charge-les via module (`type="module"`).

## CSS
- Centralise les règles communes dans `assets/css/main.css`.
- Les nouveaux composants doivent recevoir des classes plutôt que des `id` quand c'est possible.

## Tests manuels
- Après toute modification fonctionnelle, vérifie l'import d'un PDF exemple pour s'assurer que l'extraction et l'export CSV fonctionnent toujours.
