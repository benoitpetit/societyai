import { Society, createAgent, createRole } from '../../index';
import { MockModel } from '../utils/mock-model';

describe('Advanced Graph Features', () => {
  describe('Conditional Branching', () => {
    test('should support withBranch for conditional routing', async () => {
      const validatorModel = new MockModel().withDefaultResponse('VALID');
      const approveModel = new MockModel().withDefaultResponse('Approved');
      const rejectModel = new MockModel().withDefaultResponse('Rejected');

      const validator = createAgent(
        'validator',
        createRole('validator', 'Validate'),
        validatorModel
      );
      const approver = createAgent('approver', createRole('approver', 'Approve'), approveModel);
      const rejector = createAgent('rejector', createRole('rejector', 'Reject'), rejectModel);

      const result = await Society.create()
        .withName('Branching Test')
        .useAgents([validator, approver, rejector])
        .addTask((s) => s.withId('validate').withAgents(['validator']).sequential())
        .addTask((s) =>
          s
            .withId('decision')
            .withAgents(['validator'])
            .sequential()
            .withBranch(
              (results) => {
                const validateResult = results.get('validate')?.[0];
                return validateResult?.output.includes('VALID') ?? false;
              },
              ['approve'],
              ['reject']
            )
        )
        .addTask((s) => s.withId('approve').withAgents(['approver']).sequential())
        .addTask((s) => s.withId('reject').withAgents(['rejector']).sequential())
        .execute('Check this');

      expect(result.success).toBe(true);
      // Should go through approve path since validator returns VALID
      expect(result.taskResults.has('approve')).toBe(true);
    });

    test('should support withConditionalNext for simple branching', async () => {
      const checkerModel = new MockModel().withDefaultResponse('pass');
      const successModel = new MockModel().withDefaultResponse('Success!');

      const checker = createAgent('checker', createRole('checker', 'Check'), checkerModel);
      const succeeder = createAgent('succeeder', createRole('succeeder', 'Success'), successModel);

      const result = await Society.create()
        .withName('Conditional Next Test')
        .useAgents([checker, succeeder])
        .addTask((s) => s.withId('check').withAgents(['checker']).sequential())
        .addTask((s) =>
          s
            .withId('decide')
            .withAgents(['checker'])
            .sequential()
            .withConditionalNext((results) => {
              const checkResult = results.get('check')?.[0];
              return checkResult?.output.includes('pass') ?? false;
            }, 'success')
        )
        .addTask((s) => s.withId('success').withAgents(['succeeder']).sequential())
        .execute('Test');

      expect(result.success).toBe(true);
      expect(result.taskResults.has('success')).toBe(true);
    });
  });

  describe('Loop Support', () => {
    test('should support withLoop for iterative refinement', async () => {
      let callCount = 0;
      const improverModel = new MockModel();
      improverModel.process = async (): Promise<string> => {
        callCount++;
        return callCount >= 3 ? 'perfect result' : `iteration ${callCount}`;
      };

      const improver = createAgent('improver', createRole('improver', 'Improve'), improverModel);

      const result = await Society.create()
        .withName('Loop Test')
        .useAgent(improver)
        .addTask((s) =>
          s
            .withId('refine')
            .withAgents(['improver'])
            .withLoop(5, (results) => {
              const lastResult = results[results.length - 1];
              return lastResult.output.includes('perfect');
            })
        )
        .execute('Improve this');

      expect(result.success).toBe(true);
      // Should stop at iteration 3 when "perfect" is found
      expect(callCount).toBe(3);
    });

    test('should respect maxIterations in loop', async () => {
      let callCount = 0;
      const workerModel = new MockModel();
      workerModel.process = async (): Promise<string> => {
        callCount++;
        return `iteration ${callCount}`;
      };

      const worker = createAgent('worker', createRole('worker', 'Work'), workerModel);

      const result = await Society.create()
        .withName('Max Iterations Test')
        .useAgent(worker)
        .addTask(
          (s) => s.withId('work').withAgents(['worker']).withLoop(3) // Max 3 iterations, no completion condition
        )
        .execute('Work on this');

      expect(result.success).toBe(true);
      // Should stop at exactly 3 iterations
      expect(callCount).toBe(3);
    });
  });
});
