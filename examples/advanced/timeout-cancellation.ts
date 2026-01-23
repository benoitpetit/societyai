import { StandardModelBase, society, setGlobalLogLevel, LogLevel } from '../../src';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * Modèle avec support de timeout configurable
 */
class SlowModel extends StandardModelBase {
  constructor(name: string, processingTime: number) {
    super(
      {
        name,
        timeout: 10000, // Timeout du modèle
      },
      async (prompt: unknown, signal?: AbortSignal) => {
        console.log(`  [${name}] Début du traitement (durée prévue: ${processingTime}ms)`);

        // Simuler un traitement long par morceaux
        const chunks = 10;
        const chunkDuration = processingTime / chunks;

        for (let i = 0; i < chunks; i++) {
          // Vérifier si annulé
          if (signal?.aborted) {
            console.log(`  [${name}] ⚠️  Annulation détectée à ${((i / chunks) * 100).toFixed(0)}%`);
            throw new Error('Opération annulée');
          }

          await new Promise((resolve) => setTimeout(resolve, chunkDuration));
          
          if ((i + 1) % 3 === 0) {
            console.log(`  [${name}] ... ${((i + 1) / chunks * 100).toFixed(0)}% terminé`);
          }
        }

        console.log(`  [${name}] ✅ Traitement terminé`);
        return `[${name}] Traitement complet après ${processingTime}ms`;
      }
    );
  }
}

/**
 * Exemple 1 : Timeout au niveau du modèle
 */
