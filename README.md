# SocietyAI

SocietyAI est une bibliothèque Golang permettant de créer une société d'agents d'intelligence artificielle qui collaborent pour analyser en profondeur un prompt et générer une réponse réfléchie.

## Caractéristiques

- **Architecture Multi-Agents** : Création d'une société d'agents AI travaillant ensemble de manière coordonnée
- **Interface Flexible de Modèles** : 
  - Architecture abstraite via l'interface `AIModel`
  - Support pour n'importe quel modèle d'IA
  - Exemples d'implémentations personnalisables
- **Modes de Fonctionnement** :
  - Mode standard avec distribution des tâches
  - Mode synthèse avec modèle dédié
  - Mode collaboratif avec analyse approfondie
- **Performance Optimisée** : 
  - Traitement asynchrone via goroutines
  - Communication par channels
  - Gestion du contexte et des timeouts
- **Configuration Flexible** : 
  - Support de configurations personnalisées
  - Paramètres adaptables par modèle
  - Architecture extensible

## Installation

```bash
go get github.com/benoitpetit/societyai
```

## Structure du Projet

```
.
├── examples/
│   ├── config_custom/    # Exemple avec modèles personnalisés
│   │   ├── README.md    # Documentation des modèles personnalisés
│   │   └── main.go      # Implémentation des modèles d'exemple
│   ├── README.md        # Documentation des exemples
│   └── main.go          # Exemple d'utilisation principal
├── models.go            # Définitions des interfaces et types
└── society.go          # Implémentation de la logique principale
```

## Modes de Fonctionnement

### 1. Mode Standard

```go
package main

import (
    "context"
    "fmt"
    "github.com/benoitpetit/societyai"
)

// Implémentation de votre propre modèle
type MyCustomModel struct {
    name string
}

func (m *MyCustomModel) Name() string {
    return m.name
}

func (m *MyCustomModel) Process(ctx context.Context, prompt string) (string, error) {
    // Connexion à votre API d'IA préférée
    return "Analyse du prompt: " + prompt, nil
}

func main() {
    // Création des modèles personnalisés
    model1 := &MyCustomModel{name: "Model1"}
    model2 := &MyCustomModel{name: "Model2"}
    
    // Configuration de la société
    models := []societyai.AIModel{model1, model2}
    prompt := "Analysez les implications de l'IA dans la société moderne"
    
    // Exécution
    response, err := societyai.Society(prompt, 3, models, true)
    if err != nil {
        panic(err)
    }
    fmt.Println(response)
}
```

### 2. Mode Synthèse

```go
// Utilisation d'un modèle dédié pour la synthèse
synthModel := &MyCustomModel{name: "SynthesisModel"}
response, err := societyai.SocietyWithSynthesis(
    prompt,
    3,       // nombre d'agents
    models,
    true,    // multi-modèle
    synthModel,
)
```

### 3. Mode Collaboratif

```go
response, err := societyai.SocietyCollaborative(
    prompt,
    4,      // nombre d'agents
    models,
    true,   // multi-modèle
)
```

## Processus de Réflexion Collaborative

1. **Analyse Initiale** (performInitialAnalysis)
   - Compréhension approfondie du prompt
   - Identification des attentes implicites et explicites

2. **Exploration Multi-dimensionnelle** (exploreDimensions)
   - Aspects factuels et théoriques
   - Implications pratiques
   - Considérations contextuelles
   - Défis et solutions
   - Applications concrètes

3. **Intégration** (integrateAnalyses)
   - Fusion des perspectives
   - Identification des patterns
   - Résolution des contradictions

4. **Synthèse** (generateFinalResponse)
   - Réponse unifiée et cohérente
   - Adaptation au contexte initial
   - Validation des objectifs

## Exemples Détaillés

Pour des exemples d'implémentation plus détaillés, consultez :
- [Documentation des exemples](examples/README.md)
- [Exemple avec modèles personnalisés](examples/config_custom/README.md)

## Contribution

Les contributions sont les bienvenues ! Veuillez consulter nos guides de contribution pour plus de détails.

## Licence

MIT 