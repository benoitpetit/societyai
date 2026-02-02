import { withRetry, sleep } from '../utils/retry';

describe('Retry Mechanism', () => {
  // Mock console pour éviter les logs dans la sortie des tests
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const result = await withRetry(fn, { maxRetries: 2, initialBackoff: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

      await expect(withRetry(fn, { maxRetries: 2, initialBackoff: 10 })).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should respect abort signal', async () => {
      const controller = new AbortController();
      const fn = jest.fn().mockImplementation(async () => {
        await sleep(100);
        return 'success';
      });

      // Annuler immédiatement
      controller.abort();

      await expect(
        withRetry(fn, { maxRetries: 3, initialBackoff: 10 }, controller.signal)
      ).rejects.toThrow();
    });
  });

  describe('sleep', () => {
    it('should sleep for the specified duration', async () => {
      const start = Date.now();
      await sleep(100);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(90); // Allow some margin
    });

    it('should be cancellable with abort signal', async () => {
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 50);

      await expect(sleep(1000, controller.signal)).rejects.toThrow('Operation cancelled');
    });
  });
});
