# Pipeline Patterns

Les pipelines de SocietyAI fournissent des patterns composables pour orchestrer l'exécution des agents avec des modèles d'exécution pré-configurés.

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Pipeline Builder](#pipeline-builder)
- [Patterns de Base](#patterns-de-base)
- [Patterns Avancés](#patterns-avancés)
- [Built-in Pipelines](#built-in-pipelines)
- [Composition de Pipelines](#composition-de-pipelines)
- [Patterns Pré-configurés](#patterns-pré-configurés)
- [Exemples Complets](#exemples-complets)

## Vue d'ensemble

Les pipelines définissent le flux et la coordination des agents. Ils permettent de:

- **Orchestrer** l'exécution séquentielle ou parallèle
- **Router** dynamiquement vers des agents appropriés
- **Diviser** et traiter les tâches en parallèle
- **Agréger** les résultats de multiples agents
- **Composer** des workflows complexes
- **Réutiliser** des patterns communs

### Principes de Design

- **Model-agnostic**: Fonctionne avec n'importe quel modèle AI
- **Composable**: Les pipelines peuvent être imbriqués et combinés
- **Type-safe**: Support complet TypeScript
- **Zero runtime deps**: Implémentation pure TypeScript

## Pipeline Builder

### Création de Base

```typescript
import { PipelineBuilder } from 'societyai';

const pipeline = PipelineBuilder.create('my-pipeline')
  .withTimeout(30000) // 30 secondes
  .then('agent-1')
  .then('agent-2')
  .build();

// Exécution
const result = await pipeline.execute(input, agentsMap);
```

### Configuration

```typescript
const pipeline = PipelineBuilder.create()
  .withName('Analysis Pipeline')
  .withTimeout(60000)
  .onStepComplete((step, results) => {
    console.log(`Step ${step.name} completed with ${results.length} results`);
  })
  // ... ajouter des steps
  .build();
```

## Patterns de Base

### Chain Pattern

Exécution séquentielle où la sortie de chaque agent alimente l'entrée du suivant.

```typescript
// Chaîne simple
const pipeline = PipelineBuilder.create()
  .then('researcher') // Recherche d'informations
  .then('analyzer') // Analyse les données
  .then('summarizer') // Crée un résumé
  .build();

// Chaîne avec noms
const pipeline = PipelineBuilder.create()
  .chain(['researcher', 'analyzer', 'summarizer'], 'analysis-chain')
  .build();
```

**Cas d'usage:**

- Processing étape par étape
- Raffinement itératif
- Pipeline de transformation

### Scatter-Gather Pattern

Exécution parallèle de plusieurs agents avec agrégation des résultats.

```typescript
import { Strategies } from 'societyai';

// Scatter to multiple agents
const pipeline = PipelineBuilder.create()
  .scatter(['expert-1', 'expert-2', 'expert-3'])
  .gather(Strategies.consensus(0.7))
  .build();

// Convenience method
const pipeline = PipelineBuilder.create()
  .scatterGather(['analyst-1', 'analyst-2', 'analyst-3'], Strategies.merge())
  .build();
```

**Cas d'usage:**

- Analyse multi-perspective
- Validation par consensus
- Parallélisation de tâches

### Router Pattern

Routage dynamique vers un agent approprié basé sur l'entrée ou le contexte.

```typescript
// Router avec fonction personnalisée
const pipeline = PipelineBuilder.create()
  .route(['technical-expert', 'business-expert', 'legal-expert'], (input, ctx) => {
    if (input.includes('legal')) return 'legal-expert';
    if (input.includes('technical')) return 'technical-expert';
    return 'business-expert';
  })
  .build();

// Router par contenu
const pipeline = PipelineBuilder.create()
  .routeByContent(
    [
      { match: /bug|error|crash/, agentId: 'bug-fixer' },
      { match: /feature|enhancement/, agentId: 'feature-developer' },
      { match: /documentation/, agentId: 'doc-writer' },
    ],
    'general-agent' // Agent par défaut
  )
  .build();
```

**Cas d'usage:**

- Classification de requêtes
- Routage par expertise
- Triage automatique

### Splitter Pattern

Division de l'entrée pour traitement parallèle de parties séparées.

```typescript
// Split avec fonction personnalisée
const pipeline = PipelineBuilder.create()
  .split('processor', (input) => {
    // Diviser en paragraphes
    return input.split('\n\n');
  })
  .gather(Strategies.concat('\n\n'))
  .build();

// Split par délimiteur
const pipeline = PipelineBuilder.create()
  .splitByDelimiter('analyzer', '\n---\n')
  .gather(Strategies.merge())
  .build();

// Split par lignes
const pipeline = PipelineBuilder.create()
  .splitByLines('line-processor', {
    chunkSize: 10, // Grouper par 10 lignes
    skipEmpty: true,
  })
  .gather(Strategies.concat())
  .build();
```

**Cas d'usage:**

- Traitement de documents longs
- Analyse parallèle de sections
- Processing par batch

## Patterns Avancés

### Transform Pattern

Transformation de données entre étapes.

```typescript
const pipeline = PipelineBuilder.create()
  .then('analyzer')
  .transform((result, ctx) => {
    // Extraire seulement les données importantes
    const data = JSON.parse(result);
    return JSON.stringify(data.insights);
  })
  .then('reporter')
  .build();
```

### Condition Pattern

Exécution conditionnelle basée sur le contexte.

```typescript
const pipeline = PipelineBuilder.create()
  .then('validator')
  .condition(
    (ctx) => {
      // Vérifier si validation OK
      return ctx.currentResult.includes('valid');
    },
    // Then branch (si true)
    PipelineBuilder.create().then('approver').build(),
    // Else branch (si false)
    PipelineBuilder.create().then('reviewer').then('validator').build()
  )
  .build();
```

### Loop Pattern

Boucles avec condition de terminaison.

```typescript
const pipeline = PipelineBuilder.create()
  .loop(PipelineBuilder.create().then('generator').then('validator').build(), {
    maxIterations: 5,
    condition: (iteration, result, ctx) => {
      // Continuer si pas validé
      return !result.includes('approved');
    },
  })
  .build();
```

### Aggregator Pattern

Agrégation de résultats avec stratégies personnalisées.

```typescript
const pipeline = PipelineBuilder.create()
  .scatter(['agent-1', 'agent-2', 'agent-3'])
  .aggregate(Strategies.weightedVote([0.5, 0.3, 0.2]))
  .build();

// Agrégation multi-niveau
const pipeline = PipelineBuilder.create()
  .scatter(['group-1-a', 'group-1-b'])
  .gather(Strategies.merge())
  .scatter(['group-2-a', 'group-2-b'])
  .gather(Strategies.concat())
  .aggregate(Strategies.bestOf())
  .build();
```

### Saga Pattern

Transaction distribuée avec compensation en cas d'échec.

```typescript
const pipeline = PipelineBuilder.create()
  .saga({
    steps: [
      {
        agentId: 'reserve-inventory',
        compensate: 'release-inventory',
      },
      {
        agentId: 'charge-payment',
        compensate: 'refund-payment',
      },
      {
        agentId: 'ship-order',
        compensate: 'cancel-shipment',
      },
    ],
    onFailure: 'compensate-all', // ou 'compensate-previous'
  })
  .build();
```

### Circuit Breaker Pattern

Protection contre les défaillances en cascade.

```typescript
const pipeline = PipelineBuilder.create()
  .circuitBreaker({
    agentId: 'external-api-agent',
    failureThreshold: 5,
    timeout: 10000,
    resetTimeout: 60000,
    fallback: 'cached-agent', // Agent de secours
  })
  .build();
```

## Built-in Pipelines

### Pipelines Pré-construits

```typescript
import { Pipelines } from 'societyai';

// Multi-perspective analysis
const pipeline = Pipelines.multiPerspective(
  ['analyst-1', 'analyst-2', 'analyst-3'],
  Strategies.consensus(0.6)
);

// Iterative refinement
const pipeline = Pipelines.iterativeRefinement('generator', 'critic', { maxIterations: 3 });

// Debate pattern
const pipeline = Pipelines.debate(['pro-agent', 'con-agent'], 'judge-agent', { rounds: 3 });

// Map-reduce
const pipeline = Pipelines.mapReduce('mapper', 'reducer', {
  splitter: (input) => input.split('\n'),
  aggregator: Strategies.concat('\n'),
});

// Hierarchical processing
const pipeline = Pipelines.hierarchical([
  ['worker-1', 'worker-2', 'worker-3'], // Niveau 1
  ['supervisor-1', 'supervisor-2'], // Niveau 2
  ['manager'], // Niveau 3
]);
```

## Composition de Pipelines

### Combiner des Pipelines

```typescript
import { composePipelines, parallelPipelines } from 'societyai';

// Exécution séquentielle de pipelines
const composed = composePipelines([pipeline1, pipeline2, pipeline3]);

// Exécution parallèle de pipelines
const parallel = parallelPipelines([pipeline1, pipeline2, pipeline3], Strategies.merge());

// Imbrication
const nested = PipelineBuilder.create()
  .then('preprocessor')
  .pipeline(subPipeline) // Pipeline imbriqué
  .then('postprocessor')
  .build();
```

### Pipelines Réutilisables

```typescript
// Créer des factories de pipelines
function createValidationPipeline(validatorId: string, maxRetries: number) {
  return PipelineBuilder.create()
    .loop(PipelineBuilder.create().then('generator').then(validatorId).build(), {
      maxIterations: maxRetries,
    })
    .build();
}

// Utiliser
const pipeline1 = createValidationPipeline('strict-validator', 5);
const pipeline2 = createValidationPipeline('lenient-validator', 3);
```

## Patterns Pré-configurés

### Self-Correction Pattern

```typescript
import { PipelinePatterns } from 'societyai';

const pipeline = PipelinePatterns.selfCorrection(
  'content-generator',
  'quality-validator',
  3 // max retries
);

// Utilisation
const result = await pipeline.execute('Generate a blog post about TypeScript', agents);
```

**Comment ça marche:**

1. Le générateur crée du contenu
2. Le validateur vérifie la qualité
3. Si pas valide, le feedback est renvoyé au générateur
4. Répète jusqu'à validation ou max retries

### Multi-Perspective Debate Pattern

```typescript
const pipeline = PipelinePatterns.multiPerspectiveDebate(
  'pro-argument-agent',
  'con-argument-agent',
  'neutral-judge',
  3 // rounds of debate
);

// Utilisation
const result = await pipeline.execute('Should we adopt microservices architecture?', agents);
```

**Comment ça marche:**

1. Agent Pro présente ses arguments
2. Agent Con présente ses contre-arguments
3. Répète pour N rounds
4. Juge synthétise la conclusion finale

### Hierarchical Review Pattern

```typescript
const pipeline = PipelinePatterns.hierarchicalReview([
  ['junior-reviewer-1', 'junior-reviewer-2'],
  ['senior-reviewer'],
  ['chief-editor'],
]);
```

### Ensemble Pattern

```typescript
const pipeline = PipelinePatterns.ensemble(['model-1', 'model-2', 'model-3'], Strategies.voting(), {
  minAgreement: 0.6,
});
```

## Exemples Complets

### Exemple 1: Pipeline de Traitement de Document

```typescript
import { PipelineBuilder, Strategies, Society } from 'societyai';

// Créer le pipeline
const documentPipeline = PipelineBuilder.create('document-analysis')
  .withTimeout(120000) // 2 minutes

  // 1. Prétraitement
  .then('preprocessor')

  // 2. Split par sections
  .split('section-analyzer', (doc) => doc.split(/\n## /g))

  // 3. Analyse parallèle des sections
  .gather(Strategies.merge())

  // 4. Router vers spécialistes
  .route(['technical-expert', 'business-expert', 'legal-expert'], (result, ctx) => {
    if (result.includes('technical')) return 'technical-expert';
    if (result.includes('business')) return 'business-expert';
    return 'legal-expert';
  })

  // 5. Validation
  .then('quality-validator')

  // 6. Formatting
  .transform((result, ctx) => {
    return formatReport(result, ctx.sharedData);
  })

  .onStepComplete((step, results) => {
    console.log(`✅ ${step.name}: ${results.length} results`);
  })

  .build();

// Utiliser avec Society
const result = await Society.create()
  .withName('Document Analyzer')
  .addAgent(/* ... agents ... */)
  .usePipeline(() => documentPipeline)
  .execute(documentContent);
```

### Exemple 2: Pipeline de Génération de Code

```typescript
const codePipeline = PipelineBuilder.create('code-generation')
  // 1. Analyser les requirements
  .then('requirements-analyzer')

  // 2. Générer l'architecture
  .then('architect')

  // 3. Générer le code en parallèle
  .scatter(['frontend-dev', 'backend-dev', 'database-dev'])
  .gather(Strategies.merge())

  // 4. Review et correction iterative
  .loop(
    PipelineBuilder.create()
      .then('code-reviewer')
      .condition(
        (ctx) => ctx.currentResult.includes('approved'),
        PipelineBuilder.create().build(), // Approuvé - sortir
        PipelineBuilder.create() // Pas approuvé - corriger
          .then('code-fixer')
          .build()
      )
      .build(),
    { maxIterations: 3 }
  )

  // 5. Génération tests
  .then('test-generator')

  // 6. Documentation
  .then('doc-generator')

  .build();
```

### Exemple 3: Pipeline de Customer Support

```typescript
const supportPipeline = PipelineBuilder.create('customer-support')
  // 1. Classification de la requête
  .routeByContent(
    [
      { match: /billing|payment|invoice/, agentId: 'billing-agent' },
      { match: /technical|bug|error/, agentId: 'technical-agent' },
      { match: /account|password|login/, agentId: 'account-agent' },
      { match: /cancel|refund/, agentId: 'retention-agent' },
    ],
    'general-support'
  )

  // 2. Traitement spécialisé
  .condition(
    (ctx) => ctx.sharedData.get('needsEscalation'),
    // Escalation branch
    PipelineBuilder.create().then('senior-support').then('manager-review').build(),
    // Resolution branch
    PipelineBuilder.create().then('resolution-agent').build()
  )

  // 3. Génération de réponse
  .then('response-generator')

  // 4. Quality check
  .then('quality-checker')

  // 5. Sentiment analysis
  .then('sentiment-analyzer')

  .build();
```

### Exemple 4: Pipeline de Recherche Académique

```typescript
const researchPipeline = PipelineBuilder.create('academic-research')
  // 1. Recherche parallèle dans différentes sources
  .scatterGather(['pubmed-searcher', 'arxiv-searcher', 'scholar-searcher'], Strategies.merge())

  // 2. Filtrage et déduplication
  .transform((results, ctx) => {
    const papers = JSON.parse(results);
    const unique = deduplicatePapers(papers);
    const filtered = filterByRelevance(unique, ctx.input);
    return JSON.stringify(filtered);
  })

  // 3. Analyse détaillée en parallèle
  .splitByDelimiter('paper-analyzer', /\n---\n/)
  .gather(Strategies.concat('\n\n'))

  // 4. Synthèse multi-perspective
  .scatterGather(
    ['methodology-analyst', 'results-analyst', 'implications-analyst'],
    Strategies.concat('\n\n## ')
  )

  // 5. Génération de rapport
  .then('report-generator')

  // 6. Citation formatting
  .then('citation-formatter')

  // 7. Peer review
  .scatterGather(['reviewer-1', 'reviewer-2', 'reviewer-3'], Strategies.consensus(0.67))

  .build();
```

### Exemple 5: Pipeline avec Circuit Breaker

```typescript
const robustPipeline = PipelineBuilder.create('robust-processing')
  // Agent avec protection
  .circuitBreaker({
    agentId: 'external-api-agent',
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000,
    fallback: 'cached-agent',
    onOpen: () => {
      console.warn('Circuit opened - using fallback');
      metrics.increment('circuit_breaker.opened');
    },
    onClose: () => {
      console.log('Circuit closed - back to normal');
      metrics.increment('circuit_breaker.closed');
    },
  })

  // Traitement normal
  .then('processor')

  .build();
```

## Bonnes Pratiques

### 1. Nommer les Steps

```typescript
// ✅ Bon - noms descriptifs
.chain(['researcher', 'analyzer'], 'research-phase')
.scatter(['expert-1', 'expert-2'], 'expert-review')

// ❌ Mauvais - pas de noms
.chain(['agent1', 'agent2'])
```

### 2. Gestion des Timeouts

```typescript
// ✅ Bon - timeout adapté
const pipeline = PipelineBuilder.create()
  .withTimeout(60000) // 1 minute pour pipeline complet
  .then('quick-agent')
  .build();

// ✅ Bon - timeout par agent si nécessaire
const agent = AgentBuilder.create()
  .withId('slow-agent')
  .withRetry({
    maxRetries: 3,
    timeout: 30000, // 30s par tentative
  })
  .build();
```

### 3. Stratégies d'Agrégation Appropriées

```typescript
// ✅ Bon - stratégie adaptée au cas d'usage
.scatterGather(
  ['fact-checker-1', 'fact-checker-2'],
  Strategies.consensus(0.8)  // Haute conf pour facts
)

// ✅ Bon - concat pour perspectives
.scatterGather(
  ['analyst-1', 'analyst-2'],
  Strategies.concat('\n\n')
)
```

### 4. Error Handling

```typescript
// ✅ Bon - gestion d'erreurs
const pipeline = PipelineBuilder.create()
  .onStepComplete((step, results) => {
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      logger.warn(`Step ${step.name} had ${failures.length} failures`);
    }
  })
  .build();
```

### 5. Context Sharing

```typescript
// ✅ Bon - utiliser sharedData pour communication
.transform((result, ctx) => {
  // Stocker des données pour les steps suivants
  ctx.sharedData.set('analysis-results', JSON.parse(result));
  return result;
})

.route(['agent-a', 'agent-b'], (input, ctx) => {
  // Utiliser les données partagées
  const analysis = ctx.sharedData.get('analysis-results');
  return analysis.complexity > 0.5 ? 'agent-a' : 'agent-b';
})
```

## API Reference

### `PipelineBuilder`

**Méthodes de construction:**

- `static create(name?: string): PipelineBuilder`
- `withName(name: string): this`
- `withTimeout(ms: number): this`
- `onStepComplete(handler): this`

**Patterns:**

- `then(agentId: string, name?: string): this`
- `chain(agentIds: string[], name?: string): this`
- `scatter(agentIds: string[], name?: string): this`
- `gather(strategy: AggregationStrategy, name?: string): this`
- `scatterGather(agentIds: string[], strategy: AggregationStrategy, name?: string): this`
- `route(agentIds: string[], router: Function, name?: string): this`
- `routeByContent(routes: RouteConfig[], defaultId: string, name?: string): this`
- `split(agentId: string, splitter: Function, name?: string): this`
- `splitByDelimiter(agentId: string, delimiter: string | RegExp, name?: string): this`
- `transform(transformer: Function, name?: string): this`
- `condition(condition: Function, thenPipeline: Pipeline, elsePipeline?: Pipeline): this`
- `loop(pipeline: Pipeline, config: LoopConfig): this`
- `aggregate(strategy: AggregationStrategy, name?: string): this`
- `saga(config: SagaConfig): this`
- `circuitBreaker(config: CircuitBreakerConfig): this`
- `pipeline(nested: Pipeline, name?: string): this`
- `build(): Pipeline`

### `Pipelines`

**Built-in Pipelines:**

- `static multiPerspective(agentIds: string[], strategy: AggregationStrategy): Pipeline`
- `static iterativeRefinement(generatorId: string, criticId: string, config): Pipeline`
- `static debate(debaterIds: string[], judgeId: string, config): Pipeline`
- `static mapReduce(mapperId: string, reducerId: string, config): Pipeline`
- `static hierarchical(levels: string[][]): Pipeline`

### `PipelinePatterns`

**Pre-configured Patterns:**

- `static selfCorrection(generatorId: string, validatorId: string, maxRetries: number): Pipeline`
- `static multiPerspectiveDebate(agentAId: string, agentBId: string, judgeId: string, rounds: number): Pipeline`

### `Pipeline` Interface

**Méthodes:**

- `execute(input: string, agents: Map<string, AgentConfig>, signal?: AbortSignal): Promise<PipelineResult>`
- `getSteps(): readonly PipelineStep[]`
- `getName(): string`

## Voir Aussi

- [Workflows](./workflows.md) - Patterns de workflow
- [Graph Execution](./graph-execution.md) - Workflows basés sur graphes
- [Strategies](./aggregation-strategies.md) - Stratégies d'agrégation
- [Advanced Patterns](./advanced.md) - Patterns avancés
