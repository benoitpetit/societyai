import { society, societyWithSynthesis, StandardModelBase, setGlobalLogLevel, LogLevel } from '../../src';

// Définir le niveau de log
setGlobalLogLevel(LogLevel.INFO);

/**
 * Modèles simulés avec différentes caractéristiques
 */
class FastModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'FastModel', timeout: 5000 },
      async (prompt: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const promptText = String(prompt);
        return `[FAST] Analyse rapide et concise:\n${promptText.substring(0, 100)}...\n` +
          `Réponse directe et factuelle basée sur les faits établis.`;
      }
    );
  }
}

class DetailedModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'DetailedModel', timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const promptText = String(prompt);
        return `[DETAILED] Analyse approfondie et détaillée:\n\n` +
          `1. Contexte:\n${promptText.substring(0, 80)}...\n\n` +
          `2. Analyse:\nExamen minutieux des différents aspects, considérations techniques ` +
          `et implications pratiques. Chaque élément est évalué avec attention.\n\n` +
          `3. Recommandations:\nSolutions détaillées basées sur les meilleures pratiques.`;
      }
    );
  }
}

class CreativeModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'CreativeModel', timeout: 8000 },
      async (prompt: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const promptText = String(prompt);
        return `[CREATIVE] Approche innovante et créative:\n\n` +
          `💡 Perspective unique:\n${promptText.substring(0, 80)}...\n\n` +
          `🚀 Solutions innovantes:\nEn pensant en dehors des sentiers battus, ` +
          `on peut envisager des approches non conventionnelles qui offrent ` +
          `des avantages significatifs.\n\n` +
          `🎯 Applications créatives:\nIdées nouvelles et perspectives fraîches.`;
      }
    );
  }
}

class AnalyticalModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'AnalyticalModel', timeout: 9000 },
      async (prompt: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 1300));
        const promptText = String(prompt);
        return `[ANALYTICAL] Analyse structurée et méthodique:\n\n` +
          `📊 Données:\n${promptText.substring(0, 80)}...\n\n` +
          `📈 Analyse quantitative:\n` +
          `- Facteur 1: Impact élevé\n` +
          `- Facteur 2: Considération importante\n` +
          `- Facteur 3: Évaluation critique\n\n` +
          `📉 Conclusions basées sur les données:\nApproche méthodique et mesurable.`;
      }
    );
  }
}

class SynthesisModel extends StandardModelBase {
  constructor() {
    super(
      { name: 'SynthesisModel', timeout: 12000 },
      async (prompt: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const promptText = String(prompt);
        
        // Simule une synthèse plus sophistiquée
        return `🔍 SYNTHÈSE CONSOLIDÉE\n\n` +
          `${promptText}\n\n` +
          `Après analyse des différentes perspectives fournies par les agents, ` +
          `voici une synthèse intégrée qui combine les points clés:\n\n` +
          `✓ Points de convergence:\n` +
          `  - Les agents s'accordent sur l'importance de...\n` +
          `  - Une approche cohérente émerge concernant...\n\n` +
          `⚠ Points de divergence:\n` +
          `  - Des perspectives différentes existent sur...\n` +
          `  - Approches complémentaires identifiées...\n\n` +
          `🎯 CONCLUSION UNIFIÉE:\n` +
          `En intégrant les insights de tous les agents, la réponse optimale combine ` +
          `rapidité d'exécution, profondeur d'analyse, créativité dans les solutions, ` +
          `et rigueur méthodologique. Cette approche holistique offre la meilleure ` +
          `valeur en tirant parti des forces de chaque perspective.`;
      }
    );
  }
}

/**
 * Exemple 1 : Utiliser plusieurs modèles différents en parallèle
 */
