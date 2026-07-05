const express = require('express');
const router = express.Router();
const listingContentService = require('../services/ListingContentService');
const subscriptionProxy = require('../services/SubscriptionProxy');
const { getCategories, getTypes, getTypeById } = require('../data/listingTypes');

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  return null;
}

// GET /api/listing/types - Get supported categories + content types (public)
router.get('/types', (req, res) => {
  res.json({ success: true, data: { categories: getCategories(), types: getTypes() } });
});

// POST /api/listing/generate - Generate an AI title + description for a listing type
router.post('/generate', async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { type, subject, details, city, referenceId, tone, outputLanguage } = req.body;

    if (!type || !getTypeById(type)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing listing type' });
    }
    if (!subject || !subject.trim() || !details || !details.trim()) {
      return res.status(400).json({ success: false, message: 'subject and details are required' });
    }

    // Ask the shared backend whether this user is premium / how much free
    // quota they have left today — that backend owns the User data, not us.
    let status;
    try {
      status = await subscriptionProxy.getStatus(token);
    } catch (proxyError) {
      return res.status(proxyError.statusCode || 502).json({
        success: false,
        message: proxyError.statusCode === 401
          ? 'Invalid or expired session'
          : 'Could not verify your subscription right now. Please try again.'
      });
    }

    const limits = status.limits;
    if (!status.isPremium && limits.dailyGenerations !== -1 && status.dailyUsage >= limits.dailyGenerations) {
      return res.status(429).json({
        success: false,
        message: 'Daily generation limit reached. Upgrade to premium for unlimited access.',
        data: { dailyUsage: status.dailyUsage, limit: limits.dailyGenerations }
      });
    }

    let result;
    try {
      result = await listingContentService.generate(type, {
        subject: subject.trim(),
        details: details.trim(),
        city: (city || '').trim(),
        referenceId: (referenceId || '').trim(),
        tone: tone || 'professional',
        outputLanguage: outputLanguage === 'tr' ? 'tr' : 'en'
      });
    } catch (aiError) {
      console.error('[Listing/Generate] AI generation failed:', aiError.message);
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please try again in a moment.'
      });
    }

    // Record usage on the shared backend (source of truth). Non-fatal: the
    // user still gets their generated content even if this bookkeeping call
    // fails — worst case they get one extra free generation that day.
    try {
      await subscriptionProxy.markUsage(token);
    } catch (usageError) {
      console.warn('[Listing/Generate] usage tracking failed:', usageError.message);
    }

    res.json({
      success: true,
      data: {
        title: result.title,
        description: result.description,
        type,
        isPremium: status.isPremium,
        dailyUsage: status.dailyUsage + 1
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
