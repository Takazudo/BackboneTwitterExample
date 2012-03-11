/*
  grunt: https://github.com/cowboy/grunt
  sqwish: https://github.com/ded/sqwish
  growlnotify: http://growl.info/extras.php
*/

var proc = require('child_process');

config.init({
  meta: {
    banner: '/* my app code */'
  },
  watch: {
    files: [
      'js/coffee/*.coffee',
      'style/scss/*.scss'
    ],
    //tasks: 'coffee min compass concat cssmin notifyOK'
    tasks: 'coffee compass concat cssmin notifyOK'
  },
  compass: {
    'style/scss': 'style/cssfragments'
  },
  concat: {
    'style/all.css': [
      'style/cssfragments/h5bp-pre.css',
      'style/cssfragments/base.css',
      'style/cssfragments/modules.css',
      'style/cssfragments/h5bp-after.css'
    ],
    'js/all.min.js': [
      'js/jsfragments/jquery.easing.1.3.min.js',
      'js/jsfragments/twitter-text-1.4.16.min.js',
      'js/jsfragments/spin.min.js',
      'js/jsfragments/underscore-min.js',
      'js/jsfragments/backbone-min.js',
      'js/jsfragments/backbone.localStorage-min.js',
      'js/jsfragments/jquery.tmpldeck.min.js',
      '<banner>',
      'js/jsfragments/app.min.js'
      //'js/jsfragments/app.js'
    ]
  },
  coffee: {
    'js/coffee/': 'js/jsfragments/'
  },
  min: {
    'js/jsfragments/app.min.js': 'js/jsfragments/app.js'
  },
  cssmin: {
    'style/all.min.css': 'style/all.css'
  }
});

task.registerBasicTask('coffee', 'compile CoffeeScripts', function(data, name) {
  var done = this.async();
  var command = 'coffee --compile --output ' + data + ' ' + name;
  proc.exec(command, function(err, sout, serr){
    if(err || sout || serr){
      proc.exec("growlnotify -t 'COFFEE COMPILE ERROR!' -m '" + serr + "'");
      done(false);
    }else{
      done(true);
    }
  });
});

task.registerBasicTask('compass', 'compass compile', function( data, name ) {
  var done = this.async();
  var command = 'compass compile --sass-dir ' + name + ' --css-dir ' + data + ' --boring';
  proc.exec(command, function(err, sout, serr){
    if(sout.indexOf('error')>-1){
      proc.exec("growlnotify -t 'COMPASS COMPILE ERROR!!!' -m '" + sout.replace(/^\s*/,'') + "'");
      console.log('ERROR!');
      done(false);
    }else{
      console.log('OK!');
      done(true);
    }
  });
});

task.registerBasicTask('cssmin', 'minify css', function( data, name ) {
  var done = this.async();
  var command = 'sqwish ' + data + ' -o ' + name;
  proc.exec(command, function(err, sout, serr){
      done(true);
  });
});

task.registerTask('notifyOK', 'done!', function(){
  proc.exec("growlnotify -t 'grunt.js' -m '＼(^o^)／'");
});

task.registerTask('default', 'coffee min compass concat cssmin notifyOK');
//task.registerTask('default', 'coffee compass concat cssmin notifyOK');
