import { AIModel } from '../../core/types';

export class MockModel implements AIModel {
  private _name: string;
  private responses: Map<string, string> = new Map();
  private defaultResponse: string = 'Mock response';
  public callHistory: string[] = [];

  constructor(name: string = 'MockModel') {
    this._name = name;
  }

  name(): string {
    return this._name;
  }

  supportsPromptType(type: string): boolean {
    return type === 'text';
  }

  when(prompt: string): { thenReturn: (response: string) => MockModel } {
    return {
      thenReturn: (response: string) => {
        this.responses.set(prompt, response);
        return this;
      },
    };
  }

  withDefaultResponse(response: string): this {
    this.defaultResponse = response;
    return this;
  }

  async process(prompt: unknown, _signal?: AbortSignal): Promise<string> {
    const promptStr = String(prompt);
    this.callHistory.push(promptStr);

    // Check if we have a specific response for this prompt (simple partial match)
    for (const [key, value] of this.responses) {
      if (promptStr.includes(key)) {
        return value;
      }
    }

    return this.defaultResponse;
  }

  reset(): void {
    this.callHistory = [];
    this.responses.clear();
  }
}
