# Guide des Mécanismes de Transformation - SocietyAI

Ce guide explique quand et comment utiliser les trois mécanismes de transformation disponibles dans SocietyAI.

## Vue d'ensemble

SocietyAI offre trois façons de transformer ou modifier les données :

1. **Middlewares** - Transformations globales et cross-cutting concerns
2. **Transform Nodes** - Transformations dans le graphe d'exécution
3. **Step Result Transformers** - Transformations des résultats d'étapes

---

## 1. Middlewares

### Quand utiliser ?
- **Cross-cutting concerns** : Logging, métriques, caching, rate limiting
- **Transformations globales** : Appliquées à toutes les requêtes/réponses
- **Validation/Sanitisation** : Vérifier ou nettoyer les entrées/sorties
- **Retry logic** : Gestion des erreurs et tentatives

### Caractéristiques
- ✅ S'appliquent à **tous les agents** de la société
- ✅ **Composables** et réutilisables
- ✅ Exécutés **avant et après** chaque appel de modèle
- ⚠️ Ne modifient pas le flux de contrôle du workflow

### Exemple d'usage

```typescript
import { Society, Middlewares } from 'societyai';

const result = await Society.create()
  .withName('Logged Society')
  .addMiddleware(Middlewares.logging())
  .addMiddleware(Middlewares.timing())
  .addMiddleware(Middlewares.cache({ ttl: 60000 }))
  .addAgent(agent => /* ... */)
  .addTask(step => /* ... */)
  .execute('Input');
```

### Cas d'usage typiques
- **Observabilité** : Tracer toutes les interactions avec les modèles
- **Performance** : Mettre en cache les réponses fréquentes
- **Fiabilité** : Retry automatique sur erreur temporaire
- **Sécurité** : Filtrer les contenus sensibles

---

## 2. Transform Nodes (Graphe)

### Quand utiliser ?
- **Transformations dans le flux** : Modifier les données entre deux étapes
- **Normalisation** : Formater les sorties pour l'étape suivante
- **Extraction** : Extraire une partie spécifique d'un résultat
- **Routage conditionnel** : Décider du prochain nœud selon les données

### Caractéristiques
- ✅ Partie intégrante du **graphe d'exécution**
- ✅ Permet le **routage dynamique**
- ✅ Accès complet au **contexte d'exécution**
- ⚠️ Nécessite l'utilisation de l'API GraphBuilder

### Exemple d'usage

```typescript
import { GraphBuilder, NodeType } from 'societyai';

const graph = GraphBuilder.create()
  .addNode('analyzer', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('extract', NodeType.TRANSFORM, {
    transformer: (result, context) => {
      // Extraire seulement le score d'un résultat JSON
      const data = JSON.parse(result);
      return data.score.toString();
    }
  })
  .addNode('evaluator', NodeType.AGENT, { agentId: 'evaluator' })
  .addEdge('analyzer', 'extract')
  .addEdge('extract', 'evaluator')
  .build();
```

### Cas d'usage typiques
- **Format conversion** : JSON → String, XML → JSON, etc.
- **Data enrichment** : Ajouter des métadonnées au contexte
- **Aggregation** : Combiner plusieurs résultats
- **Filtering** : Supprimer des données non pertinentes

---

## 3. Step Result Transformers

### Quand utiliser ?
- **Post-processing d'étape** : Transformer le résultat d'une étape spécifique
- **Formatting simple** : Nettoyer ou formater la sortie
- **Type conversion** : Convertir le résultat en un format attendu
- **Business logic** : Appliquer une logique métier simple

### Caractéristiques
- ✅ **Scope limité** à une étape spécifique
- ✅ Simple et **déclaratif**
- ✅ Compatible avec l'API fluide de haut niveau
- ⚠️ Pas d'accès au contexte global

### Exemple d'usage

```typescript
const result = await Society.create()
  .withName('Formatted Output')
  .addAgent(/* ... */)
  .addTask(s => s
    .withId('analyze')
    .withAgents(['analyst'])
    .sequential()
    .transformResults((results) => {
      // Transformer le résultat en JSON structuré
      const content = Array.isArray(results) 
        ? results[0].output 
        : results.output;
      
      return {
        analysis: content,
        timestamp: Date.now(),
        confidence: 0.95
      };
    })
  )
  .execute('Analyze this');
```

### Cas d'usage typiques
- **Formatting** : Ajouter des préfixes/suffixes
- **Validation** : Vérifier le format de sortie
- **Mapping** : Convertir entre formats de données
- **Extraction** : Isoler une partie du résultat

---

## Tableau de Décision

| Critère | Middlewares | Transform Nodes | Result Transformers |
|---------|-------------|-----------------|---------------------|
| **Portée** | Globale (tous agents) | Locale (dans graphe) | Locale (une étape) |
| **Réutilisabilité** | ✅ Haute | ⚠️ Moyenne | ❌ Faible |
| **Accès au contexte** | ✅ Complet | ✅ Complet | ⚠️ Limité |
| **Routage dynamique** | ❌ Non | ✅ Oui | ❌ Non |
| **Complexité** | Moyenne | Haute | Faible |
| **API requise** | Society fluide | GraphBuilder | Society fluide |

---

## Exemples Combinés

Vous pouvez combiner ces trois mécanismes :

```typescript
import { Society, Middlewares, GraphBuilder, NodeType } from 'societyai';

// 1. Middleware pour le logging global
const loggingMiddleware = Middlewares.logging();

// 2. Transform Node pour extraction de données
const extractNode = {
  id: 'extract-score',
  type: NodeType.TRANSFORM,
  transformer: (result) => JSON.parse(result).score
};

// 3. Result Transformer pour formatting
const result = await Society.create()
  .withName('Complete Example')
  .addMiddleware(loggingMiddleware) // Global
  .addAgent(/* ... */)
  .addTask(s => s
    .withId('evaluate')
    .withAgents(['evaluator'])
    .sequential()
    .transformResults(r => ({ // Local à l'étape
      score: r.output,
      evaluated_at: new Date().toISOString()
    }))
  )
  .execute('Input');
```

---

## Bonnes Pratiques

### ✅ À faire
- Utiliser **Middlewares** pour les concerns transversaux
- Utiliser **Transform Nodes** pour le routage complexe
- Utiliser **Result Transformers** pour les transformations simples d'étape
- Garder les transformations **pures** (sans effets de bord)

### ❌ À éviter
- Utiliser Result Transformers pour modifier le contexte global
- Utiliser Middlewares pour des transformations spécifiques à une étape
- Mélanger logique métier et transformation dans les middlewares
- Transformer des données qui ne sont pas nécessaires

---

## Pour aller plus loin

- [Documentation Middlewares](../core/middleware.md)
- [Guide GraphBuilder](./architecture.md)
- [Graph Execution](./graph.md)
