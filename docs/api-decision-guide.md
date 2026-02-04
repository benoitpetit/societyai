# Decision Guide: Which API to Use?

This guide helps you choose between the High-Level and Low-Level APIs of SocietyAI.

---

## 🎯 Quick Overview

| Criteria | High-Level API | Low-Level API |
|---------|---------------|---------------|
| **Entry Point** | `Society.create()` | `GraphBuilder.create()` |
| **Complexity** | 🟢 Simple | 🟡 Advanced |
| **Flexibility** | 🟡 Limited | 🟢 Maximum |
| **Use Cases** | Standard Workflows | Complex Patterns |
| **Learning Curve** | 15 minutes | 1-2 hours |

---

## ✅ Use High-Level API (Society)

### When?
- ✅ You are building a **sequential, parallel, or collaborative** workflow.
- ✅ You want **quick results** without complex configuration.
- ✅ Your logic follows a **linear flow** (A → B → C).
- ✅ You are **new** to SocietyAI.

### Use Case Examples
- Content pipeline (draft → review → publish).
- Parallel analysis by multiple experts.
- Collaborative debate between agents.
- Simple conditional routing (if X then Y, else Z).

> **Note**: Some advanced aggregation strategies (consensus, voting) are documented but not yet implemented. Use custom aggregation via `AggregationStrategies.reduce()` or `AggregationStrategies.best()` for complex scenarios.

### Code Example
```typescript
import { Society } from 'societyai';

const result = await Society.create()
  .withName('Content Pipeline')
  .addAgent(writerAgent)
  .addAgent(editorAgent)
  .addTask(s => s
    .withId('draft')
    .withAgents(['writer'])
    .sequential()
  )
  .addTask(s => s
    .withId('review')
    .withAgents(['editor'])
    .sequential()
  )
  .execute('Write a blog post about AI');

console.log(result.output);
```

### Advantages
- 🚀 Intuitive and fluent API.
- 📖 Comprehensive documentation.
- 🛡️ Automatic validation.
- 🎨 Pre-configured patterns (`SocietyPatterns`).

---

## 🔧 Use Low-Level API (Graph)

### When?
- ✅ You need **feedback loops** (cycles).
- ✅ You want to **transform data** between steps.
- ✅ You need custom **result aggregation**.
- ✅ Your workflow has a **complex structure** (decision tree).
- ✅ You want **total control** over execution.

### Use Case Examples
- Self-correction loops (generate → validate → retry until valid).
- Hierarchical routing (junior → senior → manager).
- Custom aggregation strategies (best result, weighted scores).
- Multi-stage pipelines with transformations.
- Recursive workflows (agents calling sub-societies).

### Code Example
```typescript
import { GraphBuilder, NodeType } from 'societyai';

const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('generate', NodeType.AGENT, { 
    agentId: 'generator' 
  })
  .addNode('validate', NodeType.AGENT, { 
    agentId: 'validator' 
  })
  .addNode('check', NodeType.CONDITION, {
    condition: (result) => result.includes('VALID')
  })
  .addNode('end', NodeType.END)
  
  // Create feedback loop
  .addEdge('start', 'generate')
  .addEdge('generate', 'validate')
  .addEdge('validate', 'check')
  .addEdge('check', 'end')        // Valid path
  .addEdge('check', 'generate')   // Retry path (cycle!)
  .build();

const result = await graph.execute(input, agents);
```

### Avantages
- ⚡ Performance optimisée
- 🔄 Support des cycles (self-improvement)
- 🎛️ Contrôle granulaire sur chaque nœud
- 🧩 Composition avancée (transform, aggregate)

---

## 🤔 Cas Ambigus

### "Je veux que mon agent s'améliore jusqu'à ce que le résultat soit parfait"

**→ Low-Level API avec Loop**

```typescript
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('improve', NodeType.LOOP, {
    maxIterations: 10,
    loopCondition: (iteration, result) => {
      return !result.includes('PERFECT');
    }
  })
  .addNode('processor', NodeType.AGENT, { agentId: 'improver' })
  .addNode('end', NodeType.END)
  
  .addEdge('start', 'improve')
  .addEdge('improve', 'processor')
  .addEdge('processor', 'improve')  // Feedback
  .addEdge('improve', 'end')
  .build();
```

**Pourquoi pas High-Level ?**  
L'API High-Level ne supporte pas les boucles avec condition de sortie custom.

---

### "Je veux 3 agents qui débattent pendant 5 tours"

**→ High-Level API avec Collaborative**

```typescript
Society.create()
  .addAgent(agent1)
  .addAgent(agent2)
  .addAgent(agent3)
  .addTask(s => s
    .withId('debate')
    .withAgents(['agent1', 'agent2', 'agent3'])
    .collaborative(5)  // 5 iterations
  )
  .execute(topic);
```

**Pourquoi pas Low-Level ?**  
L'API High-Level gère déjà ce pattern de manière idiomatique.

---

### "Je veux router vers différents experts selon le contenu"

**→ High-Level API avec Conditional Routing**

