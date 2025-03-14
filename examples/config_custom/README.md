# Exemple de modèles et configurations personnalisés

Cet exemple démontre comment implémenter vos propres modèles d'IA et configurations personnalisées dans SocietyAI.

## Modèles d'exemple

### 1. Modèle simple (`SimpleModel`)

Un modèle fictif qui sélectionne aléatoirement des réponses dans une liste prédéfinie. Utile pour les tests et la démonstration.

```go
type SimpleModel struct {
    name string
}

func (m *SimpleModel) Process(ctx context.Context, prompt string) (string, error) {
    // Implémentation simple pour les tests
}
```

### 2. Modèle configurable (`ConfigurableModel`)

Un modèle qui nécessite une configuration spécifique, comme une clé API.

```go
type ConfigurableModel struct {
    name   string
    config *models.Config
}

func (m *ConfigurableModel) Process(ctx context.Context, prompt string) (string, error) {
    // Utilisation de la configuration pour le traitement
}
```

### 3. Modèle GPT simulé (`GPTModel`)

Un modèle qui simule le comportement d'un modèle GPT avec des paramètres comme la version et la clé API.

```go
type GPTModel struct {
    name    string
    version string
    apiKey  string
}

func (m *GPTModel) Process(ctx context.Context, prompt string) (string, error) {
    // Simulation du traitement GPT
}
```

## Exécution de l'exemple

```bash
cd examples/config_custom
go run main.go
```

## Adaptation à votre API d'IA

Pour adapter cet exemple à une vraie API d'IA :

1. Conservez l'interface `AIModel`
2. Implémentez la logique de connexion à votre API
3. Gérez correctement les erreurs et les timeouts
4. Configurez les paramètres spécifiques à votre modèle

### Exemple d'implémentation avec une API réelle

```go
type CustomAPIModel struct {
    name      string
    apiClient *api.Client
    config    *models.Config
}

func (m *CustomAPIModel) Process(ctx context.Context, prompt string) (string, error) {
    // Implémentez votre logique d'appel API ici
    response, err := m.apiClient.SendRequest(ctx, prompt)
    if err != nil {
        return "", fmt.Errorf("erreur API : %w", err)
    }
    return response, nil
}
```

## Bonnes pratiques

1. **Gestion des erreurs** : Implémentez une gestion robuste des erreurs
2. **Timeouts** : Utilisez le contexte pour gérer les timeouts
3. **Configuration** : Externalisez les paramètres sensibles
4. **Tests** : Ajoutez des tests unitaires pour vos modèles

Pour plus d'informations sur l'architecture générale, consultez le [README principal](../README.md). 