const userModels = require('../../models/user.models');

const generateOTP = require('../../utils/generateOTP');
const sendOTPEmail = require('../../services/mailService');

const bcrypt = require('bcryptjs');
const otpModel = require("../../models/otp.model");
const {asyncWrapper} = require('../../utils/AsyncWrapper');
const ExpressError = require("../../utils/ExpressError");
const { resetTokenGenerator } = require("../../tokenGenerator");
const jwt = require('jsonwebtoken');

module.exports.forgetPassword = asyncWrapper(async (req, res)=>{
    const {email} = req.body;

    if(!email) return res.status(403).json({message: "Email address is required"});
    
    const user = await userModels.findOne({email});

    if(user.googleId) return res.json({message: "this mail is linked with a google account!"});

    
    if(!user) return res.json({message: "There is no account with this email address"});
    
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await otpModel.create({
        email,
        otp: hashedOtp,
        expiresAt,
    })

    try{
        await sendOTPEmail(email, otp);
        res.status(200).json({message: "OTP sent, please check your inbox and spam folder"});
    }catch(err){
        res.status(500).json({message: "Error sending OTP", error: err.message});
    }
})


module.exports.verifyOtp = asyncWrapper(async (req, res, next) => {
    const { email, otp: inputOtp } = req.body;

    const record = await otpModel.findOne({ email }).sort({ createdAt: -1 });

    if (!record) throw new ExpressError(400, 'No OTP found.');

    const { otp, expiresAt, used } = record;

    if (used) throw new ExpressError(400, 'OTP already used.');

    if (Date.now() > expiresAt) throw new ExpressError(400, 'OTP expired.');

    const isValidOtp = await bcrypt.compare(inputOtp, otp)

    if (!isValidOtp) throw new ExpressError(400, 'Invalid OTP.');

    record.used = true;
    await record.save();

    const resetToken = await resetTokenGenerator(email);
    
    res.status(200).json({ message: 'OTP Verified Successfully', resetToken: resetToken });
});

module.exports.resetPassword = asyncWrapper(async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (!newPassword) throw new ExpressError('Password required', 400);
  if (newPassword.length < 8) throw new ExpressError('Password must be at least 8 characters.', 400);
  if (newPassword !== confirmPassword) throw new ExpressError('Passwords do not match.', 400);

  const resetToken = req.headers['x-reset-token'];
  if (!resetToken) throw new ExpressError('Missing reset token', 403);

  let decodedData;
  try {
    decodedData = jwt.verify(resetToken, process.env.RESET_TOKEN_SECRET);
  } catch (err) {
    throw new ExpressError('Invalid or expired reset token', 401);
  }

  const user = await userModels.findOne({ email: decodedData.email });
  if (!user) throw new ExpressError('User not found', 404);

  user.password = newPassword;
  await user.save();

  res.status(200).json({ message: 'Password reset successful.' });
});