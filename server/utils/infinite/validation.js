/**
 * 🏆 Production-Grade Validation for Infinite Legendary Features
 * 
 * Comprehensive input validation, sanitization, and error handling
 */

class InfiniteValidator {
  constructor() {
    this.validationErrors = [];
  }

  // Validate quantum optimization input
  validateQuantumOptimize(input) {
    const errors = [];

    if (!input) {
      errors.push({ field: 'input', message: 'Input is required' });
      return { valid: false, errors };
    }

    if (input.qubits !== undefined) {
      if (!Number.isInteger(input.qubits) || input.qubits < 1 || input.qubits > 50) {
        errors.push({ 
          field: 'qubits', 
          message: 'Qubits must be an integer between 1 and 50' 
        });
      }
    }

    if (input.problem) {
      if (typeof input.problem !== 'object') {
        errors.push({ 
          field: 'problem', 
          message: 'Problem must be an object' 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeQuantumInput(input),
    };
  }

  _sanitizeQuantumInput(input) {
    return {
      problem: input.problem || {},
      qubits: Math.max(1, Math.min(50, parseInt(input.qubits) || 4)),
    };
  }

  // Validate time-series forecasting input
  validateForecast(input) {
    const errors = [];

    if (!input.series || !Array.isArray(input.series)) {
      errors.push({ 
        field: 'series', 
        message: 'Series must be a non-empty array' 
      });
      return { valid: false, errors };
    }

    if (input.series.length < 2) {
      errors.push({ 
        field: 'series', 
        message: 'Series must have at least 2 data points' 
      });
    }

    // Validate all values are numbers
    const invalidValues = input.series.filter(v => 
      typeof v !== 'number' || !isFinite(v)
    );
    if (invalidValues.length > 0) {
      errors.push({ 
        field: 'series', 
        message: `Series contains ${invalidValues.length} invalid values` 
      });
    }

    if (input.steps !== undefined) {
      if (!Number.isInteger(input.steps) || input.steps < 1 || input.steps > 1000) {
        errors.push({ 
          field: 'steps', 
          message: 'Steps must be an integer between 1 and 1000' 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeForecastInput(input),
    };
  }

  _sanitizeForecastInput(input) {
    return {
      series: input.series.filter(v => typeof v === 'number' && isFinite(v)),
      steps: Math.max(1, Math.min(1000, parseInt(input.steps) || 10)),
      lookback: Math.max(2, Math.min(100, parseInt(input.lookback) || 10)),
      attentionWindow: Math.max(5, Math.min(200, parseInt(input.attentionWindow) || 20)),
    };
  }

  // Validate swarm intelligence input
  validateSwarm(input) {
    const errors = [];

    if (input.swarmSize !== undefined) {
      if (!Number.isInteger(input.swarmSize) || input.swarmSize < 1 || input.swarmSize > 10000) {
        errors.push({ 
          field: 'swarmSize', 
          message: 'Swarm size must be an integer between 1 and 10000' 
        });
      }
    }

    if (input.iterations !== undefined) {
      if (!Number.isInteger(input.iterations) || input.iterations < 1 || input.iterations > 100000) {
        errors.push({ 
          field: 'iterations', 
          message: 'Iterations must be an integer between 1 and 100000' 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeSwarmInput(input),
    };
  }

  _sanitizeSwarmInput(input) {
    return {
      swarmSize: Math.max(1, Math.min(10000, parseInt(input.swarmSize) || 20)),
      iterations: Math.max(1, Math.min(100000, parseInt(input.iterations) || 100)),
      objective: input.objective || '',
    };
  }

  // Validate causal AI input
  validateCausal(input) {
    const errors = [];

    if (input.data && !Array.isArray(input.data)) {
      errors.push({ 
        field: 'data', 
        message: 'Data must be an array' 
      });
    }

    if (input.data && input.data.length > 0) {
      const firstRow = input.data[0];
      if (typeof firstRow !== 'object') {
        errors.push({ 
          field: 'data', 
          message: 'Data rows must be objects' 
        });
      }
    }

    if (input.graphId && typeof input.graphId !== 'string') {
      errors.push({ 
        field: 'graphId', 
        message: 'Graph ID must be a string' 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeCausalInput(input),
    };
  }

  _sanitizeCausalInput(input) {
    return {
      data: Array.isArray(input.data) ? input.data.slice(0, 10000) : [],
      graphId: typeof input.graphId === 'string' ? input.graphId : null,
      variables: Array.isArray(input.variables) ? input.variables : [],
      relationships: Array.isArray(input.relationships) ? input.relationships : [],
    };
  }

  // Validate consciousness AI input
  validateConsciousness(input) {
    const errors = [];

    if (input.question && typeof input.question !== 'string') {
      errors.push({ 
        field: 'question', 
        message: 'Question must be a string' 
      });
    }

    if (input.question && input.question.length > 10000) {
      errors.push({ 
        field: 'question', 
        message: 'Question must be less than 10000 characters' 
      });
    }

    if (input.observations && !Array.isArray(input.observations)) {
      errors.push({ 
        field: 'observations', 
        message: 'Observations must be an array' 
      });
    }

    if (input.observations && input.observations.length > 100000) {
      errors.push({ 
        field: 'observations', 
        message: 'Observations array too large (max 100000)' 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeConsciousnessInput(input),
    };
  }

  _sanitizeConsciousnessInput(input) {
    return {
      question: typeof input.question === 'string' 
        ? input.question.slice(0, 10000).trim() 
        : '',
      context: typeof input.context === 'object' ? input.context : {},
      observations: Array.isArray(input.observations) 
        ? input.observations.slice(0, 100000) 
        : [],
      reasoningType: ['abductive', 'analogical', 'counterfactual', 'temporal', 'spatial']
        .includes(input.reasoningType) 
        ? input.reasoningType 
        : 'abductive',
    };
  }

  // Validate self-replicating input
  validateSelfReplicating(input) {
    const errors = [];

    if (input.targetFile && typeof input.targetFile !== 'string') {
      errors.push({ 
        field: 'targetFile', 
        message: 'Target file must be a string' 
      });
    }

    if (input.targetFile) {
      // Security: prevent path traversal
      if (input.targetFile.includes('..') || input.targetFile.includes('~')) {
        errors.push({ 
          field: 'targetFile', 
          message: 'Invalid file path (path traversal detected)' 
        });
      }
    }

    if (input.spec && typeof input.spec !== 'object') {
      errors.push({ 
        field: 'spec', 
        message: 'Spec must be an object' 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeSelfReplicatingInput(input),
    };
  }

  _sanitizeSelfReplicatingInput(input) {
    return {
      targetFile: typeof input.targetFile === 'string' 
        ? input.targetFile.replace(/[<>:"|?*\x00-\x1f]/g, '') 
        : null,
      spec: typeof input.spec === 'object' ? input.spec : {},
      modification: typeof input.modification === 'object' ? input.modification : {},
      adaptations: typeof input.adaptations === 'object' ? input.adaptations : {},
    };
  }

  // Validate neuromorphic input
  validateNeuromorphic(input) {
    const errors = [];

    if (input.config) {
      if (input.config.neuronCount !== undefined) {
        if (!Number.isInteger(input.config.neuronCount) || 
            input.config.neuronCount < 1 || 
            input.config.neuronCount > 100000) {
          errors.push({ 
            field: 'config.neuronCount', 
            message: 'Neuron count must be between 1 and 100000' 
          });
        }
      }

      if (input.config.synapseCount !== undefined) {
        if (!Number.isInteger(input.config.synapseCount) || 
            input.config.synapseCount < 0 || 
            input.config.synapseCount > 1000000) {
          errors.push({ 
            field: 'config.synapseCount', 
            message: 'Synapse count must be between 0 and 1000000' 
          });
        }
      }
    }

    if (input.duration !== undefined) {
      if (!Number.isInteger(input.duration) || 
          input.duration < 1 || 
          input.duration > 100000) {
        errors.push({ 
          field: 'duration', 
          message: 'Duration must be between 1 and 100000 ms' 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeNeuromorphicInput(input),
    };
  }

  _sanitizeNeuromorphicInput(input) {
    return {
      networkId: typeof input.networkId === 'string' ? input.networkId : null,
      config: {
        neuronCount: Math.max(1, Math.min(100000, 
          parseInt(input.config?.neuronCount) || 10)),
        synapseCount: Math.max(0, Math.min(1000000, 
          parseInt(input.config?.synapseCount) || 20)),
        neuronType: input.config?.neuronType || 'leaky_integrate_fire',
      },
      duration: Math.max(1, Math.min(100000, parseInt(input.duration) || 100)),
      inputSpikes: typeof input.inputSpikes === 'object' ? input.inputSpikes : {},
    };
  }

  // Validate simulation input
  validateSimulation(input) {
    const errors = [];

    if (input.iterations !== undefined) {
      if (!Number.isInteger(input.iterations) || 
          input.iterations < 1 || 
          input.iterations > 10000000) {
        errors.push({ 
          field: 'iterations', 
          message: 'Iterations must be between 1 and 10000000' 
        });
      }
    }

    if (input.model && typeof input.model !== 'object') {
      errors.push({ 
        field: 'model', 
        message: 'Model must be an object' 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeSimulationInput(input),
    };
  }

  _sanitizeSimulationInput(input) {
    return {
      iterations: Math.max(1, Math.min(10000000, parseInt(input.iterations) || 10000)),
      model: typeof input.model === 'object' ? input.model : {},
      config: typeof input.config === 'object' ? input.config : {},
      baseScenario: typeof input.baseScenario === 'object' ? input.baseScenario : {},
      variations: Array.isArray(input.variations) ? input.variations : [],
    };
  }

  // Validate multi-dimensional optimization input
  validateMultiOptimize(input) {
    const errors = [];

    if (input.objectives && !Array.isArray(input.objectives)) {
      errors.push({ 
        field: 'objectives', 
        message: 'Objectives must be an array' 
      });
    }

    if (input.objectives && input.objectives.length === 0) {
      errors.push({ 
        field: 'objectives', 
        message: 'At least one objective is required' 
      });
    }

    if (input.objectives && input.objectives.length > 100) {
      errors.push({ 
        field: 'objectives', 
        message: 'Maximum 100 objectives allowed' 
      });
    }

    if (input.bounds && !Array.isArray(input.bounds)) {
      errors.push({ 
        field: 'bounds', 
        message: 'Bounds must be an array' 
      });
    }

    if (input.bounds) {
      const invalidBounds = input.bounds.filter(b => 
        !Array.isArray(b) || b.length !== 2 || 
        typeof b[0] !== 'number' || typeof b[1] !== 'number' ||
        b[0] >= b[1]
      );
      if (invalidBounds.length > 0) {
        errors.push({ 
          field: 'bounds', 
          message: 'All bounds must be [min, max] arrays with min < max' 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeMultiOptimizeInput(input),
    };
  }

  _sanitizeMultiOptimizeInput(input) {
    return {
      objectives: Array.isArray(input.objectives) 
        ? input.objectives.slice(0, 100) 
        : [],
      constraints: Array.isArray(input.constraints) 
        ? input.constraints.slice(0, 100) 
        : [],
      bounds: Array.isArray(input.bounds) 
        ? input.bounds.filter(b => 
            Array.isArray(b) && b.length === 2 && 
            typeof b[0] === 'number' && typeof b[1] === 'number' &&
            b[0] < b[1]
          ).slice(0, 100)
        : [],
      iterations: Math.max(1, Math.min(100000, parseInt(input.iterations) || 50)),
      method: ['penalty', 'barrier'].includes(input.method) ? input.method : 'penalty',
      weights: Array.isArray(input.weights) 
        ? input.weights.filter(w => typeof w === 'number' && w >= 0 && w <= 1)
        : [],
    };
  }

  // Validate blockchain input
  validateBlockchain(input) {
    const errors = [];

    if (input.auditEntry && typeof input.auditEntry !== 'object') {
      errors.push({ 
        field: 'auditEntry', 
        message: 'Audit entry must be an object' 
      });
    }

    if (input.contract && input.contract.code) {
      // Security: prevent code injection
      const dangerousPatterns = [
        /require\(/,
        /import\(/,
        /eval\(/,
        /Function\(/,
        /process\./,
        /global\./,
        /__dirname/,
        /__filename/,
      ];

      const code = input.contract.code;
      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          errors.push({ 
            field: 'contract.code', 
            message: 'Contract code contains potentially dangerous patterns' 
          });
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this._sanitizeBlockchainInput(input),
    };
  }

  _sanitizeBlockchainInput(input) {
    return {
      auditEntry: typeof input.auditEntry === 'object' ? input.auditEntry : {},
      contract: {
        code: typeof input.contract?.code === 'string' 
          ? input.contract.code.slice(0, 10000) 
          : '',
        inputs: typeof input.contract?.inputs === 'object' 
          ? input.contract.inputs 
          : {},
      },
    };
  }

  // Generic string sanitization
  sanitizeString(str, maxLength = 1000) {
    if (typeof str !== 'string') return '';
    return str
      .slice(0, maxLength)
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .trim();
  }

  // Generic number validation
  validateNumber(value, min = -Infinity, max = Infinity, field = 'value') {
    const errors = [];
    const num = parseFloat(value);

    if (isNaN(num)) {
      errors.push({ field, message: 'Must be a valid number' });
    } else if (num < min || num > max) {
      errors.push({ 
        field, 
        message: `Must be between ${min} and ${max}` 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      value: errors.length === 0 ? num : null,
    };
  }

  // Generic array validation
  validateArray(arr, minLength = 0, maxLength = Infinity, field = 'array') {
    const errors = [];

    if (!Array.isArray(arr)) {
      errors.push({ field, message: 'Must be an array' });
      return { valid: false, errors, value: [] };
    }

    if (arr.length < minLength) {
      errors.push({ 
        field, 
        message: `Must have at least ${minLength} items` 
      });
    }

    if (arr.length > maxLength) {
      errors.push({ 
        field, 
        message: `Must have at most ${maxLength} items` 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      value: arr.slice(0, maxLength),
    };
  }
}

export default new InfiniteValidator();
