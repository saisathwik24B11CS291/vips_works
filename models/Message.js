const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'senderModel' },
    senderModel: { type: String, required: true, enum: ['Worker', 'Employer'] },
    receiver: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'receiverModel' },
    receiverModel: { type: String, required: true, enum: ['Worker', 'Employer'] },
    text: { type: String },
    image: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true } // Added index for faster sorting
});

module.exports = mongoose.model('Message', messageSchema);