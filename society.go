package societyai

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Society crée une société d'agents qui analysent le prompt et travaillent ensemble
// pour générer une réponse améliorée.
// Cette fonction est un wrapper sur SocietyWithModels qui s'attend à ce que le développeur
// fournisse directement les modèles d'IA à utiliser.
func Society(prompt string, agentCount int, models []AIModel, multiModel bool) (string, error) {
	if agentCount <= 0 {
		return "", ErrInvalidAgentCount
	}

	if len(models) == 0 {
		return "", ErrNoModelsSpecified
	}

	return RunSociety(context.Background(), &Config{
		Prompt:     prompt,
		AgentCount: agentCount,
		MultiModel: multiModel,
	}, models)
}

// SocietyWithSynthesis crée une société d'agents qui analysent le prompt et utilise
// un modèle dédié pour synthétiser les résultats des agents.
func SocietyWithSynthesis(prompt string, agentCount int, models []AIModel, multiModel bool, synthModel AIModel) (string, error) {
	if agentCount <= 0 {
		return "", ErrInvalidAgentCount
	}

	if len(models) == 0 {
		return "", ErrNoModelsSpecified
	}

	if synthModel == nil {
		return "", errors.New("le modèle de synthèse ne peut pas être nil")
	}

	return RunSocietyWithSynthesis(context.Background(), &Config{
		Prompt:     prompt,
		AgentCount: agentCount,
		MultiModel: multiModel,
	}, models, synthModel)
}

// SocietyCollaborative crée une société d'agents qui travaillent ensemble de manière collaborative,
// avec une analyse initiale commune et une exploration de dimensions complémentaires.
func SocietyCollaborative(prompt string, agentCount int, models []AIModel, multiModel bool) (string, error) {
	if agentCount <= 0 {
		return "", ErrInvalidAgentCount
	}

	if len(models) == 0 {
		return "", ErrNoModelsSpecified
	}

	return RunSocietyCollaborative(context.Background(), &Config{
		Prompt:        prompt,
		AgentCount:    agentCount,
		MultiModel:    multiModel,
		Collaborative: true,
	}, models)
}

// RunSociety exécute la société d'agents avec les configurations fournies et les modèles spécifiés
func RunSociety(ctx context.Context, config *Config, models []AIModel) (string, error) {
	// Création de la société
	society := createSociety(config, models)

	// Lancement des agents
	err := society.run(ctx)
	if err != nil {
		return "", err
	}

	// Attente et collecte des résultats
	result := society.collectResults()

	return result, nil
}

// RunSocietyWithSynthesis exécute la société d'agents avec les configurations fournies
// et utilise un modèle spécifique pour la synthèse finale
func RunSocietyWithSynthesis(ctx context.Context, config *Config, models []AIModel, synthModel AIModel) (string, error) {
	// Création de la société
	society := createSociety(config, models)

	// Lancement des agents
	err := society.run(ctx)
	if err != nil {
		return "", err
	}

	// Attente et collecte des résultats avec le modèle de synthèse
	result, err := society.collectResultsWithSynthesisModel(ctx, synthModel)
	if err != nil {
		return "", err
	}

	return result, nil
}

// RunSocietyCollaborative exécute la société d'agents en mode collaboratif
// avec une réflexion profonde et partagée
func RunSocietyCollaborative(ctx context.Context, config *Config, models []AIModel) (string, error) {
	// Création d'une société collaborative
	society := createCollaborativeSociety(config, models)

	// Étape 1: Analyse initiale du prompt
	err := society.performInitialAnalysis(ctx)
	if err != nil {
		return "", err
	}

	// Étape 2: Exploration des dimensions
	err = society.exploreDimensions(ctx)
	if err != nil {
		return "", err
	}

	// Étape 3: Intégration des analyses
	err = society.integrateAnalyses(ctx)
	if err != nil {
		return "", err
	}

	// Étape 4: Génération de la réponse finale
	result, err := society.generateFinalResponse(ctx)
	if err != nil {
		return "", err
	}

	return result, nil
}

