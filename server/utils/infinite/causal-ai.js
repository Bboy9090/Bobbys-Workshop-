/**
 * ♾️ Infinite Legendary - Causal AI
 * 
 * Causal inference and root cause analysis
 * Features:
 * - Causal graph construction
 * - Causal inference
 * - Root cause analysis
 * - Counterfactual analysis
 * - Intervention prediction
 */

class CausalAI {
  constructor() {
    this.causalGraphs = new Map();
    this.causalModels = new Map();
    this.interventions = [];
  }

  // Build causal graph from data
  buildCausalGraph(variables, relationships) {
    const graphId = `graph-${Date.now()}-${Math.random()}`;
    
    const graph = {
      id: graphId,
      nodes: variables.map(v => ({
        id: v.id,
        name: v.name,
        type: v.type || 'variable',
        properties: v.properties || {},
      })),
      edges: relationships.map(r => ({
        from: r.from,
        to: r.to,
        type: r.type || 'causes',
        strength: r.strength || 1.0,
        confidence: r.confidence || 0.8,
      })),
      createdAt: new Date().toISOString(),
    };

    this.causalGraphs.set(graphId, graph);
    return graph;
  }

  // Discover causal structure from data
  discoverCausalStructure(data) {
    // Simplified causal discovery
    // In production, would use PC algorithm, FCI, or other methods
    
    const variables = Object.keys(data[0] || {});
    const relationships = [];

    // Simple correlation-based discovery (simplified)
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const correlation = this._calculateCorrelation(
          data.map(d => d[variables[i]]),
          data.map(d => d[variables[j]])
        );

        if (Math.abs(correlation) > 0.5) {
          // Determine direction (simplified - would use more sophisticated methods)
          const direction = correlation > 0 ? 'positive' : 'negative';
          relationships.push({
            from: variables[i],
            to: variables[j],
            type: direction,
            strength: Math.abs(correlation),
            confidence: 0.7,
          });
        }
      }
    }

    const graph = this.buildCausalGraph(
      variables.map(v => ({ id: v, name: v })),
      relationships
    );

    return graph;
  }

  _calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Causal inference - predict effect of intervention
  predictIntervention(graphId, intervention) {
    const graph = this.causalGraphs.get(graphId);
    if (!graph) {
      throw new Error('Causal graph not found');
    }

    // Find affected nodes (descendants of intervention target)
    const affectedNodes = this._findDescendants(graph, intervention.variable);
    
    // Predict effects
    const effects = {};
    for (const node of affectedNodes) {
      const pathStrength = this._calculatePathStrength(graph, intervention.variable, node.id);
      effects[node.id] = {
        expectedChange: intervention.value * pathStrength,
        confidence: pathStrength,
        path: this._findPath(graph, intervention.variable, node.id),
      };
    }

    const prediction = {
      id: `intervention-${Date.now()}`,
      graphId,
      intervention,
      effects,
      affectedNodes: affectedNodes.map(n => n.id),
      timestamp: new Date().toISOString(),
    };

    this.interventions.push(prediction);
    return prediction;
  }

  _findDescendants(graph, startNode) {
    const descendants = [];
    const visited = new Set();

    const dfs = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      for (const edge of graph.edges) {
        if (edge.from === nodeId) {
          const targetNode = graph.nodes.find(n => n.id === edge.to);
          if (targetNode && !descendants.includes(targetNode)) {
            descendants.push(targetNode);
            dfs(edge.to);
          }
        }
      }
    };

    dfs(startNode);
    return descendants;
  }

  _calculatePathStrength(graph, from, to) {
    // Calculate strength of causal path
    const path = this._findPath(graph, from, to);
    if (!path) return 0;

    let strength = 1.0;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges.find(
        e => e.from === path[i] && e.to === path[i + 1]
      );
      if (edge) {
        strength *= edge.strength;
      }
    }

    return strength;
  }

  _findPath(graph, from, to) {
    // Find path between nodes (BFS)
    const queue = [[from]];
    const visited = new Set([from]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === to) {
        return path;
      }

      for (const edge of graph.edges) {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push([...path, edge.to]);
        }
      }
    }

    return null;
  }

  // Root cause analysis
  analyzeRootCause(graphId, effect) {
    const graph = this.causalGraphs.get(graphId);
    if (!graph) {
      throw new Error('Causal graph not found');
    }

    // Find all ancestors (potential root causes)
    const rootCauses = this._findAncestors(graph, effect);
    
    // Rank by causal strength
    const rankedCauses = rootCauses.map(node => ({
      node,
      causalStrength: this._calculatePathStrength(graph, node.id, effect),
      path: this._findPath(graph, node.id, effect),
    })).sort((a, b) => b.causalStrength - a.causalStrength);

    return {
      effect,
      rootCauses: rankedCauses,
      mostLikelyCause: rankedCauses[0],
      timestamp: new Date().toISOString(),
    };
  }

  _findAncestors(graph, targetNode) {
    const ancestors = [];
    const visited = new Set();

    const dfs = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      for (const edge of graph.edges) {
        if (edge.to === nodeId) {
          const sourceNode = graph.nodes.find(n => n.id === edge.from);
          if (sourceNode && !ancestors.includes(sourceNode)) {
            ancestors.push(sourceNode);
            dfs(edge.from);
          }
        }
      }
    };

    dfs(targetNode);
    return ancestors;
  }

  // Counterfactual analysis - what if?
  counterfactualAnalysis(graphId, scenario) {
    const graph = this.causalGraphs.get(graphId);
    if (!graph) {
      throw new Error('Causal graph not found');
    }

    // Simulate alternative scenario
    const counterfactual = {
      id: `counterfactual-${Date.now()}`,
      graphId,
      scenario,
      originalOutcome: scenario.original,
      alternativeOutcome: this._simulateAlternative(graph, scenario),
      difference: null,
      timestamp: new Date().toISOString(),
    };

    counterfactual.difference = 
      counterfactual.alternativeOutcome - counterfactual.originalOutcome;

    return counterfactual;
  }

  _simulateAlternative(graph, scenario) {
    // Simulate what would happen under alternative conditions
    // Simplified - in production would use do-calculus or structural equation models
    const intervention = this.predictIntervention(graph.id, {
      variable: scenario.variable,
      value: scenario.alternativeValue,
    });

    // Aggregate effects
    const totalEffect = Object.values(intervention.effects).reduce(
      (sum, effect) => sum + effect.expectedChange,
      0
    );

    return scenario.original + totalEffect;
  }

  getCausalGraph(graphId) {
    return this.causalGraphs.get(graphId);
  }

  getAllGraphs() {
    return Array.from(this.causalGraphs.values());
  }

  getInterventions(limit = 100) {
    return this.interventions.slice(-limit).reverse();
  }
}

export default new CausalAI();
