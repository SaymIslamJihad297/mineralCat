const questionsModel = require("../../models/questions.model");
const ExpressError = require("../../utils/ExpressError");
const { addSummarizeTextSchemaValidator, writeEmailSchemaValidator } = require("../../validations/schemaValidations");
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const { default: axios } = require("axios");
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({subtype: "summarize_written_text"})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    const questionsCount = await questionsModel.countDocuments({subtype: 'summarize_written_text'});
    res.status(200).json({questions, questionsCount});
})
module.exports.summarizeWrittenTextResult = asyncWrapper(async (req, res) => {
    const { questionId, userSummary } = req.body;

    if (!questionId || !userSummary) {
        throw new ExpressError(400, "questionId and userSummary are required!");
    }

    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question not found");
    }

    const originalParagraph = question.text;

    const prompt = `
    You are an expert at evaluating summaries of written texts. Below is the original paragraph and the summary written by the user.

    Original Paragraph: 
    ${originalParagraph}

    User's Summary: 
    ${userSummary}

    Please evaluate the user's summary and provide a score out of 7 in the following categories:
    - Content (0-2)
    - Grammar (0-2)
    - Form (0-1)
    - Vocabulary Range (0-2)

    Provide a breakdown of the score in the following format:
    Score: X/7
    Enabling Skills:
    Content: X/2
    Grammar: X/2
    Form: X/1
    Vocabulary Range: X/2

    Please also provide any feedback or suggestions for improvement. 
    `;

    try {
    const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
            {
                role: "system",
                content: "You are an expert at evaluating summaries of written texts."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        max_tokens: 500,
        temperature: 0.7,
    });

    console.log("GPT Response:", gptResponse.choices[0].message.content);

    const gptResult = gptResponse.choices[0].message.content;

    const parsedResult = parseGPTResponse(gptResult);
    return res.status(200).json(parsedResult);
} catch (error) {
    console.error(error);
    throw new ExpressError(500, "An error occurred while processing the request.");
}
});

function parseGPTResponse(responseText) {
    const regex = /Score:\s*(\d)\/7\nEnabling Skills:\nContent:\s*(\d)\/2\nGrammar:\s*(\d)\/2\nForm:\s*(\d)\/1\nVocabulary Range:\s*(\d)\/2/g;
    const matches = regex.exec(responseText);
    
    if (!matches) {
        throw new Error('Unable to parse GPT response');
    }
    const feedback = responseText.split('Feedback:')[1]?.trim() || "No feedback provided.";

    return {
        score: parseInt(matches[1]),
        content: parseInt(matches[2]),
        grammar: parseInt(matches[3]),
        form: parseInt(matches[4]),
        vocabularyRange: parseInt(matches[5]),
        feedback: feedback,
    };
}

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
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({subtype: "write_email"})
    .limit(limit)
    .skip(skip)
    .sort({createdAt: -1});
    const questionsCount = await questionsModel.countDocuments({subtype: 'write_email'});
    res.status(200).json({questions, questionsCount});
})
