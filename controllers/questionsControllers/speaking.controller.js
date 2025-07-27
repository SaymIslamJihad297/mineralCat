const questionsModel = require("../../models/questions.model");
const ExpressError = require("../../utils/ExpressError");
const {
    readAloudSchemaValidator,
    repeatSentenceSchemaValidator,
    respondToASituationSchemaValidator,
    answerShortQuestionSchemaValidator,
    editreadAloudSchemaValidator,
    editrepeatSentenceSchemaValidator,
    editrespondToASituationSchemaValidator,
    editanswerShortQuestionSchemaValidator
} = require("../../validations/schemaValidations");
const cloudinary = require('../../middleware/cloudinary.config');
const path = require('path');
const fs = require('node:fs');
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const { default: axios } = require("axios");
const fsPromises = require('fs').promises;
const https = require('https');
const { OpenAI } = require('openai');
const practicedModel = require("../../models/practiced.model");
const { getQuestionByQuery } = require("../../common/getQuestionFunction");


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// ============================================================
// HELPER FUNCTIONS
// ============================================================

// File operations
async function safeDeleteFile(filePath) {
    if (filePath) {
        try {
            await fsPromises.unlink(filePath);
        } catch (err) {
            console.error("Failed to delete temp file:", err);
        }
    }
}

function readFileAsBase64(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return fileBuffer.toString('base64');
    } catch (readError) {
        console.error("Failed to read file from disk:", readError);
        throw new ExpressError(500, "Failed to read file from disk: " + readError.message);
    }
}

async function uploadToCloudinary(file, folderName) {
    if (!file) throw new ExpressError(400, 'Please upload a file');

    const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        public_id: `${path.basename(file.originalname, path.extname(file.originalname))}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        folder: `listening_test/${folderName}`,
        type: 'authenticated',
    });

    fs.unlinkSync(file.path);
    return result.secure_url;
}

const downloadAndSaveAudio = async (audioUrl) => {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(audioUrl);
        const filePath = path.join('downloads', fileName);

        if (!fs.existsSync('downloads')) {
            fs.mkdirSync('downloads');
        }

        const fileStream = fs.createWriteStream(filePath);

        https.get(audioUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download audio: ${response.statusCode}`));
                return;
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                resolve(filePath);
            });

            fileStream.on('error', (err) => {
                reject(new Error('Error saving audio file: ' + err.message));
            });
        }).on('error', (err) => {
            reject(new Error('Request error: ' + err.message));
        });
    });
};

const detectAudioFormat = (audioUrl, contentType) => {
    const extension = path.extname(audioUrl).toLowerCase();

    if (extension === '.mp3' || contentType?.includes('mpeg')) return 'mp3';
    if (extension === '.wav' || contentType?.includes('wav')) return 'wav';
    if (extension === '.m4a' || contentType?.includes('m4a')) return 'm4a';
    if (extension === '.ogg' || contentType?.includes('ogg')) return 'ogg';

    return 'mp3';
};

const extractTranscript = (apiResponse) => {
    try {
        if (apiResponse.vocabulary?.feedback?.tagged_transcript) {
            return apiResponse.vocabulary.feedback.tagged_transcript;
        }

        if (apiResponse.fluency?.feedback?.tagged_transcript) {
            return apiResponse.fluency.feedback.tagged_transcript
                .replace(/<discourse-marker[^>]*>(.*?)<\/discourse-marker>/g, '$1')
                .replace(/<[^>]*>/g, '')
                .trim();
        }

        if (apiResponse.metadata?.predicted_text) {
            return apiResponse.metadata.predicted_text;
        }

        return null;
    } catch (error) {
        console.error('Error extracting transcript:', error);
        return null;
    }
};

