/**
 * ♾️ Infinite Legendary - Swarm Intelligence
 * 
 * Multi-agent collaborative AI system
 * Features:
 * - Agent swarms
 * - Emergent behavior
 * - Distributed decision making
 * - Self-organizing networks
 */

import { EventEmitter } from 'events';

class SwarmIntelligence extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.swarms = new Map();
    this.messages = [];
    this.collectiveKnowledge = new Map();
  }

  // Create agent
  createAgent(agentId, config = {}) {
    const agent = {
      id: agentId,
      type: config.type || 'worker',
      state: 'idle',
      knowledge: {},
      neighbors: [],
      position: {
        x: Math.random() * 100,
        y: Math.random() * 100,
      },
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
      },
      fitness: 0,
      createdAt: new Date().toISOString(),
      ...config,
    };

    this.agents.set(agentId, agent);
    return agent;
  }

  // Create swarm
  createSwarm(swarmId, agentIds, config = {}) {
    const swarm = {
      id: swarmId,
      agents: agentIds.filter(id => this.agents.has(id)),
      task: config.task || null,
      state: 'forming',
      consensus: null,
      createdAt: new Date().toISOString(),
      ...config,
    };

    this.swarms.set(swarmId, swarm);
    return swarm;
  }

  // Agent communication
  sendMessage(fromAgentId, toAgentId, message) {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error('Agent not found');
    }

    const messageObj = {
      id: `msg-${Date.now()}-${Math.random()}`,
      from: fromAgentId,
      to: toAgentId,
      message,
      timestamp: new Date().toISOString(),
    };

    this.messages.push(messageObj);
    this.emit('message', messageObj);

    // Update agent knowledge
    if (message.type === 'knowledge') {
      this._updateCollectiveKnowledge(message.data);
    }

    return messageObj;
  }

  // Broadcast message to all agents in swarm
  broadcastToSwarm(swarmId, fromAgentId, message) {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const messages = [];
    for (const agentId of swarm.agents) {
      if (agentId !== fromAgentId) {
        messages.push(this.sendMessage(fromAgentId, agentId, message));
      }
    }

    return messages;
  }

  // Particle Swarm Optimization
  async particleSwarmOptimize(objective, swarmSize = 20, iterations = 100) {
    // Initialize particles (agents)
    const particles = [];
    for (let i = 0; i < swarmSize; i++) {
      const particle = {
        id: `particle-${i}`,
        position: [Math.random() * 10, Math.random() * 10], // 2D for simplicity
        velocity: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2],
        bestPosition: null,
        bestFitness: -Infinity,
        fitness: 0,
      };
      particle.bestPosition = [...particle.position];
      particles.push(particle);
    }

    let globalBest = { position: null, fitness: -Infinity };

    // PSO algorithm
    for (let iter = 0; iter < iterations; iter++) {
      for (const particle of particles) {
        // Evaluate fitness
        particle.fitness = objective(particle.position);

        // Update personal best
        if (particle.fitness > particle.bestFitness) {
          particle.bestFitness = particle.fitness;
          particle.bestPosition = [...particle.position];
        }

        // Update global best
        if (particle.fitness > globalBest.fitness) {
          globalBest = {
            position: [...particle.position],
            fitness: particle.fitness,
          };
        }

        // Update velocity (PSO formula)
        const w = 0.7; // Inertia
        const c1 = 1.5; // Cognitive
        const c2 = 1.5; // Social

        for (let d = 0; d < particle.position.length; d++) {
          const r1 = Math.random();
          const r2 = Math.random();

          particle.velocity[d] = 
            w * particle.velocity[d] +
            c1 * r1 * (particle.bestPosition[d] - particle.position[d]) +
            c2 * r2 * (globalBest.position[d] - particle.position[d]);
        }

        // Update position
        for (let d = 0; d < particle.position.length; d++) {
          particle.position[d] += particle.velocity[d];
        }
      }
    }

    return {
      globalBest,
      iterations,
      swarmSize,
      particles: particles.map(p => ({
        id: p.id,
        finalPosition: p.position,
        bestFitness: p.bestFitness,
      })),
    };
  }

  // Consensus algorithm (simplified)
  async reachConsensus(swarmId, proposal) {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const votes = new Map();
    let consensusReached = false;
    let consensusValue = null;

    // Each agent votes
    for (const agentId of swarm.agents) {
      const agent = this.agents.get(agentId);
      if (agent) {
        // Simplified voting - in production would be more sophisticated
        const vote = this._agentVote(agent, proposal);
        votes.set(agentId, vote);
      }
    }

    // Count votes
    const voteCounts = {};
    for (const vote of votes.values()) {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    }

    // Check for consensus (simple majority)
    const totalVotes = swarm.agents.length;
    for (const [value, count] of Object.entries(voteCounts)) {
      if (count > totalVotes / 2) {
        consensusReached = true;
        consensusValue = value;
        break;
      }
    }

    swarm.consensus = {
      proposal,
      votes: Object.fromEntries(votes),
      consensusReached,
      consensusValue,
      timestamp: new Date().toISOString(),
    };

    return swarm.consensus;
  }

  _agentVote(agent, proposal) {
    // Simplified voting logic
    // In production, agents would have sophisticated decision-making
    return Math.random() < 0.7 ? 'yes' : 'no';
  }

  _updateCollectiveKnowledge(data) {
    for (const [key, value] of Object.entries(data)) {
      const current = this.collectiveKnowledge.get(key) || { value: null, count: 0 };
      // Weighted average
      const newValue = (current.value * current.count + value) / (current.count + 1);
      this.collectiveKnowledge.set(key, {
        value: newValue,
        count: current.count + 1,
      });
    }
  }

  // Self-organizing network
  organizeNetwork(swarmId) {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    // Update agent positions based on neighbors (simplified)
    for (const agentId of swarm.agents) {
      const agent = this.agents.get(agentId);
      if (agent) {
        // Move towards neighbors (attraction)
        for (const neighborId of agent.neighbors) {
          const neighbor = this.agents.get(neighborId);
          if (neighbor) {
            const dx = neighbor.position.x - agent.position.x;
            const dy = neighbor.position.y - agent.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
              agent.velocity.x += (dx / distance) * 0.1;
              agent.velocity.y += (dy / distance) * 0.1;
            }
          }
        }

        // Update position
        agent.position.x += agent.velocity.x;
        agent.position.y += agent.velocity.y;

        // Boundary conditions
        agent.position.x = Math.max(0, Math.min(100, agent.position.x));
        agent.position.y = Math.max(0, Math.min(100, agent.position.y));
      }
    }

    return {
      swarmId,
      organized: true,
      timestamp: new Date().toISOString(),
    };
  }

  getSwarmStats(swarmId) {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return null;
    }

    return {
      id: swarm.id,
      agentCount: swarm.agents.length,
      state: swarm.state,
      consensus: swarm.consensus,
      agents: swarm.agents.map(id => {
        const agent = this.agents.get(id);
        return agent ? {
          id: agent.id,
          type: agent.type,
          state: agent.state,
          fitness: agent.fitness,
          position: agent.position,
        } : null;
      }).filter(Boolean),
    };
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  getAllSwarms() {
    return Array.from(this.swarms.values());
  }
}

export default new SwarmIntelligence();
