const router = require("express").Router();
const { addSectionalMockTest, getAllSectionalMockTest, deleteSectionalMockTest, getSingleSectionalMockTest } = require("../../controllers/mockTestControllers/sectionalMockTest.Controller");
const { isUserLoggedIn , isAdminUser} = require('../../middleware/middlewares');

router.post('/add', isUserLoggedIn, isAdminUser, addSectionalMockTest);

router.get('/getAll/:type', isUserLoggedIn, getAllSectionalMockTest);

router.get('/getSingleSectionalMockTest/:id', isUserLoggedIn, getSingleSectionalMockTest);

router.delete('/delete/:id', isUserLoggedIn, isAdminUser, deleteSectionalMockTest);

module.exports = router;
