const express = require('express');
const router = express.Router();
const ExtensionSettings = require('../models/ExtensionSettings');
const config = require('../config');

// GET /api/listing-config
// Lets the standalone ai-listing-backend service fetch the Groq key pool +
// model the admin configured in the panel, without giving it (or anyone else)
// direct database access. Protected by a shared secret rather than user JWT
// since the caller is a service, not a logged-in user.
router.get('/', async (req, res, next) => {
  try {
    const provided = req.headers['x-service-key'];
    if (!config.listingConfigSecret || provided !== config.listingConfigSecret) {
      return res.status(401).json({ success: false, message: 'Invalid service key' });
    }

    const settings = await ExtensionSettings.findOne({ extensionId: 'ai-listing-writer' });

    res.json({
      success: true,
      data: {
        groqApiKeys: settings ? settings.groqApiKeys : [],
        groqModel: (settings && settings.groqModel) || 'llama-3.3-70b-versatile'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
