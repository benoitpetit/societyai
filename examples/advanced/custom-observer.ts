import {
  society,
  societyCollaborative,
  StandardModelBase,
  SocietyObserver,
  setGlobalLogLevel,
  LogLevel,
} from '../../src';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * Observateur personnalisé avec métriques et statistiques
 */
class MetricsObserver implements SocietyObserver {
  private startTime: number = 0;
  private phaseStartTimes: Map<string, number> = new Map();
  private agentStartTimes: Map<number, number> = new Map();
  private agentDurations: number[] = [];
  private errors: Error[] = [];

  onSocietyStart(prompt: string, agentCount: number): void {
    this.startTime = Date.now();
    console.log('\n' + '='.repeat(80));
    console.log('🚀 DÉMARRAGE DE LA SOCIÉTÉ');
    console.log('='.repeat(80));
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`👥 Nombre d'agents: ${agentCount}`);
    console.log(`⏰ Heure de début: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80) + '\n');
  }

  onPhaseStart(phase: string): void {
    this.phaseStartTimes.set(phase, Date.now());
    console.log(`\n📋 Phase: ${phase}`);
    console.log(`   Début: ${new Date().toLocaleTimeString()}`);
  }

  onPhaseComplete(phase: string): void {
    const startTime = this.phaseStartTimes.get(phase);
    if (startTime) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Phase "${phase}" terminée en ${duration}s\n`);
    }
  }

  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    this.agentStartTimes.set(agentId, Date.now());
    console.log(`  🤖 Agent ${agentId} (${modelName})`);
    console.log(`     Démarré à: ${new Date().toLocaleTimeString()}`);
  }

  onAgentComplete(agentId: number, modelName: string, result: string): void {
    const startTime = this.agentStartTimes.get(agentId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.agentDurations.push(duration);
      console.log(`  ✓ Agent ${agentId} terminé`);
      console.log(`    Durée: ${(duration / 1000).toFixed(2)}s`);
      console.log(`    Taille réponse: ${result.length} caractères`);
    }
  }

  onAgentError(agentId: number, modelName: string, error: Error): void {
    this.errors.push(error);
    console.error(`  ❌ Agent ${agentId} erreur: ${error.message}`);
  }

  onSocietyComplete(finalResult: string): void {
    const totalDuration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTIQUES FINALES');
    console.log('='.repeat(80));
    console.log(`⏱️  Durée totale: ${totalDuration}s`);
    console.log(`📏 Taille réponse finale: ${finalResult.length} caractères`);

    if (this.agentDurations.length > 0) {
      const avgDuration = (
        this.agentDurations.reduce((a, b) => a + b, 0) /
        this.agentDurations.length /
        1000
      ).toFixed(2);
      const minDuration = (Math.min(...this.agentDurations) / 1000).toFixed(2);
      const maxDuration = (Math.max(...this.agentDurations) / 1000).toFixed(2);

      console.log(`\n📈 Statistiques des agents:`);
      console.log(`   Durée moyenne: ${avgDuration}s`);
      console.log(`   Durée min: ${minDuration}s`);
      console.log(`   Durée max: ${maxDuration}s`);
    }

    if (this.errors.length > 0) {
      console.log(`\n⚠️  Erreurs rencontrées: ${this.errors.length}`);
      this.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.message}`);
      });
    } else {
      console.log(`\n✅ Aucune erreur`);
    }

    console.log(`\n🏁 Terminé à: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80) + '\n');
  }
}

/**
 * Modèle simulé pour la démo
 */
class SimulatedModel extends StandardModelBase {
  private modelName: string;

  constructor(name: string, minDelay: number = 500, maxDelay: number = 2000) {
    super({ name }, async (prompt: unknown) => {
      // Simuler un délai variable
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const promptText = typeof prompt === 'string' ? prompt : String(prompt);

      return `[${name}] Analyse détaillée du prompt:\n\n` +
        `${this.generateResponse(promptText)}\n\n` +
        `Cette analyse a été générée après ${(delay / 1000).toFixed(2)}s de traitement.`;
    });
    this.modelName = name;
  }

  private generateResponse(prompt: string): string {
    const responses = [
      'Une perspective analytique profonde révèle que...',
      'En examinant les aspects pratiques, on constate que...',
      'Du point de vue stratégique, il est crucial de considérer...',
      'L\'analyse technique démontre que...',
      'Une approche holistique suggère que...',
    ];

    const index = Math.abs(this.modelName.charCodeAt(0)) % responses.length;
    return responses[index] + ' ' + prompt.substring(0, 100);
  }
}

