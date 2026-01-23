# Exemples SocietyAI

Ce dossier contient des exemples d'utilisation de la bibliothèque SocietyAI.

## 🚀 Exécution des Exemples

Avant d'exécuter les exemples, assurez-vous d'avoir compilé le projet :

```bash
npm run build
```

Ensuite, vous pouvez exécuter les exemples avec ts-node :

```bash
npx ts-node examples/basic.ts
```

## 📚 Exemples Disponibles

### basic.ts

Contient plusieurs exemples illustrant les différents modes d'utilisation :

1. **Mode Standard** : Utilisation basique avec un seul modèle
2. **Mode Multi-Modèles** : Utilisation de plusieurs modèles différents
3. **Mode Collaboratif** : Analyse approfondie en 4 étapes
4. **Avec Observer** : Suivi du cycle de vie des agents

## 🔧 Personnalisation

Les exemples utilisent un `SimulatedModel` qui simule les réponses d'un modèle d'IA.
Dans un cas réel, vous devriez :

1. Créer votre propre classe qui étend `StandardModelBase`
2. Implémenter la fonction de traitement pour connecter votre API d'IA préférée
3. Gérer les erreurs et les timeouts appropriés

### Exemple avec OpenAI

```typescript
import { StandardModelBase, OpenAIAdapter } from '@societyai/core';
import OpenAI from 'openai';

class OpenAIModel extends StandardModelBase {
  private client: OpenAI;

  constructor(apiKey: string, model = 'gpt-4') {
    const client = new OpenAI({ apiKey });

    super(
      {
        name: `OpenAI-${model}`,
        adapter: new OpenAIAdapter(),
      },
      async (prompt: unknown) => {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Tu es un assistant IA intelligent.' },
            { role: 'user', content: String(prompt) },
          ],
        });

        return completion.choices[0].message.content || '';
      }
    );

    this.client = client;
  }
}
```

### Exemple avec Anthropic Claude

```typescript
import { StandardModelBase } from '@societyai/core';
import Anthropic from '@anthropic-ai/sdk';

class ClaudeModel extends StandardModelBase {
  private client: Anthropic;

  constructor(apiKey: string, model = 'claude-3-opus-20240229') {
    const client = new Anthropic({ apiKey });

    super({ name: `Claude-${model}` }, async (prompt: unknown, signal?: AbortSignal) => {
      const message = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: String(prompt) }],
      });

      return message.content[0].type === 'text' ? message.content[0].text : '';
    });

    this.client = client;
  }
}
```

## 📖 Documentation Complète

Pour plus d'informations, consultez le [README principal](../README.md).