async function callSpeechAssessmentAPI(audioBase64, audioFormat, expectedText, accent) {
    const data = JSON.stringify({
        "audio_base64": audioBase64,
        "audio_format": audioFormat,
        "expected_text": expectedText,
    });

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.LANGUAGE_CONFIDENCE_BASE_URL}/speech-assessment/scripted/${accent}`,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': process.env.LANGUAGE_CONFIDENCE_SECONDARY_API,
        },
        data: data
    };

    try {
        const response = await axios.request(config);
        return response.data;
    } catch (error) {
        console.error("Error from Language Confidence API:", error.response ? error.response.data : error.message);

        const errorMessage = error.response
            ? JSON.stringify(error.response.data)
            : error.message;

        throw new ExpressError(500, "Error assessing speech: " + errorMessage);
    }
}

async function addQuestion(validator, data, userId, audioFile = null, folderName = null, convertToText = false) {
    const { error, value } = validator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    let questionData = {
        ...value,
        createdBy: userId,
    };

    if (audioFile && convertToText === true) {
        const audioFilePath = audioFile.path;
        const userFileBase64 = readFileAsBase64(audioFilePath);
        const audioFormat = detectAudioFormat(audioFilePath);
        const expectedText = "sdfsdfsfsdff"

        const response = await callSpeechAssessmentAPI(
            userFileBase64,
            audioFormat,
            expectedText,
            'us'
        );
        const ConvertedText = extractTranscript(response);
        questionData.audioConvertedText = ConvertedText;
    }
    if (audioFile && folderName) {
        questionData.audioUrl = await uploadToCloudinary(audioFile, folderName);
    }

    const newQuestion = await questionsModel.create(questionData);
    return newQuestion;
}

async function editQuestion(validator, questionId, data, userId, audioFile = null, folderName = null) {
    const { error, value } = validator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (audioFile && folderName) {
        value.audioUrl = await uploadToCloudinary(audioFile, folderName);
    }

    const question = await questionsModel.findByIdAndUpdate(
        questionId,
        { ...value, createdBy: userId },
        { new: true }
    );

    if (!question) throw new ExpressError('Question not found', 404);
    return question;
}

async function getAllQuestions(subtype, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

    if (!questions) throw new ExpressError('No question found', 404);

    const questionsCount = await questionsModel.countDocuments({ subtype });
    return { questions, questionsCount };
}

async function handleSpeechAssessment(req, res, expectedSubtype, useDirectPrompt = true) {
    const { questionId, accent = 'us', format } = req.body;
    let userFilePath = req.file?.path;

    try {
        if (!questionId) throw new ExpressError(400, "questionId is required!");
        if (!req.file) throw new ExpressError(400, "voice is required!");

        const question = await questionsModel.findById(questionId);
        if (!question) {
            throw new ExpressError(404, "Question not found!");
        }

        if (question.subtype !== expectedSubtype) {
            throw new ExpressError(401, "this is not valid questionType for this route!");
        }

        const userFileBase64 = readFileAsBase64(userFilePath);
        const audioFormat = format || detectAudioFormat(userFilePath);

        const expectedText = useDirectPrompt ? question.prompt : question.prompt;

        const response = await callSpeechAssessmentAPI(
            userFileBase64,
            audioFormat,
            expectedText,
            accent
        );

        await safeDeleteFile(userFilePath);

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

        return res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        await safeDeleteFile(userFilePath);
        throw error;
    }
}

// ============================================================
// READ ALOUD FUNCTIONS
// ============================================================

module.exports.addReadAloud = asyncWrapper(async (req, res) => {

    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if (newData.type != 'speaking' || newData.subtype != 'read_aloud') {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { type = 'speaking', subtype = 'read_aloud', heading, prompt } = newData;
    const newQuestion = await addQuestion(
        readAloudSchemaValidator,
        { type, subtype, heading, prompt },
        req.user._id
    );

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });
});

module.exports.editReadAloud = asyncWrapper(async (req, res) => {
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if ((newData.type && newData.type != 'speaking') || (newData.subtype && newData.subtype != 'read_aloud')) {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { questionId, ...data } = newData;
    const { type = 'speaking', subtype = 'read_aloud', heading, prompt } = data;

    const question = await editQuestion(
        editreadAloudSchemaValidator,
        questionId,
        { type, subtype, heading, prompt },
        req.user._id
    );

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
});

module.exports.getAllReadAloud = asyncWrapper(async (req, res) => {
    const query = req.query.query;
    if(!query) query = 'all';
    const { page, limit } = req.query;

    getQuestionByQuery(query, 'read_aloud', page, limit, req, res);
});

module.exports.readAloudResult = asyncWrapper(async (req, res) => {
    return handleSpeechAssessment(req, res, 'read_aloud');
});

// ============================================================
// REPEAT SENTENCE FUNCTIONS
// ============================================================

module.exports.addRepeatSentence = asyncWrapper(async (req, res) => {
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if (newData.type != 'speaking' || newData.subtype != 'repeat_sentence') {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { type = 'speaking', subtype = 'repeat_sentence', heading } = newData;
    const newQuestion = await addQuestion(
        repeatSentenceSchemaValidator,
        { type, subtype, heading },
        req.user._id,
        req.file,
        'repeatSentence',
        true
    );

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });
});

module.exports.editRepeatSentence = asyncWrapper(async (req, res) => {
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if ((newData.type && newData.type != 'speaking') || (newData.subtype && newData.subtype != 'repeat_sentence')) {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { questionId, ...data } = newData;
    data.type = 'speaking';
    data.subtype = 'repeat_sentence';

    const question = await editQuestion(
        editrepeatSentenceSchemaValidator,
        questionId,
        data,
        req.user._id,
        req.file,
        'repeatSentence'
    );

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
});

module.exports.getAllRepeatSentence = asyncWrapper(async (req, res) => {
    const query = req.query.query;
    if(!query) query = 'all';
    const { page, limit } = req.query;

    getQuestionByQuery(query, 'repeat_sentence', page, limit, req, res);
});


module.exports.repeatSentenceResult = asyncWrapper(async (req, res) => {
    const { questionId, accent = 'us' } = req.body;
    let userFilePath = req.file?.path;

    try {
        if (!questionId) throw new ExpressError(400, "questionId is required!");
        if (!req.file) throw new ExpressError(400, "voice is required!");

        const question = await questionsModel.findById(questionId);
        if (!question) throw new ExpressError(404, "Question Not Found!");

        const userfileBase64 = readFileAsBase64(userFilePath);
        const expectedText = question.audioConvertedText;
        const finalFormat = detectAudioFormat(userFilePath);

        const finalResponse = await callSpeechAssessmentAPI(
            userfileBase64,
            finalFormat,
            expectedText,
            accent
        );

        await safeDeleteFile(userFilePath);

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

        return res.status(200).json({
            success: true,
            data: finalResponse
        });

    } catch (error) {
        await safeDeleteFile(userFilePath);
        throw error;
    }
});

// ============================================================
// RESPOND TO SITUATION FUNCTIONS
// ============================================================

module.exports.addRespondToASituation = asyncWrapper(async (req, res) => {
    if (!req.file) {
        throw new ExpressError(400, "File is Required");
    }
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if (newData.type != 'speaking' || newData.subtype != 'respond_to_situation') {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { type = 'speaking', subtype = 'respond_to_situation', heading, prompt } = newData;
    const newQuestion = await addQuestion(
        respondToASituationSchemaValidator,
        { type, subtype, heading, prompt },
        req.user._id,
        req.file,
        'respondToASituation'
    );

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });
});

module.exports.editRespondToASituation = asyncWrapper(async (req, res) => {
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if ((newData.type && newData.type != 'speaking') || (newData.subtype && newData.subtype != 'respond_to_situation')) {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { questionId, ...data } = newData;
    data.type = 'speaking';
    data.subtype = 'respond_to_situation';

    const question = await editQuestion(
        editrespondToASituationSchemaValidator,
        questionId,
        data,
        req.user._id,
        req.file,
        'respondToASituation'
    );

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
});

module.exports.getAllRespondToASituation = asyncWrapper(async (req, res) => {
    const query = req.query.query;
    if(!query) query = 'all';
    const { page, limit } = req.query;

    getQuestionByQuery(query, 'respond_to_situation', page, limit, req, res);
});


module.exports.respondToASituationResult = asyncWrapper(async (req, res) => {
    if (req.file && path.extname(req.file.originalname) !== '.wav') {
        throw new ExpressError(401, "only .wav file is supported");
    }

    return handleSpeechAssessment(req, res, 'respond_to_situation');
});

// ============================================================
// ANSWER SHORT QUESTION FUNCTIONS
// ============================================================

module.exports.addAnswerShortQuestion = asyncWrapper(async (req, res) => {
    if (!req.file) {
        throw new ExpressError(400, "File is Required");
    }
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if (newData.type != 'speaking' || newData.subtype != 'answer_short_question') {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { type = 'speaking', subtype = 'answer_short_question', heading } = newData;
    const newQuestion = await addQuestion(
        answerShortQuestionSchemaValidator,
        { type, subtype, heading },
        req.user._id,
        req.file,
        'answerShortQuestion',
        true
    );

    return res.status(200).json({
        message: "Question added successfully",
        question: newQuestion,
    });
});

module.exports.editAnswerShortQuestion = asyncWrapper(async (req, res) => {
    const newData = req.body;

    if (!newData) {
        throw new ExpressError(400, "New data is required");
    }

    if ((newData.type && newData.type != 'speaking') || (newData.subtype && newData.subtype != 'answer_short_question')) {
        throw new ExpressError(400, "question type or subtype is not valid!");
    }

    const { questionId, ...data } = newData;
    data.type = 'speaking';
    data.subtype = 'answer_short_question';

    const question = await editQuestion(
        editanswerShortQuestionSchemaValidator,
        questionId,
        data,
        req.user._id,
        req.file,
        'answerShortQuestion'
    );

    return res.status(200).json({
        message: "Question updated successfully",
        question,
    });
});

module.exports.getAllAnswerShortQuestion = asyncWrapper(async (req, res) => {
    const query = req.query.query;
    if(!query) query = 'all';
    const { page, limit } = req.query;

    getQuestionByQuery(query, 'answer_short_question', page, limit, req, res);
});


module.exports.answerShortQuestionResult = asyncWrapper(async (req, res) => {
    const { questionId, accent = 'us' } = req.body;
    let mainAudioFile = null;
    let userFilePath = req.file?.path;

    try {
        if (!questionId) throw new ExpressError(400, "questionId is required!");
        if (!req.file) throw new ExpressError(400, "voice is required!");

        const question = await questionsModel.findById(questionId);
        if (!question) throw new ExpressError(404, "Question Not Found!");

        const userfileBase64 = readFileAsBase64(userFilePath);
        const mainAudioText = question.audioConvertedText;
        const finalFormat = detectAudioFormat(userFilePath);

        const finalResponse = await callSpeechAssessmentAPI(
            userfileBase64,
            finalFormat,
            "sdfsdfsty",
            accent
        );

        const userText = extractTranscript(finalResponse);

        await safeDeleteFile(userFilePath);
        userFilePath = null;

        const prompt = `
