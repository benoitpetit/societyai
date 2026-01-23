# Référence API - SocietyAI

Cette documentation détaille toutes les interfaces, classes et fonctions disponibles dans SocietyAI.

## Table des Matières

- [Interfaces](#interfaces)
  - [AIModel](#aimodel)
  - [ModelAdapter](#modeladapter)
  - [SocietyObserver](#societyobserver)
  - [SocietyConfig](#societyconfig)
  - [Agent](#agent)
  - [CollaborativeContext](#collaborativecontext)
- [Classes](#classes)
  - [StandardModelBase](#standardmodelbase)
  - [TextModelAdapter](#textmodeladapter)
  - [OpenAIAdapter](#openaiadapter)
  - [GeminiAdapter](#geminiadapter)
  - [SocietyGroup](#societygroup)
  - [WorkerPool](#workerpool)
- [Fonctions](#fonctions)
  - [society()](#society)
  - [societyWithSynthesis()](#societywithsynthesis)
  - [societyCollaborative()](#societycollaborative)
- [Types et Options](#types-et-options)
- [Gestion des Erreurs](#gestion-des-erreurs)
- [Logging](#logging)

---

## Interfaces

### AIModel

Interface principale que tous les modèles d'IA doivent implémenter.

```typescript
interface AIModel {
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  name(): string;
  supportsPromptType(promptType: string): boolean;
}
```

#### Méthodes

##### `process(prompt, signal?)`

Traite un prompt et retourne une réponse.

**Paramètres :**
- `prompt: unknown` - Le prompt à traiter (format flexible)
- `signal?: AbortSignal` - Signal optionnel pour annuler l'opération

**Retourne :** `Promise<string>` - La réponse générée

**Exemple :**
```typescript
const response = await model.process("Explique la gravité", abortSignal);
```

##### `name()`

Retourne le nom du modèle.

**Retourne :** `string` - Nom du modèle

##### `supportsPromptType(promptType)`

Vérifie si le modèle supporte un type de prompt spécifique.

**Paramètres :**
- `promptType: string` - Type de prompt à vérifier ('text', 'structured', etc.)

**Retourne :** `boolean`

---

### ModelAdapter

Interface pour adapter les prompts et réponses entre différents formats.

```typescript
interface ModelAdapter {
  convertPrompt(genericPrompt: unknown): Promise<unknown>;
  convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

#### Méthodes

##### `convertPrompt(genericPrompt)`

Convertit un prompt générique au format spécifique du modèle.

**Paramètres :**
- `genericPrompt: unknown` - Prompt au format générique

**Retourne :** `Promise<unknown>` - Prompt converti

##### `convertResponse(specificResponse)`

Convertit une réponse spécifique au format string standard.

**Paramètres :**
- `specificResponse: unknown` - Réponse dans le format du modèle

**Retourne :** `Promise<string>` - Réponse normalisée

##### `getSupportedPromptTypes()`

Liste les types de prompts supportés.

**Retourne :** `string[]` - Tableau des types supportés

---

### SocietyObserver

Interface pour observer les événements du cycle de vie d'une société.

```typescript
interface SocietyObserver {
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void;
  onAgentComplete(agentId: number, modelName: string, result: string): void;
  onAgentError(agentId: number, modelName: string, error: Error): void;
  onPhaseStart(phase: string): void;
  onPhaseComplete(phase: string): void;
  onSocietyStart(prompt: string, agentCount: number): void;
  onSocietyComplete(finalResult: string): void;
}
```

#### Méthodes

##### `onAgentStart(agentId, modelName, prompt)`

Appelé quand un agent commence le traitement.

**Paramètres :**
- `agentId: number` - Identifiant de l'agent
- `modelName: string` - Nom du modèle utilisé
- `prompt: unknown` - Prompt traité

##### `onAgentComplete(agentId, modelName, result)`

Appelé quand un agent termine avec succès.

**Paramètres :**
- `agentId: number` - Identifiant de l'agent
- `modelName: string` - Nom du modèle utilisé
- `result: string` - Résultat généré

##### `onAgentError(agentId, modelName, error)`

Appelé quand un agent rencontre une erreur.

**Paramètres :**
- `agentId: number` - Identifiant de l'agent
- `modelName: string` - Nom du modèle utilisé
- `error: Error` - Erreur rencontrée

##### `onPhaseStart(phase)`

Appelé au début d'une phase (mode collaboratif).

**Paramètres :**
- `phase: string` - Nom de la phase

##### `onPhaseComplete(phase)`

Appelé à la fin d'une phase.

**Paramètres :**
- `phase: string` - Nom de la phase

##### `onSocietyStart(prompt, agentCount)`

Appelé au démarrage de la société.

**Paramètres :**
- `prompt: string` - Prompt initial
- `agentCount: number` - Nombre d'agents

##### `onSocietyComplete(finalResult)`

Appelé quand la société termine le traitement.

**Paramètres :**
- `finalResult: string` - Résultat final

---

### SocietyConfig

Configuration pour créer une société d'agents.

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

#### Propriétés

- `prompt: string` - Prompt à analyser
- `agentCount: number` - Nombre d'agents à créer
- `multiModel?: boolean` - Si true, distribue les modèles entre agents
- `collaborative?: boolean` - Active le mode collaboratif
- `timeout?: number` - Timeout global en millisecondes
- `observer?: SocietyObserver` - Observateur pour le monitoring

---

### Agent

Représente un agent individuel dans la société.

```typescript
interface Agent {
  id: number;
  model: AIModel;
  prompt: unknown;
  phase?: number;
  dimensionToExplore?: string;
  sharedAnalysis?: string;
}
```

#### Propriétés

- `id: number` - Identifiant unique
- `model: AIModel` - Modèle d'IA utilisé
- `prompt: unknown` - Prompt à traiter
- `phase?: number` - Phase actuelle (mode collaboratif)
- `dimensionToExplore?: string` - Dimension assignée (mode collaboratif)
- `sharedAnalysis?: string` - Analyse partagée entre agents

---

### CollaborativeContext

Contexte partagé en mode collaboratif.

```typescript
interface CollaborativeContext {
  dimensions: string[];
  sharedInsights: string[];
  initialAnalysis?: string;
  integratedAnalysis?: string;
}
```

#### Propriétés

- `dimensions: string[]` - Dimensions à explorer
- `sharedInsights: string[]` - Insights collectés
- `initialAnalysis?: string` - Analyse initiale
- `integratedAnalysis?: string` - Analyse intégrée finale

---

## Classes

### StandardModelBase

Classe de base abstraite pour implémenter des modèles d'IA.

```typescript
abstract class StandardModelBase implements AIModel {
  constructor(
    options?: Partial<StandardModelOptions>,
    processFunc?: (prompt: unknown, signal?: AbortSignal) => Promise<string>
  );
  
  name(): string;
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  supportsPromptType(promptType: string): boolean;
  
  withName(name: string): this;
  withAdapter(adapter: ModelAdapter): this;
  withTimeout(timeout: number): this;
  withSupportedPromptTypes(types: string[]): this;
}
```

#### Constructeur

```typescript
constructor(
  options?: Partial<StandardModelOptions>,
  processFunc?: (prompt: unknown, signal?: AbortSignal) => Promise<string>
)
```

**Paramètres :**
- `options?: Partial<StandardModelOptions>` - Options de configuration
- `processFunc?: Function` - Fonction de traitement custom

**Options disponibles :**
```typescript
interface StandardModelOptions {
  name: string;
  timeout: number;
  retryOptions: RetryOptions;
  logger: Logger;
  adapter?: ModelAdapter;
}
```

#### Méthodes

##### `withName(name)`

Configure le nom du modèle (chaînable).

**Paramètres :**
- `name: string` - Nouveau nom

**Retourne :** `this`

**Exemple :**
```typescript
const model = new MyModel()
  .withName('GPT-4')
  .withTimeout(30000);
```

##### `withAdapter(adapter)`

Configure l'adaptateur (chaînable).

**Paramètres :**
- `adapter: ModelAdapter` - Adaptateur à utiliser

**Retourne :** `this`

##### `withTimeout(timeout)`

Configure le timeout (chaînable).

**Paramètres :**
- `timeout: number` - Timeout en millisecondes

**Retourne :** `this`

##### `withSupportedPromptTypes(types)`

Configure les types de prompts supportés (chaînable).

**Paramètres :**
- `types: string[]` - Types supportés

**Retourne :** `this`

#### Exemple d'Implémentation

```typescript
class MyCustomModel extends StandardModelBase {
  constructor(apiKey: string) {
    super(
      { 
        name: 'MyCustomModel',
        timeout: 30000 
      },
      async (prompt: unknown) => {
        // Votre logique de traitement
        const response = await fetch('https://api.example.com', {
          method: 'POST',
          body: JSON.stringify({ prompt }),
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return await response.text();
      }
    );
  }
}
```

---

### TextModelAdapter

Adaptateur simple pour modèles textuels.

```typescript
class TextModelAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown>;
  async convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

**Usage :**
```typescript
const adapter = new TextModelAdapter();
const model = new StandardModelBase({ adapter });
```

---

### OpenAIAdapter

Adaptateur pour le format OpenAI.

```typescript
class OpenAIAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown>;
  async convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

**Format de sortie :**
```typescript
{
  messages: [
    { role: 'user', content: prompt }
  ]
}
```

**Usage :**
```typescript
const adapter = new OpenAIAdapter();
const model = new StandardModelBase({ adapter });
```

---

### GeminiAdapter

Adaptateur pour le format Google Gemini.

```typescript
class GeminiAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown>;
  async convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

**Format de sortie :**
```typescript
{
  contents: [
    { role: 'user', parts: [{ text: prompt }] }
  ]
}
```

---

### SocietyGroup

Classe qui orchestre une société d'agents.

```typescript
class SocietyGroup {
  public agents: Agent[];
  public models: AIModel[];
  public multiModel: boolean;
  public context?: CollaborativeContext;
  public observer?: SocietyObserver;
  
  constructor(
    agents: Agent[],
    models: AIModel[],
    multiModel?: boolean,
    context?: CollaborativeContext,
    observer?: SocietyObserver
  );
  
  async run(signal?: AbortSignal): Promise<void>;
  async collectResults(signal?: AbortSignal): Promise<string>;
  async collectResultsWithSynthesisModel(
    synthesisModel: AIModel, 
    signal?: AbortSignal
  ): Promise<string>;
  
  // Mode collaboratif
  async performInitialAnalysis(signal?: AbortSignal): Promise<void>;
  async exploreDimensions(signal?: AbortSignal): Promise<void>;
  async integrateAnalyses(signal?: AbortSignal): Promise<void>;
  async generateFinalResponse(signal?: AbortSignal): Promise<string>;
}
```

#### Méthodes

##### `run(signal?)`

Lance tous les agents en parallèle.

**Paramètres :**
- `signal?: AbortSignal` - Signal d'annulation

**Retourne :** `Promise<void>`

##### `collectResults(signal?)`

Collecte et agrège les résultats des agents.

**Paramètres :**
- `signal?: AbortSignal` - Signal d'annulation

**Retourne :** `Promise<string>` - Résultats agrégés

##### `collectResultsWithSynthesisModel(synthesisModel, signal?)`

Collecte les résultats et utilise un modèle pour la synthèse.

**Paramètres :**
- `synthesisModel: AIModel` - Modèle de synthèse
- `signal?: AbortSignal` - Signal d'annulation

**Retourne :** `Promise<string>` - Résultat synthétisé

---

### WorkerPool

Pool de workers pour parallélisation.

```typescript
class WorkerPool {
  constructor(maxWorkers: number, signal?: AbortSignal);
  
  async submit<T>(task: () => Promise<T>): Promise<T>;
  async waitAll(): Promise<void>;
}
```

#### Constructeur

```typescript
constructor(maxWorkers: number, signal?: AbortSignal)
```

**Paramètres :**
- `maxWorkers: number` - Nombre maximum de workers simultanés
- `signal?: AbortSignal` - Signal d'annulation global

#### Méthodes

##### `submit(task)`

Soumet une tâche au pool.

**Paramètres :**
- `task: () => Promise<T>` - Fonction asynchrone à exécuter

**Retourne :** `Promise<T>` - Résultat de la tâche

##### `waitAll()`

Attend que toutes les tâches soient terminées.

**Retourne :** `Promise<void>`

**Exemple :**
```typescript
const pool = new WorkerPool(3);

await pool.submit(async () => {
  return await processTask1();
});

await pool.submit(async () => {
  return await processTask2();
});

await pool.waitAll();
```

---

## Fonctions

### society()

Crée une société d'agents en mode standard.

```typescript
async function society(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel?: boolean,
  observer?: SocietyObserver
): Promise<string>
```

**Paramètres :**
- `prompt: string` - Prompt à analyser
- `agentCount: number` - Nombre d'agents (doit être > 0)
- `models: AIModel[]` - Tableau de modèles d'IA
- `multiModel?: boolean` - Distribuer les modèles entre agents (défaut: false)
- `observer?: SocietyObserver` - Observateur optionnel

**Retourne :** `Promise<string>` - Résultat agrégé

**Throws :**
- `InvalidAgentCountError` - Si agentCount <= 0
- `NoModelsSpecifiedError` - Si models est vide

**Exemple :**
```typescript
const result = await society(
  'Explique TypeScript',
  3,
  [new MyModel()],
  false
);
console.log(result);
```

---

### societyWithSynthesis()

Crée une société avec modèle de synthèse dédié.

```typescript
async function societyWithSynthesis(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel: boolean,
  synthModel: AIModel,
  observer?: SocietyObserver
): Promise<string>
```

**Paramètres :**
- `prompt: string` - Prompt à analyser
- `agentCount: number` - Nombre d'agents
- `models: AIModel[]` - Modèles pour les agents
- `multiModel: boolean` - Distribution des modèles
- `synthModel: AIModel` - Modèle dédié à la synthèse
- `observer?: SocietyObserver` - Observateur optionnel

**Retourne :** `Promise<string>` - Résultat synthétisé

**Throws :**
- `InvalidAgentCountError` - Si agentCount <= 0
- `NoModelsSpecifiedError` - Si models est vide
- `SynthesisModelRequiredError` - Si synthModel est null/undefined

**Exemple :**
```typescript
const result = await societyWithSynthesis(
  'Avantages de TypeScript',
  3,
  [new ModelA()],
  false,
  new ModelB() // Modèle de synthèse
);
```

---

### societyCollaborative()

Crée une société en mode collaboratif (4 phases).

```typescript
async function societyCollaborative(
  prompt: string,
  agentCount: number,
  models: AIModel[],
  multiModel?: boolean,
  observer?: SocietyObserver
): Promise<string>
```

**Paramètres :**
- `prompt: string` - Prompt à analyser
- `agentCount: number` - Nombre d'agents (recommandé: 3-7)
- `models: AIModel[]` - Modèles d'IA
- `multiModel?: boolean` - Distribution des modèles
- `observer?: SocietyObserver` - Observateur optionnel

**Retourne :** `Promise<string>` - Réponse finale collaborative

**Phases exécutées :**
1. Analyse initiale
2. Exploration de dimensions
3. Intégration des analyses
4. Génération réponse finale

**Exemple :**
```typescript
const result = await societyCollaborative(
  'Comment améliorer la performance web ?',
  5,
  [new MyModel()],
  false
);
```

---

## Types et Options

### StandardModelOptions

```typescript
interface StandardModelOptions {
  name: string;              // Nom du modèle
  timeout: number;           // Timeout en ms (défaut: 20000)
  retryOptions: RetryOptions; // Options de retry
  logger: Logger;            // Logger
  adapter?: ModelAdapter;    // Adaptateur optionnel
}
```

### RetryOptions

```typescript
interface RetryOptions {
  maxAttempts: number;       // Nombre max de tentatives (défaut: 3)
  initialDelay: number;      // Délai initial en ms (défaut: 1000)
  maxDelay: number;          // Délai max en ms (défaut: 10000)
  backoffMultiplier: number; // Multiplicateur backoff (défaut: 2)
  jitter: boolean;           // Ajouter du jitter (défaut: true)
}
```

**Valeurs par défaut :**
```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true
}
```

### LogLevel

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}
```

---

## Gestion des Erreurs

### Hiérarchie des Erreurs

```typescript
class SocietyError extends Error {}

class InvalidAgentCountError extends SocietyError {}
class NoModelsSpecifiedError extends SocietyError {}
class SynthesisModelRequiredError extends SocietyError {}
class ProcessingFailedError extends SocietyError {}
class TimeoutError extends SocietyError {}
```

### InvalidAgentCountError

Lancée quand le nombre d'agents est invalide (≤ 0).

```typescript
throw new InvalidAgentCountError();
// Message: "Le nombre d'agents doit être supérieur à 0"
```

### NoModelsSpecifiedError

Lancée quand aucun modèle n'est fourni.

```typescript
throw new NoModelsSpecifiedError();
// Message: "Au moins un modèle d'IA doit être spécifié"
```

### SynthesisModelRequiredError

Lancée quand un modèle de synthèse est requis mais absent.

```typescript
throw new SynthesisModelRequiredError();
// Message: "Un modèle de synthèse est requis pour ce mode"
```

### ProcessingFailedError

Lancée quand le traitement échoue.

```typescript
throw new ProcessingFailedError('Raison de l\'échec');
```

### TimeoutError

Lancée lors d'un timeout.

```typescript
throw new TimeoutError('L\'opération a dépassé le timeout');
```

### Gestion des Erreurs

```typescript
try {
  const result = await society(prompt, 3, [model]);
} catch (error) {
  if (error instanceof InvalidAgentCountError) {
    console.error('Nombre d\'agents invalide');
  } else if (error instanceof TimeoutError) {
    console.error('Timeout dépassé');
  } else {
    console.error('Erreur:', error.message);
  }
}
```

---

## Logging

### Configuration Globale

```typescript
import { setGlobalLogLevel, LogLevel } from '@societyai/core';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

// Niveaux disponibles:
// LogLevel.DEBUG  - Très verbeux
// LogLevel.INFO   - Informations générales
// LogLevel.WARN   - Avertissements
// LogLevel.ERROR  - Erreurs uniquement
```

### Obtenir le Logger

```typescript
import { getLogger } from '@societyai/core';

const logger = getLogger();

logger.debug('Message de debug');
logger.info('Information');
logger.warn('Avertissement');
logger.error('Erreur');
```

### Logger Personnalisé

```typescript
interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// Implémenter votre propre logger
class MyLogger implements Logger {
  debug(message: string): void {
    // Votre implémentation
  }
  // ... autres méthodes
}
```

---

## Utilitaires

### withRetry()

Fonction utilitaire pour retry automatique.

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryOptions>,
  signal?: AbortSignal
): Promise<T>
```

**Paramètres :**
- `operation: () => Promise<T>` - Opération à exécuter
- `options?: Partial<RetryOptions>` - Options de retry
- `signal?: AbortSignal` - Signal d'annulation

**Retourne :** `Promise<T>` - Résultat de l'opération

**Exemple :**
```typescript
import { withRetry } from '@societyai/core';

const result = await withRetry(
  async () => {
    return await riskyOperation();
  },
  {
    maxAttempts: 5,
    initialDelay: 2000
  }
);
```

### wrapError()

Encapsule une erreur avec un message contextuel.

```typescript
function wrapError(error: Error, context: string): Error
```

**Exemple :**
```typescript
try {
  await operation();
} catch (error) {
  throw wrapError(error as Error, 'Échec de l\'opération');
}
```

---

## Exemples Complets

### Exemple 1 : Modèle Custom Simple

```typescript
import { StandardModelBase, society } from '@societyai/core';

class MyModel extends StandardModelBase {
  constructor(apiKey: string) {
    super(
      { name: 'MyModel', timeout: 30000 },
      async (prompt: unknown) => {
        const response = await fetch('https://api.example.com', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ prompt })
        });
        return await response.text();
      }
    );
  }
}

const model = new MyModel('your-api-key');
const result = await society('Question', 3, [model]);
```

### Exemple 2 : Avec Observateur

```typescript
import { SocietyObserver, society } from '@societyai/core';

class MyObserver implements SocietyObserver {
  onAgentStart(id: number, model: string, prompt: unknown): void {
    console.log(`Agent ${id} démarre avec ${model}`);
  }
  
  onAgentComplete(id: number, model: string, result: string): void {
    console.log(`Agent ${id} a terminé`);
  }
  
  onAgentError(id: number, model: string, error: Error): void {
    console.error(`Agent ${id} erreur:`, error.message);
  }
  
  onPhaseStart(phase: string): void {
    console.log(`Phase: ${phase}`);
  }
  
  onPhaseComplete(phase: string): void {
    console.log(`Phase ${phase} terminée`);
  }
  
  onSocietyStart(prompt: string, count: number): void {
    console.log(`Démarrage avec ${count} agents`);
  }
  
  onSocietyComplete(result: string): void {
    console.log('Société terminée');
  }
}

const observer = new MyObserver();
const result = await society('Question', 3, [model], false, observer);
```

### Exemple 3 : Mode Collaboratif avec Timeout

```typescript
import { societyCollaborative, StandardModelBase } from '@societyai/core';

const model = new MyModel('api-key');

const controller = new AbortController();

// Timeout de 60 secondes
setTimeout(() => controller.abort(), 60000);

try {
  const result = await societyCollaborative(
    'Question complexe',
    5,
    [model],
    false
  );
  console.log(result);
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Opération annulée');
  } else {
    console.error('Erreur:', error);
  }
}
```

---

Cette documentation API couvre l'ensemble des fonctionnalités de SocietyAI. Pour des exemples plus détaillés, consultez le dossier [examples/](../examples/) et le [guide de démarrage](./getting-started.md).
