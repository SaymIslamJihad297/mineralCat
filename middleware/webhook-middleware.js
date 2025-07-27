/**
 * Middleware to ensure webhook routes get raw body while other routes get parsed JSON
 * This prevents body parsing middleware from interfering with webhook signature verification
 */

const express = require('express');

/**
 * Creates conditional body parsing middleware
 * - Uses raw body for webhook endpoints (required for Stripe signature verification)
 * - Uses JSON parsing for all other endpoints
 */
function createConditionalBodyParser() {
  return (req, res, next) => {
    // Check if this is a webhook endpoint
    if (req.path.includes('/webhook')) {
      // Use raw body parser for webhooks
      return express.raw({ type: 'application/json' })(req, res, next);
    } else {
      // Use JSON parser for all other routes
      return express.json({ limit: '10mb' })(req, res, next);
    }
  };
}

/**
 * Alternative approach: Skip body parsing entirely for webhook routes
 */
function skipWebhookBodyParsing() {
  return (req, res, next) => {
    // Skip body parsing for webhook routes
    if (req.path.includes('/webhook')) {
      return next();
    }
    // Apply JSON parsing for non-webhook routes
    return express.json({ limit: '10mb' })(req, res, next);
  };
}

module.exports = {
  createConditionalBodyParser,
  skipWebhookBodyParsing
};