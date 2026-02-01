# Event System

Le système d'événements de SocietyAI fournit un mécanisme d'observation type-safe pour surveiller le cycle de vie des workflows, suivre la progression, et intégrer avec des systèmes externes.

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Types d'Événements](#types-dévénements)
- [Event Emitter](#event-emitter)
- [Event Handlers](#event-handlers)
- [Progress Tracking](#progress-tracking)
- [Event Filtering](#event-filtering)
- [Event History](#event-history)
- [Intégrations](#intégrations)
- [Exemples Complets](#exemples-complets)

## Vue d'ensemble

Le système d'événements permet de:

- **Observer le cycle de vie** des workflows, steps et agents
- **Suivre la progression** en temps réel
- **Déboguer** avec des hooks détaillés
- **Intégrer** avec des systèmes de logging/monitoring externes
- **Historique** des événements pour replay et analyse

### Principes de Design

- **Type-safe**: Support complet TypeScript pour tous les types d'événements
- **Async**: Les handlers asynchrones ne bloquent pas l'exécution
- **Extensible**: Facile d'ajouter des événements personnalisés
- **Non-bloquant**: L'exécution continue même si les handlers échouent
- **Zero runtime deps**: Implémentation pure TypeScript

## Types d'Événements

### Événements de Workflow

```typescript
// Démarrage de workflow
interface WorkflowStartEvent {
  type: 'workflow:start';
  workflowId: string;
  workflowName: string;
  input: string;
  agentCount: number;
  timestamp: number;
  correlationId?: string;
}

// Complétion de workflow
interface WorkflowCompleteEvent {
  type: 'workflow:complete';
  workflowId: string;
  workflowName: string;
  result: WorkflowResult;
  duration: number;
  timestamp: number;
}

// Erreur de workflow
interface WorkflowErrorEvent {
  type: 'workflow:error';
  workflowId: string;
  workflowName: string;
  error: Error;
  timestamp: number;
}
```

### Événements de Step

```typescript
// Démarrage de step
interface StepStartEvent {
  type: 'step:start';
  stepId: string;
  stepName: string;
  agentIds: string[];
  executionType: string;
  timestamp: number;
}

// Complétion de step
interface StepCompleteEvent {
  type: 'step:complete';
  stepId: string;
  stepName: string;
  results: StepResult[];
  duration: number;
  timestamp: number;
}

// Erreur de step
interface StepErrorEvent {
  type: 'step:error';
  stepId: string;
  stepName: string;
  error: Error;
  timestamp: number;
}

// Step sauté
interface StepSkippedEvent {
  type: 'step:skipped';
  stepId: string;
  stepName: string;
  reason: string;
  timestamp: number;
}
```

### Événements d'Agent

```typescript
// Démarrage d'agent
interface AgentStartEvent {
  type: 'agent:start';
  agentId: string;
  agentName?: string;
  modelName: string;
  prompt: unknown;
  timestamp: number;
}

// Complétion d'agent
interface AgentCompleteEvent {
  type: 'agent:complete';
  agentId: string;
  agentName?: string;
  modelName: string;
  result: string;
  duration: number;
  timestamp: number;
}

// Erreur d'agent
interface AgentErrorEvent {
  type: 'agent:error';
  agentId: string;
  agentName?: string;
  modelName: string;
  error: Error;
  timestamp: number;
}

// Retry d'agent
interface AgentRetryEvent {
  type: 'agent:retry';
  agentId: string;
  agentName?: string;
  attempt: number;
  maxAttempts: number;
  error: Error;
  timestamp: number;
}
```

### Événements de Progression

```typescript
interface ProgressEvent {
  type: 'progress';
  percent: number; // 0-100
  phase: string; // Description de la phase
  estimatedTimeRemaining?: number; // ms
  details?: Record<string, unknown>;
  timestamp: number;
}
```

### Événements de Message

```typescript
// Message envoyé
interface MessageSentEvent {
  type: 'message:sent';
  from: string;
  to: string | 'broadcast';
  messageType: string;
  content: string;
  timestamp: number;
}

// Message reçu
interface MessageReceivedEvent {
  type: 'message:received';
  from: string;
  to: string;
  messageType: string;
  content: string;
  timestamp: number;
}
```

### Événements de Debug

```typescript
interface DebugEvent {
  type: 'debug';
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  timestamp: number;
}
```

### Événements Personnalisés

```typescript
interface CustomEvent {
  type: 'custom';
  name: string;
  data: unknown;
  timestamp: number;
}
```

## Event Emitter

### Création et Utilisation de Base

```typescript
import { SocietyEventEmitter } from 'societyai';

const emitter = new SocietyEventEmitter();

// Écouter des événements
emitter.on('workflow:start', (event) => {
  console.log(`Workflow started: ${event.workflowName}`);
});

emitter.on('agent:complete', (event) => {
  console.log(`Agent ${event.agentId} completed in ${event.duration}ms`);
});

// Handlers asynchrones
emitter.on('workflow:complete', async (event) => {
  await saveResults(event.result);
  await notifyUser(event.workflowId);
});

// Émission d'événements
emitter.emit({
  type: 'workflow:start',
  workflowId: 'wf-123',
  workflowName: 'Analysis',
  input: 'Analyze this',
  agentCount: 3,
  timestamp: Date.now(),
});
```

### Wildcard et Événements Multiples

```typescript
// Écouter tous les événements
emitter.on('*', (event) => {
  console.log(`Event: ${event.type}`);
});

// Écouter plusieurs types
emitter.on('workflow:start', handleWorkflowStart);
emitter.on('workflow:complete', handleWorkflowComplete);
emitter.on('workflow:error', handleWorkflowError);
```

### Once - Écouter une seule fois

```typescript
// S'exécute une seule fois puis se détache
emitter.once('workflow:complete', (event) => {
  console.log('First workflow completed!');
});
```

### Détachement des Handlers

```typescript
const handler = (event) => console.log(event);

emitter.on('agent:start', handler);

// Détacher plus tard
emitter.off('agent:start', handler);

// Détacher tous les handlers d'un type
emitter.removeAllListeners('agent:start');

// Détacher tous les handlers
emitter.removeAllListeners();
```

## Event Handlers

### Handler Type-Safe

```typescript
import { EventHandler } from 'societyai';

// Handler typé pour un type d'événement spécifique
const workflowHandler: EventHandler<WorkflowCompleteEvent> = (event) => {
  // 'event' est correctement typé comme WorkflowCompleteEvent
  console.log(event.result.output);
  console.log(event.duration);
};

emitter.on('workflow:complete', workflowHandler);
```

### Handler avec Gestion d'Erreur

```typescript
emitter.on('agent:error', (event) => {
  console.error(`Agent ${event.agentId} failed:`, event.error);

  // Notification
  notifyDevelopers({
    agentId: event.agentId,
    error: event.error.message,
    timestamp: event.timestamp,
  });

  // Logging
  logger.error('Agent execution failed', {
    agentId: event.agentId,
    model: event.modelName,
    error: event.error,
  });
});
```

### Handler Conditionnel

```typescript
emitter.on('agent:complete', (event) => {
  // Seulement pour certains agents
  if (event.agentId.startsWith('critical-')) {
    // Action spéciale
    priorityLog(event);
  }

  // Seulement si lent
  if (event.duration > 5000) {
    console.warn(`Slow agent: ${event.agentId} took ${event.duration}ms`);
  }
});
```

## Progress Tracking

### ProgressTracker

```typescript
import { ProgressTracker } from 'societyai';

const tracker = new ProgressTracker(emitter);

// Démarrer le tracking
tracker.start('workflow-123', {
  totalSteps: 5,
  estimatedDuration: 30000, // 30s
});

// Mettre à jour la progression
tracker.updateProgress('workflow-123', {
  current: 1,
  phase: 'Analyzing input',
  details: { agentsActive: 2 },
});

tracker.updateProgress('workflow-123', {
  current: 2,
  phase: 'Processing data',
});

// Compléter
tracker.complete('workflow-123');

// Les événements 'progress' sont automatiquement émis
```

### Tracking Manuel

```typescript
// Émettre manuellement des événements de progression
emitter.emit({
  type: 'progress',
  percent: 25,
  phase: 'Step 1 of 4',
  estimatedTimeRemaining: 15000,
  timestamp: Date.now(),
});

// Avec détails
emitter.emit({
  type: 'progress',
  percent: 50,
  phase: 'Processing',
  details: {
    itemsProcessed: 50,
    itemsTotal: 100,
    currentItem: 'item-50',
  },
  timestamp: Date.now(),
});
```

### Progress UI

```typescript
// Intégration avec une barre de progression
emitter.on('progress', (event) => {
  updateProgressBar(event.percent);
  updateStatusText(event.phase);

  if (event.estimatedTimeRemaining) {
    updateETA(event.estimatedTimeRemaining);
  }
});

// Console progress bar
emitter.on('progress', (event) => {
  const bar = '='.repeat(event.percent / 2) + ' '.repeat(50 - event.percent / 2);
  process.stdout.write(`\r[${bar}] ${event.percent}% - ${event.phase}`);
});
```

## Event Filtering

### FilteredEventEmitter

```typescript
import { FilteredEventEmitter } from 'societyai';

const baseEmitter = new SocietyEventEmitter();

// Créer un emitter filtré
const filteredEmitter = new FilteredEventEmitter(baseEmitter, (event) => {
  // Filtrer seulement les événements d'agents spécifiques
  if (event.type.startsWith('agent:')) {
    const agentEvent = event as AgentStartEvent;
    return agentEvent.agentId.startsWith('production-');
  }
  return true;
});

// Seulement les événements filtrés passent
filteredEmitter.on('agent:start', (event) => {
  // Seulement les agents de production
});
```

### Filtres par Type

```typescript
// Créer des emitters spécialisés
const workflowEmitter = new FilteredEventEmitter(baseEmitter, (event) =>
  event.type.startsWith('workflow:')
);

const agentEmitter = new FilteredEventEmitter(baseEmitter, (event) =>
  event.type.startsWith('agent:')
);

// Chacun reçoit seulement son type d'événements
workflowEmitter.on('workflow:start', handleWorkflowStart);
agentEmitter.on('agent:complete', handleAgentComplete);
```

### Filtres Complexes

```typescript
const criticalEmitter = new FilteredEventEmitter(baseEmitter, (event) => {
  // Seulement les erreurs
  if (event.type.includes('error')) return true;

  // Agents lents
  if (event.type === 'agent:complete') {
    const agentEvent = event as AgentCompleteEvent;
    return agentEvent.duration > 10000;
  }

  // Workflows échoués
  if (event.type === 'workflow:complete') {
    const wfEvent = event as WorkflowCompleteEvent;
    return !wfEvent.result.success;
  }

  return false;
});

// Monitoring critique seulement
criticalEmitter.on('*', (event) => {
  alertOpsTeam(event);
});
```

## Event History

### Activer l'Historique

```typescript
const emitter = new SocietyEventEmitter();

// Activer avec taille max
emitter.enableHistory(1000); // Garde 1000 derniers événements

// Désactiver
emitter.disableHistory();
```

### Accéder à l'Historique

```typescript
// Tous les événements
const allEvents = emitter.getHistory();

// Filtrer par type
const workflowEvents = emitter.getHistoryByType('workflow:start');

// Filtrer par temps
const recentEvents = emitter.getHistorySince(Date.now() - 60000); // 1 minute

// Événements entre deux timestamps
const events = emitter.getHistoryBetween(startTime, endTime);
```

### Replay des Événements

```typescript
const history = emitter.getHistory();

// Replay dans un nouvel emitter
const replayEmitter = new SocietyEventEmitter();
replayEmitter.on('*', logEvent);

for (const event of history) {
  replayEmitter.emit(event);
}
```

### Clear History

```typescript
// Vider l'historique
emitter.clearHistory();
```

## Intégrations

### Event Logger

```typescript
import { EventLogger } from 'societyai';

const logger = new EventLogger(emitter, {
  logToConsole: true,
  logToFile: './logs/events.log',
  includeTypes: ['workflow:*', 'agent:error'],
  excludeTypes: ['debug'],
  formatter: (event) => {
    return `[${new Date(event.timestamp).toISOString()}] ${event.type}`;
  },
});

// Les événements sont automatiquement loggés
```

### Event Aggregator

```typescript
import { EventAggregator } from 'societyai';

const aggregator = new EventAggregator(emitter);

// Agréger sur une période
aggregator.startAggregation({
  windowSize: 60000, // 1 minute
  onAggregated: (summary) => {
    console.log('Events in last minute:', summary.total);
    console.log('By type:', summary.byType);
    console.log('Errors:', summary.errors);
  },
});

// Récupérer le résumé
const summary = aggregator.getSummary();
console.log(`Total workflows: ${summary.workflows}`);
console.log(`Total agents: ${summary.agents}`);
console.log(`Average duration: ${summary.avgDuration}ms`);
```

### Intégration avec Society

```typescript
import { Society, createEventEmitter } from 'societyai';

const emitter = createEventEmitter();

// Logger tous les événements
emitter.on('*', (event) => {
  console.log(`[${event.type}]`, event);
});

// Tracker la progression
emitter.on('progress', (event) => {
  updateUI(event.percent, event.phase);
});

// Utiliser avec Society
const result = await Society.create()
  .withName('Event-Tracked Society')
  .withEvents(emitter) // Attacher l'emitter
  .addAgent(/* ... */)
  .execute(input);
```

## Exemples Complets

### Exemple 1: Monitoring Complet

```typescript
import { SocietyEventEmitter, ProgressTracker, EventLogger, Society } from 'societyai';

// Configuration du monitoring
const emitter = new SocietyEventEmitter().enableHistory(500);

const tracker = new ProgressTracker(emitter);
const logger = new EventLogger(emitter, {
  logToFile: './logs/workflow.log',
});

// Métriques
const metrics = {
  workflows: 0,
  agents: 0,
  errors: 0,
  totalDuration: 0,
};

emitter.on('workflow:start', (event) => {
  metrics.workflows++;
  console.log(`📊 Starting workflow: ${event.workflowName}`);
  tracker.start(event.workflowId, {
    totalSteps: event.agentCount,
  });
});

emitter.on('agent:start', (event) => {
  metrics.agents++;
  console.log(`🤖 Agent ${event.agentId} processing...`);
});

emitter.on('agent:complete', (event) => {
  console.log(`✅ Agent ${event.agentId} done in ${event.duration}ms`);
  tracker.updateProgress(event.agentId, {
    current: metrics.agents,
    phase: `Agent ${event.agentId} completed`,
  });
});

emitter.on('agent:error', (event) => {
  metrics.errors++;
  console.error(`❌ Agent ${event.agentId} failed:`, event.error);
});

emitter.on('workflow:complete', (event) => {
  metrics.totalDuration += event.duration;
  const avgDuration = metrics.totalDuration / metrics.workflows;

  console.log(`
🎉 Workflow Complete!
   Duration: ${event.duration}ms
   Success: ${event.result.success}
   Average: ${avgDuration.toFixed(0)}ms
   Total Agents: ${metrics.agents}
   Errors: ${metrics.errors}
  `);

  tracker.complete(event.workflowId);
});

// Utiliser avec Society
const result = await Society.create()
  .withName('Monitored Workflow')
  .withEvents(emitter)
  .addAgent(/* ... */)
  .execute(input);
```

### Exemple 2: Dashboard en Temps Réel

```typescript
interface DashboardState {
  activeWorkflows: Map<string, WorkflowInfo>;
  completedWorkflows: number;
  failedWorkflows: number;
  activeAgents: Set<string>;
  lastEvents: SocietyEvent[];
}

class WorkflowDashboard {
  private state: DashboardState = {
    activeWorkflows: new Map(),
    completedWorkflows: 0,
    failedWorkflows: 0,
    activeAgents: new Set(),
    lastEvents: [],
  };

  constructor(private emitter: SocietyEventEmitter) {
    this.setupListeners();
  }

  private setupListeners() {
    this.emitter.on('workflow:start', (event) => {
      this.state.activeWorkflows.set(event.workflowId, {
        id: event.workflowId,
        name: event.workflowName,
        startTime: event.timestamp,
        agentCount: event.agentCount,
        completedAgents: 0,
      });
      this.update();
    });

    this.emitter.on('agent:start', (event) => {
      this.state.activeAgents.add(event.agentId);
      this.update();
    });

    this.emitter.on('agent:complete', (event) => {
      this.state.activeAgents.delete(event.agentId);

      // Mettre à jour le workflow
      for (const workflow of this.state.activeWorkflows.values()) {
        workflow.completedAgents++;
      }
      this.update();
    });

    this.emitter.on('workflow:complete', (event) => {
      this.state.activeWorkflows.delete(event.workflowId);
      if (event.result.success) {
        this.state.completedWorkflows++;
      } else {
        this.state.failedWorkflows++;
      }
      this.update();
    });

    this.emitter.on('*', (event) => {
      this.state.lastEvents.unshift(event);
      if (this.state.lastEvents.length > 10) {
        this.state.lastEvents.pop();
      }
    });
  }

  private update() {
    // Rafraîchir l'UI
    console.clear();
    console.log('╔══════════════════════════════════════╗');
    console.log('║    SocietyAI Workflow Dashboard     ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║ Active Workflows: ${this.state.activeWorkflows.size}               ║`);
    console.log(`║ Completed: ${this.state.completedWorkflows}                        ║`);
    console.log(`║ Failed: ${this.state.failedWorkflows}                           ║`);
    console.log(`║ Active Agents: ${this.state.activeAgents.size}                  ║`);
    console.log('╠══════════════════════════════════════╣');

    for (const workflow of this.state.activeWorkflows.values()) {
      const progress = (workflow.completedAgents / workflow.agentCount) * 100;
      const bar = '█'.repeat(progress / 5) + '░'.repeat(20 - progress / 5);
      console.log(`║ ${workflow.name.padEnd(20)} [${bar}] ${progress.toFixed(0)}%`);
    }

    console.log('╚══════════════════════════════════════╝');
  }

  getState(): DashboardState {
    return this.state;
  }
}

// Utilisation
const emitter = new SocietyEventEmitter();
const dashboard = new WorkflowDashboard(emitter);

// Exécuter workflows...
```

### Exemple 3: Testing avec Event Assertions

```typescript
describe('Workflow Events', () => {
  let emitter: SocietyEventEmitter;
  let events: SocietyEvent[];

  beforeEach(() => {
    emitter = new SocietyEventEmitter().enableHistory();
    events = [];

    emitter.on('*', (event) => {
      events.push(event);
    });
  });

  it('should emit workflow lifecycle events', async () => {
    await Society.create().withEvents(emitter).addAgent(/* ... */).execute('test input');

    // Vérifier l'ordre des événements
    expect(events[0].type).toBe('workflow:start');
    expect(events[events.length - 1].type).toBe('workflow:complete');

    // Vérifier qu'on a des événements d'agents
    const agentEvents = events.filter((e) => e.type.startsWith('agent:'));
    expect(agentEvents.length).toBeGreaterThan(0);
  });

  it('should emit error events on failure', async () => {
    // Agent qui échoue
    const failingModel = {
      name: () => 'FailingModel',
      process: async () => {
        throw new Error('Test error');
      },
      supportsPromptType: () => true,
    };

    try {
      await Society.create()
        .withEvents(emitter)
        .addAgent((a) =>
          a
            .withId('failing')
            .withRole((r) => r.withSystemPrompt('test'))
            .withModel(failingModel)
        )
        .execute('test');
    } catch (e) {
      // Expected
    }

    const errorEvents = events.filter((e) => e.type.includes('error'));
    expect(errorEvents.length).toBeGreaterThan(0);
  });
});
```

### Exemple 4: Audit Trail

```typescript
class AuditTrail {
  private db: Database;

  constructor(private emitter: SocietyEventEmitter) {
    this.setupAuditLogging();
  }

  private setupAuditLogging() {
    // Logger tous les événements importants
    const auditEvents = [
      'workflow:start',
      'workflow:complete',
      'workflow:error',
      'agent:start',
      'agent:complete',
      'agent:error',
    ];

    for (const eventType of auditEvents) {
      this.emitter.on(eventType as any, async (event) => {
        await this.logToDatabase(event);
      });
    }
  }

  private async logToDatabase(event: SocietyEvent) {
    await this.db.auditLogs.insert({
      eventType: event.type,
      timestamp: event.timestamp,
      correlationId: event.correlationId,
      data: JSON.stringify(event),
      userId: getCurrentUser()?.id,
      sessionId: getCurrentSession()?.id,
    });
  }

  async getAuditLog(workflowId: string): Promise<AuditLog[]> {
    return await this.db.auditLogs
      .query()
      .where('correlationId', workflowId)
      .orderBy('timestamp', 'asc')
      .all();
  }

  async searchAudit(criteria: AuditSearchCriteria): Promise<AuditLog[]> {
    let query = this.db.auditLogs.query();

    if (criteria.eventType) {
      query = query.where('eventType', criteria.eventType);
    }

    if (criteria.dateRange) {
      query = query
        .where('timestamp', '>=', criteria.dateRange.start)
        .where('timestamp', '<=', criteria.dateRange.end);
    }

    if (criteria.userId) {
      query = query.where('userId', criteria.userId);
    }

    return await query.all();
  }
}
```

## Bonnes Pratiques

### 1. Gestion des Erreurs dans les Handlers

```typescript
// ✅ Bon - handler avec try-catch
emitter.on('workflow:complete', async (event) => {
  try {
    await saveResults(event.result);
  } catch (error) {
    console.error('Failed to save results:', error);
    // Ne pas propager l'erreur
  }
});

// ❌ Mauvais - erreurs non gérées
emitter.on('workflow:complete', async (event) => {
  await saveResults(event.result); // Peut throw
});
```

### 2. Nettoyage des Listeners

```typescript
// ✅ Bon - détacher quand fini
class WorkflowMonitor {
  private handler: EventHandler<WorkflowCompleteEvent>;

  start(emitter: SocietyEventEmitter) {
    this.handler = (event) => this.handle(event);
    emitter.on('workflow:complete', this.handler);
  }

  stop(emitter: SocietyEventEmitter) {
    emitter.off('workflow:complete', this.handler);
  }
}
```

### 3. Corrélation des Événements

```typescript
// ✅ Bon - utiliser correlationId
const correlationId = generateId();

emitter.setCorrelationId(correlationId);

// Tous les événements auront le même correlationId
await workflow.execute(input);

// Récupérer tous les événements liés
const related = emitter.getHistory().filter((e) => e.correlationId === correlationId);
```

### 4. Performance

```typescript
// ✅ Bon - handlers légers
emitter.on('progress', (event) => {
  // Rapide
  progressBar.update(event.percent);
});

// ❌ Mauvais - handlers lourds
emitter.on('progress', async (event) => {
  // Lent - bloque l'émission
  await heavyDatabaseOperation(event);
});

// ✅ Mieux - async mais non-bloquant
emitter.on('progress', (event) => {
  // Fire and forget
  heavyDatabaseOperation(event).catch(console.error);
});
```

## API Reference

### `SocietyEventEmitter`

**Méthodes:**

- `on<K>(type: K, handler: EventHandler<T>): this` - Écouter un événement
- `once<K>(type: K, handler: EventHandler<T>): this` - Écouter une fois
- `off<K>(type: K, handler: EventHandler<T>): this` - Détacher un handler
- `emit(event: SocietyEvent): void` - Émettre un événement
- `enableHistory(maxSize?: number): this` - Activer l'historique
- `disableHistory(): this` - Désactiver l'historique
- `getHistory(): SocietyEvent[]` - Récupérer l'historique
- `clearHistory(): void` - Vider l'historique
- `removeAllListeners(type?: string): this` - Détacher tous les handlers

### `ProgressTracker`

**Méthodes:**

- `start(id: string, config: ProgressConfig): void` - Démarrer le tracking
- `updateProgress(id: string, update: ProgressUpdate): void` - Mettre à jour
- `complete(id: string): void` - Compléter
- `fail(id: string, error: Error): void` - Marquer comme échoué

### `FilteredEventEmitter`

**Constructeur:**

- `new FilteredEventEmitter(source: SocietyEventEmitter, filter: EventFilter<SocietyEvent>)`

### `EventLogger`

**Constructeur:**

- `new EventLogger(emitter: SocietyEventEmitter, options: EventLoggerOptions)`

### `EventAggregator`

**Méthodes:**

- `startAggregation(config: AggregationConfig): void` - Démarrer l'agrégation
- `stopAggregation(): void` - Arrêter
- `getSummary(): EventSummary` - Récupérer le résumé

## Voir Aussi

- [Architecture](./architecture.md) - Concepts de base
- [Workflows](./workflows.md) - Intégration avec les workflows
- [Metrics & Observability](./metrics-observability.md) - Métriques et monitoring
- [Advanced Features](./advanced.md) - Fonctionnalités avancées
