# SocietyAI

[![npm version](https://img.shields.io/npm/v/@societyai/core.svg)](https://www.npmjs.com/package/@societyai/core)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

SocietyAI est une bibliothèque TypeScript permettant de créer une société d'agents d'intelligence artificielle qui collaborent pour analyser en profondeur un prompt et générer une réponse réfléchie.

## ✨ Caractéristiques

- **🤖 Architecture Multi-Agents** : Création d'une société d'agents AI travaillant ensemble de manière coordonnée
- **🔌 Interface Flexible de Modèles** :
  - Architecture abstraite via l'interface `AIModel`
  - Support pour n'importe quel modèle d'IA
  - Adaptateurs intégrés (TextModelAdapter, OpenAIAdapter, GeminiAdapter)
- **⚙️ Trois Modes de Fonctionnement** :
  - Mode standard avec distribution des tâches
  - Mode synthèse avec modèle dédié
  - Mode collaboratif avec analyse approfondie en 4 étapes
- **⚡ Performance Optimisée** :
  - Traitement asynchrone via Promises
  - Pool de workers pour parallélisation
  - Gestion des timeouts et annulations
- **🛡️ Robustesse** :
  - Mécanisme de retry avec backoff exponentiel et jitter
  - Gestion élégante des erreurs
  - Support de AbortSignal pour annulation
- **📊 Observabilité** :
  - Système de logging configurable
  - Interface SocietyObserver pour suivre le cycle de vie

## 📦 Installation

```bash
npm install @societyai/core
```

ou avec yarn :

```bash
yarn add @societyai/core
```

## 🚀 Démarrage Rapide

### Mode Standard

```typescript
import { society, StandardModelBase } from '@societyai/core';

// Implémentation de votre propre modèle
class MyCustomModel extends StandardModelBase {
  constructor() {
    super({ name: 'MyCustomModel' }, async (prompt: unknown) => {
      // Connexion à votre API d'IA préférée
      const response = await fetch('https://api.example.com/ai', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      return await response.text();
    });
  }
}

// Utilisation
const model = new MyCustomModel();
const result = await society('Explique-moi la théorie de la relativité', 3, [model], false);

console.log(result);
```

### Mode Synthèse

```typescript
import { societyWithSynthesis } from '@societyai/core';

const models = [new MyCustomModel()];
const synthesisModel = new MyCustomModel();

const result = await societyWithSynthesis(
  'Quels sont les avantages de TypeScript ?',
  3,
  models,
  false,
  synthesisModel
);
```

### Mode Collaboratif

Le mode collaboratif utilise une approche en 4 étapes pour une analyse approfondie :

```typescript
import { societyCollaborative } from '@societyai/core';

const models = [new MyCustomModel()];

const result = await societyCollaborative(
  "Comment améliorer la performance d'une application web ?",
  5,
  models,
  false
);
```

## 🏗️ Architecture

### Structure du Projet

```
src/
├── types.ts          # Interfaces et types de base
├── config.ts         # Configuration et options
├── errors.ts         # Gestion des erreurs
├── logger.ts         # Système de logging
├── retry.ts          # Mécanisme de retry
├── worker-pool.ts    # Pool de workers
├── models.ts         # Modèles de base et adaptateurs
├── society.ts        # Logique principale
└── index.ts          # Point d'entrée
```

### Interfaces Principales

#### AIModel

L'interface que tout modèle d'IA doit implémenter :

```typescript
interface AIModel {
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  name(): string;
  supportsPromptType(promptType: string): boolean;
}
```

#### SocietyConfig

Configuration de la société d'agents :

```typescript
interface SocietyConfig {
  prompt: string;
  agentCount: number;
  multiModel?: boolean;
  collaborative?: boolean;
  timeout?: number;
  observer?: SocietyObserver;
}
```

## 🔧 Configuration Avancée

### Utilisation d'un Logger Personnalisé

```typescript
import { setLogger, LogLevel } from '@societyai/core';

class CustomLogger {
  debug(message: string, ...args: unknown[]): void {
    // Votre implémentation
  }

  info(message: string, ...args: unknown[]): void {
    // Votre implémentation
  }

  error(message: string, ...args: unknown[]): void {
    // Votre implémentation
  }

  setLevel(level: LogLevel): void {
    // Votre implémentation
  }
}

setLogger(new CustomLogger());
```

### Utilisation d'un Observer

```typescript
import { SocietyObserver } from '@societyai/core';

const observer: SocietyObserver = {
  onAgentStart(agentId, modelName, prompt) {
    console.log(`Agent ${agentId} démarre avec ${modelName}`);
  },

  onAgentComplete(agentId, modelName, result) {
    console.log(`Agent ${agentId} a terminé`);
  },

  onAgentError(agentId, modelName, error) {
    console.error(`Agent ${agentId} a échoué:`, error);
  },

  onPhaseStart(phase) {
    console.log(`Phase démarrée: ${phase}`);
  },

  onPhaseComplete(phase) {
    console.log(`Phase terminée: ${phase}`);
  },

  onSocietyStart(prompt, agentCount) {
    console.log(`Société démarrée avec ${agentCount} agents`);
  },

  onSocietyComplete(finalResult) {
    console.log('Société terminée');
  },
};

const result = await society('Votre prompt', 3, [model], false, observer);
```

### Adaptateurs de Modèles

SocietyAI fournit plusieurs adaptateurs pour faciliter l'intégration avec différents services d'IA :

```typescript
import { TextModelAdapter, OpenAIAdapter, GeminiAdapter } from '@societyai/core';

// Pour les modèles basés sur du texte simple
const textAdapter = new TextModelAdapter();

// Pour les modèles OpenAI
const openaiAdapter = new OpenAIAdapter();

// Pour les modèles Google Gemini
const geminiAdapter = new GeminiAdapter();
```

## 📖 Exemples d'Utilisation

### Avec Timeouts et Annulation

```typescript
const controller = new AbortController();

// Annuler après 30 secondes
setTimeout(() => controller.abort(), 30000);

try {
  const result = await society('Votre prompt', 3, [model], false);
  console.log(result);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Opération annulée');
  }
}
```

### Multi-Modèles

```typescript
const models = [new ModelA(), new ModelB(), new ModelC()];

// Les agents utiliseront différents modèles en rotation
const result = await society(
  'Votre prompt',
  6,
  models,
  true // multiModel activé
);
```

## 🧪 Tests

```bash
npm test
```

Pour les tests avec couverture :

```bash
npm run test:coverage
```

## 🏗️ Build

```bash
npm run build
```

Le package sera compilé dans le dossier `dist/`.

## 📝 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📧 Support

Pour toute question ou problème, veuillez ouvrir une issue sur GitHub.

## 🔗 Liens

- [Documentation complète](https://github.com/benoitpetit/societyai-package)
- [Exemples](./examples)
- [Changelog](./CHANGELOG.md)

---

Développé avec ❤️ par la communauté SocietyAI
