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
    test: 'test',
    tasks: grunt.cli.tasks
  };

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    config: config,

    vulcanize: {
      default: {
        options: {
          inlineScripts: true,
          inlineCss: true,
          csp: 'index.js'
        },
        files: {
          // Despite this odd dest: src syntax, ./app/index.html is the built
          // output file from polymer-ui/index.html
          './<%= config.dist %>/index.html': './<%= config.app %>/polymer-ui/index.html'
        },
      },
    },

    browserify: {
      options: {
        require: [
          './<%= config.app %>/scripts/chrome-apis/udp:chromeUdp',
          './<%= config.app %>/scripts/dnssd/binary-utils:binaryUtils',
          './<%= config.app %>/scripts/dnssd/dns-sd:dnssd',
          './<%= config.app %>/scripts/dnssd/dns-sd-semcache:dnsSem',
          './<%= config.app %>/scripts/dnssd/dns-controller:dnsc',
          './<%= config.app %>/scripts/persistence/file-system-util:fsUtil',
          './<%= config.app %>/scripts/persistence/file-system:fileSystem',
          './<%= config.app %>/scripts/extension-bridge/messaging:extBridge',
          './<%= config.app %>/scripts/server/server-controller:serverController',
          './<%= config.app %>/scripts/app-controller:appController',
          './<%= config.app %>/scripts/settings:settings',
          './<%= config.app %>/scripts/evaluation:eval',
          './<%= config.app %>/scripts/webrtc/connection-manager:cmgr',
          './<%= config.app %>/scripts/coalescence/manager:coalMgr',
          './<%= config.app %>/scripts/persistence/database:db',
          './<%= config.app %>/scripts/persistence/objects:persistenceObjs',
          'moment:moment',
        ],
      },
      // Note that these targets build to the app/ directory, NOT to the dist/
      // directory. This is to allow vulcanize to find them. The clean task
      // then is responsible for removing the bundles.
      js: {
        // A single entry point for the app.
        src: '<%= config.app %>/scripts/main.js',
        dest: '<%= config.app %>/scripts/bundle.js'
      },
      frontEnd: {
        src: '<%= config.app %>/polymer-ui/main.js',
        dest: '<%= config.app %>/polymer-ui/mainBundle.js'
      },
      integrationTests: {
        src: '<%= config.test %>/polymer-ui/elements/database-integration-test.js',
        dest: '<%= config.test %>/polymer-ui/elements/dbIntegrationTestBundle.js',
      },
    },

    tape: {
      options: {
        pretty: true,
        output: 'console',
      },
      files: ['test/scripts/**/*.js'],
    },

    'wct-test': {
      local: {
        options: {
          remote: false,
          suites: ['test/polymer-ui/index.html'],
        },
        plugins: {
          local: {
            browsers: ['chrome']
          },
        },
        files: 'test/polymer-ui/index.html',
      },
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
      },
      bundles: {
        files: [{
          dot: true,
          src: [
            '<%= config.app %>/scripts/bundle.js',
            '<%= config.app %>/polymer-ui/mainBundle.js',
            // '<%= config.test %>/polymer-ui/elements/dbIntegrationTestBundle.js',
          ],
        }],
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

    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    // useminPrepare: {
    //   options: {
    //     dest: '<%= config.dist %>'
    //   },
    //   html: [
    //     '<%= config.app %>/index.html'
    //   ]
    // },

    // Performs rewrites based on rev and the useminPrepare configuration
    // usemin: {
    //   options: {
    //     assetsDirs: ['<%= config.dist %>', '<%= config.dist %>/images']
    //   },
    //   html: ['<%= config.dist %>/{,*/}*.html'],
    //   css: ['<%= config.dist %>/styles/{,*/}*.css']
    // },

    // The following *-min tasks produce minified files in the dist folder
    svgmin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= config.app %>/images',
          src: '{,*/}*.svg',
          dest: '<%= config.dist %>/images'
        }]
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
            'scripts/main.js',
            'scripts/bundle.js',
            'scripts/chromereload.js',
            'scripts/web-server-chrome/wsc-chrome.js',
            'scripts/server/dummy-handler.js',
            'index.js',
           '*.{ico,png,txt}',
            'images/{,*/}*.{webp,gif,png}',
            'styles/fonts/{,*/}*.*',
            '_locales/{,*/}*.json',
            'manifest.json',
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
        'svgmin'
      ],
      test: [
        'copy:styles'
      ],
    },

    // Merge event page, update build number, exclude the debug script
    // chromeManifest: {
    //   dist: {
    //     options: {
    //       buildnumber: true,
    //       background: {
    //         target: 'scripts/background.js',
    //         exclude: [
    //           'scripts/chromereload.js'
    //         ]
    //       }
    //     },
    //     src: '<%= config.app %>',
    //     dest: '<%= config.dist %>'
    //   }
    // },

    // Compress files in dist to make Chromea Apps package
    // compress: {
    //   dist: {
    //     options: {
    //       archive: function() {
    //         var manifest = grunt.file.readJSON('app/manifest.json');
    //         return 'package/SemCacheApp-' + manifest.version + '.zip';
    //       }
    //     },
    //     files: [{
    //       expand: true,
    //       cwd: 'dist/',
    //       src: ['**'],
    //       dest: ''
    //     }]
    //   }
    // }
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
    'wct-test:local',
  ]);

  // Give an alias to this b/c I always forget it
  grunt.registerTask('wct', [
    'wct-test:local',
  ]);

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-tape');
  grunt.loadNpmTasks('web-component-tester');

  grunt.registerTask('build', [
    'clean:dist',
    'browserify',
    'copy',
    'vulcanize',
    // 'chromeManifest:dist',
    'concurrent:dist',
    'clean:bundles',
    // 'concat',
    // 'compress'
  ]);

  grunt.registerTask('default', [
    // 'newer:jshint',
    'build'
  ]);
};
