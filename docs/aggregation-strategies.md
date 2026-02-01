# Aggregation Strategies

Les stratégies d'agrégation de SocietyAI permettent de combiner les résultats de plusieurs agents de manière flexible et personnalisable.

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Built-in Strategies](#built-in-strategies)
- [Custom Strategies](#custom-strategies)
- [Strategy Composition](#strategy-composition)
- [Exemples Complets](#exemples-complets)

## Vue d'ensemble

Les stratégies d'agrégation définissent comment combiner les résultats de plusieurs agents. Elles permettent de:

- **Fusionner** plusieurs réponses en une seule
- **Voter** pour sélectionner la meilleure réponse
- **Atteindre un consensus** basé sur la similarité
- **Pondérer** les contributions selon l'expertise
- **Filtrer** et sélectionner les meilleurs résultats
- **Composer** des stratégies complexes

### Principes de Design

- **Composable**: Les stratégies peuvent être combinées
- **Type-safe**: Support complet TypeScript
- **Model-agnostic**: Fonctionne avec n'importe quel format de résultat
- **Extensible**: Facile de créer des stratégies personnalisées

## Built-in Strategies

### Concat Strategy

Concatène tous les résultats réussis.

```typescript
import { Strategies } from 'societyai';

// Concat avec séparateur par défaut (\n\n)
const merged = Strategies.concat().aggregate(results);

// Concat avec séparateur personnalisé
const merged = Strategies.concat('\n---\n').aggregate(results);

// Avec métadonnées complètes
const result = Strategies.concat().aggregateFull(results);
console.log(result.output);
console.log(result.metadata.successCount);
console.log(result.contributions);
```

**Cas d'usage:**

- Combiner des perspectives multiples
- Rassembler des analyses différentes
- Fusion de rapports

### Merge Strategy

Alias pour concat, fusionne les résultats.

```typescript
const merged = Strategies.merge().aggregate(results);
```

### First Strategy

Retourne seulement le premier résultat réussi.

```typescript
const first = Strategies.first().aggregate(results);
```

**Cas d'usage:**

- Première réponse valide suffit
- Optimisation de performance
- Fallback en cascade

### Last Strategy

Retourne seulement le dernier résultat réussi.

```typescript
const last = Strategies.last().aggregate(results);
```

### Best Of Strategy

Sélectionne le meilleur résultat selon un critère.

```typescript
// Meilleur par longueur (plus long)
const best = Strategies.bestOf((r) => r.content.length).aggregate(results);

// Meilleur par score personnalisé
const best = Strategies.bestOf((r) => {
  const quality = calculateQuality(r.content);
  const relevance = calculateRelevance(r.content);
  return quality * 0.6 + relevance * 0.4;
}).aggregate(results);
```

**Cas d'usage:**

- Sélection par qualité
- Optimisation de pertinence
- Métriques personnalisées

### Voting Strategy

Vote majoritaire simple - sélectionne la réponse la plus fréquente.

```typescript
const winner = Strategies.voting().aggregate(results);

// Avec option pour gérer les égalités
const winner = Strategies.voting({
  tieBreaker: 'first', // ou 'last', 'random', 'all'
}).aggregate(results);
```

**Cas d'usage:**

- Décisions démocratiques
- Validation par consensus
- Détection d'anomalies

### Weighted Vote Strategy

Vote avec pondérations par agent.

```typescript
// Pondérations égales au nombre d'agents
const weights = [0.5, 0.3, 0.2]; // Total = 1.0
const winner = Strategies.weightedVote(weights).aggregate(results);

// Pondérations par expertise
const weights = {
  'expert-agent': 0.5,
  'senior-agent': 0.3,
  'junior-agent': 0.2,
};
const winner = Strategies.weightedVote(weights).aggregate(results);
```

**Cas d'usage:**

- Expertise variable
- Priorisation par rôle
- Hiérarchies de confiance

### Consensus Strategy

Atteint un consensus basé sur la similarité des réponses.

```typescript
// Consensus avec seuil de 70%
const consensus = Strategies.consensus(0.7).aggregate(results);

// Avec fonction de similarité personnalisée
const consensus = Strategies.consensus(0.8, {
  similarity: (a, b) => {
    // Calcul de similarité personnalisé
    return calculateSimilarity(a, b);
  },
}).aggregate(results);
```

**Comment ça marche:**

1. Compare toutes les paires de résultats
2. Calcule la similarité moyenne
3. Si similarité ≥ seuil, fusion des résultats
4. Sinon, retourne indication de désaccord

**Cas d'usage:**

- Validation croisée
- Détection de consensus
- Assurance qualité

### Majority Strategy

Sélectionne les résultats approuvés par la majorité.

```typescript
// Majorité simple (>50%)
const majority = Strategies.majority().aggregate(results);

// Majorité qualifiée (≥66%)
const majority = Strategies.majority(0.66).aggregate(results);
```

### Average Strategy

Moyenne des résultats numériques.

```typescript
// Pour résultats numériques
const avg = Strategies.average().aggregate(numericResults);

// Avec extraction personnalisée
const avg = Strategies.average({
  extract: (result) => parseFloat(result.content),
}).aggregate(results);
```

**Cas d'usage:**

- Estimations numériques
- Scores moyens
- Agrégation de métriques

### Filter Strategy

Filtre les résultats avant agrégation.

```typescript
// Filtrer par condition
const filtered = Strategies.filter((r) => r.success && r.content.length > 10).aggregate(results);

// Combiner avec autre stratégie
const filtered = Strategies.compose(
  Strategies.filter((r) => r.success),
  Strategies.bestOf((r) => r.content.length)
);
```

### Transform Strategy

Transforme les résultats avant agrégation.

```typescript
// Transformer le contenu
const transformed = Strategies.transform((r) => r.content.toUpperCase()).aggregate(results);

// Extraction de données
const transformed = Strategies.transform((r) => {
  const data = JSON.parse(r.content);
  return data.summary;
}).aggregate(results);
```

### Ranking Strategy

Classe les résultats selon un critère.

```typescript
// Classement par score
const ranked = Strategies.ranking((r) => calculateScore(r.content), {
  top: 3, // Garder top 3
  order: 'desc', // Ordre décroissant
}).aggregate(results);
```

### Unanimous Strategy

Requiert l'unanimité de tous les agents.

```typescript
// Tous doivent être d'accord
const unanimous = Strategies.unanimous().aggregate(results);

// Avec fonction de comparaison personnalisée
const unanimous = Strategies.unanimous({
  compare: (a, b) => normalizeText(a) === normalizeText(b),
}).aggregate(results);
```

## Custom Strategies

### Strategy Builder

```typescript
import { StrategyBuilder } from 'societyai';

const customStrategy = StrategyBuilder.create()
  .withName('custom-merge')
  .withDescription('Merges results with custom logic')
  .withAggregator((results) => {
    // Logique personnalisée
    const successful = results.filter((r) => r.success);

    // Traiter les résultats
    const processed = successful.map((r) => processResult(r.content));

    // Combiner
    return processed.join('\n\n');
  })
  .build();

// Utiliser
const result = customStrategy.aggregate(results);
```

### Function Strategy

```typescript
import { createStrategy } from 'societyai';

// Créer une stratégie depuis une fonction
const myStrategy = createStrategy('my-strategy', (results) => {
  // Implémentation
  return results
    .filter((r) => r.success)
    .map((r) => r.content)
    .join(' | ');
});
```

### Class-Based Strategy

```typescript
import { AggregationStrategy, StepResult, AggregationResult } from 'societyai';

class SmartMergeStrategy implements AggregationStrategy {
  name = 'smart-merge';
  description = 'Intelligently merges results';

  constructor(
    private options: {
      minLength?: number;
      maxResults?: number;
    } = {}
  ) {}

  aggregate(results: StepResult[]): string {
    let successful = results.filter((r) => r.success);

    // Filtrer par longueur minimum
    if (this.options.minLength) {
      successful = successful.filter((r) => r.content.length >= this.options.minLength!);
    }

    // Limiter le nombre
    if (this.options.maxResults) {
      successful = successful.slice(0, this.options.maxResults);
    }

    // Fusionner
    return successful.map((r) => r.content).join('\n\n');
  }

  aggregateFull(results: StepResult[]): AggregationResult {
    const output = this.aggregate(results);
    const successful = results.filter((r) => r.success);

    return {
      output,
      metadata: {
        successCount: successful.length,
        failedCount: results.length - successful.length,
        strategy: this.name,
        avgLength: successful.reduce((sum, r) => sum + r.content.length, 0) / successful.length,
      },
      contributions: results.map((r) => ({
        agentId: r.agentId,
        included: r.success,
        weight: 1.0 / successful.length,
      })),
    };
  }
}

// Utilisation
const strategy = new SmartMergeStrategy({ minLength: 50, maxResults: 5 });
const result = strategy.aggregate(results);
```

## Strategy Composition

### Chaîner des Stratégies

```typescript
import { chainStrategies } from 'societyai';

// Exécuter des stratégies en séquence
const chained = chainStrategies([
  Strategies.filter((r) => r.success),
  Strategies.transform((r) => r.content.trim()),
  Strategies.bestOf((r) => r.content.length),
]);

const result = chained.aggregate(results);
```

### Stratégies Parallèles

```typescript
import { parallelStrategies } from 'societyai';

// Exécuter plusieurs stratégies et combiner
const parallel = parallelStrategies(
  [Strategies.bestOf((r) => r.content.length), Strategies.consensus(0.7), Strategies.voting()],
  Strategies.voting()
); // Stratégie finale pour combiner

const result = parallel.aggregate(results);
```

### Compose Helper

```typescript
import { Strategies } from 'societyai';

// Composer plusieurs stratégies
const composed = Strategies.compose(
  // 1. Filtrer les succès
  Strategies.filter((r) => r.success),

  // 2. Garder ceux avec contenu substantiel
  Strategies.filter((r) => r.content.length > 100),

  // 3. Voter pour le meilleur
  Strategies.weightedVote([0.5, 0.3, 0.2])
);
```

### Conditional Strategy

```typescript
function conditionalStrategy(
  condition: (results: StepResult[]) => boolean,
  strategyA: AggregationStrategy,
  strategyB: AggregationStrategy
): AggregationStrategy {
  return {
    name: 'conditional',
    aggregate: (results) => {
      if (condition(results)) {
        return strategyA.aggregate(results);
      } else {
        return strategyB.aggregate(results);
      }
    },
    aggregateFull: (results) => {
      const strategy = condition(results) ? strategyA : strategyB;
      return strategy.aggregateFull(results);
    },
  };
}

// Utilisation
const strategy = conditionalStrategy(
  (results) => results.length > 5,
  Strategies.voting(), // Beaucoup de résultats -> vote
  Strategies.consensus(0.8) // Peu de résultats -> consensus
);
```

## Exemples Complets

### Exemple 1: Stratégie de Review Multi-Niveau

```typescript
class MultiLevelReviewStrategy implements AggregationStrategy {
  name = 'multi-level-review';

  constructor(
    private levels: Array<{
      threshold: number;
      strategy: AggregationStrategy;
    }>
  ) {
    // Trier par threshold décroissant
    this.levels.sort((a, b) => b.threshold - a.threshold);
  }

  aggregate(results: StepResult[]): string {
    const successRate = results.filter((r) => r.success).length / results.length;

    // Sélectionner la stratégie selon le taux de succès
    for (const level of this.levels) {
      if (successRate >= level.threshold) {
        return level.strategy.aggregate(results);
      }
    }

    // Fallback - premier résultat réussi
    return Strategies.first().aggregate(results);
  }

  aggregateFull(results: StepResult[]): AggregationResult {
    const output = this.aggregate(results);
    const successRate = results.filter((r) => r.success).length / results.length;

    return {
      output,
      metadata: {
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
        strategy: this.name,
        successRate,
        levelUsed: this.getLevelUsed(successRate),
      },
    };
  }

  private getLevelUsed(successRate: number): string {
    for (const level of this.levels) {
      if (successRate >= level.threshold) {
        return level.strategy.name;
      }
    }
    return 'fallback';
  }
}

// Utilisation
const strategy = new MultiLevelReviewStrategy([
  { threshold: 0.9, strategy: Strategies.consensus(0.9) }, // Excellent
  { threshold: 0.7, strategy: Strategies.consensus(0.7) }, // Bon
  { threshold: 0.5, strategy: Strategies.voting() }, // Moyen
  { threshold: 0.3, strategy: Strategies.bestOf(scoreFunc) }, // Faible
]);
```

### Exemple 2: Stratégie avec Validation

```typescript
class ValidatedMergeStrategy implements AggregationStrategy {
  name = 'validated-merge';

  constructor(
    private validator: (content: string) => boolean,
    private minValidResults: number = 2
  ) {}

  aggregate(results: StepResult[]): string {
    // Filtrer les résultats valides
    const validResults = results.filter((r) => r.success).filter((r) => this.validator(r.content));

    if (validResults.length < this.minValidResults) {
      throw new Error(
        `Insufficient valid results: ${validResults.length} < ${this.minValidResults}`
      );
    }

    // Fusionner les résultats valides
    return validResults.map((r) => r.content).join('\n\n');
  }

  aggregateFull(results: StepResult[]): AggregationResult {
    const validResults = results.filter((r) => r.success).filter((r) => this.validator(r.content));

    const output = this.aggregate(results);

    return {
      output,
      metadata: {
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
        strategy: this.name,
        validCount: validResults.length,
        invalidCount: results.filter((r) => r.success).length - validResults.length,
      },
      contributions: results.map((r) => {
        const isValid = r.success && this.validator(r.content);
        return {
          agentId: r.agentId,
          included: isValid,
          weight: isValid ? 1.0 / validResults.length : 0,
        };
      }),
    };
  }
}

// Utilisation
const strategy = new ValidatedMergeStrategy(
  (content) => {
    // Valider le contenu
    return content.length > 50 && !content.includes('error') && isValidJSON(content);
  },
  3 // Au moins 3 résultats valides requis
);
```

### Exemple 3: Stratégie de Scoring Avancée

```typescript
interface ScoringCriteria {
  name: string;
  weight: number;
  score: (content: string) => number;
}

class ScoringStrategy implements AggregationStrategy {
  name = 'advanced-scoring';

  constructor(
    private criteria: ScoringCriteria[],
    private threshold?: number
  ) {
    // Normaliser les poids
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    this.criteria = criteria.map((c) => ({
      ...c,
      weight: c.weight / totalWeight,
    }));
  }

  private calculateScore(content: string): number {
    return this.criteria.reduce((total, criterion) => {
      const score = criterion.score(content);
      return total + score * criterion.weight;
    }, 0);
  }

  aggregate(results: StepResult[]): string {
    const scored = results
      .filter((r) => r.success)
      .map((r) => ({
        content: r.content,
        agentId: r.agentId,
        score: this.calculateScore(r.content),
      }))
      .sort((a, b) => b.score - a.score);

    if (this.threshold !== undefined) {
      // Filtrer par threshold
      const qualified = scored.filter((s) => s.score >= this.threshold!);
      if (qualified.length === 0) {
        throw new Error('No results meet the quality threshold');
      }
      return qualified.map((s) => s.content).join('\n\n');
    }

    // Retourner le meilleur
    return scored[0]?.content || '';
  }

  aggregateFull(results: StepResult[]): AggregationResult {
    const scored = results
      .filter((r) => r.success)
      .map((r) => ({
        result: r,
        score: this.calculateScore(r.content),
      }))
      .sort((a, b) => b.score - a.score);

    const output = this.aggregate(results);

    return {
      output,
      metadata: {
        successCount: scored.length,
        failedCount: results.length - scored.length,
        strategy: this.name,
        topScore: scored[0]?.score,
        avgScore: scored.reduce((sum, s) => sum + s.score, 0) / scored.length,
        scores: scored.map((s) => ({
          agentId: s.result.agentId,
          score: s.score,
        })),
      },
      contributions: results.map((r) => {
        const scoredResult = scored.find((s) => s.result.agentId === r.agentId);
        return {
          agentId: r.agentId,
          included: scoredResult !== undefined,
          weight: scoredResult?.score,
        };
      }),
    };
  }
}

// Utilisation
const strategy = new ScoringStrategy(
  [
    {
      name: 'length',
      weight: 0.3,
      score: (content) => Math.min(content.length / 1000, 1),
    },
    {
      name: 'keywords',
      weight: 0.4,
      score: (content) => {
        const keywords = ['important', 'relevant', 'accurate'];
        return keywords.filter((k) => content.toLowerCase().includes(k)).length / keywords.length;
      },
    },
    {
      name: 'structure',
      weight: 0.3,
      score: (content) => {
        const hasIntro = content.includes('Introduction');
        const hasConclusion = content.includes('Conclusion');
        const hasSections = (content.match(/\n## /g) || []).length >= 3;
        return (hasIntro ? 0.33 : 0) + (hasConclusion ? 0.33 : 0) + (hasSections ? 0.34 : 0);
      },
    },
  ],
  0.6
); // Threshold: 60%
```

### Exemple 4: Stratégie ML-Based

```typescript
class MLBasedStrategy implements AggregationStrategy {
  name = 'ml-based';

  constructor(
    private model: PredictionModel,
    private features: FeatureExtractor
  ) {}

  aggregate(results: StepResult[]): string {
    // Extraire les features
    const candidates = results
      .filter((r) => r.success)
      .map((r) => ({
        content: r.content,
        features: this.features.extract(r.content),
      }));

    // Prédire les scores
    const scored = candidates.map((c) => ({
      content: c.content,
      score: this.model.predict(c.features),
    }));

    // Sélectionner le meilleur
    const best = scored.sort((a, b) => b.score - a.score)[0];

    return best?.content || '';
  }

  aggregateFull(results: StepResult[]): AggregationResult {
    const output = this.aggregate(results);

    return {
      output,
      metadata: {
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
        strategy: this.name,
        modelUsed: this.model.name,
      },
    };
  }
}

// Utilisation avec un modèle de qualité
const qualityModel = loadQualityModel();
const featureExtractor = new TextFeatureExtractor();

const strategy = new MLBasedStrategy(qualityModel, featureExtractor);
```

## Bonnes Pratiques

### 1. Choisir la Bonne Stratégie

```typescript
// ✅ Bon - stratégie adaptée au cas d'usage

// Pour validation factuelle
Strategies.consensus(0.8); // Forte similarité requise

// Pour opinions diverses
Strategies.concat('\n\n'); // Garder toutes les perspectives

// Pour décision binaire
Strategies.voting(); // Majorité simple

// Pour expertise variable
Strategies.weightedVote(weights); // Pondération par expertise
```

### 2. Gestion des Échecs

```typescript
// ✅ Bon - gérer les cas où tous échouent
const safeStrategy = Strategies.compose(
  Strategies.filter((r) => r.success),
  Strategies.bestOf((r) => r.content.length),
  // Fallback si aucun succès
  {
    name: 'fallback',
    aggregate: (results) => {
      if (results.length === 0) {
        return 'No results available';
      }
      return Strategies.first().aggregate(results);
    },
  }
);
```

### 3. Validation des Résultats

```typescript
// ✅ Bon - valider avant agrégation
const validatedStrategy = StrategyBuilder.create()
  .withName('validated')
  .withAggregator((results) => {
    const valid = results.filter(
      (r) => r.success && r.content.length > 0 && isValidFormat(r.content)
    );

    if (valid.length === 0) {
      throw new Error('No valid results to aggregate');
    }

    return valid.map((r) => r.content).join('\n\n');
  })
  .build();
```

### 4. Métadonnées Riches

```typescript
// ✅ Bon - inclure métadonnées utiles
const strategy: AggregationStrategy = {
  name: 'rich-metadata',
  aggregate: (results) => {
    // ... logique d'agrégation
  },
  aggregateFull: (results) => {
    const output = this.aggregate(results);
    const successful = results.filter((r) => r.success);

    return {
      output,
      metadata: {
        successCount: successful.length,
        failedCount: results.length - successful.length,
        strategy: 'rich-metadata',
        // Métadonnées additionnelles
        totalLength: successful.reduce((sum, r) => sum + r.content.length, 0),
        avgLength: successful.reduce((sum, r) => sum + r.content.length, 0) / successful.length,
        timestamp: Date.now(),
        agents: successful.map((r) => r.agentId),
      },
      contributions: results.map((r) => ({
        agentId: r.agentId,
        included: r.success,
        weight: r.success ? 1.0 / successful.length : 0,
      })),
    };
  },
};
```

### 5. Performance

```typescript
// ✅ Bon - optimiser pour performance
const efficientStrategy = Strategies.filter((r) => r.success && r.content.length > 50).aggregate(
  results
);

// ❌ Mauvais - opérations coûteuses répétées
results.forEach((r) => {
  if (expensiveValidation(r)) {
    // Appelé N fois
    // ...
  }
});

// ✅ Mieux - valider une fois
const validated = results.filter((r) => expensiveValidation(r));
const result = Strategies.concat().aggregate(validated);
```

## API Reference

### `Strategies`

**Méthodes statiques:**

- `concat(separator?: string): AggregationStrategy`
- `merge(): AggregationStrategy`
- `first(): AggregationStrategy`
- `last(): AggregationStrategy`
- `bestOf(scorer: Function): AggregationStrategy`
- `voting(options?: VotingOptions): AggregationStrategy`
- `weightedVote(weights: number[] | Record<string, number>): AggregationStrategy`
- `consensus(threshold: number, options?: ConsensusOptions): AggregationStrategy`
- `majority(threshold?: number): AggregationStrategy`
- `average(options?: AverageOptions): AggregationStrategy`
- `filter(predicate: Function): AggregationStrategy`
- `transform(transformer: Function): AggregationStrategy`
- `ranking(scorer: Function, options?: RankingOptions): AggregationStrategy`
- `unanimous(options?: UnanimousOptions): AggregationStrategy`
- `compose(...strategies: AggregationStrategy[]): AggregationStrategy`

### `StrategyBuilder`

**Méthodes:**

- `static create(): StrategyBuilder`
- `withName(name: string): this`
- `withDescription(description: string): this`
- `withAggregator(fn: (results: StepResult[]) => string): this`
- `build(): AggregationStrategy`

### `AggregationStrategy` Interface

```typescript
interface AggregationStrategy {
  name: string;
  description?: string;
  aggregate: (results: StepResult[]) => string;
  aggregateFull: (results: StepResult[]) => AggregationResult;
}
```

### Helper Functions

- `createStrategy(name: string, fn: Function): AggregationStrategy`
- `chainStrategies(strategies: AggregationStrategy[]): AggregationStrategy`
- `parallelStrategies(strategies: AggregationStrategy[], final: AggregationStrategy): AggregationStrategy`

## Voir Aussi

- [Workflows](./workflows.md) - Utilisation dans les workflows
- [Pipeline Patterns](./pipeline-patterns.md) - Patterns de pipeline
- [Graph Execution](./graph-execution.md) - Utilisation dans les graphes
- [Advanced Patterns](./advanced.md) - Patterns avancés
