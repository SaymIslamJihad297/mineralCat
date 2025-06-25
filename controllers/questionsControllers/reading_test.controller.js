const mongoose = require('mongoose');
const Question = require('../../models/questions.model');
const { FillInTheBlanksQuestionSchemaValidator, mcqMultipleSchemaValidator, mcqSingleSchemaValidator, readingFillInTheBlanksSchemaValidator, reorderParagraphsSchemaValidator, EditFillInTheBlanksQuestionSchemaValidator, EditmcqMultipleSchemaValidator, EditmcqSingleSchemaValidator } = require('../../validations/schemaValidations');
const ExpressError = require('../../utils/ExpressError');
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const questionsModel = require('../../models/questions.model');


// ---------------------- reading and writing fill in the blanks-=----------------------
module.exports.addFillInTheBlanks = asyncWrapper(async (req, res) => {
    const { error, value } = FillInTheBlanksQuestionSchemaValidator.validate(req.body);

    if (error) throw new ExpressError(400, error.details[0].message);
    const { type = 'reading', subtype = 'rw_fill_in_the_blanks', prompt, blanks, heading } = value;

    const userId = req.user._id;

    const newQuestion = await Question.create({
        type,
        subtype,
        heading,
        prompt,
        blanks,
        createdBy: userId,
    })

    res.json({ newQuestion });
})

module.exports.getAllFillInTheBlanks = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const allFillinTheBlanks = await Question.find({ subtype: "rw_fill_in_the_blanks" })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

    const questionsCount = await questionsModel.countDocuments({ subtype: 'rw_fill_in_the_blanks' });

    res.status(200).json({ data: allFillinTheBlanks, questionsCount });
})

module.exports.editFillIntheBlanks = asyncWrapper(async (req, res) => {
    const { questionId, newData } = req.body;


    const { error, value } = EditFillInTheBlanksQuestionSchemaValidator.validate(newData);

    const { type = 'reading', subtype = 'rw_fill_in_the_blanks', prompt, blanks, heading } = value;

    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(401, "Question Id required");

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        heading,
        prompt,
        blanks,
    });


    res.status(200).json({ message: "Question Updated Successfully" });
})




// -------------------------------------mcq_multiple----------------------------------

module.exports.addMcqMultiple = asyncWrapper(async (req, res) => {

    const { error, value } = mcqMultipleSchemaValidator.validate(req.body);

    const { type = 'reading', subtype = 'mcq_multiple', prompt, options, correctAnswers } = value;
    const userId = req.user._id;

    if (error) throw new ExpressError(400, error.details[0].message);


    const newQuestion = await Question.create({
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
        createdBy: userId,
    });


    res.status(200).json({ data: newQuestion });
})
module.exports.getMcqMultiple = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const allMcqMultipleQuestions = await Question.find({ subtype: "mcq_multiple" })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

    const questionsCount = await questionsModel.countDocuments({ subtype: 'mcq_multiple' });

    res.status(200).json({ data: allMcqMultipleQuestions, questionsCount });
})

module.exports.editMcqMultiple = asyncWrapper(async (req, res) => {
    const { questionId, newData } = req.body;


    const { error, value } = EditmcqMultipleSchemaValidator.validate(newData);

    const { type = 'reading', subtype = 'mcq_multiple', prompt, options, correctAnswers } = value;

    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(401, "Question Id required");

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
    });


    res.status(200).json({ message: "Question Updated Successfully", updatedQuestion });
})


module.exports.mcqMultipleChoiceResult = asyncWrapper(async (req, res) => {
    const { questionId, selectedAnswers } = req.body;

    // Step 1: Retrieve the question from the database
    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question Not Found!");
    }

    // Step 2: Initialize variables to track score
    const correctAnswers = question.correctAnswers;
    let score = 0;

    // Step 3: Compare the selected answers to the correct ones
    selectedAnswers.forEach((userAnswer) => {
        if (correctAnswers.includes(userAnswer)) {
            score++;
        }
    });

    // Step 4: Calculate the result and prepare the response
    const result = {
        score,
        totalCorrectAnswers: correctAnswers.length,
        correctAnswersGiven: score === correctAnswers.length,
    };

    // Optional: Provide feedback
    const feedback = `You scored ${score} out of ${correctAnswers.length}.`;

    // Step 5: Return the result as a response
    return res.status(200).json({
        result,
        feedback,
    });
});


// -------------------------------------mcq_single----------------------------------

module.exports.addMcqSingle = asyncWrapper(async (req, res) => {

    const { error, value } = mcqSingleSchemaValidator.validate(req.body);

    const { type = 'reading', subtype = 'mcq_single', prompt, options, correctAnswers } = value;
    const userId = req.user._id;

    if (error) throw new ExpressError(400, error.details[0].message);

    if (value.correctAnswers.length > 1) throw new ExpressError(400, "Multiple answer not allowed for mcq_single");

    value.createdBy = req.user._id;

    const newQuestion = await Question.create({
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
        createdBy: userId,
    });


    res.status(200).json({ data: newQuestion });
})

module.exports.getMcqSingle = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const allMcqSingle = await Question.find({ subtype: "mcq_single" })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

    const questionsCount = await questionsModel.countDocuments({ subtype: 'mcq_single' });

    res.status(200).json({ data: allMcqSingle, questionsCount });
})


module.exports.editMcqSingle = asyncWrapper(async (req, res) => {
    const { questionId, newData } = req.body;


    const { error, value } = EditmcqSingleSchemaValidator.validate(newData);

    const { type = 'reading', subtype = 'mcq_single', prompt, options, correctAnswers } = value;

    if (error) throw new ExpressError(400, error.details[0].message);

    if (value.correctAnswers.length > 1) throw new ExpressError(400, "Multiple answer not allowed for mcq_single");

    if (!questionId) throw new ExpressError(401, "Question Id required");

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
    }, { new: true });


    res.status(200).json({ message: "Question Updated Successfully" });
})

