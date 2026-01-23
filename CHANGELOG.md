# Changelog

## [1.0.0] - 2026-01-23

### Added

- 🎉 Version initiale de SocietyAI en TypeScript
- 🤖 Architecture multi-agents avec 3 modes de fonctionnement
- ⚙️ Mode standard : distribution simple des tâches
- 🔄 Mode synthèse : utilisation d'un modèle dédié pour la synthèse
- 🤝 Mode collaboratif : analyse approfondie en 4 étapes
- 🔌 Interface flexible pour intégrer n'importe quel modèle d'IA
- 📦 Adaptateurs intégrés (TextModelAdapter, OpenAIAdapter, GeminiAdapter)
- ⚡ Pool de workers pour parallélisation optimale
- 🔄 Mécanisme de retry avec backoff exponentiel et jitter
- 📊 Système de logging configurable
- 👀 Interface SocietyObserver pour observer le cycle de vie
- 🛡️ Gestion robuste des erreurs avec classes d'erreurs personnalisées
- ⏱️ Support de AbortSignal pour annulation et timeouts
- 📚 Documentation complète en français
- 🧪 Exemples d'utilisation détaillés
- 🎯 Types TypeScript stricts pour une meilleure DX

### Features

- Support de prompts simples ou structurés
- Personnalisation des perspectives par agent
- Configuration flexible via SocietyConfig
- Extensibilité via interfaces (ModelAdapter, PromptBuilder, etc.)
- Compatibilité Node.js moderne (ES2020+)
