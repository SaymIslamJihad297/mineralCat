const router = require("express").Router();
const { addMockTest, getSingleMockTest, updateMockTest, deleteMockTest, getAllMockTests } = require("../../controllers/mockTestControllers/FullmockTest.controller");
const { isUserLoggedIn , isAdminUser} = require('../../middleware/middlewares');

router.post("/add", isUserLoggedIn, isAdminUser, addMockTest);

router.get('/get/:id', isUserLoggedIn, getSingleMockTest);

router.put('/update/:id', isUserLoggedIn, isAdminUser, updateMockTest);

router.delete('/delete/:id', isUserLoggedIn, isAdminUser, deleteMockTest);

router.get('/getAll', isUserLoggedIn ,getAllMockTests);

module.exports = router;