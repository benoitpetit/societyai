# Architecture de SocietyAI

## Vue d'ensemble

SocietyAI est conçu pour orchestrer plusieurs agents d'IA qui collaborent pour analyser des prompts complexes et générer des réponses complètes. L'architecture repose sur plusieurs principes clés :

- **Modularité** : Chaque composant peut être remplacé ou étendu
- **Extensibilité** : Support pour n'importe quel modèle d'IA via l'interface `AIModel`
- **Performance** : Traitement parallèle via un pool de workers
- **Robustesse** : Gestion des erreurs, retry automatique, timeouts configurables

## Architecture Générale

```
┌─────────────────────────────────────────────────────┐
│                   Utilisateur                        │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│            Fonctions Principales                     │
│  • society()                                         │
│  • societyWithSynthesis()                           │
│  • societyCollaborative()                           │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              SocietyGroup                            │
│  • Gestion des agents                               │
│  • Orchestration du workflow                        │
│  • Collecte des résultats                           │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ WorkerPool   │        │   Agents     │
│ • Parallélisme│       │  • AIModel   │
│ • Queue      │        │  • Prompt    │
└──────────────┘        └──────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │  AIModel     │
                        │ (Interface)  │
                        └──────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐   ┌──────────┐
        │  OpenAI  │    │  Gemini  │   │  Custom  │
        │ Adapter  │    │ Adapter  │   │  Model   │
        └──────────┘    └──────────┘   └──────────┘
```

## Composants Clés

### 1. Interface AIModel

L'interface `AIModel` est au cœur de l'architecture. Elle définit le contrat que tous les modèles d'IA doivent respecter :

```typescript
interface AIModel {
  process(prompt: unknown, signal?: AbortSignal): Promise<string>;
  name(): string;
  supportsPromptType(promptType: string): boolean;
}
```

**Avantages :**
- Indépendance vis-à-vis de fournisseurs spécifiques
- Permet d'utiliser n'importe quel modèle d'IA
- Facilite les tests avec des mocks

### 2. StandardModelBase

Classe de base qui implémente les fonctionnalités communes :

- Gestion du timeout
- Mécanisme de retry automatique
- Adaptation de prompts via ModelAdapter
- Logging intégré

```typescript
class StandardModelBase implements AIModel {
  protected options: StandardModelOptions;
  protected processFunc?: (prompt: unknown, signal?: AbortSignal) => Promise<string>;
  
  // Implémentation avec retry, timeout, adaptation...
}
```

### 3. SocietyGroup

Orchestrateur principal qui gère :

- La création et l'exécution des agents
- Le workflow selon le mode choisi
- La collecte et synthèse des résultats
- L'observabilité (via SocietyObserver)

### 4. WorkerPool

Gestionnaire de parallélisme qui :

- Exécute les agents en parallèle
- Gère une queue de tâches
- Supporte l'annulation via AbortSignal
- Optimise l'utilisation des ressources

### 5. Système de Retry

Mécanisme robuste de retry avec :

- Backoff exponentiel
- Jitter pour éviter les thundering herds
- Nombre maximum de tentatives configurable
- Support de l'annulation

## Trois Modes de Fonctionnement

### Mode Standard

```
Prompt initial
     │
     ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Agent 1 │  │ Agent 2 │  │ Agent 3 │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └────────────┴────────────┘
                  │
                  ▼
        Synthèse simple (agrégation)
```

**Workflow :**
1. Chaque agent reçoit une variation du prompt
2. Les agents traitent en parallèle
3. Les résultats sont agrégés simplement

**Cas d'usage :**
- Questions simples nécessitant plusieurs perspectives
- Besoin de rapidité
- Première analyse d'un sujet

### Mode Synthèse

```
Prompt initial
     │
     ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Agent 1 │  │ Agent 2 │  │ Agent 3 │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └────────────┴────────────┘
                  │
                  ▼
          Modèle de synthèse
                  │
                  ▼
         Réponse synthétisée
```

**Workflow :**
1. Agents analysent le prompt en parallèle
2. Un modèle dédié synthétise les résultats
3. Génération d'une conclusion cohérente

**Cas d'usage :**
- Besoin d'une réponse unifiée et cohérente
- Questions complexes avec multiples angles
- Analyse nécessitant intégration d'insights

### Mode Collaboratif

```
              Prompt initial
                    │
                    ▼
         Phase 1: Analyse Initiale
              (Agent primaire)
                    │
                    ▼
       Phase 2: Exploration de Dimensions
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│Dimension│   │Dimension│   │Dimension│
│    1    │   │    2    │   │    3    │
└────┬────┘   └────┬────┘   └────┬────┘
     └──────────────┼──────────────┘
                    ▼
      Phase 3: Intégration des Analyses
              (Agent primaire)
                    │
                    ▼
      Phase 4: Génération Réponse Finale
              (Agent primaire)
```

**Workflow :**
1. **Phase 1** : Analyse initiale approfondie par agent primaire
2. **Phase 2** : Chaque agent explore une dimension spécifique
3. **Phase 3** : Intégration des insights par agent primaire
4. **Phase 4** : Génération de la réponse finale cohérente

**Dimensions explorées :**
- Compréhension fondamentale
- Aspects pratiques
- Implications plus larges
- Défis potentiels
- Applications concrètes

**Cas d'usage :**
- Questions très complexes
- Besoin d'analyse approfondie
- Sujets nécessitant exploration multidimensionnelle

