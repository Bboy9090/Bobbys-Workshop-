/**
 * ♾️ Infinite Legendary - Time-Series Forecasting API (Production-Grade)
 */

import express from 'express';
import timeSeriesForecast from '../../../utils/infinite/time-series-forecast.js';
import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';

const router = express.Router();

// Apply resource management to all routes
router.use(manageInfiniteResources);

/**
 * POST /api/v1/infinite/forecast/lstm
 * LSTM forecasting - Production-Grade
 */
router.post('/lstm',
  validateInfiniteFeature('forecast'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { series, steps = 10, lookback = 10 } = req.body;
      
      const forecast = await timeSeriesForecast.lstmForecast(series, steps, lookback);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'lstm_forecast',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...forecast,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'forecast',
        operation: 'lstm_forecast',
      });

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'lstm_forecast',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/forecast/transformer
 * Transformer forecasting - Production-Grade
 */
router.post('/transformer',
  validateInfiniteFeature('forecast'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { series, steps = 10, attentionWindow = 20 } = req.body;
      
      const forecast = await timeSeriesForecast.transformerForecast(series, steps, attentionWindow);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'transformer_forecast',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...forecast,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'forecast',
        operation: 'transformer_forecast',
      });

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'transformer_forecast',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/forecast/ensemble
 * Ensemble forecasting - Production-Grade
 */
router.post('/ensemble',
  validateInfiniteFeature('forecast'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { series, steps = 10 } = req.body;
      
      const forecast = await timeSeriesForecast.ensembleForecast(series, steps);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'ensemble_forecast',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...forecast,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'forecast',
        operation: 'ensemble_forecast',
      });

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'ensemble_forecast',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/forecast/multi-step
 * Multi-step ahead forecasting - Production-Grade
 */
router.post('/multi-step',
  validateInfiniteFeature('forecast'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { series, steps = [1, 7, 30], method = 'ensemble' } = req.body;
      
      // Validate method
      const validMethods = ['lstm', 'transformer', 'ensemble'];
      const validatedMethod = validMethods.includes(method) ? method : 'ensemble';
      
      // Validate steps array
      const validatedSteps = Array.isArray(steps) 
        ? steps.filter(s => Number.isInteger(s) && s > 0 && s <= 1000).slice(0, 10)
        : [1, 7, 30];
      
      if (validatedSteps.length === 0) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'multi_step_forecast',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Steps must be an array of positive integers',
          },
        });
      }
      
      const forecast = await timeSeriesForecast.multiStepForecast(series, validatedSteps, validatedMethod);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'multi_step_forecast',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...forecast,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'forecast',
        operation: 'multi_step_forecast',
      });

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'multi_step_forecast',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/forecast/uncertainty
 * Forecast with uncertainty quantification - Production-Grade
 */
router.post('/uncertainty',
  validateInfiniteFeature('forecast'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { series, steps = 10, confidenceLevel = 0.95 } = req.body;
      
      // Validate confidence level
      const validatedConfidence = Math.max(0.5, Math.min(0.99, 
        parseFloat(confidenceLevel) || 0.95));
      
      const forecast = await timeSeriesForecast.forecastWithUncertainty(
        series, 
        steps, 
        validatedConfidence
      );
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'forecast_uncertainty',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...forecast,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'forecast',
        operation: 'forecast_uncertainty',
      });

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'forecast_uncertainty',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

export default router;
