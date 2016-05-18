module.exports = function(grunt) {
	require('jit-grunt')(grunt);

	grunt.initConfig({
		less: {
			development: {
				options: {
					compress: false,
					yuicompress: false,
					optimization: 2
				},
				files: {
					"data-grid.css": "data-grid.less" // destination file and source file
				}
			},
			production: {
				options: {
					compress: true,
					yuicompress: true,
					optimization: 2
				},
				files: {
					"data-grid.min.css": "data-grid.less" // destination file and source file
				}
			}
		},
		watch: {
			styles: {
				files: ['*.less'], // which files to watch
				tasks: ['less'],
				options: {
					nospawn: true
				}
			}
		}
	});

	grunt.registerTask('watch-less', ['less', 'watch']);
};