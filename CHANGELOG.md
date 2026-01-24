# Changelog

## [1.0.1] - 2026-01-24

### Fixed

- **Documentation**: Added missing `Pipelines.review()` and `Pipelines.consensus()` methods
- **Internationalization**: Translated all French comments and error messages to English
- **Exports**: Added `createRole()` and `createAgent()` helper functions to builder API
- **Package.json**: Updated description to English and added author information
- **API Documentation**: Completed API reference with Pipelines, Strategies, and Middlewares sections

### Added

- **Examples**: New `simple-society-v2.ts` example demonstrating the fluent Society.create() API
- **Tests**: Comprehensive test suite for the new Society builder API (`builder.test.ts`)
- **Documentation**: Enhanced API reference with complete v2.0 API documentation

### Improved

- Consistent English language across the entire codebase
- Better examples showcasing the recommended v2.0 API
- More comprehensive test coverage for modern API

## [1.0.0] - 2026-01-23

### Added

- 🎉 Initial release of SocietyAI in TypeScript
- 🤖 Multi-agent architecture with 3 operating modes
- ⚙️ Standard mode: simple task distribution
- 🔄 Synthesis mode: dedicated model for synthesis
- 🤝 Collaborative mode: in-depth 4-phase analysis
- 🔌 Flexible interface to integrate any AI model
- 📦 Built-in adapters (TextModelAdapter, OpenAIAdapter, GeminiAdapter)
- ⚡ Worker pool for optimal parallelization
- 🔄 Retry mechanism with exponential backoff and jitter
- 📊 Configurable logging system
- 👀 SocietyObserver interface for lifecycle monitoring
- 🛡️ Robust error handling with custom error classes
- ⏱️ AbortSignal support for cancellation and timeouts
- 📚 Complete documentation
- 🧪 Detailed usage examples
- 🎯 Strict TypeScript types for better DX

### Features

- Support for simple or structured prompts
- Customizable agent perspectives
- Flexible configuration via SocietyConfig
- Extensibility via interfaces (ModelAdapter, PromptBuilder, etc.)
- Modern Node.js compatibility (ES2020+)
