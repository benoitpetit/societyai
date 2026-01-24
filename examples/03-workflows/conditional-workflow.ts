/**
 * Example: Conditional Workflow
 * 
 * Steps execute based on conditions and previous results.
 * Enables dynamic workflow paths and branching logic.
 */

import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
  MessageBus,
  StandardModelBase,
  WorkflowContext,
  WorkflowStep,
} from '../../src';

/**
 * Model that returns structured results
 */
class StructuredModel extends StandardModelBase {
  constructor(
    name: string,
    private resultGenerator: (prompt: string) => unknown
  ) {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return this.resultGenerator(String(prompt));
      }
    );
  }
}

/**
 * Example 1: Basic Conditional Branching
 */
async function basicConditionalWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Conditional Branching');
  console.log('='.repeat(60) + '\n');

  // Create agents for different paths
  const classifier = new AgentBuilder('classifier')
    .withRole(new RoleBuilder('Request Classifier').build())
    .withModel(new StructuredModel('Classifier', () => ({ type: 'technical' })))
    .build();

  const technicalHandler = new AgentBuilder('tech-handler')
    .withRole(new RoleBuilder('Technical Handler').build())
    .withModel(new StructuredModel('TechHandler', () => 'Technical issue resolved'))
    .build();

  const billingHandler = new AgentBuilder('billing-handler')
    .withRole(new RoleBuilder('Billing Handler').build())
    .withModel(new StructuredModel('BillingHandler', () => 'Billing issue resolved'))
    .build();

  const generalHandler = new AgentBuilder('general-handler')
    .withRole(new RoleBuilder('General Handler').build())
    .withModel(new StructuredModel('GeneralHandler', () => 'General inquiry handled'))
    .build();

  const steps: WorkflowStep[] = [
    // Step 1: Classify the request
    new StepBuilder('classify')
      .withName('Classify Request')
      .withAgents([classifier.id])
      .withExecutionType('sequential')
      .build(),

    // Step 2a: Technical handling (conditional)
    new StepBuilder('handle-technical')
      .withName('Technical Handling')
      .withAgents([technicalHandler.id])
      .withExecutionType('conditional')
      .withCondition((context: WorkflowContext) => {
        // Check if classification result indicates technical
        const classifyResult = context.stepResults.get('classify');
        if (classifyResult && typeof classifyResult === 'object' && 'type' in classifyResult) {
          return (classifyResult as { type: string }).type === 'technical';
        }
        return false;
      })
      .build(),

    // Step 2b: Billing handling (conditional)
    new StepBuilder('handle-billing')
      .withName('Billing Handling')
      .withAgents([billingHandler.id])
      .withExecutionType('conditional')
      .withCondition((context: WorkflowContext) => {
        const classifyResult = context.stepResults.get('classify');
        if (classifyResult && typeof classifyResult === 'object' && 'type' in classifyResult) {
          return (classifyResult as { type: string }).type === 'billing';
        }
        return false;
      })
      .build(),

    // Step 2c: General handling (default fallback)
    new StepBuilder('handle-general')
      .withName('General Handling')
      .withAgents([generalHandler.id])
      .withExecutionType('conditional')
      .withCondition((context: WorkflowContext) => {
        const classifyResult = context.stepResults.get('classify');
        if (classifyResult && typeof classifyResult === 'object' && 'type' in classifyResult) {
          const type = (classifyResult as { type: string }).type;
          return type !== 'technical' && type !== 'billing';
        }
        return true; // Default handler
      })
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('conditional-routing')
    .withName('Conditional Request Routing')
    .addSteps(steps)
    .withAgents([classifier, technicalHandler, billingHandler, generalHandler])
    .build();

  console.log('Workflow Branches:');
  console.log('  Classify → Technical Handler (if technical)');
  console.log('           → Billing Handler (if billing)');
  console.log('           → General Handler (default)');
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'My server is not responding after the latest update',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('Execution Path:');
  result.stepResults.forEach((stepResult, stepId) => {
    const skipped = stepResult.duration === 0 ? ' (skipped)' : '';
    console.log(`  ${stepId}: ${stepResult.success ? '✓' : '○'}${skipped}`);
  });
}

/**
 * Example 2: Quality Gate Conditions
 */
