const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');
const ExtensionSettings = require('../models/ExtensionSettings');
const { protect } = require('../middleware/auth');
const config = require('../config');

// GET /api/payment/link/:extensionId - Get payment link for extension
router.get('/link/:extensionId', protect, async (req, res, next) => {
  try {
    const { extensionId } = req.params;
    const { plan } = req.query; // monthly or yearly

    const extSettings = await ExtensionSettings.findOne({ extensionId });
    if (!extSettings) {
      return res.status(404).json({ success: false, message: 'Extension not found' });
    }

    const amount = plan === 'yearly'
      ? extSettings.premiumPriceYearly
      : extSettings.premiumPriceMonthly;

    const planDuration = plan === 'yearly' ? 365 : 30;

    // Clean up any existing pending payments for this user/extension to avoid clutter
    await Payment.deleteMany({
      userId: req.user._id,
      extensionId,
      status: 'pending'
    });

    // Create pending payment record
    const merchantOid = Payment.generateMerchantOid();
    const payment = await Payment.create({
      userId: req.user._id,
      extensionId,
      amount,
      currency: extSettings.premiumCurrency || 'TRY',
      status: 'pending',
      merchantOid,
      planDuration
    });

    // Generate PayTR iframe token
    const paytrToken = generatePayTRToken({
      merchantOid,
      amount: Math.round(amount * 100), // PayTR expects kuruş/cents
      userEmail: req.user.email,
      userName: req.user.name || req.user.email.split('@')[0],
      userIp: req.ip || '127.0.0.1'
    });

    // If PayTR credentials are not set, return manual payment info
    if (!config.paytr.merchantId) {
      return res.json({
        success: true,
        data: {
          paymentId: payment._id,
          merchantOid,
          amount,
          currency: extSettings.premiumCurrency || 'TRY',
          vposLink: extSettings.vposLink || '',
          message: 'PayTR credentials not configured. Use vposLink for manual payment or configure PayTR.'
        }
      });
    }

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        merchantOid,
        paytrToken,
        amount,
        currency: extSettings.premiumCurrency || 'TRY'
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payment/webhook - PayTR callback
router.post('/webhook', async (req, res, next) => {
  try {
    const {
      merchant_oid,
      status,
      total_amount,
      hash
    } = req.body;

    // Verify PayTR hash
    const hashStr = config.paytr.merchantKey +
      merchant_oid +
      config.paytr.merchantSalt +
      status +
      total_amount;
    const expectedHash = crypto.createHmac('sha256', config.paytr.merchantKey)
      .update(hashStr)
      .digest('base64');

    // Skip hash verification in development if PayTR not configured
    if (config.paytr.merchantId && hash !== expectedHash) {
      return res.status(400).send('PAYTR notification: hash mismatch');
    }

    const payment = await Payment.findOne({ merchantOid: merchant_oid });
    if (!payment) {
      return res.status(404).send('PAYTR notification: payment not found');
    }

    if (status === 'success') {
      payment.status = 'completed';
      payment.completedAt = new Date();
      await payment.save();

      // Activate subscription
      const user = await User.findById(payment.userId);
      if (user) {
        const subIndex = user.subscriptions.findIndex(s => s.extensionId === payment.extensionId);
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + payment.planDuration);

        const subData = {
          extensionId: payment.extensionId,
          plan: 'premium',
          startDate,
          endDate,
          isActive: true,
          paymentId: payment._id
        };

        if (subIndex >= 0) {
          user.subscriptions[subIndex] = subData;
        } else {
          user.subscriptions.push(subData);
        }

        await user.save();
      }
    } else {
      payment.status = 'failed';
      await payment.save();
    }

    // PayTR expects "OK" response
    res.send('OK');
  } catch (error) {
    console.error('[PayTR Webhook Error]', error);
    res.status(500).send('ERROR');
  }
});

// POST /api/payment/manual-activate (Admin or testing)
router.post('/manual-activate', protect, async (req, res, next) => {
  try {
    const { extensionId, durationDays } = req.body;

    if (!extensionId) {
      return res.status(400).json({ success: false, message: 'extensionId is required' });
    }

    const duration = durationDays || 30;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    const user = await User.findById(req.user._id);
    const subIndex = user.subscriptions.findIndex(s => s.extensionId === extensionId);

    const subData = {
      extensionId,
      plan: 'premium',
      startDate,
      endDate,
      isActive: true
    };

    if (subIndex >= 0) {
      user.subscriptions[subIndex] = subData;
    } else {
      user.subscriptions.push(subData);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Subscription activated',
      data: { subscription: subData }
    });
  } catch (error) {
    next(error);
  }
});

// Helper: Generate PayTR token
function generatePayTRToken({ merchantOid, amount, userEmail, userName, userIp }) {
  if (!config.paytr.merchantId) return null;

  const merchantId = config.paytr.merchantId;
  const merchantKey = config.paytr.merchantKey;
  const merchantSalt = config.paytr.merchantSalt;

  const basketJson = Buffer.from(JSON.stringify([
    ['Premium Subscription', amount / 100, 1]
  ])).toString('base64');

  const hashStr = [
    merchantId, userIp, merchantOid, userEmail,
    amount, 'TL', 'no_installment', 'payment',
    0, config.paytr.okUrl, config.paytr.failUrl,
    basketJson, merchantSalt
  ].join('');

  const token = crypto.createHmac('sha256', merchantKey)
    .update(hashStr)
    .digest('base64');

  return token;
}

module.exports = router;
