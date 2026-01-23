# Index - SocietyAI

Guide complet de navigation dans la documentation et les exemples de SocietyAI.

## 📚 Documentation

### Guides Principaux

| Document                                             | Description               | Niveau        |
| ---------------------------------------------------- | ------------------------- | ------------- |
| [README.md](./README.md)                             | Vue d'ensemble du projet  | Débutant      |
| [docs/getting-started.md](./docs/getting-started.md) | Guide de démarrage rapide | Débutant      |
| [docs/api.md](./docs/api.md)                         | Référence API complète    | Intermédiaire |
| [docs/architecture.md](./docs/architecture.md)       | Architecture du système   | Avancé        |
| [docs/best-practices.md](./docs/best-practices.md)   | Meilleures pratiques      | Avancé        |

### Documentation Complémentaire

| Document                             | Description             |
| ------------------------------------ | ----------------------- |
| [CHANGELOG.md](./CHANGELOG.md)       | Historique des versions |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guide de contribution   |
| [LICENSE](./LICENSE)                 | Licence MIT             |

## 💻 Exemples de Code

### Exemples de Base

| Fichier                                    | Description                    | Concepts                              |
| ------------------------------------------ | ------------------------------ | ------------------------------------- |
| [examples/basic.ts](./examples/basic.ts)   | Exemples simples d'utilisation | Mode standard, synthèse, collaboratif |
| [examples/README.md](./examples/README.md) | Guide des exemples             | -                                     |

### Exemples Avancés

| Fichier                                                                                  | Description                 | Concepts                     |
| ---------------------------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| [examples/advanced/custom-observer.ts](./examples/advanced/custom-observer.ts)           | Observateurs avec métriques | Observer pattern, monitoring |
| [examples/advanced/multi-model.ts](./examples/advanced/multi-model.ts)                   | Utilisation multi-modèles   | Distribution, rotation       |
| [examples/advanced/retry-config.ts](./examples/advanced/retry-config.ts)                 | Configuration du retry      | Résilience, backoff          |
| [examples/advanced/timeout-cancellation.ts](./examples/advanced/timeout-cancellation.ts) | Gestion timeouts            | AbortSignal, cancellation    |
| [examples/advanced/adapter-pattern.ts](./examples/advanced/adapter-pattern.ts)           | Adaptateurs personnalisés   | ModelAdapter, transformation |

### Exemples d'Intégration

| Fichier                                                                                      | Description        | API            |
| -------------------------------------------------------------------------------------------- | ------------------ | -------------- |
| [examples/integrations/openai-integration.ts](./examples/integrations/openai-integration.ts) | Intégration OpenAI | GPT-3.5, GPT-4 |

## 🎯 Parcours d'Apprentissage

### 1. Débutant

**Objectif :** Comprendre les bases et créer votre première société d'agents

1. ✅ Lire [README.md](./README.md)
2. ✅ Suivre [Guide de Démarrage](./docs/getting-started.md)
3. ✅ Exécuter [examples/basic.ts](./examples/basic.ts)
4. ✅ Créer votre propre modèle simulé
5. ✅ Tester les trois modes

**Durée estimée :** 1-2 heures

### 2. Intermédiaire

**Objectif :** Maîtriser l'API et les configurations avancées

1. ✅ Explorer [Référence API](./docs/api.md)
2. ✅ Étudier [custom-observer.ts](./examples/advanced/custom-observer.ts)
3. ✅ Tester [multi-model.ts](./examples/advanced/multi-model.ts)
4. ✅ Configurer retry et timeouts
5. ✅ Implémenter un observateur personnalisé

**Durée estimée :** 3-4 heures

### 3. Avancé

**Objectif :** Comprendre l'architecture et optimiser pour la production

1. ✅ Lire [Architecture](./docs/architecture.md)
2. ✅ Appliquer [Meilleures Pratiques](./docs/best-practices.md)
3. ✅ Intégrer avec vraie API ([openai-integration.ts](./examples/integrations/openai-integration.ts))
4. ✅ Créer adaptateurs personnalisés
5. ✅ Optimiser pour production

**Durée estimée :** 5-8 heures

## 🔍 Recherche par Concept

### Architecture

