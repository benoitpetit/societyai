# Guide de Contribution

Merci de votre intérêt pour contribuer à SocietyAI ! 🎉

## 🚀 Comment Contribuer

### Rapporter un Bug

Si vous trouvez un bug, veuillez ouvrir une issue avec :

- Une description claire du problème
- Les étapes pour reproduire le bug
- Le comportement attendu vs le comportement actuel
- Votre environnement (Node.js version, OS, etc.)

### Proposer une Nouvelle Fonctionnalité

Pour proposer une nouvelle fonctionnalité :

1. Ouvrez d'abord une issue pour discuter de votre idée
2. Attendez les retours de la communauté
3. Une fois approuvée, vous pouvez créer une pull request

### Processus de Pull Request

1. **Fork** le projet
2. **Créez** une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. **Committez** vos changements (`git commit -m 'Add some AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrez** une Pull Request

## 📋 Standards de Code

### Style de Code

- Utilisez TypeScript strict
- Suivez les conventions ESLint configurées
- Formatez votre code avec Prettier (`npm run format`)
- Ajoutez des commentaires JSDoc pour les fonctions publiques

### Tests

- Écrivez des tests pour toutes les nouvelles fonctionnalités
- Assurez-vous que tous les tests passent (`npm test`)
- Visez une couverture de code > 80%

### Commits

Utilisez des messages de commit clairs et descriptifs :

- `feat:` pour une nouvelle fonctionnalité
- `fix:` pour une correction de bug
- `docs:` pour la documentation
- `test:` pour les tests
- `refactor:` pour le refactoring
- `chore:` pour les tâches de maintenance

Exemple : `feat: add retry mechanism with exponential backoff`

## 🧪 Tests

```bash
# Exécuter tous les tests
npm test

# Exécuter les tests avec couverture
npm run test:coverage

# Exécuter les tests en mode watch
npm run test:watch
```

## 🏗️ Structure du Projet

```
src/
├── types.ts          # Interfaces et types
├── config.ts         # Configuration
├── errors.ts         # Gestion des erreurs
├── logger.ts         # Système de logging
├── retry.ts          # Mécanisme de retry
├── worker-pool.ts    # Pool de workers
├── models.ts         # Modèles de base
├── society.ts        # Logique principale
└── index.ts          # Point d'entrée
```

## 📝 Documentation

- Mettez à jour le README si nécessaire
- Ajoutez des exemples pour les nouvelles fonctionnalités
- Documentez les breaking changes dans le CHANGELOG

## ⚖️ Licence

En contribuant, vous acceptez que vos contributions soient sous licence MIT.

## 💬 Questions ?

N'hésitez pas à ouvrir une issue pour toute question !

Merci de contribuer à SocietyAI ! 🙏
