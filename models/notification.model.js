const { Schema, default: mongoose } = require('mongoose');

const notificationSchema = new Schema({
    title: {
        type: String, 
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    time: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
