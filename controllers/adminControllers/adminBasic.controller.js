const mock_testModel = require("../../models/mock_test.model");
const questionsModel = require("../../models/questions.model");
const supscriptionModel = require("../../models/supscription.model");
const userModels = require("../../models/user.models");
const { accessTokenAndRefreshTokenGenerator } = require("../../tokenGenerator");
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const { LoginFormValidator } = require("../../validations/schemaValidations");


module.exports.getCounts = asyncWrapper(async(req, res)=>{
    const userCount = await userModels.countDocuments({});
    const questionCount = await questionsModel.countDocuments({});
    const mockTestCount = await mock_testModel.countDocuments({});


    res.status(200).json({userCount, questionCount, mockTestCount});

})


module.exports.deleteUsers = asyncWrapper(async(req, res)=>{
    const {id} = req.params;

    const user = await userModels.findByIdAndDelete(id);

    if(!user){
        res.status(401).json({message: "User not found!"});
    }

    res.status(200).json({message: "User Deleted Successfully"});
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

        query = { userSupscription: { $in: subscriptionIds } };
    }

    const allUsers = await userModels
        .find(query)
        .limit(limit)
        .skip(skip)
        .populate("userSupscription")
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


module.exports.loginUser = asyncWrapper(async(req, res)=>{
    const {error, value} = LoginFormValidator.validate(req.body);

    const {email, password} = value;

    const user = await userModels.findOne({email});
    if(!user) return res.status(400).json({message: "Wrong email or password"});

    if(user.role!=='admin'){
        return res.status(401).json({message: "Forbidden - Admins only"});
    }

    const checkPassword = await user.verifyPassword(password);

    if(!checkPassword) return res.status(400).json({message: "Wrong email or password"});

    const {accessToken, refreshToken} = await accessTokenAndRefreshTokenGenerator(user._id);

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


module.exports.deleteQuestion = asyncWrapper(async(req, res)=>{
    const {id} = req.params;

    console.log(id);
    

    await questionsModel.findByIdAndDelete(id);

    res.status(200).json({message: "Question Deleted"});
})