// createSociety crée une société d'agents
func createSociety(config *Config, models []AIModel) *SocietyGroup {
	agents := make([]*Agent, 0, config.AgentCount)
	results := make(chan string, config.AgentCount)

	for i := 0; i < config.AgentCount; i++ {
		var model AIModel
		if config.MultiModel && len(models) > 1 {
			// Distribuer les modèles entre les agents si multiModel est activé
			model = models[i%len(models)]
		} else {
			// Sinon, utiliser seulement le premier modèle
			model = models[0]
		}

		// Adapter légèrement le prompt pour chaque agent pour favoriser la diversité
		agentPrompt := generatePromptForAgent(config.Prompt, i)

		agent := &Agent{
			ID:      i,
			Model:   model,
			Prompt:  agentPrompt,
			Results: results,
		}

		agents = append(agents, agent)
	}

	return &SocietyGroup{
		Agents:     agents,
		Models:     models,
		MultiModel: config.MultiModel,
		Results:    results,
	}
}

// createCollaborativeSociety crée une société d'agents collaboratifs
func createCollaborativeSociety(config *Config, models []AIModel) *SocietyGroup {
	agents := make([]*Agent, 0, config.AgentCount)
	results := make(chan string, config.AgentCount)

	// Définir les dimensions à explorer
	dimensions := []string{
		"Compréhension fondamentale et factuelle du sujet",
		"Aspects pratiques et mise en œuvre concrète",
		"Implications plus larges et considérations de contexte",
		"Défis potentiels et approches pour les surmonter",
		"Applications pratiques et exemples concrets",
	}

	// Limiter les dimensions au nombre d'agents
	if len(dimensions) > config.AgentCount {
		dimensions = dimensions[:config.AgentCount]
	}

	// Créer le contexte collaboratif
	context := &CollaborativeContext{
		Dimensions:     dimensions,
		SharedInsights: make([]string, 0),
	}

	for i := 0; i < config.AgentCount; i++ {
		var model AIModel
		if config.MultiModel && len(models) > 1 {
			model = models[i%len(models)]
		} else {
			model = models[0]
		}

		dimensionIndex := i % len(dimensions)

		agent := &Agent{
			ID:                 i,
			Model:              model,
			Prompt:             config.Prompt, // Sera modifié lors des différentes phases
			Results:            results,
			Phase:              0,
			DimensionToExplore: dimensions[dimensionIndex],
		}

		agents = append(agents, agent)
	}

	return &SocietyGroup{
		Agents:     agents,
		Models:     models,
		MultiModel: config.MultiModel,
		Results:    results,
		Context:    context,
	}
}

// performInitialAnalysis réalise l'analyse initiale du prompt
func (s *SocietyGroup) performInitialAnalysis(ctx context.Context) error {
	if len(s.Agents) == 0 {
		return errors.New("aucun agent disponible pour l'analyse")
	}

	// Utiliser le premier agent pour l'analyse initiale
	primaryAgent := s.Agents[0]

	// Créer le prompt pour l'analyse initiale
	analysisPrompt := "Analyse profondément cette demande pour en comprendre l'essence, les attentes implicites et explicites, " +
		"et le niveau de détail approprié pour y répondre de manière optimale: " + primaryAgent.Prompt

	// Effectuer l'analyse initiale
	initialAnalysis, err := primaryAgent.Model.Process(ctx, analysisPrompt)
	if err != nil {
		return err
	}

	// Stocker l'analyse initiale dans le contexte partagé
	s.Context.InitialAnalysis = initialAnalysis

	// Partager l'analyse avec tous les agents
	for _, agent := range s.Agents {
		agent.SharedAnalysis = initialAnalysis
	}

	return nil
}

// exploreDimensions fait explorer les différentes dimensions du sujet par les agents
func (s *SocietyGroup) exploreDimensions(ctx context.Context) error {
	var wg sync.WaitGroup
	errs := make(chan error, len(s.Agents))

	// Créer un contexte avec timeout pour éviter les blocages
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	// Lancer l'exploration par chaque agent
	for _, agent := range s.Agents {
		wg.Add(1)
		go func(a *Agent) {
			defer wg.Done()

			// Créer le prompt pour explorer la dimension spécifique
			explorationPrompt := fmt.Sprintf(
				"En te basant sur cette analyse initiale:\n\n%s\n\n"+
					"Explore en profondeur cette dimension spécifique: %s\n\n"+
					"Pour la question originale: %s\n\n"+
					"Analyse cette dimension de manière détaillée et approfondie, en tenant compte des autres aspects "+
					"mais en te concentrant particulièrement sur cette dimension. "+
					"Pense étape par étape et développe une analyse nuancée et complète.",
				a.SharedAnalysis,
				a.DimensionToExplore,
				a.Prompt,
			)

			// Explorer la dimension
			result, err := a.Model.Process(ctx, explorationPrompt)
			if err != nil {
				errs <- err
				return
			}

			// Envoyer le résultat
			a.Results <- result
		}(agent)
	}

	// Attendre que tous les agents terminent ou qu'une erreur se produise
	go func() {
		wg.Wait()
		close(errs)
	}()

	// Vérifier s'il y a des erreurs
	for err := range errs {
		return err
	}

	// Collecter les résultats d'exploration
	insights := make([]string, len(s.Agents))
	for i := 0; i < len(s.Agents); i++ {
		insights[i] = <-s.Results
	}

	// Stocker les insights dans le contexte
	s.Context.SharedInsights = insights

	return nil
}

