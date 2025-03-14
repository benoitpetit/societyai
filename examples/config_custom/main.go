// Exemple d'utilisation de SocietyAI avec des modèles personnalisés et configurations
//
// Cet exemple montre comment :
// 1. Implémenter vos propres modèles d'IA avec l'interface AIModel
// 2. Utiliser des configurations personnalisées pour vos modèles
// 3. Combiner plusieurs types de modèles dans une même société

package main

import (
	"bufio"
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/benoitpetit/societyai"
)

// ===============================================================
// Modèle 1: Modèle fictif simple
// ===============================================================

// FictiveModel est un exemple d'implémentation personnalisée de AIModel
type FictiveModel struct {
	name      string
	responses []string
	rng       *rand.Rand
}

// NewFictiveModel crée un nouveau modèle fictif
func NewFictiveModel(name string, responses []string) *FictiveModel {
	return &FictiveModel{
		name:      name,
		responses: responses,
		rng:       rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Name retourne le nom du modèle
func (m *FictiveModel) Name() string {
	return m.name
}

// Process génère une réponse (fictive) au prompt
func (m *FictiveModel) Process(ctx context.Context, prompt string) (string, error) {
	// Simuler un délai de traitement
	select {
	case <-time.After(time.Duration(m.rng.Intn(500)) * time.Millisecond):
		// Sélectionner une réponse aléatoire parmi les réponses disponibles
		responseIndex := m.rng.Intn(len(m.responses))
		return fmt.Sprintf("[%s] %s\nPrompt: %s", m.name, m.responses[responseIndex], prompt), nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// ===============================================================
// Modèle 2: Modèle avec configuration personnalisée
// ===============================================================

// ConfigurableModel est un modèle qui nécessite une configuration
type ConfigurableModel struct {
	name   string
	config map[string]string
	rng    *rand.Rand
}

// NewConfigurableModel crée un nouveau modèle avec configuration
func NewConfigurableModel(name string, config map[string]string) *ConfigurableModel {
	return &ConfigurableModel{
		name:   name,
		config: config,
		rng:    rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Name retourne le nom du modèle
func (m *ConfigurableModel) Name() string {
	return m.name
}

// Process génère une réponse au prompt en utilisant la configuration
func (m *ConfigurableModel) Process(ctx context.Context, prompt string) (string, error) {
	// Vérifier la présence d'une configuration requise
	if _, hasAPIKey := m.config["api_key"]; !hasAPIKey {
		return "", fmt.Errorf("clé API non fournie pour le modèle %s", m.name)
	}

	// Simuler un délai de traitement avec une variation aléatoire
	delay := 800 + m.rng.Intn(200) // Entre 800 et 1000 ms
	select {
	case <-time.After(time.Duration(delay) * time.Millisecond):
		return fmt.Sprintf("[%s] Réponse avec configuration: %v\nPrompt: %s",
			m.name, m.config, prompt), nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// ===============================================================
// Modèle 3: Modèle simulant GPT
// ===============================================================

// GPTMockModel simule un modèle GPT
type GPTMockModel struct {
	version string
	apiKey  string
	rng     *rand.Rand
}

// NewGPTMockModel crée un nouveau modèle GPT simulé
func NewGPTMockModel(version, apiKey string) *GPTMockModel {
	return &GPTMockModel{
		version: version,
		apiKey:  apiKey,
		rng:     rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Name retourne le nom du modèle
func (m *GPTMockModel) Name() string {
	return "GPT-" + m.version
}

// Process génère une réponse simulant GPT
func (m *GPTMockModel) Process(ctx context.Context, prompt string) (string, error) {
	// Vérifier que la clé API a été fournie
	if m.apiKey == "" {
		return "", fmt.Errorf("clé API non fournie pour GPT-%s", m.version)
	}

	// Simuler un délai de traitement avec une légère variation aléatoire
	delay := 1000 + m.rng.Intn(500) // Entre 1000 et 1500 ms
	select {
	case <-time.After(time.Duration(delay) * time.Millisecond):
		return fmt.Sprintf("[GPT-%s] Analyse sophistiquée générée à partir du prompt: %s",
			m.version, prompt), nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// ===============================================================
// Programme principal
// ===============================================================

func main() {
	fmt.Println("🧠 SocietyAI - Exemple avec modèles personnalisés et configurations")
	fmt.Println("===============================================================")
	fmt.Println()

	// Créer un modèle fictif
	model1 := NewFictiveModel("FictiveModel", []string{
		"Il est important de considérer les performances.",
		"La simplicité devrait être une priorité.",
		"Ne jamais négliger les tests dans le développement.",
		"L'architecture hexagonale offre une bonne séparation des préoccupations.",
	})

	// Créer un modèle avec configuration personnalisée
	model2 := NewConfigurableModel("ConfigModel", map[string]string{
		"api_key":     "simulation_key_123",
		"temperature": "0.7",
		"max_tokens":  "150",
	})

	// Créer un modèle simulant GPT
	model3 := NewGPTMockModel("4", "simulation_key_456")

	// Combiner les modèles en un tableau
	models := []societyai.AIModel{model1, model2, model3}

	// Demander à l'utilisateur de saisir un prompt
	scanner := bufio.NewScanner(os.Stdin)
	fmt.Println("🔍 Entrez votre prompt (ou appuyez sur Entrée pour utiliser l'exemple) :")
	var prompt string
	if scanner.Scan() {
		prompt = strings.TrimSpace(scanner.Text())
	}
	if prompt == "" {
		prompt = "Comment structurer une application Golang pour garantir sa maintenabilité?"
		fmt.Printf("   Utilisation du prompt par défaut: \"%s\"\n", prompt)
	} else {
		fmt.Printf("   Prompt choisi: \"%s\"\n", prompt)
	}

	// Demander le nombre d'agents
	fmt.Println("\n👥 Entrez le nombre d'agents (ou appuyez sur Entrée pour utiliser la valeur par défaut) :")
	var agentCountStr string
	var agentCount int = 5 // Valeur par défaut
	if scanner.Scan() {
		agentCountStr = strings.TrimSpace(scanner.Text())
		if agentCountStr != "" {
			if count, err := strconv.Atoi(agentCountStr); err == nil && count > 0 {
				agentCount = count
			} else {
				fmt.Println("   Valeur invalide, utilisation du nombre par défaut: 5")
			}
		}
	}
	fmt.Printf("   Nombre d'agents: %d\n", agentCount)

	// Mode multi-modèle
	multiModel := true
	fmt.Printf("   Mode multi-modèles: %v\n", multiModel)

	fmt.Println("\n🚀 Démarrage de l'analyse avec des modèles personnalisés...")
	fmt.Println("   Utilisation des modèles :")
	for i, model := range models {
		fmt.Printf("   - Modèle %d: %s\n", i+1, model.Name())
	}

	// Mesurer le temps d'exécution
	startTime := time.Now()

	// Utiliser la fonction Society
	result, err := societyai.Society(prompt, agentCount, models, multiModel)
	if err != nil {
		fmt.Printf("❌ Erreur: %v\n", err)
		os.Exit(1)
	}

	// Calculer le temps d'exécution
	duration := time.Since(startTime)

	// Afficher le résultat
	fmt.Println("\n📊 Résultat de l'analyse:")
	fmt.Println("----------------------------------------")
	fmt.Println(result)
	fmt.Println("----------------------------------------")
	fmt.Printf("\n⏱️ Temps d'exécution: %s\n", duration)
}
