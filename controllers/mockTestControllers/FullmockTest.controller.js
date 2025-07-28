const FullmockTestSchema = require("../../models/mock_test.model");
const { mockTestSchemaValidator } = require("../../validations/schemaValidations");


module.exports.addMockTest = async (req, res) => {

    console.log(req.body);
    

    const {error, value} = mockTestSchemaValidator.validate(req.body);
    const {name, duration: {hours, minutes}, questions} = value;
    const userId = req.user._id;

    const newMockTest = await FullmockTestSchema.create({
        name,
        duration: {
            hours,
            minutes
        },
        questions,
        createdBy: userId
    });

    if (!newMockTest) {
        return res.status(500).json({
            success: false,
            message: "Failed to create mock test"
        });
    }
    return res.status(201).json({
        success: true,
        message: "Mock test created successfully",
        data: newMockTest
    });
}


module.exports.getSingleMockTest = async (req, res) => {
    const { id } = req.params;
    try {
        const mockTest = await FullmockTestSchema.findById(id).populate("questions");
        console.log(mockTest);
        
        if (!mockTest) {
            return res.status(404).json({ message: "Mock test not found" });
        }
        res.status(200).json(mockTest);
    } catch (error) {
        console.error("Error fetching mock test:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}


module.exports.updateMockTest = async (req, res) => {
    const { id } = req.params;
    const { name, duration: { hours, minutes } } = req.body;

    try {
        const updatedMockTest = await FullmockTestSchema.findByIdAndUpdate(
            id,
            {
                name,
                duration: {
                    hours,
                    minutes
                }
            },
            { new: true }
        );

        if (!updatedMockTest) {
            return res.status(404).json({ message: "Mock test not found" });
        }

        res.status(200).json(updatedMockTest);
    } catch (error) {
        console.error("Error updating mock test:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}


module.exports.deleteMockTest = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedMockTest = await FullmockTestSchema.findByIdAndDelete(id);

        if (!deletedMockTest) {
            return res.status(404).json({ message: "Mock test not found" });
        }

        res.status(200).json({ message: "Mock test deleted successfully" });
    } catch (error) {
        console.error("Error deleting mock test:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}


module.exports.getAllMockTests = async (req, res) => {
  try {
    const FullmockTests = await FullmockTestSchema.find({}, { name: 1, duration: 1 })
      .sort({ createdAt: -1 });

    const totalCount = await FullmockTestSchema.countDocuments();

    res.status(200).json({
      totalCount,
      FullmockTests
    });
  } catch (error) {
    console.error("Error fetching mock tests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
