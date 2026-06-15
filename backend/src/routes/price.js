const express = require('express');
const router = express.Router();
const PriceSearch = require('../models/PriceSearch');
const priceSearchService = require('../services/PriceSearchService');
const { protect, checkPremium } = require('../middleware/auth');
const config = require('../config');

// GET /api/price/sites - Get supported sites
router.get('/sites', (req, res) => {
  const sites = priceSearchService.getSupportedSites();
  res.json({ success: true, data: { sites } });
});

// POST /api/price/search - Search for prices
router.post('/search', protect, checkPremium('price-compare'), async (req, res, next) => {
  try {
    const { query, sites } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    // Check usage limits for free users
    const dailyUsage = req.user.getDailyUsage('price-compare');
    const limits = req.isPremium
      ? config.extensions['price-compare'].premium
      : config.extensions['price-compare'].free;

    if (!req.isPremium && limits.dailySearches !== -1 && dailyUsage >= limits.dailySearches) {
      return res.status(429).json({
        success: false,
        message: 'Daily search limit reached. Upgrade to premium for unlimited searches.',
        data: { dailyUsage, limit: limits.dailySearches }
      });
    }

    // Use the sites the user selected; keep only ones we support.
    const supported = priceSearchService.getSupportedSites().map(s => s.id);
    let selectedSites = Array.isArray(sites) ? sites.filter(s => supported.includes(s)) : [];

    // Enforce the free-tier cap on number of sites (config: maxSites; -1 = unlimited)
    if (!req.isPremium && limits.maxSites !== -1 && selectedSites.length > limits.maxSites) {
      selectedSites = selectedSites.slice(0, limits.maxSites);
    }

    const maxResults = req.isPremium ? (limits.maxResults || 50) : (limits.maxResults || 20);

    // Perform search (PriceSearchService falls back to default sites if none given)
    // Pass { debug: true } in the request body to dump each site's rendered HTML
    // to backend/debug/<site>.html for selector tuning.
    const searchResult = await priceSearchService.search(query.trim(), selectedSites, {
      maxResults,
      debug: req.body.debug === true
    });

    // Save search history
    const priceSearch = await PriceSearch.create({
      userId: req.user._id,
      query: query.trim(),
      selectedSites: searchResult.sites,
      results: searchResult.results,
      totalResults: searchResult.totalResults,
      searchDuration: searchResult.duration
    });

    // Increment usage
    await req.user.incrementUsage('price-compare');

    res.json({
      success: true,
      data: {
        searchId: priceSearch._id,
        query: query.trim(),
        results: searchResult.results,
        totalResults: searchResult.totalResults,
        duration: searchResult.duration,
        sites: searchResult.sites,
        isPremium: req.isPremium
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/price/history - Get search history (premium only)
router.get('/history', protect, checkPremium('price-compare'), async (req, res, next) => {
  try {
    if (!req.isPremium) {
      return res.status(403).json({ success: false, message: 'Premium required for search history' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const searches = await PriceSearch.find({ userId: req.user._id })
      .select('query selectedSites totalResults searchDuration createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PriceSearch.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        searches,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/price/history/:id - Get specific search result
router.get('/history/:id', protect, async (req, res, next) => {
  try {
    const search = await PriceSearch.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!search) {
      return res.status(404).json({ success: false, message: 'Search not found' });
    }

    res.json({ success: true, data: { search } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
