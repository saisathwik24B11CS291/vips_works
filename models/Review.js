const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    inviteId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobInvite', default: null },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', default: null },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    revieweeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reviewerRole: { type: String, enum: ['worker', 'employer'], required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
    sourceType: { type: String, enum: ['application', 'invite'], required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true });

ReviewSchema.index(
    { reviewerId: 1, revieweeId: 1, sourceType: 1, sourceId: 1 },
    { unique: true }
);

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
