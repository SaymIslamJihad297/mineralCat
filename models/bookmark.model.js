const { Schema, default: mongoose } = require('mongoose');

const bookmark = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    questionType: {
        type: String,
        enum: ['speaking', 'writing', 'reading', 'listening'],
        required: true
    },
    subtype: {
        type: String,
        required: true
    },
    bookmarkedQuestions: [{
        type: Schema.Types.ObjectId,
        ref: 'Question',
    }]
});

// Optional: Add a compound unique index to avoid duplicate entries
bookmark.index({ user: 1, questionType: 1, subtype: 1 }, { unique: true });

module.exports = mongoose.model('Practice', bookmark);
