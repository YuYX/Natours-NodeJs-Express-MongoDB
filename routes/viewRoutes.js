const express = require('express');
const viewController = require('../controllers/viewController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// This middleware will be applied to all the middlewares after this point.
// So we also don't need to place authController.protect in front any middleware
// which need the authorization for access.
// router.use(authController.isLoggedIn);

// 1 -> '/' -> With query    -> bookingController.createBookingCheckout -> '/' again
// 2 -> '/' -> Without query -> bypass bookingController.createBookingCheckout ->authController.isLoggedIn
router.get(
  '/',
  bookingController.createBookingCheckout,
  authController.isLoggedIn,
  viewController.getOverview
);
router.get('/tour/:slug', authController.isLoggedIn, viewController.getTour);
router.get('/login', authController.isLoggedIn, viewController.getLoginForm);
router.get('/me', authController.protect, viewController.getAccount);
router.get('/my-tours', authController.protect, viewController.getMyTours);

router.post(
  '/submit-user-data',
  authController.protect,
  viewController.updateUserData
);

// /login

module.exports = router;
