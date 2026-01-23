import {
  StandardModelBase,
  ModelAdapter,
  society,
  setGlobalLogLevel,
  LogLevel,
} from '../../src';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * Exemple d'adaptateur pour un format de prompt structuré personnalisé
 */
class StructuredPromptAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    const promptText = typeof genericPrompt === 'string' ? genericPrompt : String(genericPrompt);

    // Convertir en format structuré personnalisé
    return {
      type: 'structured',
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
      content: {
        instruction: 'Analyze the following prompt',
        text: promptText,
        parameters: {
          style: 'analytical',
          depth: 'detailed',
        },
      },
    };
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    // Convertir la réponse structurée en string
    if (typeof specificResponse === 'string') {
      return specificResponse;
    }

    // Si la réponse a un format structuré, l'extraire
    const structured = specificResponse as any;
    if (structured.content && structured.content.text) {
      return structured.content.text;
    }

    return JSON.stringify(specificResponse);
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'structured'];
  }
}

/**
 * Exemple d'adaptateur pour format JSON
 */
class JSONPromptAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    return {
      query: String(genericPrompt),
      format: 'json',
      options: {
        maxLength: 1000,
        language: 'fr',
      },
    };
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    if (typeof specificResponse === 'string') {
      try {
        const parsed = JSON.parse(specificResponse);
        return parsed.result || parsed.answer || specificResponse;
      } catch {
        return specificResponse;
      }
    }

    const response = specificResponse as any;
    return response.result || response.answer || JSON.stringify(response);
  }

  getSupportedPromptTypes(): string[] {
    return ['json', 'structured'];
  }
}

/**
 * Exemple d'adaptateur pour format Markdown
 */
class MarkdownPromptAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    const promptText = String(genericPrompt);

    // Convertir en Markdown structuré
    return `# Prompt\n\n${promptText}\n\n## Instructions\n\n- Répondre de manière détaillée\n- Utiliser des exemples\n- Structurer la réponse`;
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    const response = String(specificResponse);

    // Nettoyer le markdown si nécessaire
    return response.replace(/^#+ /, '').trim();
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'markdown'];
  }
}

/**
 * Exemple d'adaptateur avec transformation complexe
 */
class SemanticPromptAdapter implements ModelAdapter {
  private keywords = ['analyser', 'expliquer', 'comparer', 'lister', 'décrire'];

  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    const promptText = String(genericPrompt);

    // Détecter le type d'action
    let action = 'general';
    for (const keyword of this.keywords) {
      if (promptText.toLowerCase().includes(keyword)) {
        action = keyword;
        break;
      }
    }

    // Extraire les entités clés (simplification)
    const entities = this.extractEntities(promptText);

    // Construire le prompt sémantique
    return {
      action,
      entities,
      originalPrompt: promptText,
      context: {
        domain: this.detectDomain(promptText),
        complexity: this.estimateComplexity(promptText),
      },
    };
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    const response = specificResponse as any;

    if (typeof response === 'string') {
      return response;
    }

    // Structurer la réponse sémantique
    return `[${response.action.toUpperCase()}]\n\n${response.content || response.text || JSON.stringify(response)}`;
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'semantic'];
  }

  private extractEntities(text: string): string[] {
    // Extraction simple d'entités (mots capitalisés, etc.)
    const words = text.split(/\s+/);
    return words
      .filter((w) => w.length > 3 && /^[A-Z]/.test(w))
      .slice(0, 5);
  }

  private detectDomain(text: string): string {
    const domains = {
      tech: ['code', 'programming', 'software', 'application'],
      business: ['entreprise', 'business', 'marché', 'stratégie'],
      science: ['recherche', 'étude', 'scientifique', 'analyse'],
    };

    const lowerText = text.toLowerCase();

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some((kw) => lowerText.includes(kw))) {
        return domain;
      }
    }

    return 'general';
  }

  private estimateComplexity(text: string): 'simple' | 'medium' | 'complex' {
    const length = text.length;
    const sentences = text.split(/[.!?]+/).length;

    if (length < 50 && sentences < 2) return 'simple';
    if (length < 200 && sentences < 5) return 'medium';
    return 'complex';
  }
}

/**
 * Exemple 1 : Utilisation d'adaptateur structuré
 */
