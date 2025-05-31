const Stripe = require('stripe');
const mongoose = require('mongoose');
const httpStatus = require('http-status');

// Import models
const StripePaymentGateway = require('../models/payment.model');
const User = require('../models/user.models');
const supscriptionModel = require('../models/supscription.model');

/**
 * Configuration setup for Stripe integration
 */
const config = {
  stripe_payment_gateway: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    onboarding_refresh_url: process.env.ONBOARDING_REFRESH_URL || 'http://localhost:8080/refresh',
    onboarding_return_url: process.env.ONBOARDING_RETURN_URL || 'http://localhost:8080/return',
    checkout_success_url: process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:8080/success',
    checkout_cancel_url: process.env.CHECKOUT_CANCEL_URL || 'http://localhost:8080/cancel'
  }
};

// Create Stripe instance
const stripe = new Stripe(config.stripe_payment_gateway.stripe_secret_key);

/**
 * API Error class for consistent error handling
 */
class ApiError extends Error {
  constructor(statusCode, message, stack = '') {
    super(message);
    this.statusCode = statusCode;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Constants for user status
 */
const USER_STATUS = {
  PROGRESS: 'progress',
  PENDING: 'pending',
  BLOCKED: 'blocked'
};

/**
 * Creates a connected Stripe account and onboarding link for a user
 * @param {Object} userData - User data containing id
 * @returns {Promise<string>} - URL for onboarding
 */
async function createConnectedAccountAndOnboardingLink(userData) {
  try {
    console.log('userData:', userData);
    const user = await User.findOne({
      _id: userData._id,
      status: USER_STATUS.PROGRESS
    }).select('_id stripeAccountId email');

    if (!user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'This user is restricted due to some issues'
      );
    }

    // If user already has a Stripe account, create a new onboarding link
    if (user.stripeAccountId) {
      const onboardingLink = await stripe.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${config.stripe_payment_gateway.onboarding_refresh_url}?accountId=${user.stripeAccountId}`,
        return_url: config.stripe_payment_gateway.onboarding_return_url,
        type: 'account_onboarding',
      });
      return onboardingLink.url;
    }

    // Create a new connected account
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      country: 'US',
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
    });


    // Update user with Stripe account ID
    await User.findByIdAndUpdate(user._id, { stripeAccountId: account.id });

    const onboardingLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${config.stripe_payment_gateway.onboarding_refresh_url}?accountId=${account.id}`,
      return_url: config.stripe_payment_gateway.onboarding_return_url,
      type: 'account_onboarding',
    });

    return onboardingLink.url;
  } catch (error) {
    console.log(error);
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Failed to create connected account and onboarding link'
    );
  }
}

/**
 * Updates the onboarding link for an existing user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Object containing link URL
 */
async function updateOnboardingLink(userId) {
  try {
    const user = await User.findOne({
      _id: userId,
      status: USER_STATUS.PROGRESS
    }).select('_id stripeAccountId');

    if (!user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'This user is restricted due to some issues'
      );
    }

    if (!user.stripeAccountId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'User does not have a Stripe account'
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: `${config.stripe_payment_gateway.onboarding_refresh_url}?accountId=${user.stripeAccountId}`,
      return_url: config.stripe_payment_gateway.onboarding_return_url,
      type: 'account_onboarding',
    });

    return { link: accountLink.url };
  } catch (error) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Failed to update onboarding link'
    );
  }
}

/**
 * Creates a payment intent for a transaction
 * @param {string} userId - User ID
 * @param {Object} paymentDetails - Payment details including price, and description
 * @returns {Promise<Object>} - Payment intent details
 */
async function createPaymentIntent(userId, paymentDetails) {
  try {
    const {
      price,
      description = 'Service payment',
      planValidity,
    } = paymentDetails;

    if (!price || price <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Price must be a positive number'
      );
    }

    // Admin Stripe Account ID (hardcoded or from env)
    const adminStripeAccountId = process.env.ADMIN_STRIPE_ACCOUNT_ID;

    if (!adminStripeAccountId) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Admin Stripe account is not configured'
      );
    }

    const amountInCents = Math.round(price * 100);

    console.log(userId, planValidity);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description,
      metadata: {
        userId: userId,
        planValidity: planValidity,
      },
      application_fee_amount: Math.round(amountInCents * 0.05), // 5% platform fee
      transfer_data: {
        destination: adminStripeAccountId,
      },
    });

    const paymentGatewayData = {
      userId,
      price,
      description,
      planValidity,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      isPayment: true,
    };

    const result = await StripePaymentGateway.create(paymentGatewayData);

    if (!result) {
      throw new ApiError(
        httpStatus.NOT_ACCEPTABLE,
        'Issues with payment gateway system'
      );
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      `Payment service unavailable: ${error.message || 'Unknown error'}`
    );
  }
}


/**
 * Retrieves the status of a payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} - Payment status information
 */
