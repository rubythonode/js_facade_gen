require('source-map-support').install();

var clangFormat = require('clang-format');
var formatter = require('gulp-clang-format');
var fs = require('fs');
var fsx = require('fs-extra');
var gulp = require('gulp');
var gutil = require('gulp-util');
var merge = require('merge2');
var mocha = require('gulp-mocha');
var sourcemaps = require('gulp-sourcemaps');
var spawn = require('child_process').spawn;
var ts = require('gulp-typescript');
var typescript = require('typescript');
var style = require('dart-style');
var which = require('which');
var tslint = require('gulp-tslint');

gulp.task('test.check-format', function() {
  return gulp.src(['*.js', 'lib/**/*.ts', 'test/**/*.ts'])
      .pipe(formatter.checkFormat('file', clangFormat))
      .on('warning', onError);
});

gulp.task('test.check-lint', function() {
  return gulp.src(['lib/**/*.ts', 'test/**/*.ts'])
      .pipe(tslint())
      .pipe(tslint.report('verbose'))
      .on('warning', onError);
});

var hasError;
var failOnError = true;

var onError = function(err) {
  hasError = true;
  gutil.log(err.message);
  if (failOnError) {
    process.exit(1);
  }
};

var tsProject =
    ts.createProject('tsconfig.json', {noEmit: false, declaration: true, typescript: typescript});

gulp.task('compile', function() {
  hasError = false;
  var tsResult =
      gulp.src(['lib/**/*.ts', 'typings/**/*.d.ts', 'node_modules/typescript/lib/typescript.d.ts'])
          .pipe(sourcemaps.init())
          .pipe(ts(tsProject))
          .on('error', onError);
  return merge([
    tsResult.dts.pipe(gulp.dest('build/definitions')),
    // Write external sourcemap next to the js file
    tsResult.js.pipe(sourcemaps.write('.')).pipe(gulp.dest('build/lib')),
    tsResult.js.pipe(gulp.dest('build/lib')),
  ]);
});

gulp.task('test.compile', ['compile'], function(done) {
  if (hasError) {
    done();
    return;
  }
  return gulp
      .src(
          ['test/*.ts', 'typings/**/*.d.ts', 'node_modules/dart-style/dart-style.d.ts'],
          {base: '.'})
      .pipe(sourcemaps.init())
      .pipe(ts(tsProject))
      .on('error', onError)
      .js.pipe(sourcemaps.write())
      .pipe(gulp.dest('build/'));  // '/test/' comes from base above.
});

gulp.task('test.unit', ['test.compile'], function(done) {
  if (hasError) {
    done();
    return;
  }
  return gulp.src('build/test/**/*.js').pipe(mocha({
    timeout: 4000,  // Needed by the type-based tests :-(
    fullTrace: true,
  }));
});

gulp.task('test', ['test.check-format', 'test.check-lint', 'test.unit']);

gulp.task('watch', ['test.unit'], function() {
  failOnError = false;
  // Avoid watching generated .d.ts in the build (aka output) directory.
  return gulp.watch(['lib/**/*.ts', 'test/**/*.ts'], {ignoreInitial: true}, ['test.unit']);
});

gulp.task('default', ['compile']);