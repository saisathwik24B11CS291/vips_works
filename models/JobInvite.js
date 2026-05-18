const mongoose = require("mongoose");

const JobInviteSchema = new mongoose.Schema({
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employer",
        required: true
    },
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        required: true
    },
    jobTitle: {
        type: String,
        required: true
    },
    jobLocation: {
        type: String,
        required: true
    },
    // snapshot of worker location at time of invite
    workerLocationAtInvite: {
        type: String
    },
    message: {
        type: String
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "completed"],
        default: "pending"
    },
    completedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent duplicate invites for the same worker + job + employer
JobInviteSchema.index(
    { employerId: 1, workerId: 1, jobTitle: 1 },
    { unique: true }
);

module.exports = mongoose.model("JobInvite", JobInviteSchema);
