'use strict';

var gulp = require("gulp");
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

var browserify = require("browserify");
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var terser = require('gulp-terser-js');


var tsify = require("tsify");

function taskBundle(name, options) {

  gulp.task(name,  function () {

    var result = browserify({
        basedir: '.',
        debug: false,
        entries: [ './src.ts/' ],
        cache: {},
        packageCache: {},
    })
    .plugin(tsify)
    .bundle()
    .pipe(source(options.filename))

    if (options.minify) {
        result = result.pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(terser())
        .pipe(sourcemaps.write('./'))
    }

    result =  result.pipe(gulp.dest("dist"));
    return result;
  });
}

// Creates dist/mxw-ledger-signer.js
taskBundle("default", { filename: "mxw-ledger-signer.js", minify: false });

// Creates dist/mxw-ledger-signer.min.js
taskBundle("minified", { filename: "mxw-ledger-signer.min.js", minify: true });