```typescript
Society.create()
  .addAgent(techExpert)
  .addAgent(bizExpert)
  .addTask(s => s
    .withId('analyze')
    .withAgents(['analyzer'])
    .sequential()
  )
  .addTask(s => s
    .withId('route')
    .withAgents(['tech-expert'])
    .withConditionalNext(
      (results) => {
        const analysis = results.get('analyze')?.[0].output;
        return analysis?.includes('technical');
      },
      'tech-review',
      'biz-review'
    )
  )
  .addTask(s => s.withId('tech-review')...)
  .addTask(s => s.withId('biz-review')...)
  .execute(input);
```

**Alternative Low-Level** (plus verbeux mais plus flexible) :
```typescript
GraphBuilder.create()
  .addNode('analyze', NodeType.AGENT, { agentId: 'analyzer' })
  .addNode('router', NodeType.CONDITION, {
    condition: (result) => result.includes('technical')
  })
  .addNode('tech-expert', NodeType.AGENT, { agentId: 'tech' })
  .addNode('biz-expert', NodeType.AGENT, { agentId: 'biz' })
  // ...
```

---

## 📊 Tableau Récapitulatif

| Pattern | High-Level | Low-Level | Recommandation |
|---------|------------|-----------|----------------|
| Sequential Pipeline | ✅ Excellent | ⚠️ Overkill | **High-Level** |
| Parallel Processing | ✅ Excellent | ⚠️ Overkill | **High-Level** |
| Collaborative Debate | ✅ Excellent | ⚠️ Overkill | **High-Level** |
| Simple Conditional | ✅ Bon | ⚠️ Overkill | **High-Level** |
| Self-Correction Loop | ❌ Non supporté | ✅ Excellent | **Low-Level** |
| Custom Aggregation | ⚠️ Limité | ✅ Excellent | **Low-Level** |
| Hierarchical Routing | ⚠️ Complexe | ✅ Excellent | **Low-Level** |
| Data Transformations | ⚠️ Limité | ✅ Excellent | **Low-Level** |
| Complex Tree Logic | ❌ Non supporté | ✅ Excellent | **Low-Level** |

---

## 🎓 Progression Recommandée

### Niveau 1 : Débutant (Jour 1)
1. Commencez avec `Society.create()`
2. Expérimentez avec `.addTask()` et les types d'exécution (`.sequential()`, `.parallel()` sur les steps)
3. Testez `.collaborate()` pour les workflows collaboratifs

### Niveau 2 : Intermédiaire (Semaine 1)
1. Utilisez le routing conditionnel (`.withConditionalNext()`)
2. Explorez `SocietyPatterns` (review, consensus)
3. Ajoutez des middlewares (logging, retry)

### Niveau 3 : Avancé (Semaine 2+)
1. Passez à `GraphBuilder` pour les cas complexes
2. Créez vos propres `NodeType.TRANSFORM` et `NodeType.AGGREGATE`
3. Implémentez des boucles de feedback

---

## 🚀 Migration High → Low Level

Si vous commencez avec l'API High-Level et réalisez que vous avez besoin de plus de contrôle :

**Avant (High-Level)** :
```typescript
Society.create()
  .addAgent(agent1)
  .addAgent(agent2)
  .addTask(s => s.withId('step1').withAgents(['agent1']).sequential())
  .addTask(s => s.withId('step2').withAgents(['agent2']).sequential())
  .execute(input);
```

**Après (Low-Level)** :
```typescript
GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('step1', NodeType.AGENT, { agentId: 'agent1' })
  .addNode('step2', NodeType.AGENT, { agentId: 'agent2' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'step1')
  .addEdge('step1', 'step2')
  .addEdge('step2', 'end')
  .build()
  .execute(input, [agent1, agent2]);
```

---

## ❓ FAQ

### "Puis-je mélanger les deux APIs ?"
❌ **Non.** Choisissez l'une ou l'autre pour un même workflow. Vous ne pouvez pas passer un `GraphBuilder` à `Society.create()`.

### "Laquelle est plus performante ?"
⚡ **Low-Level API** est légèrement plus rapide car elle évite la conversion Workflow → Graph. Mais la différence est négligeable (<5%) pour la plupart des cas.

### "Y a-t-il des fonctionnalités exclusives à Low-Level ?"
✅ **Oui** :
- Cycles (self-correction loops)
- `NodeType.TRANSFORM` (data transformation)
- `NodeType.AGGREGATE` (custom aggregation)
- `NodeType.LOOP` (repeat-until)

### "Si je commence avec High-Level, puis-je migrer facilement ?"
✅ **Oui.** La conversion est directe (voir exemple ci-dessus). Le mapping est 1:1 dans la plupart des cas.

---

## 📚 Ressources

- **High-Level API** : [Getting Started Guide](getting-started.md)
- **Low-Level API** : [Architecture Guide](architecture.md)
- **Exemples** : [src/__tests__/examples/](../src/__tests__/examples/)
- **Analyse Détaillée** : [ANALYSIS.md](../ANALYSIS.md)

---

**Conseil Final** : Commencez toujours par l'API High-Level. Ne passez au Low-Level que si vous en avez **vraiment** besoin. 80% des use cases sont couverts par `Society.create()`.
