const express = require('express');
const router = express.Router();
const listingContentService = require('../services/ListingContentService');
const { getCategories, getTypes, getTypeById } = require('../data/listingTypes');
const { protect } = require('../middleware/auth');
const config = require('../config');

const EXTENSION_ID = 'ai-listing-writer';

// GET /api/listing/types - Get supported categories + content types (public)
router.get('/types', (req, res) => {
  res.json({ success: true, data: { categories: getCategories(), types: getTypes() } });
});

// POST /api/listing/generate - Generate an AI title + description for a listing type
router.post('/generate', protect, async (req, res, next) => {
  try {
    const { type, subject, details, city, referenceId, tone, outputLanguage } = req.body;

    if (!type || !getTypeById(type)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing listing type' });
    }
    if (!subject || !subject.trim() || !details || !details.trim()) {
      return res.status(400).json({ success: false, message: 'subject and details are required' });
    }

    const isPremium = req.user.isPremium(EXTENSION_ID);
    const dailyUsage = req.user.getDailyUsage(EXTENSION_ID);

    if (!isPremium && dailyUsage >= config.freeDailyGenerations) {
      return res.status(429).json({
        success: false,
        message: 'Daily generation limit reached. Upgrade to premium for unlimited access.',
        data: { dailyUsage, limit: config.freeDailyGenerations }
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

    await req.user.incrementUsage(EXTENSION_ID);

    res.json({
      success: true,
      data: {
        title: result.title,
        description: result.description,
        type,
        isPremium,
        dailyUsage: dailyUsage + 1
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
