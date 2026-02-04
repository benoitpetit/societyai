import { Society, createRole } from '../../index';
import { MockModel } from '../utils/mock-model';

describe('Getting Started Example Smoke Test', () => {
  test('README example should compile and run', async () => {
    // 1. Define a Role
    // Note: createRole now returns a Builder which flows naturally
    const writerRole = createRole('writer').withSystemPrompt('You are a technical writer.');

    const mockModel = new MockModel();
    mockModel.withDefaultResponse('Article content');

    // 2. Create the Society logic
    const result = await Society.create()
      .withId('blog-post-workflow')
      .addAgent((agent) =>
        agent
          .withId('writer')
          // writerRole is a FluentRoleBuilder, which FluentAgentBuilder.withRole accepts
          .withRole(writerRole)
          .withModel(mockModel)
      )
      .addTask((step) =>
        step
          .withId('write-article')
          .withAgents(['writer'])
          .withInstructions('Write a blog post about AI.')
          .sequential()
      )
      .execute('Start');

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.taskResults.get('write-article')).toBeDefined();
  });
});
