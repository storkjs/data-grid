module.exports = function(grunt) {
	require('jit-grunt')(grunt);

	grunt.initConfig({
		watch: {
			styles: {
				files: ['src/*.less'], // which files to watch
				tasks: ['less'],
				options: {
					nospawn: true
				}
			},
			scripts: {
				files: ['src/*.js'], // which files to watch
				tasks: ['uglify'],
				options: {
					nospawn: true
				}
			}
		},
		less: {
			development: {
				options: {
					compress: false,
					yuicompress: false,
					optimization: 2
				},
				files: {
					"dist/data-grid.css": "src/data-grid.less", // destination file and source file
					"dist/simple-theme.css": "src/simple-theme.less" // destination file and source file
				}
			},
			production: {
				options: {
					compress: true,
					yuicompress: true,
					optimization: 2
				},
				files: {
					"dist/data-grid.min.css": "src/data-grid.less", // destination file and source file
					"dist/simple-theme.min.css": "src/simple-theme.less" // destination file and source file
				}
			}
		},
		uglify: {
			options: {
				mangle: false,
				screwIE8: true
			},
			development: {
				options: {
					compress: false,
					beautify: {
						beautify: true,
						"indent_level": 2
					}
				},
				files: {
					'dist/data-grid.js': ['src/data-grid.js']
				}
			},
			production: {
				options: {
					compress: true,
					sourceMap: true,
					sourceMapName: 'dist/data-grid.min.js.map'
				},
				files: {
					'dist/data-grid.min.js': ['src/data-grid.js']
				}
			}
		}
	});

	grunt.registerTask('watch-files', ['watch']);

	grunt.registerTask('dist', ['less', 'uglify']);
};