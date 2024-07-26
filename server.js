

// console.log(app.get('env'));
// console.log(process.env);

// const testTour = new Tour({
//   name: 'The Forest Hiker',
//   rating: 4.7,
//   price: 497
// });

// testTour
//   .save()
//   .then(doc => {
//   console.log(doc);
//   })
//   .catch(err => {
//     console.log('ERROR 🔥:', err);
//   });

 
const mongoose = require('mongoose'); 
const dotenv = require('dotenv');   

process.on('uncaughtException', err => { 
  console.log('UNCAUGHT EXCEPTION! 🔥 Shutting down...');
  console.log(err);
  process.exit(1); 
}); 

dotenv.config({ path: './config.env' }); 
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<password>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  // .connect(process.env.DATABASE_LOCAL, {
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then((con) => {
    console.log(con.connections);
    console.log('DB connection successful!');
  });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
}); 

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 🔥 Shutting down...');
  console.log(err);
  server.close( () => {
    process.exit(1);
  }); 
});