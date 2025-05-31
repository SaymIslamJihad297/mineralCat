const router = require('express').Router();
const { getRecentUsers, getAllUsers, loginUser, getCounts, deleteUsers} = require('../../controllers/adminControllers/adminBasic.controller');
const { isUserLoggedIn, isAdminUser } = require('../../middleware/middlewares');


router.post('/login', loginUser);

router.get('/recent-users', isUserLoggedIn, isAdminUser, getRecentUsers);

router.get('/all-users', isUserLoggedIn, isAdminUser, getAllUsers);

router.get('/get-all-counts', isUserLoggedIn, isAdminUser, getCounts);

router.delete('/delete-user/:id', isUserLoggedIn, isAdminUser, deleteUsers);

module.exports = router;