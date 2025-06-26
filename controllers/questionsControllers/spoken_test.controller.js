const cloudinary = require('../../middleware/cloudinary.config');
const path = require('path');
const ExpressError = require('../../utils/ExpressError');
const fs = require('node:fs');
const questionsModel = require("../../models/questions.model");
const { summarizeSpokenTextSchemaValidator, addMultipleChoiceAndMultipleAnswersSchemaValidator, addListeningFillInTheBlanksSchemaValidator, addMultipleChoiceSingleAnswerSchemaValidator } = require('../../validations/schemaValidations');
const { asyncWrapper } = require("../../utils/AsyncWrapper");
const https = require('https');
const axios = require('axios');
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// --------------------------summarization spoken text-------------------------
module.exports.addSummarizeSpokenText = asyncWrapper(async (req, res) => {

    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');

    const { error, value } = summarizeSpokenTextSchemaValidator.validate(req.body);

    const { type = 'listening', subtype = 'summarize_spoken_text', heading } = value;

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
        createdBy: req.user._id
    };

    const newQuestion = await questionsModel.create(data)

    res.status(200).json(newQuestion);
})

module.exports.editSummarizeSpokenText = asyncWrapper(async (req, res) => {
    const { questionId, ...data } = req.body;
    // Validate incoming data (excluding questionId)
    const { error, value } = summarizeSpokenTextSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (req.file !== undefined) {
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
    const question = await questionsModel.findByIdAndUpdate(questionId, value, { new: true });
    if (!question) throw new ExpressError(404, 'Question not found');

    res.status(200).json({
        message: "Question updated successfully",
        question: question,
    });
})

module.exports.getAllSummarizeSpokenText = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'summarize_spoken_text' })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);

    const questionsCount = await questionsModel.countDocuments({ subtype: 'summarize_spoken_text' });
    res.status(200).json({ questions, questionsCount });
})