async function example1MultipleModelTypes(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 1 : PLUSIEURS TYPES DE MODÈLES EN PARALLÈLE');
  console.log('='.repeat(80) + '\n');

  const models = [
    new FastModel(),
    new DetailedModel(),
    new CreativeModel(),
    new AnalyticalModel(),
  ];

  const result = await society(
    'Comment améliorer la performance d\'une application web ?',
    4, // 4 agents, un par modèle
    models,
    true // Distribuer les modèles
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 2 : Distribution de modèles avec plus d'agents que de modèles
 */
async function example2ModelRotation(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 2 : ROTATION DE MODÈLES (6 AGENTS, 3 MODÈLES)');
  console.log('='.repeat(80) + '\n');

  const models = [
    new FastModel(),
    new DetailedModel(),
    new CreativeModel(),
  ];

  console.log('Configuration:');
  console.log('  Agent 0 → FastModel');
  console.log('  Agent 1 → DetailedModel');
  console.log('  Agent 2 → CreativeModel');
  console.log('  Agent 3 → FastModel');
  console.log('  Agent 4 → DetailedModel');
  console.log('  Agent 5 → CreativeModel\n');

  const result = await society(
    'Quelles sont les meilleures pratiques pour sécuriser une API REST ?',
    6, // 6 agents
    models,
    true // Distribuer les modèles (rotation)
  );

  console.log('\n📄 RÉSULTAT (extrait):\n');
  console.log(result.substring(0, 800) + '...');
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 3 : Mode synthèse avec différents modèles
 */
async function example3SynthesisWithMultipleModels(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 3 : MODE SYNTHÈSE AVEC MODÈLES VARIÉS');
  console.log('='.repeat(80) + '\n');

  const agentModels = [
    new FastModel(),
    new DetailedModel(),
    new CreativeModel(),
  ];

  const synthesisModel = new SynthesisModel();

  console.log('Configuration:');
  console.log('  Agents: FastModel, DetailedModel, CreativeModel');
  console.log('  Synthèse: SynthesisModel (modèle dédié)\n');

  const result = await societyWithSynthesis(
    'Comment concevoir une architecture de données pour le Big Data ?',
    3,
    agentModels,
    true, // Utiliser tous les modèles
    synthesisModel // Modèle de synthèse dédié
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 4 : Comparer un seul modèle vs plusieurs modèles
 */
async function example4ComparisonSingleVsMultiple(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 4 : COMPARAISON MONO-MODÈLE VS MULTI-MODÈLES');
  console.log('='.repeat(80) + '\n');

  const question = 'Quels sont les avantages de TypeScript par rapport à JavaScript ?';

  // Test avec un seul modèle
  console.log('🔹 Test 1: Un seul modèle (DetailedModel) pour tous les agents\n');
  const singleModel = new DetailedModel();
  const result1 = await society(question, 3, [singleModel], false);
  console.log('Taille de la réponse:', result1.length, 'caractères');
  console.log('Extrait:', result1.substring(0, 300) + '...\n');

  // Test avec plusieurs modèles
  console.log('🔹 Test 2: Trois modèles différents (Fast, Detailed, Creative)\n');
  const multipleModels = [new FastModel(), new DetailedModel(), new CreativeModel()];
  const result2 = await society(question, 3, multipleModels, true);
  console.log('Taille de la réponse:', result2.length, 'caractères');
  console.log('Extrait:', result2.substring(0, 300) + '...\n');

  console.log('📊 Analyse:');
  console.log(`  Mono-modèle: ${result1.length} caractères`);
  console.log(`  Multi-modèles: ${result2.length} caractères`);
  console.log(`  Différence: ${Math.abs(result2.length - result1.length)} caractères`);
  console.log('\nℹ️  Les multi-modèles offrent généralement plus de diversité de perspectives.');
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exemple 5 : Modèles spécialisés par domaine
 */
async function example5SpecializedModels(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('EXEMPLE 5 : MODÈLES SPÉCIALISÉS PAR DOMAINE');
  console.log('='.repeat(80) + '\n');

  // Créer des modèles "spécialisés"
  class SecurityExpertModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'SecurityExpert', timeout: 8000 },
        async (prompt: unknown) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return `[SÉCURITÉ] Perspective sécurité:\n\n` +
            `🔒 Analyse des vulnérabilités potentielles\n` +
            `🛡️ Recommandations de sécurisation\n` +
            `🔐 Meilleures pratiques de protection\n` +
            `⚠️ Points d'attention critiques`;
        }
      );
    }
  }

  class PerformanceExpertModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'PerformanceExpert', timeout: 8000 },
        async (prompt: unknown) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return `[PERFORMANCE] Perspective performance:\n\n` +
            `⚡ Optimisations possibles\n` +
            `📊 Métriques clés à surveiller\n` +
            `🚀 Stratégies d'accélération\n` +
            `💾 Gestion efficace des ressources`;
        }
      );
    }
  }

  class UXExpertModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'UXExpert', timeout: 8000 },
        async (prompt: unknown) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return `[UX] Perspective expérience utilisateur:\n\n` +
            `👤 Besoins des utilisateurs\n` +
            `🎨 Interface intuitive\n` +
            `♿ Accessibilité\n` +
            `📱 Responsive design`;
        }
      );
    }
  }

  const specializedModels = [
    new SecurityExpertModel(),
    new PerformanceExpertModel(),
    new UXExpertModel(),
  ];

  const synthesisModel = new SynthesisModel();

  console.log('Équipe d\'experts spécialisés:');
  console.log('  - Expert Sécurité');
  console.log('  - Expert Performance');
  console.log('  - Expert UX');
  console.log('  - Synthétiseur (consolidation)\n');

  const result = await societyWithSynthesis(
    'Comment développer une application web moderne et robuste ?',
    3,
    specializedModels,
    true,
    synthesisModel
  );

  console.log('\n📄 RÉSULTAT:\n');
  console.log(result);
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Exécution de tous les exemples
 */
async function main(): Promise<void> {
  try {
    await example1MultipleModelTypes();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example2ModelRotation();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example3SynthesisWithMultipleModels();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example4ComparisonSingleVsMultiple();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await example5SpecializedModels();

    console.log('\n✅ Tous les exemples terminés avec succès!\n');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}