// integrateAnalyses intègre les analyses des différentes dimensions
func (s *SocietyGroup) integrateAnalyses(ctx context.Context) error {
	if len(s.Agents) == 0 || len(s.Context.SharedInsights) == 0 {
		return errors.New("aucune analyse à intégrer")
	}

	// Utiliser le premier agent pour l'intégration
	primaryAgent := s.Agents[0]

	// Créer le prompt pour l'intégration
	integrationPrompt := "Intègre organiquement ces différentes analyses en une compréhension cohérente et unifiée:\n\n"

	// Ajouter l'analyse initiale
	integrationPrompt += "Compréhension initiale de la demande:\n" + s.Context.InitialAnalysis + "\n\n"

	// Ajouter les analyses des différentes dimensions
	for i, insight := range s.Context.SharedInsights {
		integrationPrompt += fmt.Sprintf("Dimension: %s\n%s\n\n",
			s.Agents[i].DimensionToExplore,
			insight)
	}

	integrationPrompt += "Ta tâche est de synthétiser ces analyses en une compréhension intégrée qui combine " +
		"organiquement toutes les dimensions, en évitant de simplement juxtaposer les informations. " +
		"Identifie les connexions, les patterns et les idées transversales. " +
		"Forme une analyse unifiée qui représente une réflexion collaborative approfondie."

	// Effectuer l'intégration
	integratedAnalysis, err := primaryAgent.Model.Process(ctx, integrationPrompt)
	if err != nil {
		return err
	}

	// Partager l'analyse intégrée avec tous les agents
	for _, agent := range s.Agents {
		agent.SharedAnalysis = integratedAnalysis
	}

	return nil
}

// generateFinalResponse génère la réponse finale basée sur l'analyse intégrée
func (s *SocietyGroup) generateFinalResponse(ctx context.Context) (string, error) {
	if len(s.Agents) == 0 {
		return "", errors.New("aucun agent disponible pour générer la réponse")
	}

	// Utiliser le premier agent pour la génération de la réponse finale
	primaryAgent := s.Agents[0]

	// Créer le prompt pour la réponse finale
	responsePrompt := fmt.Sprintf(
		"En t'appuyant sur cette analyse intégrée et approfondie:\n\n%s\n\n"+
			"Formule une réponse directe, claire et complète à la demande originale: %s\n\n"+
			"La réponse doit être parfaitement adaptée aux besoins implicites et explicites de l'utilisateur, "+
			"en intégrant harmonieusement les perspectives des différentes dimensions analysées. "+
			"La réponse doit être cohérente, structurée et offrir un maximum de valeur à l'utilisateur. "+
			"N'inclus pas de mentions du processus analytique, concentre-toi uniquement sur la réponse à la demande.",
		primaryAgent.SharedAnalysis,
		primaryAgent.Prompt,
	)

	// Générer la réponse finale
	finalResponse, err := primaryAgent.Model.Process(ctx, responsePrompt)
	if err != nil {
		return "", err
	}

	return finalResponse, nil
}

// generatePromptForAgent personnalise légèrement le prompt pour chaque agent
func generatePromptForAgent(basePrompt string, agentID int) string {
	// Exemples de perspectives différentes selon l'ID de l'agent
	perspectives := []string{
		"Analyse cette demande de manière factuelle et concise: ",
		"Considère les implications et le contexte plus large de cette demande: ",
		"Identifie les exigences spécifiques et le but de cette demande: ",
		"Réfléchis aux approches les plus innovantes pour répondre à cette demande: ",
		"Examine les aspects techniques et pratiques de cette demande: ",
	}

	perspective := perspectives[agentID%len(perspectives)]
	return perspective + basePrompt
}

