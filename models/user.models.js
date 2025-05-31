const mongoose = require('mongoose');
const {Schema} = mongoose;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
    },
    city: {
        type: String,
    },
    phone: {
        type: String,
    },
    userSupscription: {
        type: Schema.Types.ObjectId,
        ref: 'Supscription',
    },

    role: {
        type: String,
        enum: [
            'user',
            'admin',
        ],
        default: 'user'
      },
    googleId: {
        type: String,
    },
    status: {
      type: String,
      enum: ['progress', 'blocked'],
      default: 'progress',
    },
    stripeAccountId: {
      type: String,
    },
}, {
    timestamps: true,
})

userSchema.pre('save', async function(next){
    if(!this.isModified('password') || !this.password) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.verifyPassword = async function(password){
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = async function() {
    return jwt.sign(
        {
            _id: this._id,
            name: this.name,
            email: this.email,
            role: this.role,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    )
}
userSchema.methods.generateRefreshToken = async function() {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    )
}

module.exports = mongoose.model('User', userSchema);