async function qualityGateWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Quality Gate Conditions');
  console.log('='.repeat(60) + '\n');

  // Simulate a code review pipeline with quality gates
  let qualityScore = 85; // Simulated quality score

  const codeAnalyzer = new AgentBuilder('analyzer')
    .withRole(new RoleBuilder('Code Analyzer').build())
    .withModel(new StructuredModel('Analyzer', () => ({ qualityScore, issues: 3 })))
    .build();

  const autoFixer = new AgentBuilder('fixer')
    .withRole(new RoleBuilder('Auto Fixer').build())
    .withModel(new StructuredModel('Fixer', () => 'Issues auto-fixed'))
    .build();

  const manualReview = new AgentBuilder('reviewer')
    .withRole(new RoleBuilder('Manual Reviewer').build())
    .withModel(new StructuredModel('Reviewer', () => 'Manual review completed'))
    .build();

  const deployer = new AgentBuilder('deployer')
    .withRole(new RoleBuilder('Deployer').build())
    .withModel(new StructuredModel('Deployer', () => 'Deployed successfully'))
    .build();

  const steps: WorkflowStep[] = [
    new StepBuilder('analyze')
      .withName('Code Analysis')
      .withAgents([codeAnalyzer.id])
      .withExecutionType('sequential')
      .build(),

    // Auto-fix if quality score is between 70-90
    new StepBuilder('auto-fix')
      .withName('Auto Fix Issues')
      .withAgents([autoFixer.id])
      .withExecutionType('conditional')
      .withCondition((ctx: WorkflowContext) => {
        const analysis = ctx.stepResults.get('analyze') as { qualityScore: number } | undefined;
        const score = analysis?.qualityScore ?? 0;
        return score >= 70 && score < 90;
      })
      .build(),

    // Manual review if quality score is below 70
    new StepBuilder('manual-review')
      .withName('Manual Review')
      .withAgents([manualReview.id])
      .withExecutionType('conditional')
      .withCondition((ctx: WorkflowContext) => {
        const analysis = ctx.stepResults.get('analyze') as { qualityScore: number } | undefined;
        const score = analysis?.qualityScore ?? 0;
        return score < 70;
      })
      .build(),

    // Deploy only if quality score is 90+
    new StepBuilder('deploy')
      .withName('Deploy')
      .withAgents([deployer.id])
      .withExecutionType('conditional')
      .withCondition((ctx: WorkflowContext) => {
        const analysis = ctx.stepResults.get('analyze') as { qualityScore: number } | undefined;
        const score = analysis?.qualityScore ?? 0;
        return score >= 90;
      })
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('quality-gates')
    .withName('Quality Gate Pipeline')
    .addSteps(steps)
    .withAgents([codeAnalyzer, autoFixer, manualReview, deployer])
    .build();

  console.log('Quality Gates:');
  console.log('  Score 90+: Direct deploy');
  console.log('  Score 70-89: Auto-fix, then review');
  console.log('  Score <70: Manual review required');
  console.log(`\n  Simulated Score: ${qualityScore}`);
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Analyze and deploy the feature branch',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nPipeline Execution:');
  result.stepResults.forEach((stepResult, stepId) => {
    const status = stepResult.success ? (stepResult.duration > 0 ? '✓ Executed' : '○ Skipped') : '✗ Failed';
    console.log(`  ${stepId}: ${status}`);
  });
}

/**
 * Example 3: Multi-Path Workflow
 */
