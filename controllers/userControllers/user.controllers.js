const mongoose = require('mongoose');
const userModels = require('../../models/user.models');
const { userSchemaValidator, LoginFormValidator } = require('../../validations/schemaValidations');
const { accessTokenAndRefreshTokenGenerator } = require('../../tokenGenerator');
const jwt = require('jsonwebtoken');
const { asyncWrapper } = require('../../utils/AsyncWrapper');
const supscriptionModel = require('../../models/supscription.model');
const fs = require('node:fs');
const cloudinary = require('../../middleware/cloudinary.config');
const path = require('node:path');

module.exports.signUpUser = asyncWrapper(async (req, res) => {
  const { error, value } = userSchemaValidator.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { name, email, password } = value;

  const checkUser = await userModels.findOne({ email });
  if (checkUser) return res.json({ message: "A user already exists with this email" });

  const newUser = await userModels.create({
    name,
    email,
    password,
  });

  const subscription = await supscriptionModel.create({
    user: newUser._id,
    planType: "Free",
    isActive: true,
    studyPlan: "unauthorized",
    performanceProgressDetailed: "unauthorized"
  });

  newUser.userSupscription = subscription;
  await newUser.save();

  const { accessToken, refreshToken } = await accessTokenAndRefreshTokenGenerator(newUser._id);

  return res
    .status(200)
    .json({
      user: {
        ...newUser.toObject(),
      },
      accessToken,
      refreshToken,
    });
});


module.exports.loginUser = asyncWrapper(async (req, res) => {
  const { error, value } = LoginFormValidator.validate(req.body);

  const { email, password } = value;

  const user = await userModels.findOne({ email });
  if (!user) return res.status(400).json({ message: "Wrong email or password" });

  const checkPassword = await user.verifyPassword(password);

  if (!checkPassword) return res.status(400).json({ message: "Wrong email or password" });

  const { accessToken, refreshToken } = await accessTokenAndRefreshTokenGenerator(user._id);

  return res
    .status(200)
    .json(
      {
        user: user,
        accessToken,
        refreshToken,
      }
    )
})


module.exports.refreshToken = asyncWrapper(async (req, res) => {
  const token = req.headers['x-refresh-token'];

  if (!token) {
    return res.status(401).json({ message: "Refresh token is missing. Please log in." });
  }

  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid refresh token." });
    }

    const userData = await userModels.findById(user._id).select('-password');
    if (!userData) {
      return res.status(404).json({ message: "User not found." });
    }

    const newAccessToken = jwt.sign(
      {
        _id: userData._id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      }
    );

    return res.status(200).json({
      accessToken: newAccessToken,
      message: "Access token refreshed.",
    });
  });
});


module.exports.signupWithGoogle = (req, res) => {
  const user = req.user;
  const accessToken = jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },

    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  )
  const refreshToken = jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },

    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  )

  res.status(200).json({ accessToken, refreshToken });
}



module.exports.userInfo = asyncWrapper(async (req, res) => {
  const user = req.user;
  const userData = await userModels.findById(user._id).select(['-password']).populate("userSupscription");
  return res.status(200).json({ user: userData });
});



module.exports.updateUser = asyncWrapper(async (req, res) => {
  const data = req.body;
  const user = req.user;

  let result;
  const folderName = 'userProfile'
  if (req.file) {
    result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'auto',
      public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      folder: `listening_test/${folderName}`,
      type: 'authenticated',
    })
  }

  fs.unlinkSync(req.file.path);

  const userData = await userModels.findByIdAndUpdate(user._id, {...data, profile: result.secure_url}, { new: true }).select(['-password']);
  return res.status(200).json({ user: userData });
});