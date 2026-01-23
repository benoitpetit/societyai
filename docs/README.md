# Documentation SocietyAI

Bienvenue dans la documentation complète de SocietyAI ! Cette documentation vous guide à travers tous les aspects du package.

## 📚 Table des Matières

### Démarrage

- **[Guide de Démarrage](./getting-started.md)** ⭐ Commencez ici !
  - Installation
  - Premier agent
  - Première société
  - Les trois modes
  - Configuration avancée
  - Exemples complets

### Références

- **[Référence API](./api.md)** 📖
  - Interfaces complètes
  - Classes et méthodes
  - Types et options
  - Gestion des erreurs
  - Exemples d'utilisation

- **[Architecture](./architecture.md)** 🏗️
  - Vue d'ensemble
  - Composants clés
  - Trois modes de fonctionnement
  - Diagrammes
  - Extensibilité

- **[Meilleures Pratiques](./best-practices.md)** ✨
  - Choix du mode
  - Configuration optimale
  - Performance
  - Gestion des coûts
  - Sécurité
  - Tests

## 🚀 Parcours d'Apprentissage Recommandé

### Niveau Débutant

1. Lisez le [Guide de Démarrage](./getting-started.md)
2. Exécutez les [exemples de base](../examples/basic.ts)
3. Créez votre premier modèle personnalisé
4. Essayez les trois modes

### Niveau Intermédiaire

1. Explorez la [Référence API](./api.md) complète
2. Étudiez les [exemples avancés](../examples/advanced/)
3. Implémentez un observateur personnalisé
4. Configurez retry et timeouts

### Niveau Avancé

1. Comprenez l'[Architecture](./architecture.md) interne
2. Appliquez les [Meilleures Pratiques](./best-practices.md)
3. Étudiez les [intégrations](../examples/integrations/)
4. Créez des adaptateurs personnalisés
5. Optimisez pour la production

## 📂 Structure de la Documentation

```
docs/
├── README.md                  # Ce fichier
├── getting-started.md         # Guide de démarrage rapide
├── api.md                     # Référence API complète
├── architecture.md            # Architecture du système
└── best-practices.md          # Meilleures pratiques

examples/
├── basic.ts                   # Exemples de base
├── advanced/                  # Exemples avancés
│   ├── custom-observer.ts     # Observateurs personnalisés
│   ├── multi-model.ts         # Utilisation multi-modèles
│   ├── retry-config.ts        # Configuration retry
│   └── timeout-cancellation.ts # Gestion timeouts
└── integrations/              # Intégrations LLM
    ├── openai-integration.ts  # Intégration OpenAI
    └── README.md              # Guide d'intégration
```

## 🎯 Guides par Cas d'Usage

### Je veux...

#### ...créer mon premier agent

👉 [Guide de Démarrage - Votre Premier Agent](./getting-started.md#votre-premier-agent)

#### ...comprendre les modes

👉 [Guide de Démarrage - Les Trois Modes](./getting-started.md#les-trois-modes)
👉 [Architecture - Trois Modes](./architecture.md#trois-modes-de-fonctionnement)

#### ...intégrer avec OpenAI/Claude/Gemini

👉 [Exemples d'Intégration](../examples/integrations/)

#### ...optimiser les performances

👉 [Meilleures Pratiques - Performance](./best-practices.md#performance-et-optimisation)

#### ...gérer les erreurs

👉 [API - Gestion des Erreurs](./api.md#gestion-des-erreurs)
👉 [Meilleures Pratiques - Erreurs](./best-practices.md#gestion-des-erreurs)

#### ...réduire les coûts

👉 [Meilleures Pratiques - Coûts](./best-practices.md#coûts-et-budgets)

#### ...monitorer en production

👉 [Meilleures Pratiques - Observabilité](./best-practices.md#observabilité-et-monitoring)

#### ...créer un adaptateur personnalisé

👉 [API - ModelAdapter](./api.md#modeladapter)
👉 [Exemples Avancés](../examples/advanced/)

## 📖 Glossaire

| Terme                 | Définition                                                 |
| --------------------- | ---------------------------------------------------------- |
| **Agent**             | Instance qui utilise un modèle d'IA pour traiter une tâche |
| **Société**           | Groupe d'agents collaborant sur un prompt                  |
| **AIModel**           | Interface pour intégrer n'importe quel modèle d'IA         |
| **Adapter**           | Convertit les formats de prompts/réponses                  |
| **Observer**          | Surveille le cycle de vie de la société                    |
| **Mode Standard**     | Agents indépendants avec agrégation simple                 |
| **Mode Synthèse**     | Agrégation avec modèle de synthèse dédié                   |
| **Mode Collaboratif** | 4 phases avec partage d'informations                       |

## 🔗 Liens Utiles

- [GitHub Repository](https://github.com/benoitpetit/societyai-package)
- [npm Package](https://www.npmjs.com/package/@societyai/core)
- [Changelog](../CHANGELOG.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [License](../LICENSE)

## 💡 FAQ

### Combien d'agents dois-je utiliser ?

**Réponse :**

- Mode Standard/Synthèse : 3-5 agents
- Mode Collaboratif : 5-7 agents

Voir [Meilleures Pratiques - Configuration des Agents](./best-practices.md#configuration-des-agents)

### Quel mode choisir ?

**Réponse :**

- **Standard** : Questions simples, rapidité
- **Synthèse** : Besoin de cohérence
- **Collaboratif** : Questions complexes, qualité

Voir [Meilleures Pratiques - Choix du Mode](./best-practices.md#choix-du-mode)

### Comment gérer les coûts API ?

**Réponse :**

- Limitez le nombre d'agents
- Utilisez des modèles économiques pour les agents
- Modèles puissants uniquement pour la synthèse
- Configurez max_tokens
- Implémentez du caching

Voir [Meilleures Pratiques - Coûts](./best-practices.md#coûts-et-budgets)

### Comment débugger ?

**Réponse :**

```typescript
import { setGlobalLogLevel, LogLevel } from '@societyai/core';

// Activer logs détaillés
setGlobalLogLevel(LogLevel.DEBUG);
```

Voir [API - Logging](./api.md#logging)

## 🤝 Contribution

Des questions ou suggestions sur la documentation ?

1. Ouvrez une [issue GitHub](https://github.com/benoitpetit/societyai-package/issues)
2. Proposez une amélioration via pull request
3. Consultez le [guide de contribution](../CONTRIBUTING.md)

## 📝 Notes de Version

Consultez le [CHANGELOG](../CHANGELOG.md) pour voir les dernières modifications.

---

**Bonne exploration de SocietyAI ! 🎉**