async function multiPathWorkflow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Multi-Path Decision Tree');
  console.log('='.repeat(60) + '\n');

  // Simulate different paths based on input
  let inputType = 'urgent'; // 'urgent', 'normal', 'low'

  const triageAgent = new AgentBuilder('triage')
    .withRole(new RoleBuilder('Triage').build())
    .withModel(new StructuredModel('Triage', () => ({ priority: inputType })))
    .build();

  const urgentPath = new AgentBuilder('urgent-handler')
    .withRole(new RoleBuilder('Urgent Handler').build())
    .withModel(new StructuredModel('UrgentHandler', () => 'Handled with priority'))
    .build();

  const normalPath = new AgentBuilder('normal-handler')
    .withRole(new RoleBuilder('Normal Handler').build())
    .withModel(new StructuredModel('NormalHandler', () => 'Processed normally'))
    .build();

  const lowPath = new AgentBuilder('low-handler')
    .withRole(new RoleBuilder('Low Priority Handler').build())
    .withModel(new StructuredModel('LowHandler', () => 'Queued for later'))
    .build();

  const escalation = new AgentBuilder('escalation')
    .withRole(new RoleBuilder('Escalation').build())
    .withModel(new StructuredModel('Escalation', () => 'Escalated to management'))
    .build();

  const steps: WorkflowStep[] = [
    new StepBuilder('triage')
      .withName('Initial Triage')
      .withAgents([triageAgent.id])
      .withExecutionType('sequential')
      .build(),

    new StepBuilder('urgent')
      .withName('Urgent Processing')
      .withAgents([urgentPath.id])
      .withExecutionType('conditional')
      .withCondition((ctx) => {
        const triage = ctx.stepResults.get('triage') as { priority: string } | undefined;
        return triage?.priority === 'urgent';
      })
      .build(),

    new StepBuilder('escalate')
      .withName('Escalation')
      .withAgents([escalation.id])
      .withExecutionType('conditional')
      .withCondition((ctx) => {
        const triage = ctx.stepResults.get('triage') as { priority: string } | undefined;
        return triage?.priority === 'urgent';
      })
      .build(),

    new StepBuilder('normal')
      .withName('Normal Processing')
      .withAgents([normalPath.id])
      .withExecutionType('conditional')
      .withCondition((ctx) => {
        const triage = ctx.stepResults.get('triage') as { priority: string } | undefined;
        return triage?.priority === 'normal';
      })
      .build(),

    new StepBuilder('low')
      .withName('Low Priority Queue')
      .withAgents([lowPath.id])
      .withExecutionType('conditional')
      .withCondition((ctx) => {
        const triage = ctx.stepResults.get('triage') as { priority: string } | undefined;
        return triage?.priority === 'low';
      })
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('multi-path')
    .withName('Multi-Path Decision Workflow')
    .addSteps(steps)
    .withAgents([triageAgent, urgentPath, normalPath, lowPath, escalation])
    .build();

  console.log('Decision Tree:');
  console.log('  Triage');
  console.log('    ├── Urgent → Process + Escalate');
  console.log('    ├── Normal → Standard Processing');
  console.log('    └── Low → Queue');
  console.log(`\n  Input Type: ${inputType}`);
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Process incoming support ticket',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nExecution Path:');
  result.stepResults.forEach((stepResult, stepId) => {
    if (stepResult.duration > 0) {
      console.log(`  ✓ ${stepId}`);
    }
  });
}

/**
 * Example 4: Loop Until Condition
 */
async function loopUntilCondition(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Iterative Refinement Loop');
  console.log('='.repeat(60) + '\n');

  // Simulate iterative improvement
  let iterationCount = 0;
  const maxIterations = 3;

  const refiner = new AgentBuilder('refiner')
    .withRole(new RoleBuilder('Content Refiner').build())
    .withModel(new StructuredModel('Refiner', () => {
      iterationCount++;
      const quality = 60 + (iterationCount * 15); // Improves each iteration
      return { iteration: iterationCount, quality, content: `Refined v${iterationCount}` };
    }))
    .build();

  const evaluator = new AgentBuilder('evaluator')
    .withRole(new RoleBuilder('Quality Evaluator').build())
    .withModel(new StructuredModel('Evaluator', () => {
      const quality = 60 + (iterationCount * 15);
      return { meetsStandard: quality >= 90, quality };
    }))
    .build();

  // Build workflow that can loop
  const buildIterativeSteps = (): WorkflowStep[] => {
    const steps: WorkflowStep[] = [];

    for (let i = 0; i < maxIterations; i++) {
      steps.push(
        new StepBuilder(`refine-${i + 1}`)
          .withName(`Refinement ${i + 1}`)
          .withAgents([refiner.id])
          .withExecutionType('conditional')
          .withCondition((ctx) => {
            if (i === 0) return true; // Always run first iteration
            const evalKey = `evaluate-${i}`;
            const evalResult = ctx.stepResults.get(evalKey) as { meetsStandard: boolean } | undefined;
            return !(evalResult?.meetsStandard ?? false);
          })
          .build(),

        new StepBuilder(`evaluate-${i + 1}`)
          .withName(`Evaluation ${i + 1}`)
          .withAgents([evaluator.id])
          .withExecutionType('conditional')
          .withCondition((ctx) => {
            return ctx.stepResults.has(`refine-${i + 1}`);
          })
          .build()
      );
    }

    return steps;
  };

  const workflow = new WorkflowConfigBuilder('iterative')
    .withName('Iterative Refinement')
    .addSteps(buildIterativeSteps())
    .withAgents([refiner, evaluator])
    .build();

  console.log('Iterative Process:');
  console.log('  Refine → Evaluate → (if not good enough) → Refine → ...');
  console.log(`  Max iterations: ${maxIterations}`);
  console.log(`  Target quality: 90%`);
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Refine the marketing copy until quality standards are met',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nIteration Results:');
  result.stepResults.forEach((stepResult, stepId) => {
    if (stepResult.duration > 0) {
      console.log(`  ${stepId}: ✓ Executed`);
    }
  });
  console.log(`\n  Total iterations: ${iterationCount}`);
}

