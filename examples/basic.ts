import { society, StandardModelBase, setGlobalLogLevel, LogLevel } from '../src';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * Exemple de modèle personnalisé simulé
 * Dans un cas réel, vous connecteriez ceci à une vraie API d'IA
 */
class SimulatedModel extends StandardModelBase {
  private modelName: string;

  constructor(name: string) {
    super(
      { name },
      async (prompt: unknown) => {
        // Simuler un délai de traitement
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Simuler une réponse basée sur le prompt
        const promptText = typeof prompt === 'string' ? prompt : String(prompt);

        return `Réponse de ${name} : J'ai analysé le prompt "${promptText.substring(0, 50)}..." 
        et voici mon analyse : ${this.generateSimulatedResponse(promptText)}`;
      }
    );
    this.modelName = name;
  }

  private generateSimulatedResponse(prompt: string): string {
    // Simuler différentes perspectives basées sur le nom du modèle
    const responses = {
      'Model A': 'Une perspective analytique et détaillée du sujet.',
      'Model B': 'Une approche pratique avec des exemples concrets.',
      'Model C': 'Une vision globale avec des considérations stratégiques.',
    };

    return responses[this.modelName as keyof typeof responses] || 'Une analyse générale du sujet.';
  }
}

/**
 * Exemple 1 : Mode Standard
 */
async function example1StandardMode(): Promise<void> {
  console.log('\n=== EXEMPLE 1 : MODE STANDARD ===\n');

  const model = new SimulatedModel('Model A');

  const result = await society(
    'Quelles sont les meilleures pratiques pour développer une application TypeScript ?',
    3,
    [model],
    false
  );

  console.log('Résultat:', result);
}

/**
 * Exemple 2 : Mode Multi-Modèles
 */
async function example2MultiModel(): Promise<void> {
  console.log('\n=== EXEMPLE 2 : MODE MULTI-MODÈLES ===\n');

  const models = [
    new SimulatedModel('Model A'),
    new SimulatedModel('Model B'),
    new SimulatedModel('Model C'),
  ];

  const result = await society(
    'Comment améliorer la performance d\'une application web ?',
    3,
    models,
    true // Multi-modèles activé
  );

  console.log('Résultat:', result);
}

/**
 * Exemple 3 : Mode Collaboratif
 */
async function example3Collaborative(): Promise<void> {
  console.log('\n=== EXEMPLE 3 : MODE COLLABORATIF ===\n');

  const { societyCollaborative } = await import('../src');

  const models = [new SimulatedModel('Model A')];

  const result = await societyCollaborative(
    'Quels sont les défis de l\'intelligence artificielle moderne ?',
    3,
    models,
    false
  );

  console.log('Résultat:', result);
}

/**
 * Exemple 4 : Avec Observer
 */
async function example4WithObserver(): Promise<void> {
  console.log('\n=== EXEMPLE 4 : AVEC OBSERVER ===\n');

  const observer = {
    onAgentStart(agentId: number, modelName: string) {
      console.log(`🚀 Agent ${agentId} démarre avec ${modelName}`);
    },
    onAgentComplete(agentId: number, modelName: string) {
      console.log(`✅ Agent ${agentId} (${modelName}) a terminé`);
    },
    onAgentError(agentId: number, modelName: string, error: Error) {
      console.error(`❌ Agent ${agentId} (${modelName}) a échoué:`, error.message);
    },
    onPhaseStart(phase: string) {
      console.log(`📍 Phase démarrée: ${phase}`);
    },
    onPhaseComplete(phase: string) {
      console.log(`✓ Phase terminée: ${phase}`);
    },
    onSocietyStart(prompt: string, agentCount: number) {
      console.log(`🏁 Société démarrée avec ${agentCount} agents`);
    },
    onSocietyComplete() {
      console.log('🎉 Société terminée avec succès');
    },
  };

  const model = new SimulatedModel('Model A');

  const result = await society(
    'Explique les principes de la programmation orientée objet',
    2,
    [model],
    false,
    observer
  );

  console.log('Résultat:', result);
}

/**
 * Fonction principale pour exécuter tous les exemples
 */
async function main(): Promise<void> {
  try {
    await example1StandardMode();
    await example2MultiModel();
    await example3Collaborative();
    await example4WithObserver();

    console.log('\n✨ Tous les exemples ont été exécutés avec succès !\n');
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des exemples:', error);
    process.exit(1);
  }
}

// Exécuter si c'est le fichier principal
if (require.main === module) {
  main();
}
