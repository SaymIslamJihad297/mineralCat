const mock_testModel = require("../../models/mock_test.model");
const questionsModel = require("../../models/questions.model");
const supscriptionModel = require("../../models/supscription.model");
const userModels = require("../../models/user.models");
const { accessTokenAndRefreshTokenGenerator } = require("../../tokenGenerator");
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const ExpressError = require("../../utils/ExpressError");
const { LoginFormValidator } = require("../../validations/schemaValidations");


module.exports.getCounts = asyncWrapper(async (req, res) => {
    const userCount = await userModels.countDocuments({});
    const questionCount = await questionsModel.countDocuments({});
    const mockTestCount = await mock_testModel.countDocuments({});


    res.status(200).json({ userCount, questionCount, mockTestCount });

})


module.exports.deleteUsers = asyncWrapper(async (req, res) => {
    const { id } = req.params;

    const user = await userModels.findByIdAndDelete(id);

    if (!user) {
        res.status(401).json({ message: "User not found!" });
    }

    res.status(200).json({ message: "User Deleted Successfully" });
})


module.exports.getRecentUsers = asyncWrapper(async (req, res) => {
    const recentUsers = await userModels
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("-password -__v -updatedAt")
        .lean();

    if (recentUsers) {
        const formattedUsers = recentUsers.map(user => ({
            ...user,
            joinedDate: new Date(user.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "numeric",
                day: "numeric"
            })
        }));

        return res.status(200).json({
            status: true,
            message: "Recent users retrieved successfully",
            data: formattedUsers
        });
    }
});


module.exports.getAllUsers = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10, planType } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (planType && planType !== "all") {
        const subscriptions = await supscriptionModel.find({ planType });
        const subscriptionIds = subscriptions.map(sub => sub._id);

        query = { userSubscription: { $in: subscriptionIds } };
    }

    const allUsers = await userModels
        .find(query)
        .limit(limit)
        .skip(skip)
        .populate("userSubscription")
        .sort({ createdAt: -1 })
        .select("-password -__v -updatedAt")
        .lean();

    if (allUsers) {
        const formattedUsers = allUsers.map(user => ({
            ...user,
            joinedDate: new Date(user.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "numeric",
                day: "numeric"
            })
        }));

        return res.status(200).json({
            status: true,
            message: "All users retrieved successfully",
            data: formattedUsers
        });
    }
});


module.exports.loginUser = asyncWrapper(async (req, res) => {
    const { error, value } = LoginFormValidator.validate(req.body);

    if (error) {
        throw new ExpressError(400, error.details[0].message);
    }

    const { email, password } = value;

    const user = await userModels.findOne({ email });
    if (!user) return res.status(400).json({ message: "Wrong email or password" });

    if (user.role !== 'admin') {
        return res.status(401).json({ message: "Forbidden - Admins only" });
    }

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


module.exports.deleteQuestion = asyncWrapper(async (req, res) => {
    const { id } = req.params;


    await questionsModel.findByIdAndDelete(id);

    res.status(200).json({ message: "Question Deleted" });
})


module.exports.addNotification = asyncWrapper(async (req, res) => {
    const { title, description, targetSubscription } = req.body;

    if (!['bronze', 'silver', 'gold', 'all'].includes(targetSubscription)) {
        return res.status(400).json({ message: "Invalid subscription target." });
    }

    const notification = await notificationModel.create({
        title,
        description,
        targetSubscription,
    });

    return res.status(201).json({
        success: true,
        data: notification,
        message: "Notification created successfully.",
    });
});


module.exports.adminEarnings = asyncWrapper(async (req, res) => {
    const { planType } = req.query;

    const allSubscriptions = await supscriptionModel.find({
        isActive: true,
        user: { $ne: null }
    }).populate('user');

    let totalUsers = 0;
    let totalEarnings = 0;

    let userCountByPlan = {
        bronze: 0,
        silver: 0,
        gold: 0
    };

    let earningsByPlan = {
        bronze: 0,
        silver: 0,
        gold: 0
    };

    let userList = [];

    const planPrices = {
        bronze: 29.99,
        silver: 49.99,
        gold: 69.99
    };

    for (const sub of allSubscriptions) {
        const plan = sub.planType?.toLowerCase();
        if (!plan || !planPrices[plan]) continue;

        totalUsers++;
        userCountByPlan[plan]++;
        earningsByPlan[plan] += planPrices[plan];
        totalEarnings += planPrices[plan];

        if (planType && planType.toLowerCase() === plan) {
            userList.push({
                userId: sub.user?._id.toString().slice(-6),
                name: sub.user?.name || 'N/A',
                paymentDate: sub.startedAt?.toLocaleDateString('en-GB') || 'N/A',
                expireDate: sub.expiresAt?.toLocaleDateString('en-GB') || 'N/A',
                estToken: sub.credits ?? 0,
                estMockTest: sub.mockTestLimit ?? 0,
                package: sub.planType
            });
        }
    }

    res.status(200).json({
        totalUsers,
        usersByPackage: userCountByPlan,
        earningsByPackage: earningsByPlan,
        totalEarnings,
        ...(planType && { users: userList })
    });
});
