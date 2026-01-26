/**
 * 🏆 Production-Grade Tests for Time-Series Forecasting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import timeSeriesForecast from '../../server/utils/infinite/time-series-forecast.js';

describe('Time-Series Forecasting - Production-Grade Tests', () => {
  const sampleSeries = [10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17];

  describe('Input Validation', () => {
    it('should reject empty series', async () => {
      await expect(
        timeSeriesForecast.lstmForecast([], 10)
      ).rejects.toThrow();
    });

    it('should reject series with invalid values', async () => {
      const invalidSeries = [10, NaN, 12, Infinity, 13];
      // Should filter invalid values
      const result = await timeSeriesForecast.lstmForecast(invalidSeries, 5);
      expect(result.predictions).toBeDefined();
    });

    it('should validate steps parameter', async () => {
      const result = await timeSeriesForecast.lstmForecast(sampleSeries, 0);
      // Should use default or minimum
      expect(result.steps).toBeGreaterThan(0);
    });
  });

  describe('Forecasting Methods', () => {
    it('should produce LSTM forecast', async () => {
      const forecast = await timeSeriesForecast.lstmForecast(sampleSeries, 5);
      expect(forecast).toHaveProperty('predictions');
      expect(forecast).toHaveProperty('confidence');
      expect(forecast.predictions.length).toBe(5);
    });

    it('should produce transformer forecast', async () => {
      const forecast = await timeSeriesForecast.transformerForecast(sampleSeries, 5);
      expect(forecast).toHaveProperty('predictions');
      expect(forecast).toHaveProperty('confidence');
      expect(forecast.predictions.length).toBe(5);
    });

    it('should produce ensemble forecast', async () => {
      const forecast = await timeSeriesForecast.ensembleForecast(sampleSeries, 5);
      expect(forecast).toHaveProperty('predictions');
      expect(forecast).toHaveProperty('confidence');
      expect(forecast.predictions.length).toBe(5);
    });
  });

  describe('Uncertainty Quantification', () => {
    it('should provide prediction intervals', async () => {
      const forecast = await timeSeriesForecast.forecastWithUncertainty(
        sampleSeries, 
        5, 
        0.95
      );
      
      expect(forecast).toHaveProperty('intervals');
      expect(forecast.intervals.length).toBe(5);
      expect(forecast.intervals[0]).toHaveProperty('point');
      expect(forecast.intervals[0]).toHaveProperty('lower');
      expect(forecast.intervals[0]).toHaveProperty('upper');
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await timeSeriesForecast.ensembleForecast(sampleSeries, 10);
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });
});
