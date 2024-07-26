const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
// const User = require('./userModel');

const dotenv = require('dotenv');
const { getTourStats } = require('../controllers/tourController');
dotenv.config({ path: './config.env' });

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal then 40 characters'],
      minlength: [10, 'A tour name must have more or equal then 10 characters']
      // validate: [validator.isAlpha, 'Tour name must only contain characters']
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size']
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult'
      }
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: val => Math.round(val * 10) / 10
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 4.5
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price']
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function(val) {
          // this only points to current doc on NEW document creation. NOT for document update.
          return val < this.price; // priceDiscount CANNOT bigger then price.
        },
        message: 'Discount price ({VALUE}) should be below the regular price.'
      }
      // validate: function(val){
      //   return val < this.price; // priceDiscount CANNOT bigger then price.
      // }
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summery']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image']
    },
    images: [String], // String array
    createAt: {
      type: Date,
      default: Date.now(),
      select: false // Permanently hide this field from users.
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      //GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: [Number],
      address: String,
      description: String
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number
      }
    ],
    //guides: Array   // [Embedding] Contains array of user ID.
    guides: [
      // [Child Referencing]
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User' // Even no need to import User module!
      }
    ]
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// tourSchema.index({price: 1}); // 1 - Ascending order; -1 - Descending.
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

// CANNOT use virtual properties for query since they are not part of database.
// Using Normal function NOT arrow function to use 'this'.
tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
});

// Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id'
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create()
tourSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Embedding
// tourSchema.pre('save', async function(next){
//   // the arrow function inside the map() returns a Promise.
//   const guidesPromises = this.guides.map( async id => await User.findById(id) );
//   this.guides = await Promise.all(guidesPromises);
//   next();
// })

// tourSchema.pre('save', function(next){
//   console.log('Will save document...');
//   next();
// })

// tourSchema.post('save', function(doc, next){
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next) {
  // tourSchema.pre('find', function(next){
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

// In the Query Middleware, 'this' always points to the 'query'.
tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });
  next();
});

tourSchema.post(/^find/, function(docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

// AGGREGATION MIDDLEWARE
// Since the $geoNear must be the first pipeline for the exports.getDistances 
// at tourController, but this pre 'aggregate' makes the $match pipeline even
// before the $geoNear pipeline whereby causing a fatal error.
// So comment this Middleware first.
// tourSchema.pre('aggregate', function(next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   console.log(this.pipeline());
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
