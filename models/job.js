const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true },
    title: { type: String, required: true },
    details: { type: String, required: true },
    hourlyFee: { type: String },
    totalFee: { type: String, required: true },
    hours: { type: String, required: true },
    workDetails: { type: String },
    tasks: { type: String },
    category: { type: String }, 
    status: { type: String, default: 'open' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', JobSchema);