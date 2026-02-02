import { AIModel } from '../src';

export class MockModel implements AIModel {
  constructor(private modelName: string = 'MockModel') {}

  async process(prompt: unknown, _signal?: AbortSignal): Promise<string> {
    if (typeof prompt === 'string') {
      return `[${this.modelName}] Processed: ${prompt}`;
    }
    return `[${this.modelName}] Processed prompt`;
  }

  name(): string {
    return this.modelName;
  }

  supportsPromptType(_promptType: string): boolean {
    return true;
  }
}
