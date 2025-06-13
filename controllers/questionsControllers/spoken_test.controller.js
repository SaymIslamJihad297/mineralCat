const cloudinary = require('../../middleware/cloudinary.config');
const path = require('path');
const ExpressError = require('../../utils/ExpressError');
const fs = require('node:fs');
const questionsModel = require("../../models/questions.model");
const { summarizeSpokenTextSchemaValidator, addMultipleChoiceAndMultipleAnswersSchemaValidator, addListeningFillInTheBlanksSchemaValidator, addMultipleChoiceSingleAnswerSchemaValidator } = require('../../validations/schemaValidations');
const { asyncWrapper } = require("../../utils/AsyncWrapper");

// --------------------------summarization spoken text-------------------------
module.exports.addSummarizeSpokenText = asyncWrapper(async(req, res)=>{

    if(req.file === undefined) throw new ExpressError(400, 'Please upload a file');

    const {error, value} = summarizeSpokenTextSchemaValidator.validate(req.body);
    
    const {type='listening', subtype='summarize_spoken_text', heading} = value;

    const folderName = 'summarizeSpokenText';

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })

    fs.unlinkSync(req.file.path);

    const data = {
        type,
        subtype,
        heading,
        audioUrl: result.secure_url,
        createdBy : req.user._id
      };
      
      const newQuestion = await questionsModel.create(data)

      res.status(200).json(newQuestion);
})

module.exports.editSummarizeSpokenText = asyncWrapper(async(req, res)=>{
    const { questionId, ...data } = req.body;
    // Validate incoming data (excluding questionId)
    const { error, value } = summarizeSpokenTextSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
        const folderName = 'summarizeSpokenText';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    const question = await questionsModel.findByIdAndUpdate(questionId, value, {new: true});
    if(!question) throw new ExpressError(404, 'Question not found');
    
    res.status(200).json({
        message: "Question updated successfully",
        question: question,
    });
})

module.exports.getAllSummarizeSpokenText = asyncWrapper(async(req, res)=>{
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({subtype: 'summarize_spoken_text'})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    if(!questions) throw new ExpressError('No question found', 404);

    const questionsCount = await questionsModel.countDocuments({subtype: 'summarize_spoken_text'});
    res.status(200).json({questions, questionsCount});
})

// --------------------------multiple choice and multiple answers---------------

module.exports.addMultipleChoicesAndMultipleAnswers = asyncWrapper(async(req, res)=>{

    if(req.file === undefined) throw new ExpressError(400, 'Please upload a file');

    if (typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
        req.body.options = JSON.parse(req.body.options);
        req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
      }
    const {error, value} = addMultipleChoiceAndMultipleAnswersSchemaValidator.validate(req.body);
    
    const {type='listening', subtype='listening_multiple_choice_multiple_answers', heading, prompt, options, correctAnswers} = value;

    const folderName = 'multiplechoicesmultipleanswers';

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })

    fs.unlinkSync(req.file.path);

    const data = {
        type,
        subtype,
        heading,
        prompt,
        options,
        correctAnswers,
        audioUrl: result.secure_url,
        createdBy : req.user._id
      };
      
      const newQuestion = await questionsModel.create(data)

      res.status(200).json(newQuestion);
})

module.exports.editMultipleChoicesAndMultipleAnswers = asyncWrapper(async(req, res)=>{

  if(typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
    req.body.options = JSON.parse(req.body.options);
    req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
  }
    const { questionId, ...data } = req.body;
    
    const { error, value } = addMultipleChoiceAndMultipleAnswersSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
        const folderName = 'multiplechoicesmultipleanswers';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    const question = await questionsModel.findByIdAndUpdate(questionId, value, {new: true});
    if(!question) throw new ExpressError(404, 'Question not found');


    res.status(200).json({
        message: "Question updated successfully",
        question: question,
    });
})

