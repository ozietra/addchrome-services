const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const ExtensionSettings = require('../models/ExtensionSettings');
const PriceSearch = require('../models/PriceSearch');
const { protect, adminOnly, generateToken } = require('../middleware/auth');
const config = require('../config');

// POST /api/admin/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check against env admin credentials or database admin
    if (email === config.admin.email && password === config.admin.password) {
      // Find or create admin user
      let admin = await User.findOne({ email, role: 'admin' });
      if (!admin) {
        admin = await User.create({
          email,
          password,
          name: 'Admin',
          role: 'admin'
        });
      }
      const token = generateToken(admin._id);
      return res.json({ success: true, data: { user: admin, token } });
    }

    // Try database login for admin users
    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const token = generateToken(user._id);
    res.json({ success: true, data: { user, token } });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', protect, adminOnly, async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const premiumUsers = await User.countDocuments({
      role: 'user',
      'subscriptions.plan': 'premium',
      'subscriptions.isActive': true
    });
    const totalPayments = await Payment.countDocuments({ status: 'completed' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Last 30 days registrations
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Users per extension
    const extensionStats = {};
    for (const extId of ['ig-export', 'ig-unfollow', 'price-compare', 'ai-listing-writer']) {
      const premium = await User.countDocuments({
        'subscriptions': {
          $elemMatch: { extensionId: extId, plan: 'premium', isActive: true }
        }
      });
      extensionStats[extId] = { premium };
    }

    // Recent payments (last 10)
    const recentPayments = await Payment.find({ status: 'completed' })
      .populate('userId', 'email name')
      .sort({ completedAt: -1 })
      .limit(10);

    // Recent registrations (last 10)
    const recentRegistrations = await User.find({ role: 'user' })
      .select('email name createdAt subscriptions')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          premiumUsers,
          totalPayments,
          totalRevenue: totalRevenue[0]?.total || 0,
          recentUsers
        },
        extensionStats,
        recentPayments,
        recentRegistrations
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users
router.get('/users', protect, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const extension = req.query.extension || '';
    const plan = req.query.plan || '';

    const filter = { role: 'user' };
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    if (extension && plan) {
      filter.subscriptions = {
        $elemMatch: { extensionId: extension, plan }
      };
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const payments = await Payment.find({ userId: user._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { user, payments }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, language, isBlocked, subscriptions } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (language !== undefined) updates.language = language;
    if (isBlocked !== undefined) updates.isBlocked = isBlocked;
    if (subscriptions !== undefined) updates.subscriptions = subscriptions;

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Also delete user's payments and search history
    await Payment.deleteMany({ userId: req.params.id });
    await PriceSearch.deleteMany({ userId: req.params.id });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/payments
router.get('/payments', protect, adminOnly, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'completed';
    const extension = req.query.extension || '';

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (extension) filter.extensionId = extension;

    const payments = await Payment.find(filter)
      .populate('userId', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(filter);

    // Revenue stats
    const revenueByExtension = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$extensionId', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        revenueByExtension
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/extensions
router.get('/extensions', protect, adminOnly, async (req, res, next) => {
  try {
    let settings = await ExtensionSettings.find();

    // Auto-create settings for any extension that doesn't have a document yet
    // (covers both a brand-new DB and an existing DB that predates this extension).
    const allDefaults = [
      {
        extensionId: 'ig-export',
        name: { en: 'Instagram Follower Export Tool', tr: 'Instagram Takipçi Dışa Aktarma Aracı' },
        premiumPriceMonthly: 49.99,
        premiumPriceYearly: 399.99,
        freeLimits: config.extensions['ig-export'].free
      },
      {
        extensionId: 'ig-unfollow',
        name: { en: 'Instagram Unfollow AI', tr: 'Instagram Takipten Çıkarma AI' },
        premiumPriceMonthly: 39.99,
        premiumPriceYearly: 299.99,
        freeLimits: config.extensions['ig-unfollow'].free
      },
      {
        extensionId: 'price-compare',
        name: { en: 'Price Compare - Smart Shopping Assistant', tr: 'Fiyat Karşılaştır - Akıllı Alışveriş Asistanı' },
        premiumPriceMonthly: 29.99,
        premiumPriceYearly: 249.99,
        freeLimits: config.extensions['price-compare'].free
      },
      {
        extensionId: 'ai-listing-writer',
        name: { en: 'AI Listing Writer', tr: 'AI İlan Yazarı' },
        premiumPriceMonthly: 29.99,
        premiumPriceYearly: 249.99,
        freeLimits: config.extensions['ai-listing-writer'].free
      }
    ];

    const existingIds = new Set(settings.map(s => s.extensionId));
    const missingDefaults = allDefaults.filter(d => !existingIds.has(d.extensionId));
    if (missingDefaults.length > 0) {
      const created = await ExtensionSettings.insertMany(missingDefaults);
      settings = settings.concat(created);
    }

    res.json({ success: true, data: { extensions: settings } });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/extensions/:extensionId
router.put('/extensions/:extensionId', protect, adminOnly, async (req, res, next) => {
  try {
    const { extensionId } = req.params;

    // Whitelist + sanitize the editable fields so a bad payload can't corrupt
    // the document or throw a validation error.
    const { name, vposLink, premiumPriceMonthly, premiumPriceYearly, isActive, groqApiKeys, groqModel } = req.body;
    const updates = {};
    if (name && (name.tr || name.en)) {
      updates.name = { tr: String(name.tr || '').trim(), en: String(name.en || '').trim() };
    }
    if (vposLink !== undefined) updates.vposLink = String(vposLink || '').trim();
    if (premiumPriceMonthly !== undefined) {
      const v = Number(premiumPriceMonthly);
      updates.premiumPriceMonthly = Number.isFinite(v) && v >= 0 ? v : 0;
    }
    if (premiumPriceYearly !== undefined) {
      const v = Number(premiumPriceYearly);
      updates.premiumPriceYearly = Number.isFinite(v) && v >= 0 ? v : 0;
    }
    if (isActive !== undefined) updates.isActive = !!isActive;
    if (groqApiKeys !== undefined) {
      const list = Array.isArray(groqApiKeys) ? groqApiKeys : String(groqApiKeys || '').split(/[\n,]/);
      updates.groqApiKeys = [...new Set(list.map(k => String(k || '').trim()).filter(Boolean))].slice(0, 20);
    }
    if (groqModel !== undefined) updates.groqModel = String(groqModel || '').trim();

    const settings = await ExtensionSettings.findOneAndUpdate(
      { extensionId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!settings) {
      return res.status(404).json({ success: false, message: 'Extension not found' });
    }

    res.json({ success: true, data: { extension: settings } });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/stats/:extensionId
router.get('/stats/:extensionId', protect, adminOnly, async (req, res, next) => {
  try {
    const { extensionId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Daily registrations
    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          role: 'user',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily revenue
    const dailyRevenue = await Payment.aggregate([
      {
        $match: {
          extensionId,
          status: 'completed',
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        extensionId,
        period: `${days} days`,
        dailyRegistrations,
        dailyRevenue
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
