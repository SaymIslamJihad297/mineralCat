const router = require('express').Router();
const { getRecentUsers, getAllUsers, loginUser, getCounts, deleteUsers, deleteQuestion, addNotification, adminEarnings} = require('../../controllers/adminControllers/adminBasic.controller');
const { getNotifications } = require('../../controllers/userControllers/user.controllers');
const { isUserLoggedIn, isAdminUser } = require('../../middleware/middlewares');


router.post('/login', loginUser);

router.get('/recent-users', isUserLoggedIn, isAdminUser, getRecentUsers);

router.get('/all-users', isUserLoggedIn, isAdminUser, getAllUsers);

router.get('/get-all-counts', isUserLoggedIn, isAdminUser, getCounts);

router.delete('/delete-user/:id', isUserLoggedIn, isAdminUser, deleteUsers);

router.delete('/delete-question/:id', isUserLoggedIn, isAdminUser,deleteQuestion);


router.route('/notification')
    .post(isUserLoggedIn, isAdminUser,addNotification)
    .get(isUserLoggedIn, getNotifications);


router.get('/earnings', isUserLoggedIn, isAdminUser, adminEarnings);
module.exports = router;