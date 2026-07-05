const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const subscriptionSchema = new mongoose.Schema({
  extensionId: {
    type: String,
    enum: ['ig-export', 'ig-unfollow', 'price-compare', 'ai-listing-writer'],
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free'
  },
  startDate: { type: Date },
  endDate: { type: Date },
  isActive: { type: Boolean, default: false },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
}, { _id: false });

const usageSchema = new mongoose.Schema({
  extensionId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  count: { type: Number, default: 0 }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  language: {
    type: String,
    enum: ['tr', 'en'],
    default: 'tr'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscriptions: [subscriptionSchema],
  dailyUsage: [usageSchema],
  isBlocked: { type: Boolean, default: false },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get subscription for a specific extension
userSchema.methods.getSubscription = function(extensionId) {
  return this.subscriptions.find(s => s.extensionId === extensionId) || null;
};

// Check if user has active premium for extension
userSchema.methods.isPremium = function(extensionId) {
  const sub = this.getSubscription(extensionId);
  if (!sub) return false;
  if (sub.plan !== 'premium' || !sub.isActive) return false;
  if (sub.endDate && new Date() > sub.endDate) return false;
  return true;
};

// Get daily usage count for extension
userSchema.methods.getDailyUsage = function(extensionId) {
  const today = new Date().toISOString().split('T')[0];
  const usage = this.dailyUsage.find(u => u.extensionId === extensionId && u.date === today);
  return usage ? usage.count : 0;
};

// Increment daily usage
userSchema.methods.incrementUsage = async function(extensionId) {
  const today = new Date().toISOString().split('T')[0];
  const usageIndex = this.dailyUsage.findIndex(u => u.extensionId === extensionId && u.date === today);

  if (usageIndex >= 0) {
    this.dailyUsage[usageIndex].count += 1;
  } else {
    this.dailyUsage.push({ extensionId, date: today, count: 1 });
  }

  // Clean old usage data (keep last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  this.dailyUsage = this.dailyUsage.filter(u => u.date >= weekAgoStr);

  await this.save();
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
