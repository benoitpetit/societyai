import {
  StandardModelBase,
  society,
  societyWithSynthesis,
  societyCollaborative,
  OpenAIAdapter,
  setGlobalLogLevel,
  LogLevel,
} from '../../src';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * IMPORTANT: Ce fichier contient des exemples d'intégration avec OpenAI.
 * 
 * Pour exécuter ces exemples, vous devez:
 * 1. Installer le package OpenAI: npm install openai
 * 2. Configurer votre clé API: export OPENAI_API_KEY="votre-clé"
 * 
 * Note: Ces exemples utilisent une vraie API et engendreront des coûts.
 */

/**
 * Modèle OpenAI utilisant l'API officielle
 * 
 * Installation: npm install openai
 */
class OpenAIModel extends StandardModelBase {
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gpt-3.5-turbo') {
    super(
      {
        name: `OpenAI-${modelName}`,
        timeout: 30000,
        adapter: new OpenAIAdapter(),
      },
      async (prompt: unknown) => {
        // Simuler un appel OpenAI
        // Dans un vrai scénario, vous utiliseriez le SDK OpenAI ici
        
        /*
        Exemple avec le vrai SDK:
        
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: this.apiKey });
        
        const completion = await openai.chat.completions.create({
          model: this.modelName,
          messages: prompt as any,
          temperature: 0.7,
          max_tokens: 1000,
        });
        
        return completion.choices[0].message.content || '';
        */

        // Pour la démo, on simule une réponse
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        const messages = (prompt as any).messages;
        const userMessage = messages[messages.length - 1].content;
        
        return `[Réponse simulée OpenAI ${this.modelName}]\n\n` +
          `Question: ${userMessage.substring(0, 100)}...\n\n` +
          `Réponse: Ceci est une réponse simulée. Dans un environnement réel, ` +
          `OpenAI ${this.modelName} fournirait une analyse détaillée ici.`;
      }
    );

    this.apiKey = apiKey;
    this.modelName = modelName;
  }
}

/**
 * Exemple 1 : Utilisation simple avec GPT-3.5
 */
