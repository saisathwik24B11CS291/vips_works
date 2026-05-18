const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema({
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true
    },
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employer",
        required: true
    },
    status: {
        type: String,
        enum: ["applied", "withdrawn", "accepted", "rejected", "completed"],
        default: "applied"
    },
    completedAt: {
        type: Date,
        default: null
    },
    workerSeen: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent duplicate applications per worker/job pair
JobApplicationSchema.index({ workerId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model("JobApplication", JobApplicationSchema);
