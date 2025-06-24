const { addReadAloud, getAllReadAloud, editReadAloud, addRepeatSentence, editRepeatSentence, getAllRepeatSentence, addRespondToASituation, editRespondToASituation, getAllRespondToASituation, addAnswerShortQuestion, editAnswerShortQuestion, getAllAnswerShortQuestion, readAloudResult } = require('../../controllers/questionsControllers/speaking.controller');
const { isUserLoggedIn, isAdminUser } = require('../../middleware/middlewares');
const upload = require('../../middleware/upload');

const router = require('express').Router();


router.route('/read_aloud')
    .get(isUserLoggedIn ,getAllReadAloud)
    .put(isUserLoggedIn , isAdminUser, editReadAloud)
    .post(isUserLoggedIn , isAdminUser,addReadAloud);


router.post('/read_aloud/result', isUserLoggedIn, upload.single('voice'),readAloudResult);

router.route('/repeat_sentence')
    .get(isUserLoggedIn ,getAllRepeatSentence)
    .put(isUserLoggedIn , isAdminUser, upload.single('voice'),editRepeatSentence)
    .post(isUserLoggedIn , isAdminUser, upload.single('voice'),addRepeatSentence);


router.route('/respond-to-a-situation')
    .get(isUserLoggedIn ,getAllRespondToASituation)
    .put(isUserLoggedIn , isAdminUser, upload.single('voice'),editRespondToASituation)
    .post(isUserLoggedIn , isAdminUser, upload.single('voice'),addRespondToASituation);



router.route('/answer_short_question')
    .get(isUserLoggedIn ,getAllAnswerShortQuestion)
    .put(isUserLoggedIn , isAdminUser, upload.single('voice'),editAnswerShortQuestion)
    .post(isUserLoggedIn , isAdminUser, upload.single('voice'),addAnswerShortQuestion);

module.exports = router;
