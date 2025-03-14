// Script d'exemples pour SocietyAI
//
// Ce script permet de tester les différents modes de SocietyAI:
// - Mode standard (basic): juxtaposition de perspectives variées
// - Mode avec synthèse (with_synthesis): synthèse des perspectives par un modèle dédié
// - Mode collaboratif (collaborative): réflexion profonde et intégrée en 4 étapes
//
// L'utilisateur peut choisir le mode à utiliser via un menu interactif.

package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/benoitpetit/societyai"
)

// GeminiModel implémente l'interface societyai.AIModel
type GeminiModel struct {
	ModelName    string
	APIKey       string
	BaseURL      string
	HttpClient   *http.Client
	Conversation []Message
	MaxRetries   int
	RetryDelay   time.Duration
}

// Message représente un message dans la conversation
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Part représente une partie d'un contenu dans l'API Gemini
type Part struct {
	Text string `json:"text"`
}

// Content représente un contenu dans l'API Gemini
type Content struct {
	Role  string `json:"role,omitempty"`
	Parts []Part `json:"parts"`
}

// NewGeminiModel crée un nouveau modèle Gemini
func NewGeminiModel(modelName, apiKey string) *GeminiModel {
	return &GeminiModel{
		ModelName:    modelName,
		APIKey:       apiKey,
		BaseURL:      "https://generativelanguage.googleapis.com/v1beta/models",
		HttpClient:   &http.Client{Timeout: 120 * time.Second},
		Conversation: []Message{},
		MaxRetries:   3,
		RetryDelay:   2 * time.Second,
	}
}

// Name retourne le nom du modèle (implémente l'interface AIModel)
func (m *GeminiModel) Name() string {
	return m.ModelName
}

// Process envoie une requête à l'API Gemini et retourne la réponse (implémente l'interface AIModel)
func (m *GeminiModel) Process(ctx context.Context, prompt string) (string, error) {
	// Ajouter le message utilisateur à la conversation
	m.Conversation = append(m.Conversation, Message{
		Role:    "user",
		Content: prompt,
	})

	// Convertir la conversation au format attendu par Gemini
	contents := []Content{}

	// Ajouter l'historique des messages
	for _, msg := range m.Conversation {
		content := Content{
			Role: msg.Role,
			Parts: []Part{
				{Text: msg.Content},
			},
		}
		contents = append(contents, content)
	}

	// Préparer le corps de la requête
	requestBody := struct {
		Contents         []Content `json:"contents"`
		GenerationConfig struct {
			MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
			Temperature     float64 `json:"temperature,omitempty"`
		} `json:"generationConfig,omitempty"`
	}{
		Contents: contents,
		GenerationConfig: struct {
			MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
			Temperature     float64 `json:"temperature,omitempty"`
		}{
			MaxOutputTokens: 2048,
			Temperature:     0.7,
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	var lastError error
	// Implémenter un mécanisme de retry
	for attempt := 0; attempt <= m.MaxRetries; attempt++ {
		if attempt > 0 {
			fmt.Printf("⚠️ Tentative %d/%d après erreur: %v\n", attempt, m.MaxRetries, lastError)
			time.Sleep(m.RetryDelay * time.Duration(attempt)) // Délai exponentiel
		}

		// Construire l'URL complète avec la clé API
		fullURL := fmt.Sprintf("%s/%s:generateContent?key=%s", m.BaseURL, m.ModelName, m.APIKey)

		// Créer et envoyer la requête HTTP
		req, err := http.NewRequestWithContext(
			ctx,
			"POST",
			fullURL,
			bytes.NewBuffer(jsonData),
		)
		if err != nil {
			lastError = err
			continue
		}

		req.Header.Add("Content-Type", "application/json")

		resp, err := m.HttpClient.Do(req)
		if err != nil {
			lastError = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			lastError = fmt.Errorf("erreur API: %s - %s", resp.Status, string(body))
			continue
		}

		// Décoder la réponse
		var result struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
					Role string `json:"role"`
				} `json:"content"`
				FinishReason string `json:"finishReason"`
			} `json:"candidates"`
			PromptFeedback struct {
				BlockReason string `json:"blockReason,omitempty"`
			} `json:"promptFeedback"`
		}

		err = json.NewDecoder(resp.Body).Decode(&result)
		if err != nil {
			lastError = err
			continue
		}

		if len(result.Candidates) == 0 {
			lastError = fmt.Errorf("réponse vide reçue de l'API")
			continue
		}

		// Vérifier si la requête a été bloquée pour des raisons de sécurité
		if result.PromptFeedback.BlockReason != "" {
			lastError = fmt.Errorf("requête bloquée: %s", result.PromptFeedback.BlockReason)
			continue
		}

		// Obtenir la réponse textuelle
		responseText := ""
		for _, part := range result.Candidates[0].Content.Parts {
			responseText += part.Text
		}

		// Ajouter la réponse à la conversation
		m.Conversation = append(m.Conversation, Message{
			Role:    "model",
			Content: responseText,
		})

		return responseText, nil
	}

	return "", fmt.Errorf("échec après %d tentatives: %v", m.MaxRetries, lastError)
}