module.exports.getAllMultipleChoicesAndMultipleAnswers = asyncWrapper(async(req, res)=>{
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({subtype: 'listening_multiple_choice_multiple_answers'})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    if(!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({subtype: 'listening_multiple_choice_multiple_answers'});
    res.status(200).json({questions, questionsCount});
})



// --------------------------listening fill in the blanks-----------------
module.exports.addListeningFillInTheBlanks = asyncWrapper(async (req, res) => {
    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');

      if (typeof req.body.blanks === 'string') {
        req.body.blanks = JSON.parse(req.body.blanks);
      }
  
      const { error, value } = addListeningFillInTheBlanksSchemaValidator.validate(req.body);
      if (error) throw new ExpressError(400, error.details[0].message);
  
      const { type='listening', subtype='listening_fill_in_the_blanks', heading, prompt, blanks } = value;
  
      const folderName = 'listeningfillintheblanks';
  
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
      });
  
      fs.unlinkSync(req.file.path);
  
      const data = {
        type,
        subtype,
        heading,
        prompt,
        blanks,
        audioUrl: result.secure_url,
        createdBy: req.user._id
      };
  
      const newQuestion = await questionsModel.create(data);
  
      res.status(200).json(newQuestion);
});

module.exports.editListeningFillInTheBlanks =asyncWrapper( async (req, res) => {
    if (typeof req.body.blanks === 'string') {
        req.body.blanks = JSON.parse(req.body.blanks);
      }
    const { questionId, ...data } = req.body;
    
    const { error, value } = addListeningFillInTheBlanksSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
        const folderName = 'listeningfillintheblanks';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    const question = await questionsModel.findByIdAndUpdate(questionId, value, {new: true});
    if(!question) throw new ExpressError(404, 'Question not found');


    res.status(200).json({
        message: "Question updated successfully",
        question: question,
    });
})

module.exports.getAllListeningFillInTheBlanks = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'listening_fill_in_the_blanks' })
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({subtype: 'listening_fill_in_the_blanks'});
    res.status(200).json({questions, questionsCount});
});


// --------------------------multiple choice single answers-----------------
module.exports.addMultipleChoiceSingleAnswers = asyncWrapper(async (req, res) => {
    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');

      

    if (typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
        req.body.options = JSON.parse(req.body.options);
        req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
      }
    const { error, value } = addMultipleChoiceSingleAnswerSchemaValidator.validate(req.body);
    const { type='listening', subtype='listening_multiple_choice_single_answers', heading, prompt, options, correctAnswers } = value;

    const folderName = 'multiplechoicesingleanswers';

    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    })

    fs.unlinkSync(req.file.path);

    const data = {
        type,
        subtype,
        heading,
        prompt,
        options,
        correctAnswers,
        audioUrl: result.secure_url,
        createdBy : req.user._id
      };
      
      const newQuestion = await questionsModel.create(data)

      res.status(200).json(newQuestion);
})


module.exports.editMultipleChoiceSingleAnswers = asyncWrapper(async (req, res) => {
    if (typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
        req.body.options = JSON.parse(req.body.options);
        req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
      }
    const { questionId, ...data } = req.body;
    
    const { error, value } = addMultipleChoiceSingleAnswerSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if(req.file !== undefined) {
        const folderName = 'multiplechoicesingleanswers';
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            public_id: `${path.basename(req.file.originalname, path.extname(req.file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            folder: `listening_test/${folderName}`,
            type: 'authenticated',
        })

        fs.unlinkSync(req.file.path);
        value.audioUrl = result.secure_url;
    }
    value.type = 'listening';
    value.subtype = 'listening_multiple_choice_single_answers';
    
    const question = await questionsModel.findByIdAndUpdate(questionId, value, {new: true});
    if(!question) throw new ExpressError(404, 'Question not found');


    res.status(200).json({
        message: "Question updated successfully",
        question: question,
    });
})

module.exports.getAllMultipleChoiceSingleAnswers = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'listening_multiple_choice_single_answers' })
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({subtype: 'listening_multiple_choice_single_answers'});
    res.status(200).json({questions, questionsCount});
});

