const mongoose = require('mongoose');

const PendingSignupSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    role: { type: String, enum: ['worker', 'employer'], required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: '' },
    businessCategory: { type: String, default: 'General Business' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.models.PendingSignup || mongoose.model('PendingSignup', PendingSignupSchema);
