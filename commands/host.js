'use strict';

const request = require('../lib/request');
const utils = require('../lib/utils');

const _ = require('lodash');
const flat = require('flat');

module.exports = {

    fetch: (/*core*/) => {
        return {
            commands: [
                {
                    name: 'list',
                    options: {},

                    callback: (/*options*/) => {
                        request.get('hosts', {}, (err, response) => {
                            if(err || response.statusCode != 200) {
                                process.stderr.write(`${err}\n`);
                                process.stderr.write('Could not fetch hosts!');
                                process.exit(1);
                            }

                            const format = [
                                ['%-40s', 'ID'],
                                ['%-40s', 'HOSTNAME'],
                                ['%-40s', 'START TIME'],
                                ['%-10s', 'MODE'],
                                ['%-10s', 'CONTAINERS']
                            ];

                            utils.println(format);

                            _.forEach(_.sortBy(response.body, 'id'), (host) => {
                                const format = [
                                    ['%-40s', host.id],
                                    ['%-40s', host.host_name],
                                    ['%-40s', new Date(host.start_time)],
                                    ['%-10s', `${host.mode} ${host.praetor.leader ? '*' : ''}`],
                                    ['%-10s', host.containers.length]
                                ];

                                utils.println(format);
                            });
                        });
                    }
                },

                {
                    name: 'show',
                    options: {
                        host: {
                            position: 1,
                            help: 'Name of the host to fetch',
                            metavar: 'HOST',
                            required: true
                        }
                    },

                    callback: (options) => {
                        request.get(`hosts/${options.host}`, {}, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not fetch host ${options.host}!`);
                                process.exit(1);
                            } else if(response.statusCode === 404) {
                                process.stderr.write(`Host ${options.host} does not exist!`);
                                process.exit(1);
                            } else if(response.statusCode != 200) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                const overhead = 32;
                                let used_cpus = 0;
                                let used_memory = 0;

                                utils.println([ ['%-20s', 'HOST NAME'], ['%-100s', response.body.host_name] ]);
                                utils.println([ ['%-20s', 'START TIME'], ['%-100s', new Date(response.body.start_time)] ]);
                                utils.println([ ['%-20s', 'MODE'], ['%-100s', response.body.mode] ]);

                                if(response.body.mode === 'leader') {
                                    utils.println([ ['%-20s', 'CONTROLLING LEADER'], ['%-100s', response.body.praetor.leader] ]);
                                }

                                utils.println([ ['%-20s', 'PORT'], ['%-100s', response.body.port] ]);
                                utils.println([ ['%-20s', 'PUBLIC IP'], ['%-100s', response.body.address.public] ]);
                                utils.println([ ['%-20s', 'PRIVATE IP'], ['%-100s', response.body.address.private] ]);
                                utils.println();

                                utils.println([ ['%-20s', 'TAGS'], ['%-50s', 'NAME'], ['%-50s', 'VALUE'] ]);
                                _.forEach(flat(response.body.tags), (val, key) => {
                                    utils.println([ ['%-20s', ''], ['%-50s', key], ['%-50s', val] ]);
                                });
                                utils.println();

                                if(response.body.mode === 'follower') {
                                    utils.println([ ['%-20s', 'CONTAINERS'], ['%-40s', 'ID'], ['%-40s', 'APPLICATION'], ['%-20s', 'STATUS'] ]);
                                    _.forEach(response.body.containers, (container) => {
                                        used_cpus += parseFloat(container.cpus);
                                        used_memory += _.parseInt(container.memory) + overhead;
                                        utils.println([ ['%-20s', ''], ['%-40s', container.id], ['%-40s', container.application], ['%-20s', container.status] ]);
                                    });
                                    utils.println();

                                    used_cpus = used_cpus.toFixed(2);

                                    const available_cpus = parseFloat(response.body.cpus) - used_cpus;
                                    const available_memory = (_.parseInt(response.body.memory) / (1024 * 1024)) - used_memory;

                                    utils.println([ ['%-20s', 'AVAILABLE CPUS'], ['%-100s', available_cpus] ]);
                                    utils.println([ ['%-20s', 'USED CPUS'], ['%-100s', used_cpus] ]);
                                    utils.println([ ['%-20s', 'AVAILABLE MEMORY'], ['%-100s', `${Math.floor(available_memory)} MB`] ]);
                                    utils.println([ ['%-20s', 'USED MEMORY'], ['%-100s', `${used_memory} MB`] ]);
                                }
                            }
                        });
                    }
                },

                {
                    name: 'edit',
                    options: {
                        host: {
                            position: 1,
                            help: 'Name of the host to edit',
                            metavar: 'HOST',
                            required: true
                        },

                        tag: {
                            help: 'host tags',
                            list: true
                        }
                    },

                    callback: (options) => {
                        const config = _.omit(options, ['0', '_', 'host', 'subcommand']);

                        if(_.has(config, 'tag')) {
                            config.tags = utils.parse_tags(config.tag);
                            delete config.tag;
                        }

                        request.put(`hosts/${options.host}`, {}, config, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not update host ${options.host}!`);
                                process.exit(1);
                            } else if(response.statusCode != 200) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                process.stdout.write(`Successfully updated host ${options.host}!`);
                            }
                        });
                    }
                }
            ]
        };
    }

};