func main() {
	// Récupérer la clé API depuis une variable d'environnement
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Println("⚠️  Veuillez définir la variable d'environnement GEMINI_API_KEY")
		fmt.Println("    Exemple: export GEMINI_API_KEY=votre_clé_api_gemini_ici")
		os.Exit(1)
	}

	fmt.Println("🧠 SocietyAI - Exemples unifiés")
	fmt.Println("==============================")
	fmt.Println()
	fmt.Println("Choisissez le mode que vous souhaitez tester :")
	fmt.Println("1. Mode standard (juxtaposition de perspectives)")
	fmt.Println("2. Mode avec synthèse (synthèse des perspectives par un modèle dédié)")
	fmt.Println("3. Mode collaboratif (réflexion profonde et intégrée en 4 étapes)")
	fmt.Println()

	// Lire le choix de l'utilisateur
	scanner := bufio.NewScanner(os.Stdin)
	fmt.Print("Votre choix (1-3) : ")
	var choice string
	if scanner.Scan() {
		choice = strings.TrimSpace(scanner.Text())
	}

	// Nombre d'agents (par défaut : 4)
	agentCount := 4
	fmt.Printf("Nombre d'agents: %d\n", agentCount)

	// Utiliser le modèle gemini-2.0-flash par défaut
	modelName := "gemini-2.0-flash"
	fmt.Printf("Modèle utilisé: %s\n", modelName)

	// Inviter l'utilisateur à saisir le prompt
	fmt.Println("\n🔍 Entrez votre prompt (ou appuyez sur Entrée pour utiliser l'exemple) :")
	var prompt string
	if scanner.Scan() {
		prompt = strings.TrimSpace(scanner.Text())
	}
	if prompt == "" {
		prompt = "Comment créer une API RESTful simple en Golang?"
		fmt.Printf("   Utilisation du prompt par défaut: \"%s\"\n", prompt)
	}

	// Créer les modèles IA
	models := make([]societyai.AIModel, agentCount)
	for i := 0; i < agentCount; i++ {
		models[i] = NewGeminiModel(modelName, apiKey)
	}

	// Mesurer le temps d'exécution
	startTime := time.Now()

	// Variable pour stocker le résultat
	var result string
	var err error

	// Exécuter le mode choisi
	switch choice {
	case "1":
		// Mode standard
		fmt.Println("\n🚀 Démarrage du mode standard...")
		fmt.Println("   Les agents vont analyser le prompt avec des perspectives différentes")

		result, err = societyai.Society(prompt, agentCount, models, true)

	case "2":
		// Mode avec synthèse
		fmt.Println("\n🚀 Démarrage du mode avec synthèse...")
		fmt.Println("   Les agents vont analyser le prompt puis un modèle dédié synthétisera leurs perspectives")

		// Créer un modèle spécifique pour la synthèse
		synthesisModel := NewGeminiModel(modelName, apiKey)

		result, err = societyai.SocietyWithSynthesis(prompt, agentCount, models, true, synthesisModel)

	case "3":
		// Mode collaboratif
		fmt.Println("\n🚀 Démarrage du mode collaboratif...")
		fmt.Println("   Processus en 4 étapes :")
		fmt.Println("   1. Analyse initiale de la demande")
		fmt.Println("   2. Exploration de dimensions complémentaires")
		fmt.Println("   3. Intégration des analyses")
		fmt.Println("   4. Génération de la réponse finale")

		result, err = societyai.SocietyCollaborative(prompt, agentCount, models, true)

	default:
		fmt.Println("❌ Choix invalide. Veuillez choisir 1, 2 ou 3.")
		os.Exit(1)
	}

	if err != nil {
		fmt.Printf("❌ Erreur: %v\n", err)
		os.Exit(1)
	}

	// Calculer le temps d'exécution
	duration := time.Since(startTime)

	// Afficher le résultat
	fmt.Println("\n📊 Réponse finale :")
	fmt.Println("----------------------------------------")
	fmt.Println(result)
	fmt.Println("----------------------------------------")
	fmt.Printf("\n⏱️ Temps d'exécution: %s\n", duration)
}