async function example1StructuredAdapter(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 1 : ADAPTATEUR STRUCTURÉ');
  console.log('='.repeat(80) + '\n');

  const adapter = new StructuredPromptAdapter();

  const model = new StandardModelBase(
    {
      name: 'StructuredModel',
      adapter,
    },
    async (prompt: unknown) => {
      console.log('📥 Prompt reçu (structuré):');
      console.log(JSON.stringify(prompt, null, 2));

      await new Promise((resolve) => setTimeout(resolve, 500));

      return 'Réponse basée sur le prompt structuré';
    }
  );

  const result = await society(
    'Quels sont les avantages de TypeScript ?',
    2,
    [model],
    false
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 2 : Adaptateur JSON
 */
async function example2JSONAdapter(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 2 : ADAPTATEUR JSON');
  console.log('='.repeat(80) + '\n');

  const adapter = new JSONPromptAdapter();

  const model = new StandardModelBase(
    {
      name: 'JSONModel',
      adapter,
    },
    async (prompt: unknown) => {
      console.log('📥 Prompt JSON:');
      console.log(JSON.stringify(prompt, null, 2));

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simuler une réponse JSON
      return JSON.stringify({
        result: 'Réponse en format JSON',
        confidence: 0.95,
        metadata: {
          processingTime: 500,
        },
      });
    }
  );

  const result = await society(
    'Explique le concept de programmation fonctionnelle',
    2,
    [model],
    false
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 3 : Adaptateur Markdown
 */
async function example3MarkdownAdapter(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 3 : ADAPTATEUR MARKDOWN');
  console.log('='.repeat(80) + '\n');

  const adapter = new MarkdownPromptAdapter();

  const model = new StandardModelBase(
    {
      name: 'MarkdownModel',
      adapter,
    },
    async (prompt: unknown) => {
      console.log('📥 Prompt Markdown:');
      console.log(String(prompt).substring(0, 200) + '...\n');

      await new Promise((resolve) => setTimeout(resolve, 500));

      return '# Réponse\n\nVoici une **réponse** formatée en *Markdown*.';
    }
  );

  const result = await society(
    'Liste les meilleures pratiques de développement',
    2,
    [model],
    false
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 4 : Adaptateur sémantique
 */
async function example4SemanticAdapter(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 4 : ADAPTATEUR SÉMANTIQUE');
  console.log('='.repeat(80) + '\n');

  const adapter = new SemanticPromptAdapter();

  const model = new StandardModelBase(
    {
      name: 'SemanticModel',
      adapter,
    },
    async (prompt: unknown) => {
      console.log('📥 Prompt sémantique:');
      console.log(JSON.stringify(prompt, null, 2));
      console.log();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const semantic = prompt as any;

      return {
        action: semantic.action,
        content: `Réponse adaptée pour l'action "${semantic.action}" dans le domaine "${semantic.context.domain}"`,
      };
    }
  );

  const result = await society(
    'Analyser les tendances du développement web en TypeScript',
    2,
    [model],
    false
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 5 : Comparaison de plusieurs adaptateurs
 */
async function example5CompareAdapters(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 5 : COMPARAISON D\'ADAPTATEURS');
  console.log('='.repeat(80) + '\n');

  const structuredModel = new StandardModelBase(
    {
      name: 'Structured',
      adapter: new StructuredPromptAdapter(),
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return 'Réponse avec adaptateur structuré';
    }
  );

  const jsonModel = new StandardModelBase(
    {
      name: 'JSON',
      adapter: new JSONPromptAdapter(),
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return JSON.stringify({ result: 'Réponse avec adaptateur JSON' });
    }
  );

  const markdownModel = new StandardModelBase(
    {
      name: 'Markdown',
      adapter: new MarkdownPromptAdapter(),
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return '## Réponse avec adaptateur Markdown';
    }
  );

  console.log('Trois modèles avec différents adaptateurs:');
  console.log('  1. Adaptateur structuré');
  console.log('  2. Adaptateur JSON');
  console.log('  3. Adaptateur Markdown\n');

  const result = await society(
    'Comment optimiser les performances d\'une application ?',
    3,
    [structuredModel, jsonModel, markdownModel],
    true
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 6 : Adaptateur avec validation
 */
async function example6ValidatingAdapter(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 6 : ADAPTATEUR AVEC VALIDATION');
  console.log('='.repeat(80) + '\n');

  class ValidatingAdapter implements ModelAdapter {
    async convertPrompt(genericPrompt: unknown): Promise<unknown> {
      const promptText = String(genericPrompt);

      // Valider le prompt
      if (promptText.length < 10) {
        throw new Error('Prompt trop court (minimum 10 caractères)');
      }

      if (promptText.length > 5000) {
        throw new Error('Prompt trop long (maximum 5000 caractères)');
      }

      // Nettoyer et normaliser
      const cleaned = promptText.trim().replace(/\s+/g, ' ');

      console.log(`✅ Prompt validé (${cleaned.length} caractères)`);

      return cleaned;
    }

    async convertResponse(specificResponse: unknown): Promise<string> {
      const response = String(specificResponse);

      // Valider la réponse
      if (response.length < 20) {
        console.warn('⚠️  Réponse très courte');
      }

      return response;
    }

    getSupportedPromptTypes(): string[] {
      return ['text'];
    }
  }

  const adapter = new ValidatingAdapter();

  const model = new StandardModelBase(
    {
      name: 'ValidatingModel',
      adapter,
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return 'Réponse après validation du prompt';
    }
  );

  try {
    // Test avec prompt valide
    console.log('Test 1: Prompt valide\n');
    await model.process('Ceci est un prompt valide de longueur suffisante');
    console.log('✅ Succès\n');

    // Test avec prompt trop court
    console.log('Test 2: Prompt trop court\n');
    await model.process('Court');
  } catch (error) {
    console.log(`❌ Erreur attendue: ${(error as Error).message}\n`);
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Guide de création d'adaptateur personnalisé
 */
function example7CustomAdapterGuide(): void {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 7 : GUIDE DE CRÉATION D\'ADAPTATEUR');
  console.log('='.repeat(80) + '\n');

  console.log('📋 Étapes pour créer un adaptateur personnalisé:\n');

  console.log('1. Implémenter l\'interface ModelAdapter:');
  console.log(`
class MyAdapter implements ModelAdapter {
  async convertPrompt(genericPrompt: unknown): Promise<unknown> {
    // Convertir le prompt générique au format de votre API
    return transformedPrompt;
  }

  async convertResponse(specificResponse: unknown): Promise<string> {
    // Convertir la réponse de votre API en string
    return stringResponse;
  }

  getSupportedPromptTypes(): string[] {
    return ['text', 'custom'];
  }
}
`);

  console.log('2. Utiliser l\'adaptateur avec un modèle:');
  console.log(`
const model = new StandardModelBase(
  { adapter: new MyAdapter() },
  async (prompt) => {
    // prompt est maintenant dans votre format personnalisé
    const response = await callYourAPI(prompt);
    return response;
  }
);
`);

  console.log('3. Cas d\'usage pour les adaptateurs:\n');
  console.log('   ✓ Formats d\'API spécifiques (OpenAI, Anthropic, etc.)');
  console.log('   ✓ Transformation de données (JSON, XML, Markdown)');
  console.log('   ✓ Validation et nettoyage de prompts');
  console.log('   ✓ Enrichissement sémantique');
  console.log('   ✓ Gestion de métadonnées');
  console.log('   ✓ Logging et monitoring\n');

  console.log('💡 Conseils:');
  console.log('   - Gardez la conversion simple et rapide');
  console.log('   - Gérez les erreurs de conversion gracieusement');
  console.log('   - Documentez le format attendu');
  console.log('   - Testez avec différents types d\'entrées');
  console.log('   - Utilisez TypeScript pour la sécurité des types\n');

  console.log('='.repeat(80) + '\n');
}

/**
 * Exécution de tous les exemples
 */
async function main(): Promise<void> {
  try {
    await example1StructuredAdapter();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example2JSONAdapter();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example3MarkdownAdapter();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example4SemanticAdapter();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example5CompareAdapters();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example6ValidatingAdapter();
    await new Promise((resolve) => setTimeout(resolve, 500));

    example7CustomAdapterGuide();

    console.log('\n✅ Tous les exemples terminés!\n');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

export {
  StructuredPromptAdapter,
  JSONPromptAdapter,
  MarkdownPromptAdapter,
  SemanticPromptAdapter,
};