/**
 * Exemple 1 : Mode standard avec observateur
 */
async function example1StandardWithMetrics(): Promise<void> {
  console.log('\n' + '█'.repeat(80));
  console.log('EXEMPLE 1 : MODE STANDARD AVEC MÉTRIQUES');
  console.log('█'.repeat(80));

  const model = new SimulatedModel('AnalyticalModel');
  const observer = new MetricsObserver();

  const result = await society(
    'Quels sont les principaux défis de la conception d\'une architecture microservices ?',
    3,
    [model],
    false,
    observer
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result.substring(0, 500) + '...\n');
}

/**
 * Exemple 2 : Mode collaboratif avec observateur
 */
async function example2CollaborativeWithMetrics(): Promise<void> {
  console.log('\n' + '█'.repeat(80));
  console.log('EXEMPLE 2 : MODE COLLABORATIF AVEC MÉTRIQUES');
  console.log('█'.repeat(80));

  const model = new SimulatedModel('DeepAnalysisModel', 800, 1500);
  const observer = new MetricsObserver();

  const result = await societyCollaborative(
    'Comment optimiser les performances d\'une application web à grande échelle ?',
    5,
    [model],
    false,
    observer
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result.substring(0, 500) + '...\n');
}

/**
 * Observateur avec export de métriques en JSON
 */
class JSONMetricsObserver implements SocietyObserver {
  private metrics: {
    startTime?: number;
    endTime?: number;
    agentMetrics: Array<{
      agentId: number;
      modelName: string;
      startTime: number;
      endTime?: number;
      duration?: number;
      success: boolean;
      error?: string;
    }>;
    phases: Array<{
      name: string;
      startTime: number;
      endTime?: number;
      duration?: number;
    }>;
  } = {
    agentMetrics: [],
    phases: [],
  };

  onSocietyStart(prompt: string, agentCount: number): void {
    this.metrics.startTime = Date.now();
  }

  onPhaseStart(phase: string): void {
    this.metrics.phases.push({
      name: phase,
      startTime: Date.now(),
    });
  }

  onPhaseComplete(phase: string): void {
    const phaseMetric = this.metrics.phases.find((p) => p.name === phase && !p.endTime);
    if (phaseMetric) {
      phaseMetric.endTime = Date.now();
      phaseMetric.duration = phaseMetric.endTime - phaseMetric.startTime;
    }
  }

  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    this.metrics.agentMetrics.push({
      agentId,
      modelName,
      startTime: Date.now(),
      success: false,
    });
  }

  onAgentComplete(agentId: number, modelName: string, result: string): void {
    const agentMetric = this.metrics.agentMetrics.find(
      (m) => m.agentId === agentId && !m.endTime
    );
    if (agentMetric) {
      agentMetric.endTime = Date.now();
      agentMetric.duration = agentMetric.endTime - agentMetric.startTime;
      agentMetric.success = true;
    }
  }

  onAgentError(agentId: number, modelName: string, error: Error): void {
    const agentMetric = this.metrics.agentMetrics.find(
      (m) => m.agentId === agentId && !m.endTime
    );
    if (agentMetric) {
      agentMetric.endTime = Date.now();
      agentMetric.duration = agentMetric.endTime - agentMetric.startTime;
      agentMetric.success = false;
      agentMetric.error = error.message;
    }
  }

  onSocietyComplete(finalResult: string): void {
    this.metrics.endTime = Date.now();
  }

  // Méthode pour obtenir les métriques en JSON
  getMetrics() {
    return this.metrics;
  }

  // Méthode pour exporter en JSON
  exportJSON(): string {
    return JSON.stringify(this.metrics, null, 2);
  }
}

/**
 * Exemple 3 : Export de métriques en JSON
 */
async function example3JSONMetrics(): Promise<void> {
  console.log('\n' + '█'.repeat(80));
  console.log('EXEMPLE 3 : EXPORT DE MÉTRIQUES EN JSON');
  console.log('█'.repeat(80));

  const model = new SimulatedModel('MetricsModel');
  const observer = new JSONMetricsObserver();

  await society('Question de test pour métriques', 3, [model], false, observer);

  console.log('\n📊 Métriques exportées:\n');
  console.log(observer.exportJSON());
}

/**
 * Exécution de tous les exemples
 */
async function main(): Promise<void> {
  try {
    await example1StandardWithMetrics();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example2CollaborativeWithMetrics();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example3JSONMetrics();
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

export { MetricsObserver, JSONMetricsObserver };
