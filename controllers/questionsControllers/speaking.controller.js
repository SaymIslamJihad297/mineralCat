const questionsModel = require("../../models/questions.model");
const ExpressError = require("../../utils/ExpressError");
const { readAloudSchemaValidator, repeatSentenceSchemaValidator, respondToASituationSchemaValidator, answerShortQuestionSchemaValidator, editreadAloudSchemaValidator, editrepeatSentenceSchemaValidator, editrespondToASituationSchemaValidator, editanswerShortQuestionSchemaValidator } = require("../../validations/schemaValidations");
const cloudinary = require('../../middleware/cloudinary.config');
const path = require('path');
const fs = require('node:fs');
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const { default: axios } = require("axios");
const fsPromises = require('fs').promises;

// ------------------------------------------------------------readAloud---------------------------------------------------
module.exports.addReadAloud = asyncWrapper(async (req, res) => {

    const { error, value } = readAloudSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);

    const { type = 'speaking', subtype = 'read_aloud', heading, prompt } = value;

    const userId = req.user._id;

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        prompt,
        createdBy: userId,
    });

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });

})

module.exports.editReadAloud = asyncWrapper(async (req, res) => {
    const { questionId, ...data } = req.body;

    const { error, value } = editreadAloudSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    const { type = 'speaking', subtype = 'read_aloud', heading, prompt } = value;


    if (!questionId) throw new ExpressError(400, "Question ID is required");

    const question = await questionsModel.findByIdAndUpdate(
        questionId,
        {
            type,
            subtype,
            heading,
            prompt,
            createdBy: req.user._id,
        },
        { new: true }
    );

    if (!question) throw new ExpressError('Question not found', 404);

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
});

module.exports.getAllReadAloud = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'read_aloud' })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });
    const questionsCount = await questionsModel.countDocuments({ subtype: 'read_aloud' });
    if (!questions) throw new ExpressError('No question found', 404);
    res.status(200).json({ questions, questionsCount });
}