/**
 * Example 5: Feature Flag Conditions
 */
async function featureFlagConditions(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Feature Flag Conditions');
  console.log('='.repeat(60) + '\n');

  // Simulate feature flags
  const featureFlags = {
    experimentalAnalysis: true,
    betaFormatting: false,
    advancedReporting: true,
  };

  const standardAnalyzer = new AgentBuilder('standard')
    .withRole(new RoleBuilder('Standard Analyzer').build())
    .withModel(new StructuredModel('Standard', () => 'Standard analysis'))
    .build();

  const experimentalAnalyzer = new AgentBuilder('experimental')
    .withRole(new RoleBuilder('Experimental Analyzer').build())
    .withModel(new StructuredModel('Experimental', () => 'Experimental analysis'))
    .build();

  const standardFormatter = new AgentBuilder('format-standard')
    .withRole(new RoleBuilder('Standard Formatter').build())
    .withModel(new StructuredModel('StandardFormat', () => 'Standard format'))
    .build();

  const betaFormatter = new AgentBuilder('format-beta')
    .withRole(new RoleBuilder('Beta Formatter').build())
    .withModel(new StructuredModel('BetaFormat', () => 'Beta format'))
    .build();

  const advancedReporter = new AgentBuilder('advanced-report')
    .withRole(new RoleBuilder('Advanced Reporter').build())
    .withModel(new StructuredModel('AdvancedReport', () => 'Advanced report'))
    .build();

  const steps: WorkflowStep[] = [
    // Standard vs Experimental Analysis
    new StepBuilder('standard-analysis')
      .withName('Standard Analysis')
      .withAgents([standardAnalyzer.id])
      .withExecutionType('conditional')
      .withCondition(() => !featureFlags.experimentalAnalysis)
      .build(),

    new StepBuilder('experimental-analysis')
      .withName('Experimental Analysis')
      .withAgents([experimentalAnalyzer.id])
      .withExecutionType('conditional')
      .withCondition(() => featureFlags.experimentalAnalysis)
      .build(),

    // Standard vs Beta Formatting
    new StepBuilder('standard-format')
      .withName('Standard Formatting')
      .withAgents([standardFormatter.id])
      .withExecutionType('conditional')
      .withCondition(() => !featureFlags.betaFormatting)
      .build(),

    new StepBuilder('beta-format')
      .withName('Beta Formatting')
      .withAgents([betaFormatter.id])
      .withExecutionType('conditional')
      .withCondition(() => featureFlags.betaFormatting)
      .build(),

    // Optional Advanced Reporting
    new StepBuilder('advanced-report')
      .withName('Advanced Reporting')
      .withAgents([advancedReporter.id])
      .withExecutionType('conditional')
      .withCondition(() => featureFlags.advancedReporting)
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('feature-flags')
    .withName('Feature Flag Workflow')
    .addSteps(steps)
    .withAgents([standardAnalyzer, experimentalAnalyzer, standardFormatter, betaFormatter, advancedReporter])
    .build();

  console.log('Feature Flags:');
  Object.entries(featureFlags).forEach(([flag, enabled]) => {
    console.log(`  ${flag}: ${enabled ? '✓ Enabled' : '○ Disabled'}`);
  });
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Process with feature flags',
    stepResults: new Map(),
    metadata: { featureFlags },
  });

  console.log('\nExecution with Feature Flags:');
  result.stepResults.forEach((stepResult, stepId) => {
    if (stepResult.duration > 0) {
      console.log(`  ✓ ${stepId}`);
    } else {
      console.log(`  ○ ${stepId} (flag disabled)`);
    }
  });
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicConditionalWorkflow();
    await qualityGateWorkflow();
    await multiPathWorkflow();
    await loopUntilCondition();
    await featureFlagConditions();

    console.log('\n✨ All conditional workflow examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  basicConditionalWorkflow,
  qualityGateWorkflow,
  multiPathWorkflow,
  loopUntilCondition,
  featureFlagConditions,
};