// run lance tous les agents en parallèle
func (s *SocietyGroup) run(ctx context.Context) error {
	var wg sync.WaitGroup
	errs := make(chan error, len(s.Agents))

	// Créer un contexte avec timeout pour éviter les blocages
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Lancer chaque agent dans une goroutine
	for _, agent := range s.Agents {
		wg.Add(1)
		go func(a *Agent) {
			defer wg.Done()
			err := a.process(ctx)
			if err != nil {
				errs <- err
			}
		}(agent)
	}

	// Attendre que tous les agents terminent ou qu'une erreur se produise
	go func() {
		wg.Wait()
		close(errs)
	}()

	// Vérifier s'il y a des erreurs
	for err := range errs {
		return err
	}

	return nil
}

// process traite le prompt avec le modèle de l'agent
func (a *Agent) process(ctx context.Context) error {
	result, err := a.Model.Process(ctx, a.Prompt)
	if err != nil {
		return err
	}

	// Envoyer le résultat dans le channel
	a.Results <- result

	return nil
}

// collectResults collecte les résultats de tous les agents
func (s *SocietyGroup) collectResults() string {
	var results []string

	// Récupérer les résultats des agents
	for i := 0; i < len(s.Agents); i++ {
		result := <-s.Results
		results = append(results, result)
	}

	// Combiner les résultats
	// Dans une implémentation plus avancée, on pourrait faire une analyse de consensus
	// ou utiliser un agent "coordinateur" pour synthétiser les résultats
	finalResult := "Synthèse des analyses des agents:\n\n"
	for i, result := range results {
		finalResult += fmt.Sprintf("Agent %d: %s\n\n", i+1, result)
	}

	// Suppression de la conclusion consolidée dans le mode standard
	// car elle porte à confusion et suggère une synthèse qui n'existe pas dans ce mode

	return finalResult
}

// collectResultsWithSynthesisModel collecte les résultats et utilise un modèle dédié pour la synthèse
func (s *SocietyGroup) collectResultsWithSynthesisModel(ctx context.Context, synthesisModel AIModel) (string, error) {
	var results []string

	// Récupérer les résultats des agents
	for i := 0; i < len(s.Agents); i++ {
		result := <-s.Results
		results = append(results, result)
	}

	// Présentation des résultats individuels
	finalResult := "Synthèse des analyses des agents:\n\n"
	for i, result := range results {
		finalResult += fmt.Sprintf("Agent %d: %s\n\n", i+1, result)
	}

	// Utiliser le modèle de synthèse pour créer une conclusion consolidée
	synthesis, err := SynthesizeWithModel(ctx, results, synthesisModel)
	if err != nil {
		// En cas d'erreur, utiliser la méthode simple
		finalResult += "\nConclusion consolidée (méthode simple - erreur du modèle de synthèse):\n" +
			synthesizeResults(results) +
			"\n\nErreur de synthèse: " + err.Error()
		return finalResult, nil
	}

	finalResult += "\nConclusion consolidée (via modèle de synthèse):\n" + synthesis

	return finalResult, nil
}

// synthesizeResults combine les résultats des agents en une réponse cohérente
func synthesizeResults(results []string) string {
	// Cette fonction pourrait être améliorée pour faire une véritable
	// analyse et synthèse des différentes réponses

	// Pour l'exemple actuel, nous faisons une simple concaténation
	var synthesis string
	for i, result := range results {
		synthesis += fmt.Sprintf("\nAgent %d:\n%s\n", i+1, result)
	}

	return "Synthèse des résultats:\n" + synthesis
}

// SynthesizeWithModel combine les résultats des agents en utilisant un modèle spécifique
func SynthesizeWithModel(ctx context.Context, results []string, model AIModel) (string, error) {
	// Créer un prompt qui demande au modèle de synthétiser les perspectives
	// des différents agents
	prompt := "Analyse et synthétise les perspectives suivantes des agents en une réponse cohérente et approfondie:\n\n"

	// Ajouter chaque résultat d'agent au prompt
	for i, result := range results {
		prompt += fmt.Sprintf("=== AGENT %d ===\n%s\n\n", i+1, result)
	}

	prompt += "Ta tâche est de produire une synthèse complète qui:\n" +
		"1. Identifie les points d'accord et de désaccord entre les agents\n" +
		"2. Combine les perspectives uniques en une vision cohérente\n" +
		"3. Présente une conclusion qui intègre les meilleures idées de chaque agent\n" +
		"4. Offre une réponse finale plus complète que chacune des perspectives individuelles\n\n" +
		"Synthèse:"

	// Utiliser le modèle fourni pour générer la synthèse
	return model.Process(ctx, prompt)
}
