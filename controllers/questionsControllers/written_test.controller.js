const questionsModel = require("../../models/questions.model");
const ExpressError = require("../../utils/ExpressError");
const { addSummarizeTextSchemaValidator, writeEmailSchemaValidator, EditWriteEmailSchemaValidator } = require("../../validations/schemaValidations");
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const { default: axios } = require("axios");
const { OpenAI } = require('openai');
const practicedModel = require("../../models/practiced.model");
const { getQuestionByQuery } = require("../../common/getQuestionFunction");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// --------------------------- summarize written text ---------------------



module.exports.addSummarizeWrittenText = asyncWrapper(async (req, res) => {
    if (req.body.type != 'writing' || req.body.subtype != 'summarize_written_text') {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }
    const { error, value } = addSummarizeTextSchemaValidator.validate(req.body);

    const { type = 'writing', subtype = 'summarize_written_text', heading, prompt } = value;

    if (error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        prompt,
    });

    res.status(200).json({ data: newQuestion });
})


module.exports.editSummarizeWrittenText = asyncWrapper(async (req, res) => {
    if ((req.body.newData.type && req.body.newData.type != 'writing') || (req.body.newData.subtype && req.body.newData.subtype != 'summarize_written_text')) {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }
    const { questionId, newData } = req.body;


    const { error, value } = addSummarizeTextSchemaValidator.validate(newData);

    const { type = 'writing', subtype = 'summarize_written_text', heading, text } = value;


    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(401, "Question Id required");

    await questionsModel.findByIdAndUpdate(questionId, {
        type,
        subtype,
        heading,
        text,
    });


    res.status(200).json({ message: "Question Updated Successfully" });
})

module.exports.getSummarizeWrittenText = asyncWrapper(async (req, res) => {
    const query = req.query.query;
    const {page, limit} = req.query;
    getQuestionByQuery(query, 'summarize_written_text', page, limit,req, res);
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

    if (question.subtype !== 'summarize_written_text') {
        throw new ExpressError(401, "this is not valid questionType for this route!")
    }


    const originalParagraph = question.prompt;

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

        const gptResult = gptResponse.choices[0].message.content;

        const parsedResult = parseGPTResponse(gptResult);

        await practicedModel.findOneAndUpdate(
            {
                user: req.user._id,
                questionType: question.type,
                subtype: question.subtype
            },
            {
                $addToSet: { practicedQuestions: question._id }
            },
            { upsert: true, new: true }
        );

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

module.exports.addWriteEmail = asyncWrapper(async (req, res) => {
    if (req.body.type != 'writing' || req.body.subtype != 'write_email') {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { error, value } = writeEmailSchemaValidator.validate(req.body);

    const { type = 'writing', subtype = 'write_email', heading, prompt } = value;

    if (error) throw new ExpressError(400, error.details[0].message);

    value.createdBy = req.user._id;

    const newQuestion = await questionsModel.create({
        type,
        subtype,
        heading,
        prompt,
    });

    res.status(200).json({ data: newQuestion });
})

module.exports.editWriteEmail = asyncWrapper(async (req, res) => {
    if ((req.body.newData.type && req.body.newData.type != 'writing') || (req.body.newData.subtype && req.body.newData.subtype != 'write_email')) {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }
    const { questionId, newData } = req.body;


    const { error, value } = EditWriteEmailSchemaValidator.validate(newData);

    const { type = 'writing', subtype = 'write_email', heading, prompt } = value;


    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(401, "Question Id required");

    await questionsModel.findByIdAndUpdate(questionId, {
        type,
        subtype,
        heading,
        prompt,
    });


    res.status(200).json({ message: "Question Updated Successfully" });
})

module.exports.getWriteEmail = asyncWrapper(async (req, res) => {
    const query = req.query.query;
    const {page, limit} = 10;

    getQuestionByQuery(query, 'write_email', page, limit,req, res);
})

module.exports.writeEmailResult = asyncWrapper(async (req, res) => {
    const { questionId, email } = req.body;

    if (!questionId || !email) {
        throw new ExpressError(400, "questionId and email are required!");
    }

    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question not found");
    }
    if (question.subtype !== 'write_email') {
        throw new ExpressError(401, "this is not valid questionType for this route!")
    }

    const originalEmailTemplate = question.prompt;

    const prompt = `
    You are an expert at evaluating the structure, grammar, spelling, and overall quality of emails. Below is the original email template and the email written by the user.

    Original Email Template: 
    ${originalEmailTemplate}

    User's Email: 
    ${email}

    Please evaluate the user's email and provide a score out of 15 in the following categories:
    - Content (0-3)
    - Grammar (0-2)
    - Spelling (0-2)
    - Form (0-2)
    - Organization (0-2)
    - Email Convention (0-2)
    - Vocabulary Range (0-2)

    Provide a breakdown of the score in the following format:
    Score: X/15
    Enabling Skills:
    Content: X/3
    Grammar: X/2
    Spelling: X/2
    Form: X/2
    Organization: X/2
    Email Convention: X/2
    Vocabulary Range: X/2

    Please also provide any feedback or suggestions for improvement.
    `;

    function parseGPTResponseForWriteEmail(responseText) {
        const regex = /Score:\s*(\d+(\.\d+)?)\/15\s*Enabling Skills:\s*Content:\s*(\d+)\/3\s*Grammar:\s*(\d+)\/2\s*Spelling:\s*(\d+)\/2\s*Form:\s*(\d+)\/2\s*Organization:\s*(\d+)\/2\s*Email Convention:\s*(\d+)\/2\s*Vocabulary Range:\s*(\d+)\/2\s*Feedback:\s*([\s\S]+)/;

        const matches = regex.exec(responseText);

        if (!matches) {
            throw new Error('Unable to parse GPT response');
        }

        return {
            score: parseFloat(matches[1]),
            content: parseInt(matches[3]),
            grammar: parseInt(matches[4]),
            spelling: parseInt(matches[5]),
            form: parseFloat(matches[6]),
            organization: parseInt(matches[7]),
            emailConvention: parseInt(matches[8]),
            vocabularyRange: parseInt(matches[9]),
            feedback: matches[10].trim()
        };
    }


    // try {
    const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
            {
                role: "system",
                content: "You are an expert at evaluating emails."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        max_tokens: 500,
        temperature: 0.7,
    });

    // console.log("GPT Response:", gptResponse.choices[0].message.content);

    const gptResult = gptResponse.choices[0].message.content;
    const parsedResult = parseGPTResponseForWriteEmail(gptResult);

    await practicedModel.findOneAndUpdate(
        {
            user: req.user._id,
            questionType: question.type,
            subtype: question.subtype
        },
        {
            $addToSet: { practicedQuestions: question._id }
        },
        { upsert: true, new: true }
    );

    return res.status(200).json(parsedResult);
    // } catch (error) {
    //     console.error(error);
    //     throw new ExpressError(500, "An error occurred while processing the request.");
    // }
});
