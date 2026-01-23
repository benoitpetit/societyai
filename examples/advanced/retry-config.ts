import { StandardModelBase, society, withRetry, defaultRetryOptions, setGlobalLogLevel, LogLevel } from '../../src';
import type { RetryOptions } from '../../src/types';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * Modèle qui échoue parfois (pour tester le retry)
 */
class UnreliableModel extends StandardModelBase {
  private attemptCount: number = 0;
  private failureRate: number;

  constructor(name: string, failureRate: number = 0.5) {
    super(
      {
        name,
        timeout: 10000,
        retryOptions: defaultRetryOptions(),
      },
      async (prompt: unknown) => {
        this.attemptCount++;
        
        console.log(`  [${name}] Tentative #${this.attemptCount}`);

        // Simuler un délai
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Échouer selon le taux de défaillance
        if (Math.random() < this.failureRate && this.attemptCount < 3) {
          throw new Error(`Échec temporaire de ${name}`);
        }

        return `[${name}] Réponse générée après ${this.attemptCount} tentative(s)`;
      }
    );
    this.failureRate = failureRate;
  }
}

/**
 * Exemple 1 : Configuration retry par défaut
 */
async function example1DefaultRetry(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 1 : CONFIGURATION RETRY PAR DÉFAUT');
  console.log('='.repeat(80) + '\n');

  console.log('Configuration par défaut:');
  const defaults = defaultRetryOptions();
  console.log(`  Max tentatives: ${defaults.maxAttempts}`);
  console.log(`  Délai initial: ${defaults.initialDelay}ms`);
  console.log(`  Délai max: ${defaults.maxDelay}ms`);
  console.log(`  Multiplicateur: ${defaults.backoffMultiplier}`);
  console.log(`  Jitter: ${defaults.jitter}`);
  console.log();

  const model = new UnreliableModel('DefaultRetryModel', 0.6);

  try {
    const result = await model.process('Test de retry avec configuration par défaut');
    console.log('\n✅ Succès:', result);
  } catch (error) {
    console.error('\n❌ Échec final:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 2 : Retry agressif (tentatives rapides)
 */
async function example2AggressiveRetry(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 2 : RETRY AGRESSIF (RAPIDE)');
  console.log('='.repeat(80) + '\n');

  const aggressiveOptions: RetryOptions = {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 3000,
    backoffMultiplier: 1.5,
    jitter: false,
  };

  console.log('Configuration agressive:');
  console.log(`  Max tentatives: ${aggressiveOptions.maxAttempts}`);
  console.log(`  Délai initial: ${aggressiveOptions.initialDelay}ms`);
  console.log(`  Délai max: ${aggressiveOptions.maxDelay}ms`);
  console.log(`  Multiplicateur: ${aggressiveOptions.backoffMultiplier}`);
  console.log(`  Jitter: ${aggressiveOptions.jitter}`);
  console.log();

  const model = new StandardModelBase(
    {
      name: 'AggressiveRetryModel',
      timeout: 15000,
      retryOptions: aggressiveOptions,
    },
    async (prompt: unknown) => {
      const shouldFail = Math.random() < 0.7;
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      if (shouldFail) {
        throw new Error('Échec simulé');
      }
      
      return 'Succès avec retry agressif';
    }
  );

  try {
    const startTime = Date.now();
    const result = await model.process('Test retry agressif');
    const duration = Date.now() - startTime;
    console.log(`\n✅ Succès en ${duration}ms:`, result);
  } catch (error) {
    console.error('\n❌ Échec final:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 3 : Retry conservateur (tentatives espacées)
 */
async function example3ConservativeRetry(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 3 : RETRY CONSERVATEUR (LENT ET PATIENT)');
  console.log('='.repeat(80) + '\n');

  const conservativeOptions: RetryOptions = {
    maxAttempts: 4,
    initialDelay: 2000,
    maxDelay: 20000,
    backoffMultiplier: 3,
    jitter: true,
  };

  console.log('Configuration conservatrice:');
  console.log(`  Max tentatives: ${conservativeOptions.maxAttempts}`);
  console.log(`  Délai initial: ${conservativeOptions.initialDelay}ms`);
  console.log(`  Délai max: ${conservativeOptions.maxDelay}ms`);
  console.log(`  Multiplicateur: ${conservativeOptions.backoffMultiplier}`);
  console.log(`  Jitter: ${conservativeOptions.jitter}`);
  console.log();

  const model = new StandardModelBase(
    {
      name: 'ConservativeRetryModel',
      timeout: 60000,
      retryOptions: conservativeOptions,
    },
    async (prompt: unknown) => {
      const shouldFail = Math.random() < 0.5;
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      if (shouldFail) {
        throw new Error('Échec simulé (service surchargé)');
      }
      
      return 'Succès avec retry conservateur';
    }
  );

  try {
    const startTime = Date.now();
    const result = await model.process('Test retry conservateur');
    const duration = Date.now() - startTime;
    console.log(`\n✅ Succès en ${(duration / 1000).toFixed(2)}s:`, result);
  } catch (error) {
    console.error('\n❌ Échec final:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 4 : Utilisation directe de withRetry
 */
async function example4DirectWithRetry(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 4 : UTILISATION DIRECTE DE withRetry()');
  console.log('='.repeat(80) + '\n');

  let attemptNum = 0;

  const riskyOperation = async (): Promise<string> => {
    attemptNum++;
    console.log(`  Tentative #${attemptNum}`);
    
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    if (attemptNum < 3) {
      throw new Error(`Échec tentative ${attemptNum}`);
    }
    
    return `Succès à la tentative ${attemptNum}`;
  };

  const options: Partial<RetryOptions> = {
    maxAttempts: 5,
    initialDelay: 1000,
    backoffMultiplier: 2,
    jitter: true,
  };

  try {
    const result = await withRetry(riskyOperation, options);
    console.log(`\n✅ ${result}`);
  } catch (error) {
    console.error('\n❌ Échec après toutes les tentatives:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 5 : Society avec modèles instables
 */
async function example5SocietyWithRetry(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 5 : SOCIÉTÉ AVEC MODÈLES INSTABLES');
  console.log('='.repeat(80) + '\n');

  // Créer plusieurs modèles avec différents taux d'échec
  const models = [
    new UnreliableModel('Model-A (échec 30%)', 0.3),
    new UnreliableModel('Model-B (échec 50%)', 0.5),
    new UnreliableModel('Model-C (échec 20%)', 0.2),
  ];

  console.log('Modèles avec taux d\'échec variables:');
  console.log('  Model-A: 30% d\'échec');
  console.log('  Model-B: 50% d\'échec');
  console.log('  Model-C: 20% d\'échec');
  console.log('\nLe mécanisme de retry va tenter de récupérer les échecs...\n');

  try {
    const result = await society(
      'Test de résilience avec modèles instables',
      3,
      models,
      true
    );

    console.log('\n✅ Société terminée avec succès malgré les échecs!');
    console.log('\n📄 RÉSULTAT:\n');
    console.log(result);
  } catch (error) {
    console.error('\n❌ La société a échoué:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 6 : Calculer les délais de retry
 */
async function example6RetryDelayCalculation(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 6 : CALCUL DES DÉLAIS DE RETRY');
  console.log('='.repeat(80) + '\n');

  const calculateDelay = (attempt: number, options: RetryOptions): number => {
    const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
    let delay = Math.min(exponentialDelay, options.maxDelay);
    
    if (options.jitter) {
      // Ajouter jusqu'à 20% de jitter
      const jitterAmount = delay * 0.2;
      delay = delay + (Math.random() * jitterAmount - jitterAmount / 2);
    }
    
    return Math.floor(delay);
  };

  const scenarios = [
    {
      name: 'Agressif',
      options: { maxAttempts: 5, initialDelay: 500, maxDelay: 3000, backoffMultiplier: 1.5, jitter: false },
    },
    {
      name: 'Standard',
      options: defaultRetryOptions(),
    },
    {
      name: 'Conservateur',
      options: { maxAttempts: 4, initialDelay: 2000, maxDelay: 20000, backoffMultiplier: 3, jitter: false },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\n📊 Scénario: ${scenario.name}`);
    console.log(`   Config: ${scenario.options.initialDelay}ms initial, multiplié par ${scenario.options.backoffMultiplier}`);
    console.log('   Délais de retry:');
    
    let totalTime = 0;
    for (let i = 1; i <= scenario.options.maxAttempts; i++) {
      const delay = calculateDelay(i, scenario.options);
      totalTime += delay;
      console.log(`     Tentative ${i}: ${delay}ms (total: ${totalTime}ms)`);
    }
    
    console.log(`   ⏱️  Temps total maximum: ${(totalTime / 1000).toFixed(2)}s`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exécution de tous les exemples
 */
async function main(): Promise<void> {
  try {
    await example1DefaultRetry();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example2AggressiveRetry();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example3ConservativeRetry();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example4DirectWithRetry();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example5SocietyWithRetry();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example6RetryDelayCalculation();

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
