# Meilleures Pratiques - SocietyAI

Ce guide présente les meilleures pratiques, patterns recommandés et conseils d'optimisation pour utiliser SocietyAI efficacement.

## Table des Matières

1. [Choix du Mode](#choix-du-mode)
2. [Configuration des Agents](#configuration-des-agents)
3. [Gestion des Modèles](#gestion-des-modèles)
4. [Performance et Optimisation](#performance-et-optimisation)
5. [Gestion des Erreurs](#gestion-des-erreurs)
6. [Coûts et Budgets](#coûts-et-budgets)
7. [Observabilité et Monitoring](#observabilité-et-monitoring)
8. [Sécurité](#sécurité)
9. [Tests](#tests)
10. [Patterns Avancés](#patterns-avancés)

---

## Choix du Mode

### Mode Standard

**✅ Utilisez quand :**
- Questions simples nécessitant plusieurs perspectives
- Besoin de rapidité d'exécution
- Première analyse d'un sujet
- Budget limité

**❌ Évitez quand :**
- Besoin d'une réponse très cohérente
- Questions très complexes
- Besoin d'analyse approfondie

**Exemple :**
```typescript
// Bon usage : Question simple, besoin de rapidité
const result = await society(
  'Liste les avantages de TypeScript',
  3,
  [model],
  false
);
```

### Mode Synthèse

**✅ Utilisez quand :**
- Besoin d'une réponse unifiée et cohérente
- Questions avec multiples angles d'analyse
- Identification de consensus nécessaire
- Budget modéré

**❌ Évitez quand :**
- Questions très simples (overhead inutile)
- Besoin de rapidité maximale
- Budget très limité

**Exemple :**
```typescript
// Bon usage : Besoin de synthèse cohérente
const result = await societyWithSynthesis(
  'Compare les frameworks web modernes',
  3,
  [agentModel],
  false,
  synthesisModel // Modèle plus puissant
);
```

### Mode Collaboratif

**✅ Utilisez quand :**
- Questions très complexes
- Besoin d'analyse multidimensionnelle
- Qualité prioritaire sur vitesse
- Sujets nécessitant réflexion approfondie

**❌ Évitez quand :**
- Questions simples
- Besoin de réponse rapide
- Budget très limité
- Production avec timeout strict

**Exemple :**
```typescript
// Bon usage : Question complexe nécessitant analyse approfondie
const result = await societyCollaborative(
  'Comment concevoir une architecture distribuée résiliente ?',
  5,
  [model],
  false
);
```

---

## Configuration des Agents

### Nombre d'Agents Optimal

**Recommandations :**

```typescript
// Mode Standard : 3-5 agents
await society('Question', 3, [model], false);

// Mode Synthèse : 3-5 agents
await societyWithSynthesis('Question', 4, [model], false, synthModel);

// Mode Collaboratif : 5-7 agents (un par dimension)
await societyCollaborative('Question', 5, [model], false);
```

**❌ Anti-patterns :**

```typescript
// Trop peu d'agents (perte de diversité)
await society('Question', 1, [model], false); // ❌

// Trop d'agents (coûts élevés, peu de gain)
await society('Question', 20, [model], false); // ❌

// Nombre impair recommandé (évite les égalités)
await society('Question', 3, [model], false); // ✅
await society('Question', 5, [model], false); // ✅
```

### Distribution des Modèles

**Pattern recommandé :**

```typescript
// Modèles complémentaires
const fastModel = new FastModel();      // Réponses rapides
const detailedModel = new DetailedModel(); // Analyses approfondies
const creativeModel = new CreativeModel(); // Perspectives innovantes

await society(
  'Question',
  6,
  [fastModel, detailedModel, creativeModel],
  true // Distribution active
);
```

**Anti-pattern :**

```typescript
// Tous les modèles identiques en multi-model
await society(
  'Question',
  6,
  [sameModel, sameModel, sameModel], // ❌ Pas de diversité
  true
);
```

---

## Gestion des Modèles

### Timeout Configuration

**Bonne pratique :**

```typescript
class MyModel extends StandardModelBase {
  constructor() {
    super({
      name: 'MyModel',
      timeout: 30000, // 30s - ajuster selon le modèle
      retryOptions: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
      },
    });
  }
}
```

**Timeouts recommandés :**

| Type de Modèle | Timeout Recommandé |
|----------------|-------------------|
| Rapide (GPT-3.5) | 15-20 secondes |
| Standard (GPT-4) | 30-45 secondes |
| Complexe | 60-90 secondes |

### Retry Strategy

**Configuration adaptative :**

```typescript
// API stable et rapide
const aggressiveRetry = {
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 3000,
  backoffMultiplier: 1.5,
  jitter: false,
};

// API instable ou lente
const conservativeRetry = {
  maxAttempts: 3,
  initialDelay: 2000,
  maxDelay: 20000,
  backoffMultiplier: 3,
  jitter: true, // Important pour éviter thundering herd
};

// Production
const productionRetry = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true, // Toujours activer en production
};
```

### Adaptateurs

**Utilisation correcte :**

```typescript
import { OpenAIAdapter, GeminiAdapter } from '@societyai/core';

// Adapter selon le format de l'API
const openaiModel = new MyModel()
  .withAdapter(new OpenAIAdapter());

const geminiModel = new MyModel()
  .withAdapter(new GeminiAdapter());
```

---

## Performance et Optimisation

### Parallélisation

**✅ Bonne pratique :**

```typescript
// Les agents s'exécutent en parallèle automatiquement
const result = await society('Question', 5, [model], false);
// Durée ≈ durée de l'agent le plus lent
```

**❌ Anti-pattern :**

```typescript
// Exécution séquentielle (éviter!)
for (let i = 0; i < 5; i++) {
  await model.process('Question'); // ❌ Séquentiel
}
```

### Caching

**Pattern de cache simple :**

```typescript
class CachedModel extends StandardModelBase {
  private cache = new Map<string, string>();

  constructor() {
    super({ name: 'CachedModel' }, async (prompt: unknown) => {
      const key = JSON.stringify(prompt);
      
      // Vérifier le cache
      if (this.cache.has(key)) {
        console.log('Cache hit!');
        return this.cache.get(key)!;
      }

      // Appel réel
      const response = await this.callAPI(prompt);
      
      // Mettre en cache
      this.cache.set(key, response);
      
      return response;
    });
  }

  private async callAPI(prompt: unknown): Promise<string> {
    // Votre appel API ici
    return 'Response';
  }
}
```

### Optimisation des Prompts

**✅ Prompts efficaces :**

```typescript
// Clair et concis
const goodPrompt = 'Liste les 5 principaux avantages de TypeScript';

// Trop verbeux
const badPrompt = `
  Peux-tu s'il te plaît me donner une liste exhaustive et détaillée
  de tous les avantages possibles et imaginables de TypeScript...
`; // ❌

// Structuré pour le mode collaboratif
const complexPrompt = `
  Analyse l'architecture microservices en considérant:
  - Scalabilité
  - Résilience
  - Sécurité
  - Performance
  - Maintenance
`; // ✅
```

---

## Gestion des Erreurs

### Try-Catch Approprié

**Pattern recommandé :**

```typescript
import {
  InvalidAgentCountError,
  NoModelsSpecifiedError,
  TimeoutError,
  ProcessingFailedError,
} from '@societyai/core';

async function safeSociety(prompt: string): Promise<string> {
  try {
    return await society(prompt, 3, [model], false);
  } catch (error) {
    if (error instanceof InvalidAgentCountError) {
      // Erreur de configuration
      console.error('Configuration invalide:', error.message);
      throw error; // Propager
    } else if (error instanceof TimeoutError) {
      // Timeout - peut-être retry ou fallback
      console.warn('Timeout, utilisation du fallback');
      return 'Réponse par défaut due au timeout';
    } else if (error instanceof ProcessingFailedError) {
      // Erreur de traitement - logger et notifier
      console.error('Traitement échoué:', error.message);
      // Notifier système de monitoring
      return 'Une erreur est survenue';
    } else {
      // Erreur inconnue
      console.error('Erreur inattendue:', error);
      throw error;
    }
  }
}
```

### Circuit Breaker Pattern

**Protection contre les défaillances en cascade :**

```typescript
class CircuitBreakerModel extends StandardModelBase {
  private failures = 0;
  private maxFailures = 5;
  private resetTimeout = 60000; // 1 minute
  private isOpen = false;

  constructor() {
    super({ name: 'CircuitBreakerModel' }, async (prompt: unknown) => {
      // Vérifier si le circuit est ouvert
      if (this.isOpen) {
        throw new Error('Circuit ouvert - trop de défaillances récentes');
      }

      try {
        const response = await this.callAPI(prompt);
        
        // Succès - réinitialiser le compteur
        this.failures = 0;
        
        return response;
      } catch (error) {
        this.failures++;
        
        // Ouvrir le circuit si trop de défaillances
        if (this.failures >= this.maxFailures) {
          this.isOpen = true;
          
          // Réinitialiser après un délai
          setTimeout(() => {
            this.isOpen = false;
            this.failures = 0;
          }, this.resetTimeout);
        }
        
        throw error;
      }
    });
  }

  private async callAPI(prompt: unknown): Promise<string> {
    // Votre appel API
    return 'Response';
  }
}
```

---

## Coûts et Budgets

### Estimation des Coûts

**Calculer avant d'exécuter :**

```typescript
interface CostEstimate {
  agents: number;
  modelCost: number; // Par appel
  synthesisModelCost?: number;
  estimatedTotal: number;
}

function estimateCost(
  mode: 'standard' | 'synthesis' | 'collaborative',
  agents: number,
  modelCost: number,
  synthesisCost?: number
): CostEstimate {
  let total = agents * modelCost;
  
  if (mode === 'synthesis' && synthesisCost) {
    total += synthesisCost;
  } else if (mode === 'collaborative') {
    // 4 phases : analyse, exploration, intégration, réponse
    total = (agents + 3) * modelCost;
  }
  
  return {
    agents,
    modelCost,
    synthesisModelCost: synthesisCost,
    estimatedTotal: total,
  };
}

// Usage
const cost = estimateCost('synthesis', 3, 0.002, 0.01);
console.log(`Coût estimé: $${cost.estimatedTotal.toFixed(4)}`);
```

### Optimisation des Coûts

**Stratégies :**

```typescript
// 1. Modèles économiques pour les agents
const cheapModel = new GPT35Model(apiKey);
const expensiveModel = new GPT4Model(apiKey);

// Agents avec modèle économique
await societyWithSynthesis(
  'Question',
  5,
  [cheapModel],
  false,
  expensiveModel // Modèle puissant seulement pour synthèse
);

// 2. Limiter max_tokens
const budgetModel = new OpenAIModel(apiKey, 'gpt-3.5-turbo')
  .withMaxTokens(500); // Limiter la longueur

// 3. Caching agressif
const cachedModel = new CachedModel();

// 4. Fallback si timeout
try {
  return await society('Question', 3, [model], false);
} catch (error) {
  if (error instanceof TimeoutError) {
    return 'Réponse simplifiée (pas d\'API)';
  }
  throw error;
}
```

---

## Observabilité et Monitoring

### Observateur Complet

**Pattern recommandé :**

```typescript
class ProductionObserver implements SocietyObserver {
  private metrics = {
    startTime: 0,
    agentDurations: [] as number[],
    errors: [] as Error[],
  };

  onSocietyStart(prompt: string, agentCount: number): void {
    this.metrics.startTime = Date.now();
    
    // Envoyer à système de monitoring
    this.sendMetric('society.start', {
      agentCount,
      promptLength: prompt.length,
    });
  }

  onAgentComplete(agentId: number, modelName: string, result: string): void {
    const duration = Date.now() - this.metrics.startTime;
    this.metrics.agentDurations.push(duration);
    
    // Métriques
    this.sendMetric('agent.complete', {
      agentId,
      modelName,
      duration,
      resultLength: result.length,
    });
  }

  onAgentError(agentId: number, modelName: string, error: Error): void {
    this.metrics.errors.push(error);
    
    // Alertes
    this.sendAlert('agent.error', {
      agentId,
      modelName,
      error: error.message,
    });
  }

  onSocietyComplete(finalResult: string): void {
    const totalDuration = Date.now() - this.metrics.startTime;
    
    // Métriques finales
    this.sendMetric('society.complete', {
      totalDuration,
      avgAgentDuration: this.metrics.agentDurations.reduce((a, b) => a + b, 0) / 
                        this.metrics.agentDurations.length,
      errorCount: this.metrics.errors.length,
      resultLength: finalResult.length,
    });
  }

  private sendMetric(name: string, data: any): void {
    // Envoyer à DataDog, Prometheus, CloudWatch, etc.
    console.log(`METRIC: ${name}`, data);
  }

  private sendAlert(name: string, data: any): void {
    // Envoyer alerte à PagerDuty, Slack, etc.
    console.error(`ALERT: ${name}`, data);
  }
}
```

### Logging Approprié

**Niveaux de log par environnement :**

```typescript
// Développement
setGlobalLogLevel(LogLevel.DEBUG);

// Staging
setGlobalLogLevel(LogLevel.INFO);

// Production
setGlobalLogLevel(LogLevel.WARN);
```

---

## Sécurité

### Protection des Clés API

**✅ Bonnes pratiques :**

```typescript
// Utiliser variables d'environnement
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OPENAI_API_KEY non définie');
}

const model = new OpenAIModel(apiKey);
```

**❌ Anti-patterns :**

```typescript
// Ne JAMAIS hardcoder les clés
const apiKey = 'sk-1234567890...'; // ❌

// Ne JAMAIS logger les clés
console.log('API Key:', apiKey); // ❌

// Ne JAMAIS commit les clés
// git add .env // ❌
```

### Validation des Entrées

**Pattern recommandé :**

```typescript
function validatePrompt(prompt: string): void {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt vide');
  }

  if (prompt.length > 10000) {
    throw new Error('Prompt trop long (max 10000 caractères)');
  }

  // Filtrer contenu malveillant
  const forbidden = ['<script>', 'DROP TABLE', 'rm -rf'];
  for (const pattern of forbidden) {
    if (prompt.includes(pattern)) {
      throw new Error('Prompt contient du contenu interdit');
    }
  }
}

// Usage
try {
  validatePrompt(userInput);
  const result = await society(userInput, 3, [model], false);
} catch (error) {
  console.error('Validation échouée:', error);
}
```

### Rate Limiting

**Protection contre abus :**

```typescript
class RateLimitedModel extends StandardModelBase {
  private requests: number[] = [];
  private maxRequests = 10;
  private windowMs = 60000; // 1 minute

  constructor() {
    super({ name: 'RateLimited' }, async (prompt: unknown) => {
      // Nettoyer les anciennes requêtes
      const now = Date.now();
      this.requests = this.requests.filter(t => now - t < this.windowMs);

      // Vérifier la limite
      if (this.requests.length >= this.maxRequests) {
        throw new Error('Rate limit dépassé');
      }

      // Enregistrer la requête
      this.requests.push(now);

      // Traiter
      return await this.callAPI(prompt);
    });
  }

  private async callAPI(prompt: unknown): Promise<string> {
    return 'Response';
  }
}
```

---

## Tests

### Tests Unitaires

**Pattern avec mocks :**

```typescript
import { society, AIModel } from '@societyai/core';

class MockModel implements AIModel {
  constructor(private response: string) {}

  async process(prompt: unknown): Promise<string> {
    return this.response;
  }

  name(): string {
    return 'MockModel';
  }

  supportsPromptType(promptType: string): boolean {
    return true;
  }
}

// Test
describe('Society', () => {
  it('devrait agréger les résultats correctement', async () => {
    const model = new MockModel('Test response');
    
    const result = await society('Question', 3, [model], false);
    
    expect(result).toContain('Test response');
    expect(result).toContain('Agent 1');
    expect(result).toContain('Agent 2');
    expect(result).toContain('Agent 3');
  });
});
```

### Tests d'Intégration

**Pattern avec vraie API (optionnel) :**

```typescript
describe('Integration Tests', () => {
  // Skip si pas de clé API
  const skipIfNoAPIKey = !process.env.OPENAI_API_KEY ? it.skip : it;

  skipIfNoAPIKey('devrait fonctionner avec OpenAI', async () => {
    const model = new OpenAIModel(process.env.OPENAI_API_KEY!);
    
    const result = await society('Test', 2, [model], false);
    
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  }, 30000); // Timeout élevé pour API réelle
});
```

---

## Patterns Avancés

### Pattern: Cascade de Modèles

**Utiliser des modèles de complexité croissante :**

```typescript
async function cascadeSociety(
  prompt: string,
  fastModel: AIModel,
  powerfulModel: AIModel
): Promise<string> {
  // 1. Essayer avec modèle rapide
  try {
    const quickResult = await society(prompt, 3, [fastModel], false);
    
    // Vérifier la qualité
    if (quickResult.length > 500) {
      return quickResult; // Suffisant
    }
  } catch (error) {
    console.warn('Fast model failed, trying powerful model');
  }

  // 2. Utiliser modèle puissant si nécessaire
  return await societyCollaborative(prompt, 5, [powerfulModel], false);
}
```

### Pattern: Spécialisation par Domaine

**Agents experts par domaine :**

```typescript
const securityExpert = new ExpertModel('security');
const performanceExpert = new ExpertModel('performance');
const uxExpert = new ExpertModel('ux');

const result = await societyWithSynthesis(
  'Concevoir une application web moderne',
  3,
  [securityExpert, performanceExpert, uxExpert],
  true,
  generalModel // Synthèse généraliste
);
```

### Pattern: Validation Croisée

**Vérifier la cohérence des réponses :**

```typescript
async function validatedSociety(
  prompt: string,
  model: AIModel
): Promise<string> {
  // 1. Première passe
  const result1 = await society(prompt, 3, [model], false);

  // 2. Seconde passe avec reformulation
  const verificationPrompt = `Vérifie cette analyse: ${result1}`;
  const result2 = await society(verificationPrompt, 2, [model], false);

  // 3. Combiner
  return `Analyse:\n${result1}\n\nVérification:\n${result2}`;
}
```

---

## Checklist de Mise en Production

### Avant le Déploiement

- [ ] Clés API sécurisées (variables d'environnement)
- [ ] Timeouts configurés appropriément
- [ ] Retry strategy testée
- [ ] Rate limiting en place
- [ ] Logging configuré (niveau WARN ou ERROR)
- [ ] Observateur de production implémenté
- [ ] Tests d'intégration passent
- [ ] Budget et limites de coûts définis
- [ ] Circuit breakers en place
- [ ] Fallbacks configurés pour erreurs
- [ ] Monitoring et alertes actifs
- [ ] Documentation à jour

### Après le Déploiement

- [ ] Surveiller les métriques
- [ ] Analyser les coûts réels
- [ ] Ajuster les timeouts si nécessaire
- [ ] Optimiser le nombre d'agents
- [ ] Collecter feedback utilisateurs
- [ ] Itérer sur la qualité des réponses

---

## Conclusion

Ces meilleures pratiques vous aideront à :

✅ Optimiser les performances
✅ Réduire les coûts
✅ Améliorer la fiabilité
✅ Faciliter le debugging
✅ Assurer la sécurité
✅ Préparer la production

Pour plus d'exemples concrets, consultez :
- [Exemples avancés](../examples/advanced/)
- [Exemples d'intégration](../examples/integrations/)
- [Documentation API](./api.md)
