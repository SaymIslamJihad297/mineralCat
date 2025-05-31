const router = require("express").Router();
const { getAllFAQs, createFAQ, updateFAQ } = require("../../controllers/adminControllers/faqs.controller");
const { isUserLoggedIn, isAdminUser } = require("../../middleware/middlewares");


router.route('/')
    .get(isUserLoggedIn, getAllFAQs)
    .post(isUserLoggedIn, isAdminUser, createFAQ)
    .put(isUserLoggedIn, isAdminUser, updateFAQ);



module.exports = router;