## Gestion des Erreurs

### Hiérarchie des Erreurs

```
Error
  │
  ├─ SocietyError (base)
  │   ├─ InvalidAgentCountError
  │   ├─ NoModelsSpecifiedError
  │   ├─ SynthesisModelRequiredError
  │   ├─ ProcessingFailedError
  │   └─ TimeoutError
```

### Stratégie de Gestion

1. **Erreurs récupérables** : Retry automatique avec backoff
2. **Erreurs fatales** : Propagation immédiate avec contexte
3. **Timeouts** : Annulation gracieuse via AbortSignal
4. **Erreurs d'agents individuels** : Isolation (n'affectent pas les autres)

## Système d'Adaptation

### ModelAdapter

Permet d'adapter les prompts et réponses entre différents formats :

```typescript
interface ModelAdapter {
  convertPrompt(genericPrompt: unknown): Promise<unknown>;
  convertResponse(specificResponse: unknown): Promise<string>;
  getSupportedPromptTypes(): string[];
}
```

**Adaptateurs fournis :**

- **TextModelAdapter** : Pour modèles textuels simples
- **OpenAIAdapter** : Format messages OpenAI
- **GeminiAdapter** : Format contents Gemini

## Observabilité

### SocietyObserver

Interface pour observer le cycle de vie :

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

**Cas d'usage :**
- Monitoring en production
- Debugging
- Métriques et analytics
- Progression en temps réel

## Système de Logging

Logging hiérarchique avec niveaux :

- **DEBUG** : Informations détaillées de debug
- **INFO** : Informations générales
- **WARN** : Avertissements
- **ERROR** : Erreurs

Configuration globale :
```typescript
setGlobalLogLevel(LogLevel.INFO);
```

## Extensibilité

### Ajouter un nouveau modèle

```typescript
class MyCustomModel extends StandardModelBase {
  constructor() {
    super({ name: 'MyCustomModel' }, async (prompt) => {
      // Votre implémentation
      return response;
    });
  }
}
```

### Créer un adaptateur personnalisé

```typescript
class MyAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // Conversion prompt
  }
  
  async convertResponse(specificResponse: unknown): Promise<string> {
    // Conversion réponse
  }
  
  getSupportedPromptTypes(): string[] {
    return ['text', 'structured'];
  }
}
```

### Implémenter un observateur

```typescript
class MyObserver implements SocietyObserver {
  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    console.log(`Agent ${agentId} starting with ${modelName}`);
  }
  
  // Implémenter autres méthodes...
}
```

## Performance

### Optimisations

1. **Parallélisation** : WorkerPool pour exécution concurrente
2. **Lazy loading** : Chargement à la demande des ressources
3. **Caching** : Potentiel de cache au niveau adaptateurs
4. **Timeouts** : Évite les blocages infinis
5. **AbortSignal** : Annulation rapide des opérations

### Considérations de Scale

- **Nombre d'agents** : Recommandé 3-7 agents
- **Timeout global** : Configurer selon complexité
- **Retry** : Équilibrer robustesse et performance
- **Modèles multiples** : Permet distribution de charge

## Sécurité

### Bonnes Pratiques

1. **Gestion des secrets** : Ne jamais logger les clés API
2. **Validation des entrées** : Valider prompts et configurations
3. **Timeouts** : Protection contre déni de service
4. **Isolation** : Erreurs d'un agent n'affectent pas les autres
5. **AbortSignal** : Permet annulation contrôlée

## Diagramme de Séquence - Mode Collaboratif

```
Client        Society      Agent1     Agent2     Agent3     Model
  │              │           │          │          │          │
  ├─collaborative─>│          │          │          │          │
  │              ├─create────>│          │          │          │
  │              ├─create─────┼────────>│          │          │
  │              ├─create─────┼──────────┼────────>│          │
  │              │            │          │          │          │
  │              ├─Phase1─────>│         │          │          │
  │              │            ├─process──┼──────────┼────────>│
  │              │            │<─analysis┼──────────┼─────────┤
  │              │            ├─share────>│         │          │
  │              │            ├─share─────┼────────>│          │
  │              │            │           │          │          │
  │              ├─Phase2─────>│          │          │          │
  │              │            ├─explore───┼──────────┼────────>│
  │              ├─Phase2─────┼──────────>│          │          │
  │              │            │           ├─explore──┼────────>│
  │              ├─Phase2─────┼───────────┼────────>│          │
  │              │            │           │          ├─explore─>│
  │              │            │           │          │          │
  │              ├─Phase3─────>│          │          │          │
  │              │            ├─integrate─┼──────────┼────────>│
  │              │            │<─integrated──────────┼─────────┤
  │              │            │           │          │          │
  │              ├─Phase4─────>│          │          │          │
  │              │            ├─generate──┼──────────┼────────>│
  │              │            │<─final────┼──────────┼─────────┤
  │<─result──────┤            │           │          │          │
```

## Conclusion

L'architecture de SocietyAI est conçue pour être :

- **Flexible** : Support de tout modèle d'IA
- **Robuste** : Gestion avancée des erreurs
- **Performante** : Traitement parallèle optimisé
- **Observable** : Monitoring et debugging facilités
- **Extensible** : Facile d'ajouter de nouvelles fonctionnalités

Cette architecture permet de créer des systèmes d'IA multi-agents sophistiqués tout en maintenant la simplicité d'utilisation.
