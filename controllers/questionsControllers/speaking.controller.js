const questionsModel = require("../../models/questions.model");
const ExpressError = require("../../utils/ExpressError");
const { readAloudSchemaValidator, repeatSentenceSchemaValidator, respondToASituationSchemaValidator, answerShortQuestionSchemaValidator } = require("../../validations/schemaValidations");
const cloudinary = require('../../middleware/cloudinary.config');
const path = require('path');
const fs = require('node:fs');
const { asyncWrapper } = require("../../utils/AsyncWrapper");

// ------------------------------------------------------------readAloud---------------------------------------------------
module.exports.addReadAloud = asyncWrapper(async (req, res) => {

    const {error, value} = readAloudSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);
    
    const {type='speaking', subtype='read_aloud', heading, prompt} = value;

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

    const { error, value } = readAloudSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    const {type='speaking', subtype='read_aloud', heading, prompt} = value;


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

    
    const questions = await questionsModel.find({subtype: 'read_aloud'})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    const questionsCount = await questionsModel.countDocuments();
    if(!questions) throw new ExpressError('No question found', 404);
    res.status(200).json({questions, questionsCount});
}

// ------------------------------------------------------------repeatSentence---------------------------------------------------
module.exports.addRepeatSentence = asyncWrapper(async (req, res) => {
    const {error, value} = repeatSentenceSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);
    
    const {type='speaking', subtype='repeat_sentence', heading} = value;

    const folderName = 'repeatSentence';
    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');
    const userId = req.user._id;

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })
    
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
    const { error, value } = repeatSentenceSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
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

    const questions = await questionsModel.find({subtype: 'repeat_sentence'})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    if(!questions) throw new ExpressError('No question found', 404);
    res.status(200).json(questions);
})


// ------------------------------------------------------------respondToASituation---------------------------------------------------


module.exports.addRespondToASituation = asyncWrapper(async (req, res) => {
    const {error, value} = respondToASituationSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);

    const {type='speaking', subtype='respond_to_situation', heading, prompt} = value;

    if(req.file === undefined) throw new ExpressError(400, 'Please upload a file');

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

    const { error, value } = respondToASituationSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
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

    const questions = await questionsModel.find({subtype: 'respond_to_situation'})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    if(!questions) throw new ExpressError('No question found', 404);
    res.status(200).json(questions);
})


// ------------------------------------------------------------answerShortQuestion---------------------------------------------------

module.exports.addAnswerShortQuestion = asyncWrapper(async (req, res) => {
    const {error, value} = answerShortQuestionSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);
    
    const {type='speaking', subtype='answer_short_question', heading} = value;

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

    const { error, value } = answerShortQuestionSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
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

    const questions = await questionsModel.find({subtype: 'answer_short_question'})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    if(!questions) throw new ExpressError('No question found', 404);
    res.status(200).json(questions);
})


