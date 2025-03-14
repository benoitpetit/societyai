package societyai

import (
	"context"
	"errors"
)

// AIModel définit l'interface pour les modèles d'IA
// Cette interface doit être implémentée par n'importe quel modèle
// que le développeur souhaite utiliser avec SocietyAI
type AIModel interface {
	// Process traite un prompt et retourne une réponse
	Process(ctx context.Context, prompt string) (string, error)
	// Name retourne le nom du modèle d'IA
	Name() string
}

// Agent représente un agent individuel dans la société
type Agent struct {
	ID                 int
	Model              AIModel
	Prompt             string
	Results            chan string
	Phase              int    // Phase actuelle de réflexion de l'agent
	CollabContext      string // Contexte collaboratif partagé entre les agents
	SharedAnalysis     string // Analyse partagée générée par le groupe
	DimensionToExplore string // Dimension spécifique explorée par cet agent
}

// CollaborativeContext représente le contexte partagé entre les agents
type CollaborativeContext struct {
	InitialAnalysis string   // Analyse initiale du prompt
	Dimensions      []string // Dimensions explorées par les agents
	SharedInsights  []string // Observations partagées entre les agents
}

// SocietyGroup représente une société d'agents
type SocietyGroup struct {
	Agents     []*Agent
	Models     []AIModel
	MultiModel bool
	Results    chan string
	Context    *CollaborativeContext // Contexte collaboratif partagé
}

// Config contient la configuration pour une société
type Config struct {
	// Prompt original à analyser
	Prompt string
	// AgentCount nombre d'agents dans la société
	AgentCount int
	// MultiModel indique si plusieurs modèles peuvent être utilisés
	MultiModel bool
	// Collaborative indique si les agents travaillent en mode collaboratif
	Collaborative bool
}

// NewConfig crée une nouvelle configuration avec des valeurs par défaut
func NewConfig(prompt string, agentCount int) *Config {
	return &Config{
		Prompt:        prompt,
		AgentCount:    agentCount,
		MultiModel:    true,
		Collaborative: false,
	}
}

// Error est un type d'erreur personnalisé
type Error struct {
	Message string
}

// NewError crée une nouvelle erreur
func NewError(message string) *Error {
	return &Error{Message: message}
}

// Error implémente l'interface error
func (e *Error) Error() string {
	return e.Message
}

// Erreurs communes
var (
	// ErrModelNotSupported est retourné quand un modèle n'est pas supporté
	ErrModelNotSupported = errors.New("modèle d'IA non supporté")
	// ErrProcessingFailed est retourné quand le traitement du prompt échoue
	ErrProcessingFailed = errors.New("échec du traitement du prompt")
	// ErrInvalidAgentCount est retourné quand le nombre d'agents est invalide
	ErrInvalidAgentCount = NewError("le nombre d'agents doit être positif")
	// ErrNoModelsSpecified est retourné quand aucun modèle n'est spécifié
	ErrNoModelsSpecified = NewError("au moins un modèle AI doit être spécifié")
)
