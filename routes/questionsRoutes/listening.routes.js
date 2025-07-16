const { addSummarizeSpokenText, addMultipleChoicesAndMultipleAnswers, getAllSummarizeSpokenText, getAllMultipleChoicesAndMultipleAnswers, addListeningFillInTheBlanks, getAllListeningFillInTheBlanks, addMultipleChoiceSingleAnswers, getAllMultipleChoiceSingleAnswers, editSummarizeSpokenText, editMultipleChoicesAndMultipleAnswers, editListeningFillInTheBlanks, editMultipleChoiceSingleAnswers, summerizeSpokenTextResult, multipleChoicesAndMultipleAnswersResult, listeningFillInTheBlanksResult, multipleChoiceSingleAnswerResult } = require('../../controllers/questionsControllers/spoken_test.controller');
const {isUserLoggedIn, isAdminUser} = require('../../middleware/middlewares');
const createUploadMiddleware = require('../../middleware/upload');

const router = require('express').Router();


router.route('/summarize-spoken-text')
    .get(isUserLoggedIn, getAllSummarizeSpokenText)
    .put(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), editSummarizeSpokenText)
    .post(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'),addSummarizeSpokenText);


router.post('/summarize-spoken-text/result', isUserLoggedIn, summerizeSpokenTextResult);


router.route('/multiple-choice-multiple-answers')
    .get(isUserLoggedIn, getAllMultipleChoicesAndMultipleAnswers)
    .put(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), editMultipleChoicesAndMultipleAnswers)
    .post(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), addMultipleChoicesAndMultipleAnswers);

router.post('/multiple-choice-multiple-answers/result', isUserLoggedIn, multipleChoicesAndMultipleAnswersResult);

router.route('/listening-fill-in-the-blanks')
    .get(isUserLoggedIn, getAllListeningFillInTheBlanks)
    .put(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), editListeningFillInTheBlanks)
    .post(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), addListeningFillInTheBlanks);

router.post('/listening-fill-in-the-blanks/result', isUserLoggedIn, listeningFillInTheBlanksResult);

router.route('/multiple-choice-single-answers')
    .get(isUserLoggedIn, getAllMultipleChoiceSingleAnswers)
    .put(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), editMultipleChoiceSingleAnswers)
    .post(isUserLoggedIn, isAdminUser, createUploadMiddleware(['.mp3', '.wav']).single('voice'), addMultipleChoiceSingleAnswers);

router.post('/multiple-choice-single-answers/result', isUserLoggedIn, multipleChoiceSingleAnswerResult);

module.exports = router;