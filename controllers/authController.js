const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
// const sendEmail = require('./../utils/email');
const Email = require('./../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createNSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  // const cookieOptions = {
  //   expires: new Date(
  //     Date.now() + process.env.JWT_COOKIE_EXPIRES_in * 24 * 60 * 60 * 1000
  //   ),
  //   // secure: true, // Required HTTPS protocol.
  //   httpOnly: true, // Make the cookie cannot be accessed and modified by Browser.
  //   secure: req.secure || req.headers('x-forwarded-proto') === 'https'
  // };
  // if (process.env.NODE_END === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_in * 24 * 60 * 60 * 1000
    ),
    // secure: true, // Required HTTPS protocol.
    httpOnly: true, // Make the cookie cannot be accessed and modified by Browser.
    secure: req.secure || req.headers('x-forwarded-proto') === 'https'
  });

  // Remove the password from output.
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  const url = `${req.protocol}://${req.get('host')}/me`;
  console.log(url);
  await new Email(newUser, url).sendWelcome();
  // const newUser = await User.create({
  //     name: req.body,
  //     email: req.body.email,
  //     password: req.body.password,
  //     passwordConfirm: req.body.passwordConfirm,
  // });

  createNSendToken(newUser, 201, req, res);
  //   const token = signToken(newUser._id);

  //   res.status(201).json({
  //     status: 'success',
  //     token,
  //     data: {
  //       user: newUser,
  //     },
  //   });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body; //const email = req.body.email;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password'); // Explicitly to show the password.

  // Method of 'correctPassword' is an 'Instant Method' defined in userModel.js.
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything OK, send token to client
  createNSendToken(user, 200, req, res);
  //   const token = signToken(user._id);

  //   res.status(200).json({
  //     status: 'success',
  //     token,
  //   });
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000), // 10 secs.
    httpOnly: true
  });

  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification of token
  // Because the 'jwt.verify' is a 'sync' function so needed to use 'promisify' to
  // make it 'async' and can return a 'Promise'.
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists to prevent from using of a stolen JWT.
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued.
  if (currentUser.changesPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  // 1) Verifying token
  if (req.cookies.jwt) {
    try {
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists.
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued.
      if (currentUser.changesPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      // Notice! 'res.locals' will be always available for the template.
      res.locals.user = currentUser;
      // req.user = currentUser;
      return next();
    } catch (err) {
      // Since we use a work-around to handle logout by updating the 'jwt' cookie with a
      // string other then the actual JWT, so the 'jwt.verify' definitely raises an error
      // and it must be caught here.
      // The reason why we do so is that the 3-party 'jwt' cookie is set to be HttpOnly, so
      // it cannot be deleted, but can update it and reset to a very short of life span.
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is array, ['admin', 'lead-guide'], role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address.', 404));
  }
  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Your password reset token (valid for 10 mins)',
    //   message,
    // });
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: {
      $gt: Date.now()
    }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined; // delete it
  user.passwordResetExpires = undefined; // delete it
  await user.save();

  // 3) Update changedPasswordAt property for the user

  // 4) Log the user in, send JWT
  createNSendToken(user, 200, req, res);
  //   const token = signToken(user._id);

  //   res.status(200).json({
  //     status: 'success',
  //     token,
  //   });
});

// The updated value for 'passwordChagnedAt' is wrong. Need to trouble-shooting later.
exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!user.correctPassword(req.body.passwordCurrent, user.password)) {
    return next(new AppError('Your current password is wrong', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // CANNOT use User.findByIdAndUpdate(), it will NOT work as intended.
  // 1. The 'validate' option for 'passwordConfirm' in Schema is only working on CREATE and SAVE!
  //    NOT on UPDATE;
  // 2. The 2 pre-save Middleware right after Schema's definition also are not working
  //    ( userSchema.pre('save',...), one for password encrypting, another one for setting of
  //    the 'passwordChangedAt' ).

  // 4) Log user in, send JWT
  createNSendToken(user, 200, req, res);
});