async function retrievePaymentStatus(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100, // Convert back to dollars
      metadata: paymentIntent.metadata,
      created: new Date(paymentIntent.created * 1000).toISOString(),
    };
  } catch (error) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'Could not retrieve payment information'
    );
  }
}

/**
 * Creates a checkout session for a payment
 * @param {string} userId - User ID
 * @param {Object} paymentDetails - Payment details including price and description
 * @returns {Promise<Object>} - Checkout session details
 */
async function createCheckoutSession(userId, paymentDetails) {
  try {
    const {
      price,
      description = 'Truck rental payment',
      planValidity,
    } = paymentDetails;

    if (!price || price <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Price must be a positive number'
      );
    }

    const user = await User.findOne({
      _id: userId,
      status: USER_STATUS.PROGRESS
    }).select('stripeAccountId email');

    if (!user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'User not found or not verified'
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Service Payment',
              description: description,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        planValidity,
      },
      mode: 'payment',
      success_url: `${config.stripe_payment_gateway.checkout_success_url}?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: config.stripe_payment_gateway.checkout_cancel_url,
    });

    const paymentData = {
      currency: session.currency,
      sessionId: session.id,
      userId: session.metadata.userId,
      planValidity: session.metadata.planValidity,
      paymentMethod: session.payment_method_types[0],
      paymentStatus: session.payment_status,
      price: paymentDetails.price,
      description: paymentDetails.description,
    };

    const paymentResult = await StripePaymentGateway.create(paymentData);

    if (!paymentResult) {
      throw new ApiError(
        httpStatus.NOT_IMPLEMENTED,
        'Issues with stripe checkout session'
      );
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      `Checkout service unavailable: ${error.message || 'Unknown error'}`
    );
  }
}


/**
 * Handles webhook events from Stripe
 * @param {Object} event - Stripe webhook event
 * @returns {Promise<Object>} - Result of webhook processing
 */
async function handleWebhook(event) {
  let result = {
    status: false,
    message: 'Unhandled event',
  };

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        if (!paymentIntent.id) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Issues with payment intent ID: ${paymentIntent.id}`
          );
        }

        // Handle successful payment
        // You could add additional logic here to update order status, etc.

        result = {
          status: true,
          message: 'Payment Successful',
        };
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        if (!account.id) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Issues with account ID: ${account.id} update`
          );
        }

        // You could update user details based on stripe account update here

        result = {
          status: true,
          message: 'Account updated',
        };
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;

        if (!session) {
          throw new ApiError(
            httpStatus.NO_CONTENT,
            'Issues with checkout session completion'
          );
        }

        // First, record the payment details
        const recordedPayment = await StripePaymentGateway.findOneAndUpdate(
          {
            userId: session.metadata.userId,
            sessionId: session.id,
          },
          {
            $set: {
              currency: session.currency,
              paymentMethod: session.payment_method_types[0],
              paymentStatus: session.payment_status,
              price: session.amount_total / 100, // Convert back to dollars
              description: session.description,
              planValidity: session.metadata.planValidity,
              payableName: session.customer_details?.name,
              payableEmail: session.customer_details?.email,
              paymentIntent: session.payment_intent,
              paymentIntentId: session.payment_intent,
              clientSecret: session.client_secret,
              isPayment: true,
              country: session.customer_details?.address?.country,
            },
          },
          { new: true, upsert: true }
        );

        if (!recordedPayment) {
          throw new ApiError(
            httpStatus.NOT_IMPLEMENTED,
            'Issues with recording payment information'
          );
        }

        const updatedUser = await supscriptionModel.findOneAndUpdate(
          { user: session.metadata.userId },
          {
            $set: {
              planType: 'Premium',
              isActive: true,
              mockTestLimit: -1,
              aiScoringLimit: -1,
              sectionalMockTestLimit: -1,
              cyoMockTestLimit: -1,
              templates: -1,
              studyPlan: 'authorized',
              performanceProgressDetailed: 'authorized',
              startedAt: new Date(),
              expiresAt: new Date(Date.now() + parseInt(session.metadata.planValidity) * 24 * 60 * 60 * 1000),
              paymentInfo: {
                transactionId: session.payment_intent,
                provider: 'stripe',
                amount: session.amount_total / 100,
                currency: session.currency,
              },
            },
          },
          { new: true }
        );

        if (!updatedUser) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `User with ID ${session.metadata.userId} not found or subscription update failed`
          );
        }

        console.log('Subscription updated successfully:', updatedUser.planType);

        result = {
          status: true,
          message: 'Session data and subscription successfully updated',
        };
        break;
      }

      default: {
        console.log(`Unhandled event type ${event.type}`);
        break;
      }
    }

    return result;
  } catch (error) {
    console.error('Webhook handling error:', error);
    throw error;
  }
}
module.exports = {
  createConnectedAccountAndOnboardingLink,
  updateOnboardingLink,
  createPaymentIntent,
  retrievePaymentStatus,
  createCheckoutSession,
  handleWebhook
};