const { addSummarizeWrittenText, editSummarizeWrittenText, getSummarizeWrittenText, addWriteEmail, editWriteEmail, getWriteEmail } = require('../../controllers/questionsControllers/written_test.controller');
const { isUserLoggedIn, isAdminUser } = require('../../middleware/middlewares');

const router = require('express').Router();


router.route('/summarize-written-text')
    .get(isUserLoggedIn, getSummarizeWrittenText)
    .post(isUserLoggedIn, isAdminUser,addSummarizeWrittenText)
    .put(isUserLoggedIn, isAdminUser, editSummarizeWrittenText);


router.route('/write_email')
    .get(isUserLoggedIn, getWriteEmail)
    .post(isUserLoggedIn, isAdminUser, addWriteEmail)
    .put(isUserLoggedIn, isAdminUser, editWriteEmail);

module.exports = router;