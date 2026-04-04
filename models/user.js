const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

username: { type: String, required: true, unique: true },
email: { type: String, required: true, unique: true },
phone: String,
role: { type: String, enum: ['worker', 'employer'], default: 'worker' },

location: { type: String, default: '' },

profession: { type: String, default: 'Worker' },

skills: { type: [String], default: [] },

// ⭐ ADD THIS
categories: [
{
name: String,
tags: [String]
}
],

followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

settings: {
followToView: { type: Boolean, default: false },
autoAccept: { type: Boolean, default: false }
},

mainCategory: String,
paySpeed: { type: String, default: 'Instant' },
totalHired: { type: Number, default: 0 }

});