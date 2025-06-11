const router = require('express').Router();
const { getRecentUsers, getAllUsers, loginUser, getCounts, deleteUsers, deleteQuestion} = require('../../controllers/adminControllers/adminBasic.controller');
const { isUserLoggedIn, isAdminUser } = require('../../middleware/middlewares');


router.post('/login', loginUser);

router.get('/recent-users', isUserLoggedIn, isAdminUser, getRecentUsers);

router.get('/all-users', isUserLoggedIn, isAdminUser, getAllUsers);

router.get('/get-all-counts', isUserLoggedIn, isAdminUser, getCounts);

router.delete('/delete-user/:id', isUserLoggedIn, isAdminUser, deleteUsers);

router.delete('/delete-question/:id', isUserLoggedIn, isAdminUser,deleteQuestion);

module.exports = router;