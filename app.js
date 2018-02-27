const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const getenv = require('getenv');
const path = require('path');

const files = require('./routes/files');

const app = express();

const projectDir = getenv('DIR');

app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api/v1/files', files(path.resolve(projectDir)));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
