if (process.env.NODE_ENV != 'production') {
    require('dotenv').config();
}
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const googleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const rateLimiter = require('express-rate-limit');
const passport = require('passport');
require('./passport');
const path = require('path');
const cron = require('node-cron');

const cors = require('cors');

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pipefish-famous-socially.ngrok-free.app'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow REST clients or curl with no origin
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'x-refresh-token'],
}));

const mongoose = require('mongoose');

main().then(() => {
    console.log("Database Connected");
}).catch((err) => {
    console.log(err);
})

// routes
const authRoutes = require('./routes/userRoutes/auth.routes');
const userRoutes = require('./routes/userRoutes/user.routes');
const paymentRoutes = require('./routes/userRoutes/payment.routes');
const readingRoutes = require('./routes/questionsRoutes/reading_test.routes');
const writingRoutes = require('./routes/questionsRoutes/writing_test.routes');
const listeningRoutes = require('./routes/questionsRoutes/listening.routes');
const speakingRoutes = require('./routes/questionsRoutes/speaking.routes');
const adminBasicRoutes = require('./routes/adminRoutes/adminBasic.routes');
const faqsRoutes = require('./routes/adminRoutes/faqs.routes');
const stripeRoutes = require('./routes/payments/stripe.routes');
const FullmockTestRoutes = require('./routes/mockTestRoutes/FullmockTest.routes');
const SectionalMockTestRoutes = require('./routes/mockTestRoutes/SectionalMockTest.routes');
const termsAndConditions = require('./routes/adminRoutes/terms.routes');
const aboutUs = require("./routes/adminRoutes/aboutUs.routes");

// models
const userModel = require('./models/user.models');
const ExpressError = require('./utils/ExpressError');
const { isUserLoggedIn } = require('./middleware/middlewares');
const StripePaymentGateway = require('./models/payment.model');

const seed = require('./seedScript');
// seed();

const limite = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { message: "Too many request..." }
})


cron.schedule('0 0 0 * * *', async () => {
  try {
    const datas = await StripePaymentGateway.find({});
    
    const now = new Date();
    const thresholdMs = (23 * 60 + 50) * 60 * 1000; // 23h 50min

    for (const data of datas) {
      const createdAt = new Date(data.createdAt);
      const diffMs = now - createdAt;

      if (diffMs >= thresholdMs && data.payment_status == 'unpaid') {
        await StripePaymentGateway.findByIdAndDelete(data._id);
      }
    }

  } catch (err) {
    console.error('❌ Cron error:', err);
  }
});

app.use(limite);

// Apply raw body parsing specifically for the webhook route
app.use('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }));

// Apply JSON and URL-encoded body parsing for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

app.use(cookieParser());
app.use(passport.initialize());

app.set('trust proxy', 1);

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/payment', paymentRoutes);
app.use('/test/reading', readingRoutes);
app.use('/test/writing', writingRoutes);
app.use('/test/listening', listeningRoutes);
app.use('/test/speaking', speakingRoutes);
app.use('/admin', adminBasicRoutes);
app.use('/faqs', faqsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/full-mock-test', FullmockTestRoutes);
app.use('/sectional-mock-test', SectionalMockTestRoutes);
app.use('/terms', termsAndConditions);
app.use('/about-us', aboutUs);

// async function main() {
//     mongoose.connect('mongodb://127.0.0.1:27017/MineralCatPTE');
// }

async function main() {
    mongoose.connect(process.env.MONGO_DB_URL);
}
app.get('/success', (req, res) => {
    res.send("Payment Successfull");
})

app.use((req, res, next) => {
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
    let { status = 500, message = "Some error happend" } = err;
    res.status(status).json({ message });
})

module.exports = app;