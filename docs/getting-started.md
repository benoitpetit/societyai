# Guide de Démarrage - SocietyAI

Bienvenue dans SocietyAI ! Ce guide vous accompagnera pas à pas pour créer votre première société d'agents d'intelligence artificielle.

## Table des Matières

1. [Installation](#installation)
2. [Concepts Fondamentaux](#concepts-fondamentaux)
3. [Votre Premier Agent](#votre-premier-agent)
4. [Votre Première Société](#votre-première-société)
5. [Les Trois Modes](#les-trois-modes)
6. [Configuration Avancée](#configuration-avancée)
7. [Prochaines Étapes](#prochaines-étapes)

---

## Installation

### Prérequis

- Node.js version 16 ou supérieure
- npm ou yarn

### Installation du Package

```bash
npm install @societyai/core
```

ou avec yarn :

```bash
yarn add @societyai/core
```

### Vérification de l'Installation

Créez un fichier `test.ts` :

```typescript
import { society } from '@societyai/core';

console.log('SocietyAI installé avec succès !');
```

Exécutez :

```bash
npx ts-node test.ts
```

---

## Concepts Fondamentaux

Avant de commencer, comprenons les concepts clés de SocietyAI :

### 1. AIModel

Un **modèle d'IA** est une interface qui représente n'importe quel système d'IA capable de traiter un prompt et retourner une réponse.

```typescript
interface AIModel {
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  name(): string;
  supportsPromptType(promptType: string): boolean;
}
```

### 2. Agent

Un **agent** est une instance qui utilise un modèle d'IA pour traiter une tâche spécifique.

### 3. Society (Société)

Une **société** est un groupe d'agents qui travaillent ensemble pour analyser un prompt et générer une réponse collaborative.

### 4. Modes de Fonctionnement

- **Mode Standard** : Agents travaillent indépendamment, résultats agrégés
- **Mode Synthèse** : Un modèle dédié synthétise les résultats
- **Mode Collaboratif** : Processus en 4 phases avec partage d'informations

---

## Votre Premier Agent

### Étape 1 : Créer un Modèle Simulé

Pour commencer, créons un modèle simulé (sans connexion réelle à une API) :

```typescript
import { StandardModelBase } from '@societyai/core';

class SimulatedModel extends StandardModelBase {
  constructor(modelName: string) {
    super(
      { name: modelName },
      async (prompt: unknown) => {
        // Simuler un délai de traitement
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const promptText = String(prompt);
        
        // Simuler une réponse
        return `Réponse de ${modelName} : J'ai analysé "${promptText.substring(0, 50)}..." 
        et voici mon analyse détaillée du sujet.`;
      }
    );
  }
}
```

### Étape 2 : Utiliser le Modèle

```typescript
async function testModel() {
  const model = new SimulatedModel('TestModel');
  
  const response = await model.process('Qu\'est-ce que TypeScript ?');
  
  console.log(response);
}

testModel();
```

**Sortie attendue :**
```
Réponse de TestModel : J'ai analysé "Qu'est-ce que TypeScript ?..." 
et voici mon analyse détaillée du sujet.
```

---

## Votre Première Société

### Étape 1 : Créer une Société Simple

```typescript
import { society, StandardModelBase, setGlobalLogLevel, LogLevel } from '@societyai/core';

// Activer les logs pour voir ce qui se passe
setGlobalLogLevel(LogLevel.INFO);

// Créer un modèle
class SimpleModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'SimpleModel' },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `Analyse : ${String(prompt)}`;
      }
    );
  }
}

async function firstSociety() {
  const model = new SimpleModel();
  
  const result = await society(
    'Explique-moi TypeScript en termes simples',
    3,           // 3 agents
    [model],     // Modèle(s) à utiliser
    false        // Un seul modèle pour tous les agents
  );
  
  console.log('\n=== RÉSULTAT ===\n');
  console.log(result);
}

firstSociety();
```

### Étape 2 : Comprendre la Sortie

La fonction `society()` va :

1. Créer 3 agents
2. Donner à chaque agent une variation du prompt
3. Exécuter les agents en parallèle
4. Agréger les résultats

**Sortie attendue :**
```
Démarrage de la société avec 3 agents
Agent 0 (SimpleModel) démarre le traitement
Agent 1 (SimpleModel) démarre le traitement
Agent 2 (SimpleModel) démarre le traitement
Agent 0 (SimpleModel) a terminé avec succès
Agent 1 (SimpleModel) a terminé avec succès
Agent 2 (SimpleModel) a terminé avec succès
Tous les agents ont terminé

=== RÉSULTAT ===

Synthèse des analyses des agents:

Agent 1: Analyse : ...
Agent 2: Analyse : ...
Agent 3: Analyse : ...
```

---

## Les Trois Modes

### Mode 1 : Standard

**Quand l'utiliser :** Questions simples, besoin de rapidité

```typescript
import { society } from '@societyai/core';

async function modeStandard() {
  const result = await society(
    'Quels sont les avantages de TypeScript ?',
    3,
    [model],
    false
  );
  
  console.log(result);
}
```

**Caractéristiques :**
- ✅ Rapide
- ✅ Simple
- ✅ Bon pour premières analyses
- ⚠️ Agrégation basique des résultats

---

### Mode 2 : Synthèse

**Quand l'utiliser :** Besoin d'une réponse cohérente et unifiée

```typescript
import { societyWithSynthesis } from '@societyai/core';

async function modeSynthese() {
  const agentModel = new MyModel('Agent');
  const synthesisModel = new MyModel('Synthesis');
  
  const result = await societyWithSynthesis(
    'Compare les frameworks React, Vue et Angular',
    3,              // Agents
    [agentModel],   // Modèle pour agents
    false,          // Multi-modèle
    synthesisModel  // Modèle de synthèse
  );
  
  console.log(result);
}
```

**Caractéristiques :**
- ✅ Réponse cohérente et structurée
- ✅ Identifie points d'accord/désaccord
- ✅ Meilleure qualité de synthèse
- ⚠️ Un peu plus lent (étape supplémentaire)

---

### Mode 3 : Collaboratif

**Quand l'utiliser :** Questions complexes nécessitant analyse approfondie

```typescript
import { societyCollaborative } from '@societyai/core';

async function modeCollaboratif() {
  const result = await societyCollaborative(
    'Comment concevoir une architecture microservices scalable ?',
    5,        // 5 agents recommandés
    [model],
    false
  );
  
  console.log(result);
}
```

**Phases du mode collaboratif :**

1. **Analyse Initiale** : Compréhension approfondie du prompt
2. **Exploration de Dimensions** : Chaque agent explore un aspect
   - Fondamentaux
   - Aspects pratiques
   - Implications
   - Défis
   - Applications
3. **Intégration** : Combinaison organique des analyses
4. **Réponse Finale** : Génération d'une réponse complète

**Caractéristiques :**
- ✅ Analyse très approfondie
- ✅ Exploration multidimensionnelle
- ✅ Meilleure qualité pour sujets complexes
- ⚠️ Plus lent (4 phases séquentielles)

---

## Configuration Avancée

### Utiliser Plusieurs Modèles

```typescript
const modelA = new MyModel('GPT-4');
const modelB = new MyModel('Claude');
const modelC = new MyModel('Gemini');

const result = await society(
  'Question complexe',
  6,                          // 6 agents
  [modelA, modelB, modelC],  // 3 modèles différents
  true                        // Distribuer les modèles
);
```

Avec `multiModel: true`, les agents utiliseront les modèles en rotation :
- Agent 0 → modelA
- Agent 1 → modelB
- Agent 2 → modelC
- Agent 3 → modelA
- Agent 4 → modelB
- Agent 5 → modelC

### Ajouter un Observateur

Un observateur permet de suivre le cycle de vie :

```typescript
import { SocietyObserver } from '@societyai/core';

class MyObserver implements SocietyObserver {
  onSocietyStart(prompt: string, agentCount: number): void {
    console.log(`🚀 Démarrage : ${agentCount} agents`);
  }
  
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    console.log(`🤖 Agent ${agentId} (${modelName}) démarre`);
  }
  
  onAgentComplete(agentId: number, modelName: string, result: string): void {
    console.log(`✅ Agent ${agentId} terminé`);
  }
  
  onAgentError(agentId: number, modelName: string, error: Error): void {
    console.error(`❌ Agent ${agentId} erreur: ${error.message}`);
  }
  
  onPhaseStart(phase: string): void {
    console.log(`📋 Phase: ${phase}`);
  }
  
  onPhaseComplete(phase: string): void {
    console.log(`✓ Phase ${phase} terminée`);
  }
  
  onSocietyComplete(finalResult: string): void {
    console.log(`🎉 Société terminée`);
  }
}

// Utilisation
const observer = new MyObserver();
const result = await society('Question', 3, [model], false, observer);
```

### Configurer les Timeouts

```typescript
const model = new StandardModelBase(
  {
    name: 'MyModel',
    timeout: 30000  // 30 secondes par agent
  },
  async (prompt) => {
    // Traitement
  }
);
```

### Configurer le Retry

```typescript
import { defaultRetryOptions } from '@societyai/core';

const model = new StandardModelBase(
  {
    name: 'MyModel',
    retryOptions: {
      maxAttempts: 5,        // 5 tentatives max
      initialDelay: 2000,    // 2 secondes initial
      maxDelay: 30000,       // 30 secondes max
      backoffMultiplier: 2,  // Doublement du délai
      jitter: true           // Ajouter de l'aléatoire
    }
  },
  async (prompt) => {
    // Traitement
  }
);
```

### Utiliser un Adaptateur

Les adaptateurs permettent d'adapter les formats de prompts/réponses :

```typescript
import { OpenAIAdapter } from '@societyai/core';

const model = new StandardModelBase(
  {
    name: 'MyModel',
    adapter: new OpenAIAdapter()  // Format OpenAI
  },
  async (prompt) => {
    // prompt est maintenant au format OpenAI
    // { messages: [{ role: 'user', content: '...' }] }
  }
);
```

**Adaptateurs disponibles :**
- `TextModelAdapter` : Format texte simple
- `OpenAIAdapter` : Format OpenAI messages
- `GeminiAdapter` : Format Google Gemini

---

## Gestion des Erreurs

### Try-Catch Basique

```typescript
try {
  const result = await society('Question', 3, [model]);
  console.log(result);
} catch (error) {
  console.error('Erreur:', error.message);
}
```

### Gestion Spécifique des Erreurs

```typescript
import {
  InvalidAgentCountError,
  NoModelsSpecifiedError,
  TimeoutError
} from '@societyai/core';

try {
  const result = await society('Question', 0, []); // Invalide !
} catch (error) {
  if (error instanceof InvalidAgentCountError) {
    console.error('Le nombre d\'agents doit être > 0');
  } else if (error instanceof NoModelsSpecifiedError) {
    console.error('Vous devez fournir au moins un modèle');
  } else if (error instanceof TimeoutError) {
    console.error('L\'opération a dépassé le timeout');
  } else {
    console.error('Erreur inconnue:', error);
  }
}
```

### Annulation avec AbortSignal

```typescript
const controller = new AbortController();

// Annuler après 10 secondes
setTimeout(() => controller.abort(), 10000);

try {
  // Les modèles doivent supporter signal
  const result = await society('Question', 3, [model]);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Opération annulée');
  }
}
```

---

## Exemple Complet : Application Réelle

Voici un exemple complet d'application avec toutes les fonctionnalités :

```typescript
import {
  StandardModelBase,
  societyCollaborative,
  setGlobalLogLevel,
  LogLevel,
  SocietyObserver,
  OpenAIAdapter
} from '@societyai/core';

// 1. Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

// 2. Créer un observateur personnalisé
class ProgressObserver implements SocietyObserver {
  private startTime: number = 0;
  
  onSocietyStart(prompt: string, agentCount: number): void {
    this.startTime = Date.now();
    console.log(`\n🚀 Démarrage de l'analyse`);
    console.log(`📝 Prompt: ${prompt.substring(0, 50)}...`);
    console.log(`👥 Agents: ${agentCount}\n`);
  }
  
  onPhaseStart(phase: string): void {
    console.log(`📋 Phase: ${phase}`);
  }
  
  onPhaseComplete(phase: string): void {
    console.log(`✅ Phase "${phase}" terminée\n`);
  }
  
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    console.log(`  🤖 Agent ${agentId} (${modelName}) en cours...`);
  }
  
  onAgentComplete(agentId: number, modelName: string, result: string): void {
    console.log(`  ✓ Agent ${agentId} terminé`);
  }
  
  onAgentError(agentId: number, modelName: string, error: Error): void {
    console.error(`  ❌ Agent ${agentId} erreur: ${error.message}`);
  }
  
  onSocietyComplete(finalResult: string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Analyse terminée en ${elapsed}s`);
    console.log(`📊 Taille de la réponse: ${finalResult.length} caractères\n`);
  }
}

// 3. Créer un modèle réaliste
class MyAIModel extends StandardModelBase {
  constructor(apiKey: string) {
    super(
      {
        name: 'MyAI-Model',
        timeout: 30000,
        adapter: new OpenAIAdapter(),
        retryOptions: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true
        }
      },
      async (prompt: unknown, signal?: AbortSignal) => {
        // Ici, vous appelleriez votre API réelle
        // Pour l'exemple, on simule
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (signal?.aborted) {
          throw new Error('Opération annulée');
        }
        
        return `Analyse détaillée du prompt...`;
      }
    );
  }
}

// 4. Fonction principale
async function main() {
  try {
    // Créer le modèle
    const model = new MyAIModel('your-api-key');
    
    // Créer l'observateur
    const observer = new ProgressObserver();
    
    // Poser une question complexe
    const question = `
      Comment concevoir une architecture microservices évolutive 
      pour une application e-commerce à fort trafic, en tenant compte 
      de la scalabilité, de la résilience et de la sécurité ?
    `.trim();
    
    // Lancer la société collaborative
    const result = await societyCollaborative(
      question,
      5,          // 5 agents
      [model],
      false,
      observer
    );
    
    // Afficher le résultat
    console.log('='.repeat(80));
    console.log('RÉSULTAT FINAL');
    console.log('='.repeat(80));
    console.log(result);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// 5. Exécuter
main();
```

### Exécuter l'Application

```bash
npx ts-node app.ts
```

---

## Prochaines Étapes

Maintenant que vous maîtrisez les bases, voici comment aller plus loin :

### 1. Explorez les Exemples

Consultez le dossier `examples/` pour des cas d'usage avancés :
- `examples/advanced/` - Patterns avancés
- `examples/integrations/` - Intégrations avec APIs réelles

### 2. Lisez la Documentation Complète

- [Architecture](./architecture.md) - Comprendre l'architecture interne
- [API Reference](./api.md) - Référence complète des API
- [Best Practices](./best-practices.md) - Bonnes pratiques et patterns

### 3. Intégrez avec de Vraies APIs

Créez des adaptateurs pour :
- OpenAI GPT-4
- Anthropic Claude
- Google Gemini
- Mistral AI
- Votre propre modèle

### 4. Contribuez

SocietyAI est open-source ! Consultez [CONTRIBUTING.md](../CONTRIBUTING.md)

### 5. Rejoignez la Communauté

- GitHub Issues : Rapporter des bugs ou demander des fonctionnalités
- Discussions : Partager vos cas d'usage

---

## Résumé des Commandes

```bash
# Installation
npm install @societyai/core

# Exemple basique
import { society, StandardModelBase } from '@societyai/core';

# Mode standard (rapide)
await society(prompt, 3, [model], false);

# Mode synthèse (cohérent)
await societyWithSynthesis(prompt, 3, [model], false, synthModel);

# Mode collaboratif (approfondi)
await societyCollaborative(prompt, 5, [model], false);
```

---

## Aide et Support

### Questions Fréquentes

**Q: Combien d'agents devrais-je utiliser ?**
- Mode standard/synthèse : 3-5 agents
- Mode collaboratif : 5-7 agents (un par dimension)

**Q: Quel mode choisir ?**
- Simple/rapide → Mode standard
- Cohérence → Mode synthèse
- Complexité → Mode collaboratif

**Q: Comment gérer les coûts API ?**
- Limitez le nombre d'agents
- Configurez des timeouts
- Utilisez le caching si possible
- Testez avec des modèles simulés d'abord

**Q: Comment debugger ?**
```typescript
setGlobalLogLevel(LogLevel.DEBUG);
```

### Ressources

- 📖 [Documentation complète](../docs/)
- 💡 [Exemples](../examples/)
- 🐛 [Issues GitHub](https://github.com/benoitpetit/societyai/issues)
- 📝 [Changelog](../CHANGELOG.md)

---

Félicitations ! Vous êtes maintenant prêt à créer des sociétés d'agents d'IA sophistiquées avec SocietyAI ! 🎉
