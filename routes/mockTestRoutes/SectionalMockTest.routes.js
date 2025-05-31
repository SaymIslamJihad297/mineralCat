const router = require("express").Router();
const { addSectionalMockTest, getAllSectionalMockTest, deleteSectionalMockTest } = require("../../controllers/mockTestControllers/sectionalMockTest.Controller");
const { isUserLoggedIn , isAdminUser} = require('../../middleware/middlewares');

router.post('/add', isUserLoggedIn, isAdminUser, addSectionalMockTest);

router.get('/getAll/:type', isUserLoggedIn, getAllSectionalMockTest);

router.delete('/delete/:id', isUserLoggedIn, isAdminUser, deleteSectionalMockTest);

module.exports = router;