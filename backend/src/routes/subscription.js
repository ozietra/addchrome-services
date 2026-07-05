const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const config = require('../config');

// GET /api/subscription/status/:extensionId
router.get('/status/:extensionId', protect, async (req, res) => {
  const { extensionId } = req.params;
  const validExtensions = ['ig-export', 'ig-unfollow', 'price-compare', 'ai-listing-writer'];

  if (!validExtensions.includes(extensionId)) {
    return res.status(400).json({ success: false, message: 'Invalid extension ID' });
  }

  const subscription = req.user.getSubscription(extensionId);
  const isPremium = req.user.isPremium(extensionId);
  const dailyUsage = req.user.getDailyUsage(extensionId);

  const extConfig = config.extensions[extensionId];
  const limits = isPremium ? extConfig.premium : extConfig.free;

  res.json({
    success: true,
    data: {
      extensionId,
      subscription: subscription || { plan: 'free', isActive: true },
      isPremium,
      dailyUsage,
      limits
    }
  });
});

// POST /api/subscription/use/:extensionId - Track usage
router.post('/use/:extensionId', protect, async (req, res, next) => {
  try {
    const { extensionId } = req.params;
    const isPremium = req.user.isPremium(extensionId);
    const dailyUsage = req.user.getDailyUsage(extensionId);
    const extConfig = config.extensions[extensionId];

    if (!isPremium) {
      const limits = extConfig.free;
      let limitKey;

      switch (extensionId) {
        case 'ig-export':
          limitKey = 'dailyExports';
          break;
        case 'ig-unfollow':
          limitKey = 'dailyScans';
          break;
        case 'price-compare':
          limitKey = 'dailySearches';
          break;
        case 'ai-listing-writer':
          limitKey = 'dailyGenerations';
          break;
      }

      if (limits[limitKey] !== -1 && dailyUsage >= limits[limitKey]) {
        return res.status(429).json({
          success: false,
          message: 'Daily limit reached. Upgrade to premium for unlimited access.',
          data: { dailyUsage, limit: limits[limitKey] }
        });
      }
    }

    await req.user.incrementUsage(extensionId);

    res.json({
      success: true,
      data: { dailyUsage: dailyUsage + 1 }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
