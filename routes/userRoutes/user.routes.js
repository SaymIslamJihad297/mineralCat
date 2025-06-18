const { forgetPassword, verifyOtp, resetPassword } = require('../../controllers/userControllers/otpController');
const { userInfo, updateUser } = require('../../controllers/userControllers/user.controllers');
const { isUserLoggedIn } = require('../../middleware/middlewares');
const upload = require('../../middleware/upload');

const router = require('express').Router();

router.get('/protected', isUserLoggedIn,(req, res)=>{
    res.json({message: `hello from protected route with ${process.pid}`});
})

router.post('/forgot-password', forgetPassword);

router.post('/verify-otp', verifyOtp);

router.put('/reset-password', resetPassword);

router.put('/update-user', isUserLoggedIn, upload.single('profile'),updateUser);

router.get('/user-info', isUserLoggedIn,userInfo);

module.exports = router;