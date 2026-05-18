const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'worker' },
    phone: { type: String, default: '' },
    location: {
  type: String,
  default: ""
},
    profilePicture: { type: String, default: '' },
    bio: { type: String, default: '' },
    hourlyRate: { type: Number, default: 0 },
    experience: { type: String, default: '' },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    experienceLevel: { type: String, default: 'New' },
    jobHistory: [{
        title: { type: String, default: 'Job' },
        employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer' },
        sourceType: { type: String, enum: ['application', 'invite'], default: 'application' },
        sourceId: { type: mongoose.Schema.Types.ObjectId },
        completedAt: { type: Date, default: Date.now }
    }],
    categories: [{
        name: String, // e.g., "General Labour"
        tags: [String] // e.g., ["Cleaning", "Construction"]
    }],
    // Keep this for backward compatibility and search indexing
    mainCategory: { type: String }, 
    profession: [String],
    
    // --- WORK CATEGORIES & SUB-SKILLS ---
  
    // --- SOCIAL FEATURES ---
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
    
    //  FOLLOW REQUEST LOGIC
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }], 
    
    // History logs
    notifications: [{
        type: { type: String, default: 'follow' }, 
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
        date: { type: Date, default: Date.now },
        read: { type: Boolean, default: false }
    }],
    settings: {
        language: { type: String, default: 'en' }
    },
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
    loginProvider: { type: String, default: 'local' },
    // Portfolio projects (up to 10 media each)
    projects: [{
        title: { type: String, default: 'Project' },
        description: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
        media: [{
            url: String,
            type: { type: String, enum: ['image','video'], default: 'image' },
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
        }]
    }],
    
    lastSeen: { type: Date, default: Date.now }
});

// Using exports.models.Worker ensures we don't overwrite the model during hot-reloads
module.exports = mongoose.models.Worker || mongoose.model('Worker', workerSchema);