You are an expert language assessor, and your task is to evaluate the speaking and listening abilities of a user based on a question prompt and their response. Below are the inputs:

**Main Audio Text (Question):**
"${mainAudioText}"

**User's Answer (Response):**
"${userText}"

Please evaluate the user's response in the following categories:
1. **Speaking**: Based on the content and coherence of the user’s spoken answer. The answer should be evaluated based on:
   - How well the user answered the question.
   - How relevant the response is to the question.
   - The organization and clarity of the answer.
   - Score the user’s speaking ability out of 1.
   
2. **Listening**: Based on how well the user understood the question and responded appropriately.
   - Score the user's listening ability out of 1.

3. **Enabling Skills**: Does the user demonstrate clear enabling skills (e.g., vocabulary use, organization of the response)?
   - Mark 'YES' or 'NO'.

4. **Fluency**: Evaluate how smoothly the user speaks without unnatural pauses or hesitation.
   - Score fluency out of 1.

5. **Pronunciation**: Evaluate how well the user pronounces words, including clarity and accuracy.
   - Score pronunciation out of 1.

Please provide the following result in this format and Format your response as JSON:
{
    "Speaking": 0-1,
    "Listening": 0-1, 
    "Enabling Skills": "[YES/NO]", 
    "Fluency": 0-1,
    "Pronunciation": 0-1 
}

`;
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are an expert language assessor evaluating user responses based on several criteria." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 500
        });
        const result = JSON.parse(response.choices[0].message.content);

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

        res.status(200).json({ success: true, result });

    } catch (error) {
        if (mainAudioFile) {
            await safeDeleteFile(mainAudioFile);
        }
        if (userFilePath) {
            await safeDeleteFile(userFilePath);
        }

        throw error;
    }
});
