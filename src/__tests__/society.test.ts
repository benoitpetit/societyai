import { society, StandardModelBase } from '..';

// Mock model pour les tests
class MockModel extends StandardModelBase {
  constructor(name = 'MockModel', responseText = 'Mock response') {
    super(
      { name },
      async (prompt: unknown) => {
        return `${responseText}: ${prompt}`;
      }
    );
  }
}

describe('Society', () => {
  describe('society function', () => {
    it('should throw InvalidAgentCountError when agentCount is 0', async () => {
      const model = new MockModel();
      await expect(society('test prompt', 0, [model])).rejects.toThrow('Le nombre d\'agents doit \u00eatre positif');
    });

    it('should throw InvalidAgentCountError when agentCount is negative', async () => {
      const model = new MockModel();
      await expect(society('test prompt', -1, [model])).rejects.toThrow('Le nombre d\'agents doit \u00eatre positif');
    });

    it('should throw NoModelsSpecifiedError when models array is empty', async () => {
      await expect(society('test prompt', 3, [])).rejects.toThrow('Au moins un mod\u00e8le AI doit \u00eatre sp\u00e9cifi\u00e9');
    });

    it('should successfully create and run a society with valid parameters', async () => {
      const model = new MockModel('TestModel', 'Test response');
      const result = await society('test prompt', 2, [model], false);

      expect(result).toContain('Synthèse des analyses des agents');
      expect(result).toContain('Test response');
    });

    it('should use multiple models when multiModel is true', async () => {
      const model1 = new MockModel('Model1', 'Response from Model1');
      const model2 = new MockModel('Model2', 'Response from Model2');

      const result = await society('test prompt', 4, [model1, model2], true);

      expect(result).toContain('Response from Model1');
      expect(result).toContain('Response from Model2');
    });
  });

  describe('Observer integration', () => {
    it('should call observer methods during society execution', async () => {
      const observer = {
        onAgentStart: jest.fn(),
        onAgentComplete: jest.fn(),
        onAgentError: jest.fn(),
        onPhaseStart: jest.fn(),
        onPhaseComplete: jest.fn(),
        onSocietyStart: jest.fn(),
        onSocietyComplete: jest.fn(),
      };

      const model = new MockModel();
      await society('test prompt', 2, [model], false, observer);

      expect(observer.onSocietyStart).toHaveBeenCalled();
      expect(observer.onAgentStart).toHaveBeenCalledTimes(2);
      expect(observer.onAgentComplete).toHaveBeenCalledTimes(2);
      expect(observer.onSocietyComplete).toHaveBeenCalled();
    });
  });
});
