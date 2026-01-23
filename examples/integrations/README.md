# Exemples d'Intégration - SocietyAI

Ce répertoire contient des exemples d'intégration avec différents fournisseurs de modèles d'IA.

## Table des Matières

- [openai-integration.ts](#openai-integrationts) - Intégration avec OpenAI GPT
- [anthropic-integration.ts](#anthropic-integrationts) - Intégration avec Claude d'Anthropic
- [gemini-integration.ts](#gemini-integrationts) - Intégration avec Google Gemini
- [custom-api-integration.ts](#custom-api-integrationts) - Intégration avec API personnalisée

## Prérequis

Pour exécuter ces exemples, vous aurez besoin de:

1. Clés API des fournisseurs respectifs
2. Variables d'environnement configurées:
   ```bash
   export OPENAI_API_KEY="votre-clé"
   export ANTHROPIC_API_KEY="votre-clé"
   export GEMINI_API_KEY="votre-clé"
   ```

## Installation des Dépendances

```bash
npm install openai @anthropic-ai/sdk @google/generative-ai
```

## Exécution

```bash
npx ts-node examples/integrations/openai-integration.ts
```

## Note

Ces exemples utilisent des APIs réelles. Assurez-vous d'avoir configuré vos clés API et de comprendre les coûts associés avant de les exécuter.
