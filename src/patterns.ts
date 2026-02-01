/**
 * @fileoverview Patterns Library for SocietyAI
 *
 * This module provides pre-configured graph patterns for common AI workflows.
 * These patterns make it easy to implement complex behaviors like self-correction,
 * debates, and recursive refinement.
 */

import { GraphBuilder, NodeType, SocietyGraph } from './graph';

export const PipelinePatterns = {
  /**
   * Creates a self-correction pattern where a generator agent produces content
   * and a validator agent checks it. If the validator is not satisfied,
   * the generator receives feedback and tries again.
   *
   * @param generatorId - ID of the agent generating content
   * @param validatorId - ID of the agent validating content
   * @param maxRetries - Maximum number of correction attempts (default: 3)
   * @returns A configured SocietyGraph
   */
  selfCorrection(
    generatorId: string,
    validatorId: string,
    maxRetries: number = 3
  ): SocietyGraph {
    return GraphBuilder.create()
      .addNode('start', NodeType.START)
      
      // Generator steps
      .addNode('generator', NodeType.AGENT, { 
        agentId: generatorId,
        // We use a transform here to append feedback if it exists
        transformer: (result, ctx) => {
          const feedback = ctx.sharedData.get('feedback');
          if (feedback) {
            return `${result}\n\nFeedback from previous attempt:\n${feedback}\nPlease correct based on this feedback.`;
          }
          return result; // Initial prompt
        }
      })
      
      // Validator step
      .addNode('validator', NodeType.AGENT, { 
        agentId: validatorId 
      })
      
      // Feedback capture (Transform)
      .addNode('process_feedback', NodeType.TRANSFORM, {
        transformer: (result, ctx) => {
          // Store the validation result as feedback for next iteration
          ctx.sharedData.set('feedback', result);
          
          // Increment retry count
          const retries = (ctx.sharedData.get('retryCount') as number) || 0;
          ctx.sharedData.set('retryCount', retries + 1);
          
          return result;
        }
      })
      
      // Validated Result Generator (Extract the original content if valid)
      // or just pass through.
      
      .addNode('end', NodeType.END)
      
      // Edges
      .addEdge('start', 'generator')
      .addEdge('generator', 'validator')
      .addEdge('validator', 'process_feedback')
      
      // Conditional loop
      .addConditionalEdge({
        from: 'process_feedback',
        condition: (result, ctx) => {
          const isSuccess = result.toLowerCase().includes('valid') || 
                           !result.toLowerCase().includes('invalid');
                           
          const retries = (ctx.sharedData.get('retryCount') as number) || 0;
          
          // If valid, go to end (false path = loop back)
          // Wait, logic:
          // If NOT success AND retries < max -> Loop back
          return !isSuccess && retries < maxRetries;
        },
        truePath: 'generator', // Needs correction
        falsePath: 'end'       // Valid or max retries reached
      })
      
      .build();
  },

  /**
   * Creates a multi-perspective debate pattern where two agents debate a topic
   * and a judge synthesizes the final conclusion.
   *
   * @param agentAId - ID of the first debater (e.g., 'Pro')
   * @param agentBId - ID of the second debater (e.g., 'Con')
   * @param judgeId - ID of the agent acting as judge/synthesizer
   * @param rounds - Number of debate rounds (default: 3)
   * @returns A configured SocietyGraph
   */
  multiPerspectiveDebate(
    agentAId: string,
    agentBId: string,
    judgeId: string,
    rounds: number = 3
  ): SocietyGraph {
    const builder = GraphBuilder.create()
      .addNode('start', NodeType.START)
      .addNode('end', NodeType.END)
      .addNode('judge', NodeType.AGENT, { agentId: judgeId });
      
    // Create rounds
    let previousNode = 'start';
    
    for (let i = 1; i <= rounds; i++) {
        const roundNodeA = `round_${i}_agent_A`;
        const roundNodeB = `round_${i}_agent_B`;
        
        builder
            .addNode(roundNodeA, NodeType.AGENT, { agentId: agentAId })
            .addNode(roundNodeB, NodeType.AGENT, { agentId: agentBId });
            
        builder.addEdge(previousNode, roundNodeA);
        builder.addEdge(roundNodeA, roundNodeB);
        
        previousNode = roundNodeB;
    }
    
    // Connect last round to judge
    builder.addEdge(previousNode, 'judge');
    builder.addEdge('judge', 'end');
    
    return builder.build();
  }
};
