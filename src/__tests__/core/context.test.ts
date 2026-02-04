import { createContextToken, ContextProvider, ContextScope } from '../../core/context';

describe('Context System', () => {
  // Define tokens for testing
  interface UserInfo {
    id: number;
    name: string;
  }

  const UserContext = createContextToken<UserInfo>('user');
  const ThemeContext = createContextToken<string>('theme', 'light');
  const ConfigContext = createContextToken<{ env: string }>('config');

  describe('ContextToken', () => {
    test('should create typed tokens', () => {
      expect(UserContext.name).toBe('user');
      expect(ThemeContext.defaultValue).toBe('light');
    });
  });

  describe('ContextProvider', () => {
    test('should provide and retrieve values', () => {
      const provider = ContextProvider.create()
        .provide(UserContext, { id: 1, name: 'Alice' })
        .build();

      const user = provider.get(UserContext);
      expect(user).toEqual({ id: 1, name: 'Alice' });
    });

    test('should return default value if not provided', () => {
      const provider = ContextProvider.create().build();
      const theme = provider.get(ThemeContext);
      expect(theme).toBe('light');
    });

    test('should throw if no value and no default', () => {
      const provider = ContextProvider.create().build();
      expect(() => provider.get(ConfigContext)).toThrow();
    });

    test('should support factory providers', () => {
      let callCount = 0;
      const provider = ContextProvider.create()
        .provideFactory(ConfigContext, () => {
          callCount++;
          return { env: 'production' };
        })
        .build();

      expect(callCount).toBe(0); // Lazy
      const config1 = provider.get(ConfigContext);
      expect(config1).toEqual({ env: 'production' });
      expect(callCount).toBe(1);

      const config2 = provider.get(ConfigContext);
      expect(config2).toEqual({ env: 'production' });
      expect(callCount).toBe(1); // Memoized
    });

    test('should inherit from parent provider', () => {
      const parent = ContextProvider.create().provide(ThemeContext, 'dark').build();

      const child = ContextProvider.create()
        .inherit(parent)
        .provide(UserContext, { id: 2, name: 'Bob' })
        .build();

      expect(child.get(ThemeContext)).toBe('dark'); // Inherited
      expect(child.get(UserContext)).toEqual({ id: 2, name: 'Bob' }); // Own
    });

    test('should override parent values', () => {
      const parent = ContextProvider.create().provide(ThemeContext, 'dark').build();

      const child = ContextProvider.create().inherit(parent).provide(ThemeContext, 'blue').build();

      expect(child.get(ThemeContext)).toBe('blue');
    });
  });

  describe('ContextScope', () => {
    test('should have correct enum values', () => {
      expect(ContextScope.GLOBAL).toBe('global');
      expect(ContextScope.WORKFLOW).toBe('workflow');
    });
  });
});
