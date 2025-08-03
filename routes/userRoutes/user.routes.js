const { forgetPassword, verifyOtp, resetPassword } = require('../../controllers/userControllers/otpController');
const { userInfo, updateUser, getAQuestion, addToBookmark, getBookMark, addNotification, getNotifications, getUnseenNotificationCount, userProgress, userPaymentHistory, logout } = require('../../controllers/userControllers/user.controllers');
const { isUserLoggedIn, isAdminUser } = require('../../middleware/middlewares');
const createUploadMiddleware = require('../../middleware/upload');

const router = require('express').Router();

router.get('/protected', isUserLoggedIn, (req, res) => {
    res.json({ message: `hello from protected route with ${process.pid}` });
})

router.post('/forgot-password', forgetPassword);

router.post('/verify-otp', verifyOtp);

router.put('/reset-password', resetPassword);

router.put('/update-user', isUserLoggedIn, createUploadMiddleware(['.jpg', '.png', 'jpeg']).single('profile'), updateUser);

router.get('/user-info', isUserLoggedIn, userInfo);

router.get('/get-question/:id', isUserLoggedIn, getAQuestion);

router.route('/bookmark')
    .get(isUserLoggedIn, getBookMark)
    .post(isUserLoggedIn, addToBookmark);


router.get('/notification', isUserLoggedIn, getNotifications)
    
router.get('/get-unseen-notification-count', isUserLoggedIn, getUnseenNotificationCount);


router.get('/user-progress', isUserLoggedIn, userProgress);

router.get('/user-payment-history', isUserLoggedIn, userPaymentHistory);

router.post('/logout', isUserLoggedIn, logout);

module.exports = router;