const downloadAndEncodeAudio = async (audioUrl) => {
    return new Promise((resolve, reject) => {
        console.log('Downloading audio from:', audioUrl);

        https.get(audioUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download audio: ${response.statusCode}`));
                return;
            }

            let data = [];
            let totalLength = 0;

            response.on('data', (chunk) => {
                data.push(chunk);
                totalLength += chunk.length;

                if (totalLength > 10 * 1024 * 1024) {
                    reject(new Error('Audio file too large (>10MB)'));
                    return;
                }
            });

            response.on('end', () => {
                try {
                    const audioBuffer = Buffer.concat(data);
                    const audioBase64 = audioBuffer.toString('base64');

                    console.log(`Audio downloaded: ${totalLength} bytes`);
                    resolve({
                        base64: audioBase64,
                        size: totalLength,
                        contentType: response.headers['content-type'] || 'audio/mpeg'
                    });
                } catch (error) {
                    reject(new Error('Failed to encode audio to base64: ' + error.message));
                }
            });

            response.on('error', (err) => {
                reject(new Error('Download error: ' + err.message));
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

// Function to extract clean transcript from API response
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

const scoreWithChatGPT = async (originalTranscript, userSummary) => {
    try {
        const prompt = `
You are an expert English language assessor for PTE (Pearson Test of English) Academic's "Summarize Written Text" task.

TASK: Evaluate how well the user's summary captures the key information from the original text.

ORIGINAL TEXT:
"${originalTranscript}"

USER'S SUMMARY:
"${userSummary}"

SCORING CRITERIA (Total: 10 points):
1. Content (0-2 points): How well does the summary capture the main ideas and key supporting points?
2. Form (0-2 points): Is it a single sentence between 5-75 words?
3. Grammar (0-2 points): Are there grammatical errors?
4. Vocabulary (0-2 points): Is the vocabulary appropriate and accurate?
5. Coherence (0-2 points): Does the summary flow logically and connect ideas well?

Please provide:
1. Individual scores for each criterion (0-2 points each)
2. Total score out of 10
3. Brief feedback explaining the strengths and areas for improvement
4. Word count of the summary

Format your response as JSON:
{
  "scores": {
    "content": 0-2,
    "form": 0-2,
    "grammar": 0-2,
    "vocabulary": 0-2,
    "coherence": 0-2
  },
  "total_score": 0-10,
  "word_count": number,
  "feedback": {
    "strengths": "...",
    "improvements": "...",
    "overall": "..."
  }
}
`;

        // Request configuration to OpenAI GPT
        const response = await openai.chat.completions.create({
            model: "gpt-4",  // Use GPT-4 model
            messages: [
                { role: "system", content: "You are an expert PTE Academic assessor specializing in the 'Summarize Written Text' task. Provide accurate, fair, and constructive assessments." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        // Log the result and return it
        console.log("GPT Response:", response.choices[0].message.content);
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('Error calling ChatGPT:', error);
        throw new Error('Failed to get ChatGPT assessment: ' + error.message);
    }
};

module.exports.summerizeSpokenTextResult = asyncWrapper(async (req, res) => {
    const { questionId, userSummary } = req.body;

    if (!questionId || !userSummary) {
        return res.status(400).json({ message: 'questionId and userSummary are required.' });
    }

    try {
        const question = await questionsModel.findById(questionId);
        if (!question) {
            throw new ExpressError(404, 'Question not found!');
        }

        if (question.subtype !== 'summarize_spoken_text') {
            throw new ExpressError(401, "this is not valid questionType for this route!")
        }

        const audioUrl = question.audioUrl;
        if (!audioUrl) {
            throw new ExpressError(404, 'Audio URL not found for this question!');
        }

        console.log('Starting audio download and processing...');
        const audioData = await downloadAndEncodeAudio(audioUrl);
        const audioFormat = detectAudioFormat(audioUrl, audioData.contentType);

        const requestData = {
            audio_base64: audioData.base64,
            audio_format: audioFormat
        };

        const config = {
            method: 'post',
            url: 'https://apis.languageconfidence.ai/speech-assessment/unscripted/us',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'api-key': process.env.LANGUAGE_CONFIDENCE_PRIMARY_API
            },
            data: requestData,
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024
        };

        console.log('Making API request to Language Confidence...');
        const apiResponse = await axios.request(config);

        const originalTranscript = extractTranscript(apiResponse.data);
        if (!originalTranscript) {
            throw new Error('Could not extract transcript from API response');
        }

        console.log('Extracted transcript:', originalTranscript);

        console.log('Sending to ChatGPT for assessment...');
        const chatGPTAssessment = await scoreWithChatGPT(originalTranscript, userSummary);

        const finalResult = {

            original_transcript: originalTranscript,
            user_summary: userSummary,

            summarize_text_score: chatGPTAssessment,

            summary: {
                // pronunciation_score: apiResponse.data.pronunciation?.overall_score || 0,
                // fluency_score: apiResponse.data.fluency?.overall_score || 0,
                // grammar_score: apiResponse.data.grammar?.overall_score || 0,
                // vocabulary_score: apiResponse.data.vocabulary?.overall_score || 0,
                // overall_language_score: apiResponse.data.overall?.overall_score || 0,
                summary_quality_score: chatGPTAssessment.total_score,
                combined_assessment: {
                    summary_writing_ability: `${chatGPTAssessment.total_score}/10`
                }
            }
        };

        console.log('Assessment complete!');
        return res.status(200).json(finalResult);

    } catch (error) {
        console.error('Error during audio processing:', error);

        if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);

            return res.status(error.response.status).json({
                message: 'API request failed',
                details: error.response.data,
                status: error.response.status
            });
        } else {
            return res.status(500).json({
                message: 'Error processing request',
                details: error.message
            });
        }
    }
});
// --------------------------multiple choice and multiple answers---------------

module.exports.addMultipleChoicesAndMultipleAnswers = asyncWrapper(async (req, res) => {

    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');

    if (typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
        req.body.options = JSON.parse(req.body.options);
        req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
    }
    const { error, value } = addMultipleChoiceAndMultipleAnswersSchemaValidator.validate(req.body);

    const { type = 'listening', subtype = 'listening_multiple_choice_multiple_answers', heading, prompt, options, correctAnswers } = value;

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
        createdBy: req.user._id
    };

    const newQuestion = await questionsModel.create(data)

    res.status(200).json(newQuestion);
})

module.exports.editMultipleChoicesAndMultipleAnswers = asyncWrapper(async (req, res) => {

    if (typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
        req.body.options = JSON.parse(req.body.options);
        req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
    }
    const { questionId, ...data } = req.body;

    const { error, value } = addMultipleChoiceAndMultipleAnswersSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (req.file !== undefined) {
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
    const question = await questionsModel.findByIdAndUpdate(questionId, value, { new: true });
    if (!question) throw new ExpressError(404, 'Question not found');


    res.status(200).json({
        message: "Question updated successfully",
        question: question,
    });
})

module.exports.getAllMultipleChoicesAndMultipleAnswers = asyncWrapper(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const questions = await questionsModel.find({ subtype: 'listening_multiple_choice_multiple_answers' })
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });
    if (!questions) throw new ExpressError('No question found', 404);
    const questionsCount = await questionsModel.countDocuments({ subtype: 'listening_multiple_choice_multiple_answers' });
    res.status(200).json({ questions, questionsCount });
})

module.exports.multipleChoicesAndMultipleAnswersResult = asyncWrapper(async (req, res) => {
    const { questionId, selectedAnswers } = req.body;

    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question Not Found!");
    }
    if (question.subtype !== 'listening_multiple_choice_multiple_answers') {
        throw new ExpressError(401, "this is not valid questionType for this route!")
    }

    const correctAnswers = question.correctAnswers;
    let score = 0;

    selectedAnswers.forEach((userAnswer) => {
        if (correctAnswers.includes(userAnswer)) {
            score++;
        }
    });

    const result = {
        score,
        totalCorrectAnswers: correctAnswers.length,
        correctAnswersGiven: score === correctAnswers.length,
    };

    const feedback = `You scored ${score} out of ${correctAnswers.length}.`;

    return res.status(200).json({
        result,
        feedback,
    });
})

// --------------------------listening fill in the blanks-----------------
module.exports.addListeningFillInTheBlanks = asyncWrapper(async (req, res) => {
    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');

    if (typeof req.body.blanks === 'string') {
        req.body.blanks = JSON.parse(req.body.blanks);
    }

    const { error, value } = addListeningFillInTheBlanksSchemaValidator.validate(req.body);
    if (error) throw new ExpressError(400, error.details[0].message);

    const { type = 'listening', subtype = 'listening_fill_in_the_blanks', heading, prompt, blanks } = value;

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

module.exports.editListeningFillInTheBlanks = asyncWrapper(async (req, res) => {
    if (typeof req.body.blanks === 'string') {
        req.body.blanks = JSON.parse(req.body.blanks);
    }
    const { questionId, ...data } = req.body;

    const { error, value } = addListeningFillInTheBlanksSchemaValidator.validate(data);
    if (error) throw new ExpressError(400, error.details[0].message);

    if (!questionId) throw new ExpressError(400, "Question ID is required");

    if (req.file !== undefined) {
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
    const question = await questionsModel.findByIdAndUpdate(questionId, value, { new: true });
    if (!question) throw new ExpressError(404, 'Question not found');


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
    const questionsCount = await questionsModel.countDocuments({ subtype: 'listening_fill_in_the_blanks' });
    res.status(200).json({ questions, questionsCount });
});

module.exports.listeningFillInTheBlanksResult = asyncWrapper(async (req, res) => {
    const { questionId, selectedAnswers } = req.body;

    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question Not Found!");
    }

    if (question.subtype !== 'listening_fill_in_the_blanks') {
        throw new ExpressError(401, "This is not a valid questionType for this route!");
    }
    console.log(question);

    const blanks = question.blanks;
    console.log(blanks);

    let score = 0;

    selectedAnswers.forEach((userAnswer, index) => {
        const correctAnswer = blanks[index]?.correctAnswer;

        if (correctAnswer && correctAnswer === userAnswer) {
            score++;
        }
    });

    const result = {
        score,
        totalCorrectAnswers: blanks.length,
        correctAnswersGiven: score === blanks.length,
    };

    const feedback = `You scored ${score} out of ${blanks.length}.`;

    return res.status(200).json({
        result,
        feedback,
    });
});


// --------------------------multiple choice single answers-----------------
module.exports.addMultipleChoiceSingleAnswers = asyncWrapper(async (req, res) => {
    if (req.file === undefined) throw new ExpressError(400, 'Please upload a file');



    if (typeof req.body.options === 'string' || typeof req.body.correctAnswers === 'string') {
        req.body.options = JSON.parse(req.body.options);
        req.body.correctAnswers = JSON.parse(req.body.correctAnswers);
    }
    const { error, value } = addMultipleChoiceSingleAnswerSchemaValidator.validate(req.body);
    const { type = 'listening', subtype = 'listening_multiple_choice_single_answers', heading, prompt, options, correctAnswers } = value;

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
        createdBy: req.user._id
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

    if (req.file !== undefined) {
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

    const question = await questionsModel.findByIdAndUpdate(questionId, value, { new: true });
    if (!question) throw new ExpressError(404, 'Question not found');


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
    const questionsCount = await questionsModel.countDocuments({ subtype: 'listening_multiple_choice_single_answers' });
    res.status(200).json({ questions, questionsCount });
});

module.exports.multipleChoiceSingleAnswerResult = asyncWrapper(async(req, res)=>{
    const { questionId, selectedAnswers } = req.body;

    console.log(selectedAnswers.length);

    if(selectedAnswers.length > 1){
        throw new ExpressError(401, "multiple answer is not allowed!");
    }
    

    const question = await questionsModel.findById(questionId);
    if (!question) {
        throw new ExpressError(404, "Question Not Found!");
    }
    if (question.subtype !== 'listening_multiple_choice_single_answers') {
        throw new ExpressError(401, "this is not valid questionType for this route!")
    }

    const correctAnswers = question.correctAnswers;
    let score = 0;

    selectedAnswers.forEach((userAnswer) => {
        if (correctAnswers.includes(userAnswer)) {
            score++;
        }
    });

    const result = {
        score,
        totalCorrectAnswers: correctAnswers.length,
        correctAnswersGiven: score === correctAnswers.length,
    };

    const feedback = `You scored ${score} out of ${correctAnswers.length}.`;

    return res.status(200).json({
        result,
        feedback,
    });
})