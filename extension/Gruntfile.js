// Generated on 2016-06-22 using generator-chromeapp 0.2.19
'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Configurable paths
  var config = {
    app: 'app',
    dist: 'dist',
    tasks: grunt.cli.tasks
  };

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    config: config,

    browserify: {
      options: {
        require: [],
      },
      popup: {
        // A single entry point for the app.
        src: '<%= config.app %>/scripts/popup/popup.js',
        dest: '<%= config.dist %>/scripts/popupBundle.js'
      },
      background: {
        src: '<%= config.app %>/scripts/background.js',
        dest: '<%= config.dist %>/scripts/backgroundBundle.js'
      },
      contentscript: {
        src: '<%= config.app %>/scripts/content-script/contentscript.js',
        dest: '<%= config.dist %>/scripts/contentscriptBundle.js'
      },
    },

    tape: {
      options: {
        pretty: true,
        output: 'console',
      },
      files: ['test/scripts/**/*.js'],
    },

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      bower: {
        files: ['bower.json'],
        tasks: ['bowerInstall']
      },
      js: {
        files: ['<%= config.app %>/scripts/{,*/}*.js'],
        tasks: ['jshint'],
        options: {
          livereload: true
        }
      },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      styles: {
        files: ['<%= config.app %>/styles/{,*/}*.css'],
        tasks: [],
        options: {
          livereload: true
        }
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          '.tmp/styles/{,*/}*.css',
          '<%= config.app %>/*.html',
          '<%= config.app %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}',
          '<%= config.app %>/manifest.json',
          '<%= config.app %>/_locales/{,*/}*.json'
        ]
      }
    },

    // Grunt server and debug server settings
    connect: {
      options: {
        port: 9000,
        livereload: 35729,
        // change this to '0.0.0.0' to access the server from outside
        hostname: 'localhost',
        open: true,
      },
      server: {
        options: {
          middleware: function(connect) {
            return [
              connect.static('.tmp'),
              connect().use('/bower_components', connect.static('./bower_components')),
              connect.static(config.app)
            ];
          }
        }
      },
      chrome: {
        options: {
          open: false,
          base: [
            '<%= config.app %>'
          ]
        }
      },
      test: {
        options: {
          open: false,
          base: [
            'test',
            '<%= config.app %>'
          ]
        }
      }
    },

    // Empties folders to start fresh
    clean: {
      server: '.tmp',
      chrome: '.tmp',
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= config.dist %>/*',
            '!<%= config.dist %>/.git*'
          ]
        }]
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        'Gruntfile.js',
        '<%= config.app %>/scripts/{,*/}*.js',
        '!<%= config.app %>/scripts/vendor/*',
        'test/spec/{,*/}*.js'
      ]
    },

    // Automatically inject Bower components into the HTML file
    bowerInstall: {
      app: {
        src: ['<%= config.app %>/index.html'],
        ignorePath: '<%= config.app %>/'
      }
    },

    // Copies remaining files to places other tasks can use
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= config.app %>',
          dest: '<%= config.dist %>',
          src: [
            '{,*/}*.{ico,png,txt}',
            'images/{,*/}*.{webp,gif}',
            'manifest.json',
            'scripts/options.js',
            '{,*/}*.html',
            'styles/fonts/{,*/}*.*',
            '_locales/{,*/}*.json',
            '{,*/}*.css',
          ]
        }]
      },
      styles: {
        expand: true,
        dot: true,
        cwd: '<%= config.app %>/styles',
        dest: '.tmp/styles/',
        src: '{,*/}*.css'
      }
    },

    // Run some tasks in parallel to speed up build process
    concurrent: {
      server: [
        'copy:styles'
      ],
      chrome: [
        'copy:styles'
      ],
      dist: [
        'copy:styles',
        // 'imagemin',
        // 'svgmin'
      ],
      test: [
        'copy:styles'
      ],
    },
  });

  grunt.registerTask('debug', function (platform) {
    var watch = grunt.config('watch');
    platform = platform || 'chrome';
    

    // Configure style task for debug:server task
    if (platform === 'server') {
      watch.styles.tasks = ['newer:copy:styles'];
      watch.styles.options.livereload = false;
      
    }

    // Configure updated watch task
    grunt.config('watch', watch);

    grunt.task.run([
      'clean:' + platform,
      'concurrent:' + platform,
      'connect:' + platform,
      'watch'
    ]);
  });

  grunt.registerTask('test', [
    'tape',
  ]);

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-tape');

  grunt.registerTask('build', [
    'clean:dist',
    'browserify',
    'concurrent:dist',
    'copy',
  ]);

  grunt.registerTask('default', [
    'build'
  ]);
};