module.exports.readAloudResult = asyncWrapper(async (req, res) => {

    const { questionId, format, accent = 'us' } = req.body; // Default to 'us' accent

    if (!questionId) {
        throw new ExpressError(400, "questionId is required!");
    }
    if (!req.file) {
        throw new ExpressError(400, "voice is required!");
    }
    if(path.extname(req.file.originalname)!=='.wav'){
        throw new ExpressError(401, "only .wav file is supported");
    }
    // console.log(path.extname(req.file.originalname));
    
    if (!format) {
        throw new ExpressError(400, "format is required!");
    }
    
    let fileBuffer;
    try {
        fileBuffer = fs.readFileSync(req.file.path);
    } catch (readError) {
        console.error("Failed to read uploaded file from disk:", readError);
        throw new ExpressError(500, "Failed to read uploaded file from disk: " + readError.message);
    }

    const fileBase64 = fileBuffer.toString('base64');

    const question = await questionsModel.findById(questionId);
    if (!question) {
        try {
            await fsPromises.unlink(req.file.path);
        } catch (err) {
            console.error("Failed to delete file:", err);
        }
        throw new ExpressError(404, "Question not found!");
    }
    console.log(question.prompt);

    let data = JSON.stringify({
        "audio_base64": fileBase64,
        "audio_format": format,
        // "user_metadata": {},
        "expected_text": question.prompt
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.LANGUAGE_CONFIDENCE_BASE_URL}/speech-assessment/scripted/${accent}`, // Use accent parameter
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': process.env.LANGUAGE_CONFIDENCE_SECONDARY_API,
        },
        data: data
    };

    try {
        const response = await axios.request(config);
        // console.log("API Response:", JSON.stringify(response.data, null, 2));
        
        try {
            await fsPromises.unlink(req.file.path);
        } catch (err) {
            console.error("Failed to delete temp file:", err);
        }
        
        return res.status(200).json({ 
            success: true,
            data: response.data 
        });
    } catch (error) {
        console.error("Error from Language Confidence API:", error.response ? error.response.data : error.message);
        
        if (req.file && req.file.path) {
            try {
                await fsPromises.unlink(req.file.path);
            } catch (err) {
                console.error("Failed to delete temp file on error:", err);
            }
        }
        
        const errorMessage = error.response 
            ? JSON.stringify(error.response.data)
            : error.message;
            
        throw new ExpressError(500, "Error assessing speech: " + errorMessage);
    }
});
// ------------------------------------------------------------repeatSentence---------------------------------------------------
module.exports.addRepeatSentence = asyncWrapper(async (req, res) => {

    const { error, value } = repeatSentenceSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);

    const { type = 'speaking', subtype = 'repeat_sentence', heading } = value;

    const folderName = 'repeatSentence';
    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');
    const userId = req.user._id;

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })

    // console.log(result);


    fs.unlinkSync(req.file.path);

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        audioUrl: result.secure_url,
        createdBy: userId,
    });

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });
})


module.exports.editRepeatSentence = asyncWrapper(async (req, res) => {

    const { questionId, ...data } = req.body;

    // Validate incoming data (excluding questionId)
    const { error, value } = editrepeatSentenceSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (req.file !== undefined) {
        const folderName = 'repeatSentence';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    value.type = 'speaking';
    value.subtype = 'repeat_sentence';

    const question = await questionsModel.findByIdAndUpdate(
        questionId,
        {
            ...value,
            createdBy: req.user._id,
        },
        { new: true }
    );

    if (!question) throw new ExpressError('Question not found', 404);

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
})

module.exports.getAllRepeatSentence = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'repeat_sentence' })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({ subtype: 'repeat_sentence' });
    res.status(200).json({ questions, questionsCount });
})


// ------------------------------------------------------------respondToASituation---------------------------------------------------


module.exports.addRespondToASituation = asyncWrapper(async (req, res) => {
    const { error, value } = respondToASituationSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);

    const { type = 'speaking', subtype = 'respond_to_situation', heading, prompt } = value;

    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');

    const folderName = 'respondToASituation';

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })

    fs.unlinkSync(req.file.path);

    const userId = req.user._id;

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        prompt,
        audioUrl: result.secure_url,
        createdBy: userId,
    });

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });

})


module.exports.editRespondToASituation = asyncWrapper(async (req, res) => {
    const { questionId, ...data } = req.body;

    const { error, value } = editrespondToASituationSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (req.file !== undefined) {
        const folderName = 'respondToASituation';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    value.type = 'speaking';
    value.subtype = 'respond_to_situation';

    const question = await questionsModel.findByIdAndUpdate(
        questionId,
        {
            ...value,
            createdBy: req.user._id,
        },
        { new: true }
    );

    if (!question) throw new ExpressError('Question not found', 404);

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
})


module.exports.getAllRespondToASituation = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'respond_to_situation' })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({ subtype: 'respond_to_situation' });
    res.status(200).json({ questions, questionsCount });
})


// ------------------------------------------------------------answerShortQuestion---------------------------------------------------

module.exports.addAnswerShortQuestion = asyncWrapper(async (req, res) => {
    const { error, value } = answerShortQuestionSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);

    const { type = 'speaking', subtype = 'answer_short_question', heading } = value;

    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');
    const folderName = 'answerShortQuestion';

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })

    const userId = req.user._id;

    fs.unlinkSync(req.file.path);

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        audioUrl: result.secure_url,
        createdBy: userId,
    });

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });

})

module.exports.editAnswerShortQuestion = asyncWrapper(async (req, res) => {
    const { questionId, ...data } = req.body;

    const { error, value } = editanswerShortQuestionSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (req.file !== undefined) {
        const folderName = 'answerShortQuestion';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    value.type = 'speaking';
    value.subtype = 'answer_short_question';

    const question = await questionsModel.findByIdAndUpdate(
        questionId,
        {
            ...value,
            createdBy: req.user._id,
        },
        { new: true }
    );

    if (!question) throw new ExpressError('Question not found', 404);

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
})


module.exports.getAllAnswerShortQuestion = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'answer_short_question' })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({ subtype: 'respond_to_situation' });

    res.status(200).json({ questions, questionsCount });
})


