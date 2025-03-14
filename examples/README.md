# Exemples d'utilisation de SocietyAI

Ce répertoire contient des exemples qui démontrent comment utiliser SocietyAI avec différentes implémentations de modèles d'IA.

## Organisation

### Exemple principal (`main.go`)

Le script `main.go` démontre l'utilisation des trois modes principaux de SocietyAI :

1. **Mode standard** - Distribution des tâches entre les agents
2. **Mode avec synthèse** - Synthèse des perspectives par un modèle dédié
3. **Mode collaboratif** - Réflexion profonde et intégrée en 4 étapes

Pour exécuter cet exemple :

```bash
cd examples
go run main.go
```

### Exemple avec modèles personnalisés (`config_custom`)

L'exemple `config_custom` démontre comment :

1. Implémenter vos propres modèles d'IA en respectant l'interface `AIModel`
2. Utiliser des configurations personnalisées pour vos modèles
3. Combiner différents types de modèles dans une même société d'agents

Pour plus de détails, consultez le [README dédié](./config_custom/README.md).

Pour exécuter cet exemple :

```bash
cd examples/config_custom
go run main.go
```

## Interface AIModel

Pour créer vos propres modèles, implémentez l'interface `AIModel` :

```go
type AIModel interface {
    // Process traite un prompt et retourne une réponse
    Process(ctx context.Context, prompt string) (string, error)
    // Name retourne le nom du modèle d'IA
    Name() string
}
```

## Modes de fonctionnement

### Mode standard

```go
result, err := societyai.Society(
    "Votre prompt",
    3, // nombre d'agents
    agents,
    true // multiModel
)
```

### Mode avec synthèse

```go
result, err := societyai.SocietyWithSynthesis(
    "Votre prompt",
    3, // nombre d'agents
    agents,
    true, // multiModel 
    synthesisModel // modèle pour la synthèse
)
```

### Mode collaboratif

Le mode collaboratif suit un processus en 4 étapes :

1. **Analyse initiale** : Compréhension approfondie de la demande
2. **Exploration des dimensions** : Analyse par dimension spécifique
3. **Intégration des analyses** : Fusion cohérente des perspectives
4. **Génération de la réponse finale** : Production d'une réponse unifiée

```go
result, err := societyai.SocietyCollaborative(
    "Votre prompt",
    4, // nombre d'agents
    agents,
    true // multiModel
)
```

## Adaptation à vos besoins

L'exemple `config_custom` fournit des modèles de base que vous pouvez adapter pour vos propres implémentations. Vous pouvez :

1. Créer vos propres modèles en implémentant l'interface `AIModel`
2. Configurer les modèles selon vos besoins spécifiques
3. Combiner différents types de modèles dans une même société
4. Gérer les erreurs et les timeouts selon vos exigences

Pour plus de détails sur l'implémentation des modèles personnalisés, consultez le [README de config_custom](./config_custom/README.md). 