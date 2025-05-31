const mongoose = require('mongoose');
const Question = require('../../models/questions.model');
const { FillInTheBlanksQuestionSchemaValidator, mcqMultipleSchemaValidator, mcqSingleSchemaValidator, readingFillInTheBlanksSchemaValidator, reorderParagraphsSchemaValidator } = require('../../validations/schemaValidations');
const ExpressError = require('../../utils/ExpressError');
const { asyncWrapper } = require("../../utils/AsyncWrapper");


// ---------------------- reading and writing fill in the blanks-=----------------------
module.exports.addFillInTheBlanks = asyncWrapper(async(req, res)=>{
    const {error, value} = FillInTheBlanksQuestionSchemaValidator.validate(req.body);

    if(error) throw new ExpressError(400, error.details[0].message);
    const {type='reading', subtype='rw_fill_in_the_blanks', prompt, blanks, heading } = value;

    const userId = req.user._id;
    
    const newQuestion = await Question.create({
        type,
        subtype,
        heading,
        prompt,
        blanks,
        createdBy: userId,
    })

    res.json({newQuestion});
})

module.exports.getAllFillInTheBlanks = asyncWrapper(async(req, res)=>{
    const allFillinTheBlanks = await Question.find({subtype: "rw_fill_in_the_blanks"}).sort({createdAt: -1});

    res.status(200).json({data: allFillinTheBlanks});
})

module.exports.editFillIntheBlanks = asyncWrapper(async(req, res)=>{
    const {questionId, newData} = req.body;
    

    const {error, value} = FillInTheBlanksQuestionSchemaValidator.validate(newData);

    const {type='reading', subtype='rw_fill_in_the_blanks', prompt, blanks, heading } = value;

    if(error) throw new ExpressError(400, error.details[0].message);

    if(!questionId) throw new ExpressError(401, "Question Id required");

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        heading,
        prompt,
        blanks,
    });


    res.status(200).json({message: "Question Updated Successfully"});
})

module.exports.deleteQuestion = asyncWrapper(async(req, res)=>{
    const {questionId} = req.body;

    await Question.findByIdAndDelete(questionId);

    res.status(200).json({message: "Question Deleted"});
})


// -------------------------------------mcq_multiple----------------------------------

module.exports.addMcqMultiple = asyncWrapper(async(req, res)=>{

    const {error, value} = mcqMultipleSchemaValidator.validate(req.body);

    const {type='reading', subtype='mcq_multiple', prompt, options, correctAnswers } = value;
    const userId = req.user._id;

    if(error) throw new ExpressError(400, error.details[0].message);


    const newQuestion = await Question.create({
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
        createdBy: userId,
    });


    res.status(200).json({data: newQuestion});
})
module.exports.getMcqMultiple = asyncWrapper(async(req, res)=>{
    const allMcqMultipleQuestions = await Question.find({subtype: "mcq_multiple"}).sort({createdAt: -1});

    res.status(200).json({data: allMcqMultipleQuestions});
})

module.exports.editMcqMultiple = asyncWrapper(async(req, res)=>{
    const {questionId, newData} = req.body;
    

    const {error, value} = mcqMultipleSchemaValidator.validate(newData);

    const {type='reading', subtype='mcq_multiple', prompt, options, correctAnswers } = value;

    if(error) throw new ExpressError(400, error.details[0].message);

    if(!questionId) throw new ExpressError(401, "Question Id required");

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
    });


    res.status(200).json({message: "Question Updated Successfully", updatedQuestion});
})




// -------------------------------------mcq_single----------------------------------

module.exports.addMcqSingle = asyncWrapper(async(req, res)=>{

    const {error, value} = mcqSingleSchemaValidator.validate(req.body);

    const {type='reading', subtype='mcq_single', prompt, options, correctAnswers } = value;
    const userId = req.user._id;

    if(error) throw new ExpressError(400, error.details[0].message);

    if(value.correctAnswers.length > 1) throw new ExpressError(400, "Multiple answer not allowed for mcq_single");

    value.createdBy = req.user._id;

    const newQuestion = await Question.create({
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
        createdBy: userId,
    });


    res.status(200).json({data: newQuestion});
})

