/**
 * Slim mirror of the shared backend's User model — same collection
 * ("users", via Mongoose's default pluralization of model name "User"),
 * same field shapes, so this service can read/write subscriptions and
 * usage directly without depending on the shared backend's HTTP API being
 * up to date. extensionId fields intentionally have no enum restriction
 * here (unlike the shared backend's copy) so this service never breaks
 * validation on documents that reference extensionIds it doesn't know about.
 */
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  extensionId: { type: String, required: true },
  plan: { type: String, enum: ['free', 'premium'], default: 'free' },
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
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, select: false },
  name: { type: String, trim: true, default: '' },
  language: { type: String, enum: ['tr', 'en'], default: 'tr' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscriptions: [subscriptionSchema],
  dailyUsage: [usageSchema],
  isBlocked: { type: Boolean, default: false },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

userSchema.methods.getSubscription = function(extensionId) {
  return this.subscriptions.find(s => s.extensionId === extensionId) || null;
};

userSchema.methods.isPremium = function(extensionId) {
  const sub = this.getSubscription(extensionId);
  if (!sub) return false;
  if (sub.plan !== 'premium' || !sub.isActive) return false;
  if (sub.endDate && new Date() > sub.endDate) return false;
  return true;
};

userSchema.methods.getDailyUsage = function(extensionId) {
  const today = new Date().toISOString().split('T')[0];
  const usage = this.dailyUsage.find(u => u.extensionId === extensionId && u.date === today);
  return usage ? usage.count : 0;
};

userSchema.methods.incrementUsage = async function(extensionId) {
  const today = new Date().toISOString().split('T')[0];
  const usageIndex = this.dailyUsage.findIndex(u => u.extensionId === extensionId && u.date === today);

  if (usageIndex >= 0) {
    this.dailyUsage[usageIndex].count += 1;
  } else {
    this.dailyUsage.push({ extensionId, date: today, count: 1 });
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  this.dailyUsage = this.dailyUsage.filter(u => u.date >= weekAgoStr);

  await this.save();
};

module.exports = mongoose.model('User', userSchema);
