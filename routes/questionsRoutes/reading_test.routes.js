const { addFillInTheBlanks, getAllFillInTheBlanks, editFillIntheBlanks, addMcqMultiple, getMcqMultiple, editMcqMultiple, deleteMcqMultiple, deleteQuestion, addMcqSingle, getMcqSingle, editMcqSingle, addReOrderParagraphs, editReorderParagraphs, getReorderParagraphs, addReadingFillInTheBlanks, getReadingFillInTheBlanks, editReadingFillInTheBlanks, readingFillInTheBlanksResult, mcqMultipleChoiceResult, reorderParagraphsResult, getAReorderParagraph } = require('../../controllers/questionsControllers/reading_test.controller');
const { isAdminUser, isUserLoggedIn } = require('../../middleware/middlewares');

const router = require('express').Router();


router.route('/fill-in-the-blanks')
    .post(isUserLoggedIn,isAdminUser,addFillInTheBlanks)
    .get(isUserLoggedIn,getAllFillInTheBlanks)
    .put(isUserLoggedIn, isAdminUser, editFillIntheBlanks);


router.route('/mcq_multiple')
    .post(isUserLoggedIn,isAdminUser,addMcqMultiple)
    .get(isUserLoggedIn,getMcqMultiple)
    .put(isUserLoggedIn, isAdminUser, editMcqMultiple);


router.post('/mcq_multiple/result', isUserLoggedIn, mcqMultipleChoiceResult);


router.route('/mcq_single')
    .post(isUserLoggedIn,isAdminUser,addMcqSingle)
    .get(isUserLoggedIn,getMcqSingle)
    .put(isUserLoggedIn, isAdminUser, editMcqSingle);


router.route('/reading-fill-in-the-blanks')
    .post(isUserLoggedIn,isAdminUser,addReadingFillInTheBlanks)
    .get(isUserLoggedIn,getReadingFillInTheBlanks)
    .put(isUserLoggedIn, isAdminUser, editReadingFillInTheBlanks);


router.post('/reading-fill-in-the-blanks/result', isUserLoggedIn, readingFillInTheBlanksResult);

router.route('/reorder-paragraphs')
    .post(isUserLoggedIn,isAdminUser,addReOrderParagraphs)
    .get(isUserLoggedIn,getReorderParagraphs)
    .put(isUserLoggedIn, isAdminUser, editReorderParagraphs);

router.get('/reorder-a-paragraph/:questionId', isUserLoggedIn, getAReorderParagraph);
router.post('/reorder-paragraphs/result', isUserLoggedIn, reorderParagraphsResult);

// router.delete('/delete/question', isUserLoggedIn, isAdminUser,deleteQuestion);

module.exports = router;