module.exports.getMcqSingle = asyncWrapper(async(req, res)=>{
    const allMcqSingle = await Question.find({subtype: "mcq_single"}).sort({createdAt: -1});

    res.status(200).json({data: allMcqSingle});
})


module.exports.editMcqSingle = asyncWrapper(async(req, res)=>{
    const {questionId, newData} = req.body;
    

    const {error, value} = mcqSingleSchemaValidator.validate(newData);

    const {type='reading', subtype='mcq_single', prompt, options, correctAnswers } = value;

    if(error) throw new ExpressError(400, error.details[0].message);

    if(value.correctAnswers.length > 1) throw new ExpressError(400, "Multiple answer not allowed for mcq_single");

    if(!questionId) throw new ExpressError(401, "Question Id required");

    const updatedQuestion = await Question.findByIdAndUpdate(questionId,    {
        type,
        subtype,
        prompt,
        options,
        correctAnswers,
    }, {new: true});


    res.status(200).json({message: "Question Updated Successfully"});
})



// // -------------------------------------reading_fill_in_the_blanks----------------------------------


// module.exports.addReadingFillInTheBlanks = async(req, res)=>{
//     const {error, value} = readingFillInTheBlanksSchemaValidator.validate(req.body);

//     if(error) throw new ExpressError(400, error.details[0].message);

//     value.createdBy = req.user._id;
//     const newQuestion = await Question.create(value);

//     // console.log(value);
//     res.status(200).json({data: newQuestion});
// }

// module.exports.editReadingFillInTheBlanks = async(req, res)=>{
//     const {questionId, newData} = req.body;
    

//     const {error, value} = readingFillInTheBlanksSchemaValidator.validate(newData);
    

//     if(error) throw new ExpressError(400, error.details[0].message);

//     if(!questionId) throw new ExpressError(401, "Question Id required");

//     await Question.findByIdAndUpdate(questionId, value);


//     res.status(200).json({message: "Question Updated Successfully"});
// }


// module.exports.getReadingFillInTheBlanks = async(req, res)=>{
//     const allReadingFillInTheBlanks = await Question.find({subtype: "reading_fill_in_the_blanks"}).sort({createdAt: -1});

//     res.status(200).json({data: allReadingFillInTheBlanks});
// }



// -------------------------------------reorder_paragraphs----------------------------------



module.exports.addReOrderParagraphs = asyncWrapper(async(req, res)=>{
    const {error, value} = reorderParagraphsSchemaValidator.validate(req.body);

    const {type='reading', subtype='reorder_paragraphs', prompt, paragraphs } = value;
    const userId = req.user._id;

    if(error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;
    const newQuestion = await Question.create({
        type,
        subtype,
        prompt,
        paragraphs,
        createdBy: userId,
    });

    // console.log(value);
    res.status(200).json({data: newQuestion});
})

module.exports.editReorderParagraphs = asyncWrapper(async(req, res)=>{
    const {questionId, newData} = req.body;
    

    const {error, value} = reorderParagraphsSchemaValidator.validate(newData);

    const {type='reading', subtype='reorder_paragraphs', prompt, paragraphs } = value;
    

    if(error) throw new ExpressError(400, error.details[0].message);

    if(!questionId) throw new ExpressError(401, "Question Id required");

    await Question.findByIdAndUpdate(questionId, {
        type,
        subtype,
        prompt,
        paragraphs,
    });


    res.status(200).json({message: "Question Updated Successfully"});
})

module.exports.getReorderParagraphs = asyncWrapper(async(req, res)=>{
    const allReorderParagraphs = await Question.find({subtype: "reorder_paragraphs"}).sort({createdAt: -1});

    res.status(200).json({data: allReorderParagraphs});
})