- **Vue d'ensemble** → [docs/architecture.md#vue-densemble](./docs/architecture.md)
- **Composants clés** → [docs/architecture.md#composants-clés](./docs/architecture.md)
- **Modes de fonctionnement** → [docs/architecture.md#trois-modes-de-fonctionnement](./docs/architecture.md)

### API

- **AIModel** → [docs/api.md#aimodel](./docs/api.md)
- **ModelAdapter** → [docs/api.md#modeladapter](./docs/api.md)
- **SocietyObserver** → [docs/api.md#societyobserver](./docs/api.md)
- **Fonctions principales** → [docs/api.md#fonctions](./docs/api.md)

### Configuration

- **Nombre d'agents** → [docs/best-practices.md#configuration-des-agents](./docs/best-practices.md)
- **Timeouts** → [docs/best-practices.md#timeout-configuration](./docs/best-practices.md)
- **Retry** → [docs/best-practices.md#retry-strategy](./docs/best-practices.md)

### Performance

- **Parallélisation** → [docs/best-practices.md#parallélisation](./docs/best-practices.md)
- **Caching** → [docs/best-practices.md#caching](./docs/best-practices.md)
- **Optimisation** → [docs/best-practices.md#performance-et-optimisation](./docs/best-practices.md)

### Gestion des Erreurs

- **Hiérarchie** → [docs/api.md#gestion-des-erreurs](./docs/api.md)
- **Try-Catch** → [docs/best-practices.md#try-catch-approprié](./docs/best-practices.md)
- **Circuit Breaker** → [docs/best-practices.md#circuit-breaker-pattern](./docs/best-practices.md)

### Sécurité

- **Clés API** → [docs/best-practices.md#protection-des-clés-api](./docs/best-practices.md)
- **Validation** → [docs/best-practices.md#validation-des-entrées](./docs/best-practices.md)
- **Rate Limiting** → [docs/best-practices.md#rate-limiting](./docs/best-practices.md)

### Coûts

- **Estimation** → [docs/best-practices.md#estimation-des-coûts](./docs/best-practices.md)
- **Optimisation** → [docs/best-practices.md#optimisation-des-coûts](./docs/best-practices.md)

### Monitoring

- **Observateurs** → [examples/advanced/custom-observer.ts](./examples/advanced/custom-observer.ts)
- **Logging** → [docs/api.md#logging](./docs/api.md)
- **Métriques** → [docs/best-practices.md#observabilité-et-monitoring](./docs/best-practices.md)

## 📖 Index par Type de Contenu

### Tutoriels

1. [Installation](./docs/getting-started.md#installation)
2. [Premier Agent](./docs/getting-started.md#votre-premier-agent)
3. [Première Société](./docs/getting-started.md#votre-première-société)
4. [Les Trois Modes](./docs/getting-started.md#les-trois-modes)
5. [Configuration Avancée](./docs/getting-started.md#configuration-avancée)
6. [Application Complète](./docs/getting-started.md#exemple-complet--application-réelle)

### Références

1. [Interface AIModel](./docs/api.md#aimodel)
2. [Interface ModelAdapter](./docs/api.md#modeladapter)
3. [Interface SocietyObserver](./docs/api.md#societyobserver)
4. [Classe StandardModelBase](./docs/api.md#standardmodelbase)
5. [Classe SocietyGroup](./docs/api.md#societygroup)
6. [Fonction society()](./docs/api.md#society)
7. [Fonction societyWithSynthesis()](./docs/api.md#societywithsynthesis)
8. [Fonction societyCollaborative()](./docs/api.md#societycollaborative)

### Guides Pratiques

1. [Choix du Mode](./docs/best-practices.md#choix-du-mode)
2. [Configuration des Agents](./docs/best-practices.md#configuration-des-agents)
3. [Gestion des Modèles](./docs/best-practices.md#gestion-des-modèles)
4. [Performance](./docs/best-practices.md#performance-et-optimisation)
5. [Gestion des Erreurs](./docs/best-practices.md#gestion-des-erreurs)
6. [Coûts et Budgets](./docs/best-practices.md#coûts-et-budgets)
7. [Observabilité](./docs/best-practices.md#observabilité-et-monitoring)
8. [Sécurité](./docs/best-practices.md#sécurité)
9. [Tests](./docs/best-practices.md#tests)
10. [Patterns Avancés](./docs/best-practices.md#patterns-avancés)

### Exemples de Code

#### Simples

- Mode standard basique
- Mode synthèse basique
- Mode collaboratif basique

#### Avancés

- Observateur avec métriques
- Multi-modèles
- Configuration retry
- Timeouts et annulation
- Adaptateurs personnalisés

#### Intégrations

- OpenAI GPT-3.5 et GPT-4
- Configuration avancée OpenAI

## 🎓 Ressources Pédagogiques

### Questions Fréquentes

- **Combien d'agents ?** → [docs/best-practices.md](./docs/best-practices.md#configuration-des-agents)
- **Quel mode choisir ?** → [docs/best-practices.md](./docs/best-practices.md#choix-du-mode)
- **Comment gérer les coûts ?** → [docs/best-practices.md](./docs/best-practices.md#coûts-et-budgets)
- **Comment debugger ?** → [docs/api.md](./docs/api.md#logging)

### Diagrammes

- Architecture générale → [docs/architecture.md](./docs/architecture.md)
- Mode standard → [docs/architecture.md](./docs/architecture.md)
- Mode synthèse → [docs/architecture.md](./docs/architecture.md)
- Mode collaboratif → [docs/architecture.md](./docs/architecture.md)
- Hiérarchie des erreurs → [docs/architecture.md](./docs/architecture.md)

### Tableaux de Référence

- Timeouts recommandés → [docs/best-practices.md](./docs/best-practices.md)
- Comparaison des modes → [docs/getting-started.md](./docs/getting-started.md)
- Niveaux de log → [docs/api.md](./docs/api.md)

## 🔗 Liens Externes

- [GitHub Repository](https://github.com/benoitpetit/societyai-package)
- [npm Package](https://www.npmjs.com/package/@societyai/core)
- [Issues](https://github.com/benoitpetit/societyai-package/issues)
- [Discussions](https://github.com/benoitpetit/societyai-package/discussions)

## 📊 Statistiques

- **Documentation** : 6 fichiers principaux
- **Exemples** : 6 fichiers avancés + 1 intégration
- **Guides** : 4 guides complets
- **Références** : 100+ API documentées

---

**Dernière mise à jour :** Janvier 2026

Pour toute question, consultez la [documentation](./docs/) ou ouvrez une [issue](https://github.com/benoitpetit/societyai-package/issues).
