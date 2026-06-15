const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, generateToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, language } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      email,
      password,
      name: name || '',
      language: language || 'tr',
      subscriptions: [
        { extensionId: 'ig-export', plan: 'free', isActive: true },
        { extensionId: 'ig-unfollow', plan: 'free', isActive: true },
        { extensionId: 'price-compare', plan: 'free', isActive: true }
      ]
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account is blocked' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

// PUT /api/auth/profile
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { name, language } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (language !== undefined) updates.language = language;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/password
router.put('/password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
