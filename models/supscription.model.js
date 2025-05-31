const mongoose = require('mongoose');
const {Schema} = mongoose;


const supscriptionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    planType: {
        type: String,
        enum: ['Free', 'Premium'],
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    mockTestLimit: {
        type: Number,
        default: 1,
    },
    aiScoringLimit: {
        type: Number,
        default: 5,
    },
    sectionalMockTestLimit: {
        type: Number,
        default: 1,
    },
    cyoMockTestLimit: {
        type: Number,
        default: 1,
    },
    templates: {
        type: Number,
        default: 5,
    },
    studyPlan: {
        type: String,
        enum: ['authorized', 'unauthorized']
    },
    performanceProgressDetailed : {
        type: String,
        enum: ['authorized', 'unauthorized']
    },
    startedAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
    },
    paymentInfo: {
        transactionId: String,
        provider: String,
        amount: Number,
        currency: String
    }
})

module.exports = mongoose.model('Supscription', supscriptionSchema);