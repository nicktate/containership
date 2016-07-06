'use strict';

const request = require('./../lib/request');

const fs = require('fs');

module.exports = {

    fetch: (/*core*/) => {
        return {
            commands: [
                {
                    name: 'create',
                    options: {
                        persistence: {
                            position: 1,
                            help: 'Type of persistence to use [local]',
                            required: true,
                            choices: ['local']
                        },

                        file: {
                            help: 'Local file to write to',
                            default: `/tmp/containership.backup.${new Date().valueOf()}`
                        }
                    },

                    callback: (options) => {
                        if(options.persistence === 'local') {
                            request.get('applications', {}, (err, response) => {
                                if(err) {
                                    process.stderr.write(`Error writing file to ${options.file}`);
                                    process.exit(1);
                                }

                                fs.writeFile(options.file, JSON.stringify(response.body), (err) => {
                                    if(err) {
                                        process.stderr.write(`Error writing file to ${options.file}`);
                                        process.exit(1);
                                    }

                                    process.stdout.write(`Successfully wrote file to ${options.file}\n`);
                                });
                            });
                        }
                    }
                },

                {
                    name: 'restore',
                    options: {
                        persistence: {
                            position: 1,
                            help: 'Type of persistence to use [local]',
                            required: true,
                            choices: ['local']
                        },

                        file: {
                            help: 'Local file to restore from',
                            required: true
                        }
                    },

                    callback: (options) => {
                        if(options.persistence === 'local') {
                            fs.readFile(options.file, (err, applications) => {
                                if(err) {
                                    process.stderr.write(`Error reading file: ${options.file}`);
                                    process.exit(1);
                                } else {
                                    request.post('applications', {}, JSON.parse(applications), (err, response) => {
                                        if(err || response.statusCode != 201) {
                                            process.stderr.write('Error restoring applications!');
                                            process.exit(1);
                                        } else {
                                            process.stdout.write('Successfully restored applications!\n');
                                        }
                                    });
                                }
                            });
                        }
                    }
                }

            ]
        };
    }

};
