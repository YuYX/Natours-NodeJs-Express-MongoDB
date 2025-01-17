const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express(); 

// For Heroku deployment, in order to make the following line at authController.js working
// secure: req.secure || req.headers('x-forwarded-proto') === 'https'
app.enable('trust proxy');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views')); 

// 1) GLOBAL MIDDLEWARES

//Implement CORS
app.use(cors());
// Access-Control-Allow-Origin
// api.natours.com, front-end natours.com
// app.use(cors({
//   origin: 'https://natours.com'
// }))

app.options('*', cors());
// app.options('/api/v1/tours/:id', cors());

// Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(helmet());

// Development Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000, // 1-hour
  message: 'Too many requests from this IP, please try again in an hour1'
});
app.use('/api', limiter); // Only apply to route of api.

// Implementing Webhooks of Stripe Payment's Checkout  
// app.post(
//   '/webhook-checkout',
//   // express.raw({ type: 'application/json' }),  // No need to use old method: bodyParser which required to install 'body-parser' package.
//   bodyParser.raw({ type: 'application/json' }),
//   bookingController.webhookCheckout
// );


// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ['duration', 'ratingsAverage', 'maxGroupSize', 'difficulty']
  })
);

//Building a Middleware
// app.use((req, res, next) => {
//   console.log('Hello from the middleware. ✋');
//   next();
// });  

app.use(compression()); // Compress all the text responses.

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 2) ROUTE HANDLERS.

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// catch all unhandled HTTP method, GET, POST,...
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

// 4) START SERVER
module.exports = app;
