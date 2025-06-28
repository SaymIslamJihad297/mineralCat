const mongoose = require('mongoose');
const Question = require('../../models/questions.model');
const { 
    FillInTheBlanksQuestionSchemaValidator, 
    mcqMultipleSchemaValidator, 
    mcqSingleSchemaValidator, 
    readingFillInTheBlanksSchemaValidator, 
    reorderParagraphsSchemaValidator, 
    EditFillInTheBlanksQuestionSchemaValidator, 
    EditmcqMultipleSchemaValidator, 
    EditmcqSingleSchemaValidator 
} = require('../../validations/schemaValidations');
const ExpressError = require('../../utils/ExpressError');
const { asyncWrapper } = require("../../utils/AsyncWrapper");

// Helper to validate and save questions
async function validateAndSaveQuestion(validator, data, userId, subtype) {
    const { error, value } = validator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = userId;
    value.subtype = subtype;

    const newQuestion = await Question.create(value);
    return newQuestion;
}

// Helper to update a question
async function validateAndUpdateQuestion(validator, questionId, data) {
    const { error, value } = validator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, value, { new: true });
    if (!updatedQuestion) throw new ExpressError(404, "Question not found!");

    return updatedQuestion;
}

// Helper to get all questions with pagination
async function getQuestions(subtype, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const questions = await Question.find({ subtype })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();  // Lean query for performance
    
    const questionsCount = await Question.countDocuments({ subtype });
    return { questions, questionsCount };
}

// ---------------------- reading and writing fill in the blanks ----------------------
module.exports.addFillInTheBlanks = asyncWrapper(async (req, res) => {
    const newQuestion = await validateAndSaveQuestion(FillInTheBlanksQuestionSchemaValidator, req.body, req.user._id, 'rw_fill_in_the_blanks');
    res.json({ newQuestion });
});

module.exports.getAllFillInTheBlanks = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await getQuestions('rw_fill_in_the_blanks', page, limit);
    res.status(200).json(result);
});

module.exports.editFillIntheBlanks = asyncWrapper(async (req, res) => {
    const updatedQuestion = await validateAndUpdateQuestion(EditFillInTheBlanksQuestionSchemaValidator, req.body.questionId, req.body.newData);
    res.status(200).json({ message: "Question Updated Successfully", updatedQuestion });
});

// ---------------------- mcq_multiple ----------------------
module.exports.addMcqMultiple = asyncWrapper(async (req, res) => {
    const newQuestion = await validateAndSaveQuestion(mcqMultipleSchemaValidator, req.body, req.user._id, 'mcq_multiple');
    res.status(200).json({ data: newQuestion });
});

module.exports.getMcqMultiple = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await getQuestions('mcq_multiple', page, limit);
    res.status(200).json(result);
});

module.exports.editMcqMultiple = asyncWrapper(async (req, res) => {
    const updatedQuestion = await validateAndUpdateQuestion(EditmcqMultipleSchemaValidator, req.body.questionId, req.body.newData);
    res.status(200).json({ message: "Question Updated Successfully", updatedQuestion });
});

module.exports.mcqMultipleChoiceResult = asyncWrapper(async (req, res) => {
    const { questionId, selectedAnswers } = req.body;
    const question = await Question.findById(questionId).lean();
    if (!question || question.subtype !== 'mcq_multiple') {
        throw new ExpressError(404, "Question Not Found or Invalid Type");
    }

    const correctAnswers = question.correctAnswers;
    const score = selectedAnswers.filter(answer => correctAnswers.includes(answer)).length;
    const feedback = `You scored ${score} out of ${correctAnswers.length}.`;

    return res.status(200).json({ score, feedback });
});

// ---------------------- mcq_single ----------------------
module.exports.addMcqSingle = asyncWrapper(async (req, res) => {
    if (req.body.correctAnswers.length > 1) throw new ExpressError(400, "Multiple answers not allowed for mcq_single");
    const newQuestion = await validateAndSaveQuestion(mcqSingleSchemaValidator, req.body, req.user._id, 'mcq_single');
    res.status(200).json({ data: newQuestion });
});

module.exports.getMcqSingle = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await getQuestions('mcq_single', page, limit);
    res.status(200).json(result);
});

module.exports.editMcqSingle = asyncWrapper(async (req, res) => {
    if (req.body.newData.correctAnswers.length > 1) throw new ExpressError(400, "Multiple answers not allowed for mcq_single");
    const updatedQuestion = await validateAndUpdateQuestion(EditmcqSingleSchemaValidator, req.body.questionId, req.body.newData);
    res.status(200).json({ message: "Question Updated Successfully", updatedQuestion });
});

