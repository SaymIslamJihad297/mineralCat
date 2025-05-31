const { sectionalMockTestSchemaValidator } = require("../../validations/schemaValidations");
const {asyncWrapper} = require("../../utils/AsyncWrapper");
const sectionalMockTestModel = require("../../models/sectionalMockTest.model");


module.exports.addSectionalMockTest = asyncWrapper(async (req, res) => {
        const {error, value} = sectionalMockTestSchemaValidator.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const { type, name, duration, questions } = value;

        // Create a new sectional mock test
        const sectionalMockTest = await sectionalMockTestModel.create({
            type,
            name,
            duration,
            questions,
            createdBy: req.user._id
        });

        return res.status(201).json({ message: 'Sectional Mock Test created successfully', sectionalMockTest });
})

module.exports.getAllSectionalMockTest = asyncWrapper(async (req, res) => {
    const { type } = req.params;
    if (!type) {
        return res.status(400).json({ message: 'Type is required' });
    }
    const sectionalMockTests = await sectionalMockTestModel.find({ type }).populate('questions.question');
    if (!sectionalMockTests || sectionalMockTests.length === 0) {
        return res.status(404).json({ message: 'No sectional mock tests found' });
    }

    return res.status(200).json({ message: 'Sectional Mock Tests retrieved successfully', sectionalMockTests });
})


module.exports.deleteSectionalMockTest = asyncWrapper(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'ID is required' });
    }
    const sectionalMockTest = await sectionalMockTestModel.findByIdAndDelete(id);
    if (!sectionalMockTest) {
        return res.status(404).json({ message: 'Sectional Mock Test not found' });
    }

    return res.status(200).json({ message: 'Sectional Mock Test deleted successfully', sectionalMockTest });
})