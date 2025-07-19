const { Schema, default: mongoose } = require('mongoose');


const practicedSchema = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        unique: true,
        required: true,
    },
    questionType: {
        type: String,
        enum: ['speaking', 'writing', 'reading', 'listening'],
        required: true
    },
    subtype: {
        type: String,
        enum: [
            // Speaking
            'read_aloud', 'repeat_sentence', 'describe_image',
            'respond_to_situation', 'answer_short_question',

            // Writing
            'summarize_written_text', 'write_email',

            // Reading
            'rw_fill_in_the_blanks', 'mcq_multiple', 'reorder_paragraphs',
            'reading_fill_in_the_blanks', 'mcq_single',

            // Listening
            'summarize_spoken_text', 'listening_fill_in_the_blanks',
            'listening_multiple_choice_multiple_answers', 'listening_multiple_choice_single_answers'
        ],
        required: true
    },
    practicedQuestion: {
        type: Schema.Types.ObjectId,
        ref: 'Question',
    }
})


module.exports = mongoose.model('Practice', practicedSchema);