module.exports.mcqSingleResult = asyncWrapper(async (req, res) => {
    const { questionId, userAnswer } = req.body;
    const question = await Question.findById(questionId).lean();

    if (!question || question.subtype !== 'mcq_single') {
        throw new ExpressError(404, "Question not found or invalid type");
    }

    const isCorrect = question.correctAnswers.includes(userAnswer);
    return res.status(200).json({ isCorrect, message: isCorrect ? "Correct answer!" : "Incorrect answer!" });
});

// ---------------------- reading_fill_in_the_blanks ----------------------
module.exports.addReadingFillInTheBlanks = asyncWrapper(async (req, res) => {
    const newQuestion = await validateAndSaveQuestion(readingFillInTheBlanksSchemaValidator, req.body, req.user._id, 'reading_fill_in_the_blanks');
    res.status(200).json({ data: newQuestion });
});

module.exports.editReadingFillInTheBlanks = asyncWrapper(async (req, res) => {
    const updatedQuestion = await validateAndUpdateQuestion(readingFillInTheBlanksSchemaValidator, req.body.questionId, req.body.newData);
    res.status(200).json({ message: "Question Updated Successfully", updatedQuestion });
});

module.exports.getReadingFillInTheBlanks = asyncWrapper(async (req, res) => {
    const allReadingFillInTheBlanks = await Question.find({ subtype: "reading_fill_in_the_blanks" }).sort({ createdAt: -1 });
    res.status(200).json({ data: allReadingFillInTheBlanks });
});

module.exports.readingFillInTheBlanksResult = asyncWrapper(async (req, res) => {
    const { questionId, blanks } = req.body;
    const question = await Question.findById(questionId).lean();
    if (!question || question.subtype !== 'reading_fill_in_the_blanks') {
        throw new ExpressError(404, "Question Not Found!");
    }

    let score = 0;
    const totalBlanks = question.blanks.length;

    blanks.forEach((userBlank) => {
        const correctBlank = question.blanks.find((blank) => blank.index === userBlank.index);
        if (correctBlank && userBlank.selectedAnswer === correctBlank.correctAnswer) {
            score++;
        }
    });

    const result = { score, totalBlanks };
    const feedback = `You scored ${score} out of ${totalBlanks}.`;

    return res.status(200).json({ result, feedback });
});

// ---------------------- reorder_paragraphs ----------------------
module.exports.addReOrderParagraphs = asyncWrapper(async (req, res) => {
    const newQuestion = await validateAndSaveQuestion(reorderParagraphsSchemaValidator, req.body, req.user._id, 'reorder_paragraphs');
    res.status(200).json({ data: newQuestion });
});

module.exports.editReorderParagraphs = asyncWrapper(async (req, res) => {
    const updatedQuestion = await validateAndUpdateQuestion(reorderParagraphsSchemaValidator, req.body.questionId, req.body.newData);
    res.status(200).json({ message: "Question Updated Successfully", updatedQuestion });
});

module.exports.getReorderParagraphs = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await getQuestions('reorder_paragraphs', page, limit);
    res.status(200).json(result);
});

module.exports.getAReorderParagraph = asyncWrapper(async (req, res) => {
    const { questionId } = req.params;
    const question = await Question.findById(questionId).lean();

    if (!question) {
        throw new ExpressError(404, "Question not found!");
    }

    // Fisher-Yates Shuffle function to randomize the options
    const shuffleArray = (array) => {
        let shuffledArray = array.slice();
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; // Swap elements
        }
        return shuffledArray;
    };

    const randomizedOptions = shuffleArray(question.options);
    res.status(200).json({
        data: { ...question, options: randomizedOptions }
    });
});

module.exports.reorderParagraphsResult = asyncWrapper(async (req, res) => {
    const { questionId, userReorderedOptions } = req.body;
    const question = await Question.findById(questionId).lean();

    if (!question || question.subtype !== 'reorder_paragraphs') {
        throw new ExpressError(404, "Question not found or invalid type");
    }

    const correctAnswers = question.options;
    let score = 0;

    userReorderedOptions.forEach((userAnswer, index) => {
        if (userAnswer === correctAnswers[index]) {
            score++;
        }
    });

    const totalScore = (score / correctAnswers.length) * 100;
    return res.status(200).json({
        score: totalScore,
        message: `You scored ${score} out of ${correctAnswers.length} points.`,
        userAnswer: userReorderedOptions,
        correctAnswer: correctAnswers
    });
});
