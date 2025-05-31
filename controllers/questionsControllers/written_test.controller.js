const questionsModel = require("../../models/questions.model");
const ExpressError = require("../../utils/ExpressError");
const { addSummarizeTextSchemaValidator, writeEmailSchemaValidator } = require("../../validations/schemaValidations");
const { asyncWrapper } = require("../../utils/AsyncWrapper");

// --------------------------- summarize written text ---------------------



module.exports.addSummarizeWrittenText = asyncWrapper(async(req, res)=>{
    const {error, value} = addSummarizeTextSchemaValidator.validate(req.body);

    const {type='writing', subtype='summarize_written_text', heading, text} = value;

    if(error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        text,
    });

    res.status(200).json({data: newQuestion});
})


module.exports.editSummarizeWrittenText = asyncWrapper(async(req, res)=>{
    const {questionId, newData} = req.body;
    

    const {error, value} = addSummarizeTextSchemaValidator.validate(newData);

    const {type='writing', subtype='summarize_written_text', heading, text} = value;
    

    if(error) throw new ExpressError(400, error.details[0].message);

    if(!questionId) throw new ExpressError(401, "Question Id required");

    await questionsModel.findByIdAndUpdate(questionId, {
        type,
        subtype,
        heading,
        text,
});


    res.status(200).json({message: "Question Updated Successfully"});
})

module.exports.getSummarizeWrittenText = asyncWrapper(async(req, res)=>{
    const allSummarizeWrittenTextQUestions = await questionsModel.find({subtype: "summarize_written_text"}).sort({createdAt: -1});

    res.status(200).json({data: allSummarizeWrittenTextQUestions});
})


// ------------------- write email --------------------------------------

module.exports.addWriteEmail = asyncWrapper(async(req, res)=>{
    const {error, value} = writeEmailSchemaValidator.validate(req.body);

    const {type='writing', subtype='write_email', heading, prompt} = value;

    if(error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        prompt,
    });

    res.status(200).json({data: newQuestion});
})

module.exports.editWriteEmail = asyncWrapper(async(req, res)=>{
    const {questionId, newData} = req.body;
    

    const {error, value} = writeEmailSchemaValidator.validate(newData);

    const {type='writing', subtype='write_email', heading, prompt} = value;
    

    if(error) throw new ExpressError(400, error.details[0].message);

    if(!questionId) throw new ExpressError(401, "Question Id required");

    await questionsModel.findByIdAndUpdate(questionId, {
        type,
        subtype,
        heading,
        prompt,
    });


    res.status(200).json({message: "Question Updated Successfully"});
})

module.exports.getWriteEmail = asyncWrapper(async(req, res)=>{
    const allWriteEmailQUestions = await questionsModel.find({subtype: "write_email"}).sort({createdAt: -1});

    res.status(200).json({data: allWriteEmailQUestions});
})