async function example1SimpleGPT35(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 1 : OPENAI GPT-3.5-TURBO SIMPLE');
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.OPENAI_API_KEY || 'demo-key';
  const model = new OpenAIModel(apiKey, 'gpt-3.5-turbo');

  const result = await society(
    'Quels sont les avantages de TypeScript par rapport à JavaScript ?',
    3,
    [model],
    false
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result.substring(0, 800) + '...');
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 2 : Comparaison GPT-3.5 vs GPT-4
 */
async function example2GPT35vsGPT4(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 2 : COMPARAISON GPT-3.5 vs GPT-4');
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.OPENAI_API_KEY || 'demo-key';

  const gpt35 = new OpenAIModel(apiKey, 'gpt-3.5-turbo');
  const gpt4 = new OpenAIModel(apiKey, 'gpt-4');

  console.log('Configuration:');
  console.log('  3 agents GPT-3.5-turbo (rapide, économique)');
  console.log('  3 agents GPT-4 (puissant, coûteux)\n');

  const models = [gpt35, gpt4];

  const result = await society(
    'Explique le concept de programmation fonctionnelle et ses avantages',
    6,
    models,
    true // Alterner entre les modèles
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result.substring(0, 800) + '...');
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 3 : Mode synthèse avec GPT-4
 */
async function example3SynthesisWithGPT4(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 3 : MODE SYNTHÈSE AVEC GPT-4');
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.OPENAI_API_KEY || 'demo-key';

  const analysisModel = new OpenAIModel(apiKey, 'gpt-3.5-turbo');
  const synthesisModel = new OpenAIModel(apiKey, 'gpt-4');

  console.log('Configuration:');
  console.log('  Agents d\'analyse: GPT-3.5-turbo (3 agents)');
  console.log('  Modèle de synthèse: GPT-4 (plus puissant)\n');

  const result = await societyWithSynthesis(
    'Analyse les tendances actuelles du développement web et leurs implications',
    3,
    [analysisModel],
    false,
    synthesisModel
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result.substring(0, 1000) + '...');
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 4 : Mode collaboratif avec GPT-4
 */
async function example4CollaborativeGPT4(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 4 : MODE COLLABORATIF AVEC GPT-4');
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.OPENAI_API_KEY || 'demo-key';
  const model = new OpenAIModel(apiKey, 'gpt-4');

  console.log('Mode collaboratif en 4 phases avec GPT-4');
  console.log('Question complexe nécessitant analyse approfondie\n');

  const result = await societyCollaborative(
    'Comment concevoir une architecture microservices évolutive et résiliente ' +
    'pour une plateforme e-commerce à fort trafic ?',
    5,
    [model],
    false
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 5 : Configuration avancée avec paramètres personnalisés
 */
async function example5AdvancedConfiguration(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 5 : CONFIGURATION AVANCÉE');
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.OPENAI_API_KEY || 'demo-key';

  // Modèle avec configuration personnalisée
  class CustomOpenAIModel extends StandardModelBase {
    constructor(
      apiKey: string,
      modelName: string,
      temperature: number,
      maxTokens: number
    ) {
      super(
        {
          name: `OpenAI-${modelName}-T${temperature}`,
          timeout: 45000,
          adapter: new OpenAIAdapter(),
          retryOptions: {
            maxAttempts: 3,
            initialDelay: 2000,
            maxDelay: 10000,
            backoffMultiplier: 2,
            jitter: true,
          },
        },
        async (prompt: unknown) => {
          // Simuler un appel avec paramètres personnalisés
          await new Promise((resolve) => setTimeout(resolve, 1500));

          const messages = (prompt as any).messages;
          const userMessage = messages[messages.length - 1].content;

          return `[${modelName} - Temp: ${temperature}, MaxTokens: ${maxTokens}]\n\n` +
            `${userMessage.substring(0, 100)}...\n\n` +
            `Réponse avec créativité ${temperature > 0.7 ? 'élevée' : 'modérée'} ` +
            `et longueur ${maxTokens > 500 ? 'longue' : 'courte'}.`;
        }
      );
    }
  }

  // Créer des modèles avec différentes configurations
  const creativeModel = new CustomOpenAIModel(apiKey, 'gpt-4', 0.9, 1000);
  const balancedModel = new CustomOpenAIModel(apiKey, 'gpt-4', 0.7, 800);
  const focusedModel = new CustomOpenAIModel(apiKey, 'gpt-4', 0.3, 600);

  console.log('Trois configurations:');
  console.log('  Créatif: Temperature 0.9, MaxTokens 1000');
  console.log('  Équilibré: Temperature 0.7, MaxTokens 800');
  console.log('  Focalisé: Temperature 0.3, MaxTokens 600\n');

  const result = await society(
    'Propose des solutions innovantes pour réduire l\'empreinte carbone du numérique',
    3,
    [creativeModel, balancedModel, focusedModel],
    true
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result.substring(0, 1000) + '...');
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Code d'intégration réelle (commenté)
 * 
 * Décommentez et utilisez ce code pour une vraie intégration OpenAI
 */
/*
import { OpenAI } from 'openai';

class RealOpenAIModel extends StandardModelBase {
  private openai: OpenAI;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;

  constructor(
    apiKey: string,
    modelName: string = 'gpt-3.5-turbo',
    temperature: number = 0.7,
    maxTokens: number = 1000
  ) {
    super(
      {
        name: `OpenAI-${modelName}`,
        timeout: 60000,
        adapter: new OpenAIAdapter(),
        retryOptions: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true,
        },
      },
      async (prompt: unknown, signal?: AbortSignal) => {
        const completion = await this.openai.chat.completions.create(
          {
            model: this.modelName,
            messages: (prompt as any).messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          },
          { signal }
        );

        return completion.choices[0].message.content || '';
      }
    );

    this.openai = new OpenAI({ apiKey });
    this.modelName = modelName;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }
}

// Utilisation:
const model = new RealOpenAIModel(
  process.env.OPENAI_API_KEY!,
  'gpt-4',
  0.7,
  1500
);

const result = await society('Question', 3, [model], false);
*/

/**
 * Exemple 6 : Guide d'utilisation avec vraie API
 */
function example6RealAPIGuide(): void {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 6 : GUIDE D\'UTILISATION AVEC VRAIE API OPENAI');
  console.log('='.repeat(80) + '\n');

  console.log('📋 Étapes pour utiliser la vraie API OpenAI:\n');

  console.log('1. Installer le SDK OpenAI:');
  console.log('   npm install openai\n');

  console.log('2. Obtenir une clé API:');
  console.log('   https://platform.openai.com/api-keys\n');

  console.log('3. Configurer la clé API:');
  console.log('   export OPENAI_API_KEY="sk-..."\n');

  console.log('4. Implémenter le modèle (voir code commenté ci-dessus)\n');

  console.log('5. Utiliser avec SocietyAI:');
  console.log('   const model = new RealOpenAIModel(process.env.OPENAI_API_KEY!);');
  console.log('   const result = await society("Question", 3, [model]);\n');

  console.log('⚠️  IMPORTANT:');
  console.log('   - Les appels API OpenAI sont payants');
  console.log('   - GPT-4 est plus cher que GPT-3.5');
  console.log('   - Surveillez votre utilisation sur platform.openai.com');
  console.log('   - Utilisez des timeouts et limites appropriés\n');

  console.log('💡 CONSEILS:');
  console.log('   - Commencez avec GPT-3.5-turbo (moins cher)');
  console.log('   - Utilisez GPT-4 pour la synthèse uniquement');
  console.log('   - Limitez max_tokens pour contrôler les coûts');
  console.log('   - Testez avec des modèles simulés d\'abord\n');

  console.log('='.repeat(80) + '\n');
}

/**
 * Exécution de tous les exemples
 */
async function main(): Promise<void> {
  try {
    console.log('\n🔑 Vérification de la clé API...');
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      console.log('⚠️  Aucune clé API OpenAI détectée');
      console.log('   Les exemples s\'exécuteront en mode simulé\n');
    } else {
      console.log('✅ Clé API détectée\n');
    }

    await example1SimpleGPT35();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example2GPT35vsGPT4();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example3SynthesisWithGPT4();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example4CollaborativeGPT4();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example5AdvancedConfiguration();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    example6RealAPIGuide();

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

export { OpenAIModel };
