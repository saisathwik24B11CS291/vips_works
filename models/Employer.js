const mongoose = require('mongoose');

const EmployerSchema = new mongoose.Schema({
    // --- Authentication Fields ---
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'employer' },
    companyName: { type: String },
    
    // --- MODIFIED: Unified Category Field ---
    // This field stores the selection (e.g., Construction) from your signup form
    mainCategory: { type: String, default: 'General Business' },

    // --- Profile Fields ---
    // REMOVED 'category: String' to prevent the "Corporation" fallback issue
    bio: String,
    location: { type: String, default: 'Not set' },
    phone: String,
    profilePicture: { type: String, default: '' },
    
    // --- Social & Privacy ---
   followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Employers can follow too
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }], 
    
    notifications: [{
        type: { type: String }, 
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }, 
        date: { type: Date, default: Date.now },
        read: { type: Boolean, default: false }
    }],

    // --- Privacy Settings ---
    settings: {
        followToView: { type: Boolean, default: true },
        autoAccept: { type: Boolean, default: false }
    },
    
    autoAcceptFollows: { type: Boolean, default: false }, 

    // --- Advanced Projects (Portfolio) ---
    projects: [{
        title: { type: String, default: 'Project' },
        description: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
        media: [{
            url: String,
            type: { type: String, enum:['image','video'], default:'image' },
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
        }]
    }],
    bookedWorkers: [{
        workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
        status: { type: String, default: 'Booked' },
        bookedAt: { type: Date, default: Date.now }
    }],
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
    loginProvider: { type: String, default: 'local' }
    
}, { timestamps: true });

// --- FIXED PRE-SAVE MIDDLEWARE ---
// Including 'next' and calling it resolves the 500 error during signup
// --- ASYNC PRE-SAVE MIDDLEWARE ---
// We use 'async' so we don't need the 'next' parameter. 
// This prevents the "next is not a function" error.
EmployerSchema.pre('save', async function() {
    // Logic: Ensure every new account has the correct role
    if (!this.role) {
        this.role = 'employer';
    }
    // Mongoose knows the function is done when it reaches the end of this block.
});

// Final export
module.exports = mongoose.models.Employer || mongoose.model('Employer', EmployerSchema);