module.exports.mcqSingleResult = asyncWrapper(async (req, res) => {
    const { questionId, userAnswer } = req.body;

    // Fetch the question from the database
    const question = await questionsModel.findById(questionId);

    // Check if the question exists
    if (!question) {
        throw new ExpressError(404, "Question not found!");
    }

    // Check if the user's answer matches the correct answer
    const isCorrect = question.correctAnswers.includes(userAnswer);

    return res.status(200).json({
        isCorrect,
        message: isCorrect ? "Correct answer!" : "Incorrect answer!"
    });
});


// // -------------------------------------reading_fill_in_the_blanks----------------------------------


module.exports.addReadingFillInTheBlanks = asyncWrapper(async (req, res) => {
    const { error, value } = readingFillInTheBlanksSchemaValidator.validate(req.body);

    if (error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;
    const newQuestion = await Question.create(value);

    // console.log(value);
    res.status(200).json({ data: newQuestion });
})

module.exports.editReadingFillInTheBlanks = asyncWrapper(async (req, res) => {
    const { questionId, newData } = req.body;


    const { error, value } = readingFillInTheBlanksSchemaValidator.validate(newData);


    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(401, "Question Id required");

    await Question.findByIdAndUpdate(questionId, value);


    res.status(200).json({ message: "Question Updated Successfully" });
})


module.exports.getReadingFillInTheBlanks = asyncWrapper(async (req, res) => {
    const allReadingFillInTheBlanks = await Question.find({ subtype: "reading_fill_in_the_blanks" }).sort({ createdAt: -1 });

    res.status(200).json({ data: allReadingFillInTheBlanks });
})

module.exports.readingFillInTheBlanksResult = asyncWrapper(async (req, res) => {
    const { questionId, blanks } = req.body;

    // console.log(questionId, blanks);

    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question Not Found!");
    }

    let score = 0;
    const totalBlanks = question.blanks.length;

    blanks.forEach((userBlank) => {
        const correctBlank = question.blanks.find(
            (blank) => blank.index === userBlank.index
        );

        if (correctBlank && userBlank.selectedAnswer === correctBlank.correctAnswer) {
            score++;
        }
    });

    const result = {
        score,
        totalBlanks,
    };

    const feedback = `You scored ${score} out of ${totalBlanks}.`;

    return res.status(200).json({
        result,
        feedback,
    });
});


// -------------------------------------reorder_paragraphs----------------------------------



module.exports.addReOrderParagraphs = asyncWrapper(async (req, res) => {
    const { error, value } = reorderParagraphsSchemaValidator.validate(req.body);

    const { type = 'reading', subtype = 'reorder_paragraphs', prompt, options } = value;
    const userId = req.user._id;

    if (error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;
    const newQuestion = await Question.create({
        type,
        subtype,
        prompt,
        options,
        createdBy: userId,
    });

    // console.log(value);
    res.status(200).json({ data: newQuestion });
})

module.exports.editReorderParagraphs = asyncWrapper(async (req, res) => {
    const { questionId, newData } = req.body;


    const { error, value } = reorderParagraphsSchemaValidator.validate(newData);

    const { type = 'reading', subtype = 'reorder_paragraphs', prompt, paragraphs } = value;


    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(401, "Question Id required");

    await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        prompt,
        paragraphs,
    });


    res.status(200).json({ message: "Question Updated Successfully" });
})

module.exports.getReorderParagraphs = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const allReorderParagraphs = await questionsModel.find({ subtype: "reorder_paragraphs" })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

    const questionsCount = await questionsModel.countDocuments({ subtype: 'reorder_paragraphs' });

    res.status(200).json({ data: allReorderParagraphs, questionsCount });
})

module.exports.getAReorderParagraph = asyncWrapper(async (req, res) => {
    const { questionId } = req.params;
    
    // Fetch the question from the database
    const question = await questionsModel.findById(questionId);

    // Check if the question exists
    if (!question) {
        throw new ExpressError(404, "Question not found!");
    }

    // Fisher-Yates Shuffle function to randomize the options
    const shuffleArray = (array) => {
        let shuffledArray = array.slice(); // Create a copy of the array
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; // Swap elements
        }
        return shuffledArray;
    };

    // Randomize the options before sending them
    const randomizedOptions = shuffleArray(question.options);

    // Return the question with randomized options
    res.status(200).json({
        data: {
            ...question.toObject(),
            options: randomizedOptions // Include randomized options in the response
        }
    });
});

module.exports.reorderParagraphsResult = asyncWrapper(async (req, res) => {
    const { questionId, userReorderedOptions } = req.body;

    // Validate input
    if (!questionId || !Array.isArray(userReorderedOptions)) {
        throw new ExpressError(400, "questionId and userReorderedOptions are required!");
    }

    // Fetch the question from the database
    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question not found");
    }

    const correctAnswers = question.options;  // The original, correct order

    // Check if the user's reordered options match the correct order
    let score = 0;

    // Compare user's answer with correct answers
    userReorderedOptions.forEach((userAnswer, index) => {
        if (userAnswer === correctAnswers[index]) {
            score += 1;
        }
    });

    // Calculate the total score as a percentage of correct answers
    const totalScore = (score / correctAnswers.length) * 100;

    // Send the result back to the user
    return res.status(200).json({
        score: totalScore, // Percentage score
        message: `You scored ${score} out of ${correctAnswers.length} points.`,
        userAnswer: userReorderedOptions,
        correctAnswer: correctAnswers
    });
});