async function example1ModelTimeout(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 1 : TIMEOUT AU NIVEAU DU MODÈLE');
  console.log('='.repeat(80) + '\n');

  // Créer un modèle avec timeout court
  const fastTimeoutModel = new StandardModelBase(
    {
      name: 'FastTimeoutModel',
      timeout: 2000, // 2 secondes
    },
    async (prompt: unknown) => {
      console.log('  Début traitement (durée: 3 secondes)');
      // Traitement de 3 secondes (dépasse le timeout de 2s)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return 'Réponse';
    }
  );

  try {
    await fastTimeoutModel.process('Test timeout');
    console.log('\n✅ Succès (inattendu)');
  } catch (error) {
    console.log('\n❌ Timeout détecté (attendu):', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 2 : Annulation avec AbortController
 */
async function example2AbortController(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 2 : ANNULATION AVEC ABORTCONTROLLER');
  console.log('='.repeat(80) + '\n');

  const model = new SlowModel('CancellableModel', 5000);

  const controller = new AbortController();

  // Annuler après 2 secondes
  setTimeout(() => {
    console.log('\n⚠️  Signal d\'annulation envoyé après 2 secondes');
    controller.abort();
  }, 2000);

  try {
    await model.process('Test annulation', controller.signal);
    console.log('\n✅ Succès (inattendu)');
  } catch (error) {
    console.log('\n❌ Annulation confirmée:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 3 : Timeout global pour une société
 */
async function example3SocietyTimeout(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 3 : TIMEOUT GLOBAL POUR UNE SOCIÉTÉ');
  console.log('='.repeat(80) + '\n');

  const models = [
    new SlowModel('Agent-1', 2000),
    new SlowModel('Agent-2', 2500),
    new SlowModel('Agent-3', 3000),
  ];

  console.log('Configuration:');
  console.log('  Agent-1: 2 secondes');
  console.log('  Agent-2: 2.5 secondes');
  console.log('  Agent-3: 3 secondes');
  console.log('  Timeout global: 5 secondes\n');

  const controller = new AbortController();

  // Timeout global de 5 secondes
  const timeoutId = setTimeout(() => {
    console.log('\n⚠️  Timeout global de 5 secondes atteint');
    controller.abort();
  }, 5000);

  try {
    // Les agents s'exécutent en parallèle, donc 3s max
    const result = await society(
      'Test avec timeout global',
      3,
      models,
      true
    );

    clearTimeout(timeoutId);
    console.log('\n✅ Société terminée avec succès (dans les temps)');
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('\n❌ Timeout global atteint:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 4 : Gestion gracieuse de l'annulation
 */
async function example4GracefulCancellation(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 4 : ANNULATION GRACIEUSE AVEC CLEANUP');
  console.log('='.repeat(80) + '\n');

  class ResourceModel extends StandardModelBase {
    private resources: string[] = [];

    constructor() {
      super(
        { name: 'ResourceModel', timeout: 10000 },
        async (prompt: unknown, signal?: AbortSignal) => {
          try {
            console.log('  📦 Allocation des ressources...');
            this.resources.push('Resource-1', 'Resource-2', 'Resource-3');

            console.log('  ⚙️  Traitement en cours...');
            
            // Traitement par étapes avec vérification d'annulation
            for (let i = 0; i < 5; i++) {
              if (signal?.aborted) {
                throw new Error('Annulé');
              }
              await new Promise((resolve) => setTimeout(resolve, 500));
              console.log(`    Étape ${i + 1}/5`);
            }

            return 'Traitement terminé';
          } finally {
            // Cleanup des ressources dans tous les cas
            console.log('  🧹 Libération des ressources...');
            this.resources.forEach((res) => {
              console.log(`    Libération: ${res}`);
            });
            this.resources = [];
          }
        }
      );
    }
  }

  const model = new ResourceModel();
  const controller = new AbortController();

  // Annuler après 1.5 secondes
  setTimeout(() => {
    console.log('\n⚠️  Annulation demandée');
    controller.abort();
  }, 1500);

  try {
    await model.process('Test cleanup', controller.signal);
    console.log('\n✅ Terminé normalement');
  } catch (error) {
    console.log('\n❌ Annulé (mais cleanup effectué)');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 5 : Timeout différents pour différents agents
 */
async function example5VariableTimeouts(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 5 : TIMEOUTS VARIABLES PAR AGENT');
  console.log('='.repeat(80) + '\n');

  const fastModel = new StandardModelBase(
    {
      name: 'FastModel',
      timeout: 3000, // 3 secondes
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return 'Réponse rapide';
    }
  );

  const mediumModel = new StandardModelBase(
    {
      name: 'MediumModel',
      timeout: 6000, // 6 secondes
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return 'Réponse moyenne';
    }
  );

  const slowModel = new StandardModelBase(
    {
      name: 'SlowModel',
      timeout: 10000, // 10 secondes
    },
    async (prompt: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return 'Réponse lente';
    }
  );

  console.log('Configuration des timeouts:');
  console.log('  FastModel: 3s timeout (traitement 1s)');
  console.log('  MediumModel: 6s timeout (traitement 2s)');
  console.log('  SlowModel: 10s timeout (traitement 3s)\n');

  try {
    const startTime = Date.now();
    const result = await society(
      'Test avec timeouts variables',
      3,
      [fastModel, mediumModel, slowModel],
      true
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Tous les agents ont terminé en ${duration}s`);
    console.log('(Exécution parallèle, donc durée = agent le plus lent)');
  } catch (error) {
    console.log('\n❌ Un agent a dépassé son timeout:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 6 : Pattern de timeout avec fallback
 */
async function example6TimeoutWithFallback(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 6 : TIMEOUT AVEC FALLBACK');
  console.log('='.repeat(80) + '\n');

  class FallbackModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'FallbackModel', timeout: 3000 },
        async (prompt: unknown) => {
          // Simuler un traitement qui pourrait être long
          await new Promise((resolve) => setTimeout(resolve, 4000)); // Dépasse timeout
          return 'Réponse complète';
        }
      );
    }
  }

  const model = new FallbackModel();

  try {
    console.log('Tentative avec le modèle principal...');
    const result = await model.process('Test avec fallback');
    console.log('\n✅ Succès:', result);
  } catch (error) {
    console.log('\n⚠️  Timeout du modèle principal');
    console.log('Utilisation du fallback...');

    // Fallback: réponse par défaut
    const fallbackResult = 'Réponse rapide (fallback) basée sur l\'analyse limitée';
    console.log('\n✅ Fallback utilisé:', fallbackResult);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 7 : Monitoring des timeouts
 */
async function example7TimeoutMonitoring(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 7 : MONITORING DES TIMEOUTS');
  console.log('='.repeat(80) + '\n');

  const stats = {
    total: 0,
    success: 0,
    timeout: 0,
    cancelled: 0,
  };

  class MonitoredModel extends StandardModelBase {
    constructor(name: string, duration: number) {
      super(
        { name, timeout: 2000 },
        async (prompt: unknown, signal?: AbortSignal) => {
          stats.total++;

          try {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, duration);
              signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Cancelled'));
              });
            });

            stats.success++;
            return `Succès de ${name}`;
          } catch (error) {
            if ((error as Error).message === 'Cancelled') {
              stats.cancelled++;
            } else {
              stats.timeout++;
            }
            throw error;
          }
        }
      );
    }
  }

  const models = [
    new MonitoredModel('Fast', 1000),   // Succès
    new MonitoredModel('Medium', 1800), // Succès
    new MonitoredModel('Slow', 3000),   // Timeout
    new MonitoredModel('VerySlow', 5000), // Timeout
  ];

  console.log('Test de 4 modèles avec timeout de 2s:');
  console.log('  Fast: 1s (devrait réussir)');
  console.log('  Medium: 1.8s (devrait réussir)');
  console.log('  Slow: 3s (timeout attendu)');
  console.log('  VerySlow: 5s (timeout attendu)\n');

  for (const model of models) {
    try {
      await model.process('Test');
      console.log(`  ✅ ${model.name()} : Succès`);
    } catch (error) {
      console.log(`  ❌ ${model.name()} : ${(error as Error).message}`);
    }
  }

  console.log('\n📊 Statistiques:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  Succès: ${stats.success}`);
  console.log(`  Timeouts: ${stats.timeout}`);
  console.log(`  Annulés: ${stats.cancelled}`);
  console.log(`  Taux de succès: ${((stats.success / stats.total) * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exécution de tous les exemples
 */
async function main(): Promise<void> {
  try {
    await example1ModelTimeout();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example2AbortController();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example3SocietyTimeout();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example4GracefulCancellation();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example5VariableTimeouts();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example6TimeoutWithFallback();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await example7TimeoutMonitoring();

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
