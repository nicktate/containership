'use strict';

const config = require('../lib/config');
const request = require('../lib/request');
const utils = require('../lib/utils');

const _ = require('lodash');
const async = require('async');
const flat = require('flat');
const C2C = require('c2c');
const url = require('url');
const colors = require('colors');

const protocols = {
    http: require('http'),
    https: require('https')
};

const create_edit_options = {
    application: {
        position: 1,
        help: 'Name of the application',
        metavar: 'APPLICATION',
        required: true
    },

    engine: {
        help: 'Engine used to start application',
        metavar: 'ENGINE',
        choices: ['docker'],
        abbr: 'x'
    },

    image: {
        help: 'Application image',
        metavar: 'IMAGE',
        abbr: 'i'
    },

    'env-var': {
        list: true,
        help: 'Environment variable for application',
        metavar: 'ENV_VAR=VALUE',
        abbr: 'e'
    },

    'network-mode': {
        help: 'Application network mode',
        metavar: 'NETWORK MODE',
        abbr: 'n'
    },

    'container-port': {
        help: 'Port application must listen on',
        metavar: 'PORT',
        abbr: 'p'
    },

    command: {
        help: 'Application start command',
        metavar: 'COMMAND',
        abbr: 's'
    },

    volume: {
        help: 'Volume to bind-mount for application',
        metavar: 'HOST_PATH:CONTAINER_PATH',
        list: true,
        abbr: 'b'
    },

    tag: {
        help: 'Tag to add to application',
        metavar: 'NAME=VALUE',
        list: true,
        abbr: 't'
    },

    cpus: {
        help: 'CPUs allocated to application',
        metavar: 'CPUS',
        abbr: 'c'
    },

    memory: {
        help: 'Memory (mb) allocated to application',
        metavar: 'MEMORY',
        abbr: 'm'
    },

    privileged: {
        help: 'Run application containers in privileged mode',
        metavar: 'PRIVILEGED',
        choices: [true, false]
    },

    respawn: {
        help: 'Respawn application containers when they die',
        metavar: 'RESPAWN',
        choices: [true, false]
    }
};

function parse_update_body(options) {
    if(_.has(options, 'tag')) {
        options.tags = utils.parse_tags(options.tag);
        delete options.tag;
    }

    if(_.has(options, 'volume')) {
        options.volumes = utils.parse_volumes(options.volume);
        delete options.volume;
    }

    if(_.has(options, 'env-var')) {
        options.env_vars = utils.parse_tags(options['env-var']);
        delete options['env-var'];
    }

    if(_.has(options, 'network-mode')) {
        options.network_mode = options['network-mode'];
        delete options['network-mode'];
    }

    if(_.has(options, 'container-port')) {
        options.container_port = options['container-port'];
        delete options['container-port'];
    }

    return options;
}

module.exports = {

    fetch: (/*core*/) => {
        return {
            commands: [
                {
                    name: 'create-from-file',
                    options: {
                        'docker-compose': {
                            position: 1,
                            help: 'Path to Docker compose file',
                            metavar: 'DOCKER-COMPOSE',
                            default: './docker-compose.yml',
                            required: true
                        },
                        'containership-compose': {
                            position: 2,
                            help: 'Path to ContainerShip compose file',
                            metavar: 'CONTAINERSHIP-COMPOSE'
                        }
                    },

                    callback: (options) => {
                        let c2c;

                        try {
                            c2c = new C2C({
                                compose_path: options['docker-compose'],
                                containership_path: options['containership-compose']
                            });
                        } catch(err) {
                            process.stderr.write(err.message);
                            process.exit(1);
                        }

                        c2c.convert((err, json) => {
                            if(err) {
                                process.stderr.write(err.message);
                                process.exit(1);
                            }

                            request.post('applications', {}, json, (err, response) => {
                                if(err) {
                                    process.stderr.write('Could not create applications!');
                                    process.exit(1);
                                } else if(response.statusCode != 201) {
                                    process.stderr.write(response.body.error);
                                    process.exit(1);
                                } else {
                                    process.stdout.write(`Successfully created ${_.keys(json).length} applications!`);
                                }
                            });
                        });
                    }
                },

                {
                    name: 'create',
                    options: create_edit_options,

                    callback: (options) => {
                        options = _.omit(options, ['0', '_']);
                        options = parse_update_body(options);

                        request.post(`applications/${options.application}`, {}, options, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not create application ${options.application}!`);
                                process.exit(1);
                            } else if(response.statusCode != 201) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                process.stdout.write(`Successfully created application ${options.application}!`);
                            }
                        });
                    }
                },

                {
                    name: 'edit',
                    options: create_edit_options,

                    callback: (options) => {
                        options = _.omit(options, ['0', '_']);
                        options = parse_update_body(options);

                        request.put(`applications/${options.application}`, {}, options, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not update application ${options.application}!`);
                                process.exit(1);
                            } else if(response.statusCode != 200) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                process.stdout.write(`Successfully updated application ${options.application}!`);
                            }
                        });
                    }
                },

                {
                    name: 'list',
                    options: {},

                    callback: (/*options*/) => {
                        request.get('applications', {}, (err, response) => {
                            if(err) {
                                process.stderr.write('Could not fetch applications!');
                                process.exit(1);
                            }

                            utils.println([
                                ['%-40s', 'APPLICATION'],
                                ['%-60s', 'IMAGE'],
                                ['%-45s', 'COMMAND'],
                                ['%-5s', 'CPUS'],
                                ['%-10s', 'MEMORY'],
                                ['%-10s', 'CONTAINERS'],
                            ]);

                            _.forEach(response.body, (application) => {
                                const parsed_containers = _.groupBy(application.containers, (container) => container.status);

                                var loaded_containers = parsed_containers.loaded || [];
                                utils.println([
                                    ['%-40s', application.id],
                                    ['%-60s', application.image],
                                    ['%-45s', application.command],
                                    ['%-5s', application.cpus],
                                    ['%-10s', application.memory],
                                    ['%-10s', `${loaded_containers.length || 0}/${application.containers.length}`]
                                ]);
                            });
                        });
                    }
                },

                {
                    name: 'show',
                    options: {
                        application: {
                            position: 1,
                            help: 'Name of the application to fetch',
                            metavar: 'APPLICATION',
                            required: true
                        },
                    },

                    callback: (options) => {
                        request.get(`applications/${options.application}`, {}, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not fetch application ${options.application}!`);
                                process.exit(1);
                            } else if(response.statusCode == 404) {
                                process.stderr.write(`Application ${options.application} does not exist!`);
                                process.exit(1);
                            } else if(response.statusCode != 200) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                utils.println([ ['%-20s', 'ENGINE'], ['%-100s', response.body.engine] ]);
                                utils.println([ ['%-20s', 'IMAGE'], ['%-100s', response.body.image] ]);
                                utils.println([ ['%-20s', 'COMMAND'], ['%-100s', response.body.command] ]);
                                utils.println([ ['%-20s', 'CPUS'], ['%-100s', response.body.cpus] ]);
                                utils.println([ ['%-20s', 'MEMORY'], ['%-100s', response.body.memory] ]);
                                utils.println([ ['%-20s', 'NETWORK MODE'], ['%-100s', response.body.network_mode] ]);
                                utils.println([ ['%-20s', 'DISCOVERY PORT'], ['%-100s', response.body.discovery_port] ]);
                                utils.println([ ['%-20s', 'CONTAINER PORT'], ['%-100s', response.body.container_port || ''] ]);
                                utils.println();

                                utils.println([ ['%-20s', 'ENV VARS'], ['%-50s', 'NAME'], ['%-50s', 'VALUE'] ]);
                                _.forEach(response.body.env_vars, (val, key) => {
                                    utils.println([ ['%-20s', ''], ['%-50s', key], ['%-50s', val] ]);
                                });
                                utils.println();

                                utils.println([ ['%-20s', 'TAGS'], ['%-50s', 'NAME'], ['%-50s', 'VALUE'] ]);
                                _.forEach(flat(response.body.tags), (val, key) => {
                                    utils.println([ ['%-20s', ''], ['%-50s', key], ['%-50s', val] ]);
                                });
                                utils.println();

                                utils.println([ ['%-20s', 'CONTAINERS'], ['%-50s', 'ID'], ['%-50s', 'HOST'], ['%-20s', 'STATUS'] ]);
                                _.forEach(response.body.containers, function(container){
                                    utils.println([ ['%-20s', ''], ['%-50s', container.id], ['%-50s', container.host], ['%-20s', container.status] ]);
                                });
                            }
                        });
                    }
                },

                {
                    name: 'scale-up',
                    options: {
                        application: {
                            position: 1,
                            help: 'Name of the application to scale up',
                            metavar: 'APPLICATION',
                            required: true
                        },

                        count: {
                            help: 'Number of containers to add',
                            metavar: 'NUM CONTAINERS',
                            default: 1
                        },

                        tag: {
                            help: 'Tag to add to new containers',
                            metavar: 'NAME=VALUE',
                            list: true
                        }
                    },

                    callback: (options) => {
                        if(!_.has(options, 'count')) {
                            options.count = 1;
                        }

                        if(_.has(options, 'tag')) {
                            options.tags = utils.parse_tags(options.tag);
                            delete options.tag;
                        } else {
                            options.tags = {};
                        }

                        request.post(`applications/${options.application}/containers`, { count: options.count }, { tags: options.tags }, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not scale up application ${options.application}!`);
                                process.exit(1);
                            } else if(response.statusCode == 404) {
                                process.stderr.write(`Application ${options.application} does not exist!`);
                                process.exit(1);
                            } else if(response.statusCode != 201) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                process.stdout.write(`Successfully scaled up application ${options.application}!`);
                            }
                        });

                    }
                },

                {
                    name: 'scale-down',
                    options: {
                        application: {
                            position: 1,
                            help: 'Name of the application to scale down',
                            metavar: 'APPLICATION',
                            required: true
                        },

                        count: {
                            help: 'Number of containers to remove',
                            metavar: 'NUM CONTAINERS',
                            default: 1
                        }
                    },

                    callback: (options) => {
                        request.delete(`applications/${options.application}/containers`, { count: options.count }, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not scale down application ${options.application}!`);
                                process.exit(1);
                            } else if(response.statusCode == 404) {
                                process.stderr.write(`Application ${options.application} does not exist!`);
                                process.exit(1);
                            } else if(response.statusCode != 204) {
                                process.stderr.write(response.body.error);
                                process.exit(1);
                            } else {
                                process.stdout.write(`Successfully scaled down application ${options.application}!`);
                            }
                        });
                    }
                },

                {
                    name: 'delete',
                    options: {
                        application: {
                            position: 1,
                            help: 'Name of the application to delete',
                            metavar: 'APPLICATION',
                            required: true
                        }
                    },

                    callback: (options) => {
                        request.delete(`applications/${options.application}`, {}, (err, response) => {
                            if(err) {
                                process.stderr.write(`Could not delete application ${options.application}!`);
                                process.exit(1);
                            } else if(response.statusCode == 404) {
                                process.stderr.write(`Application ${options.application} does not exist!`);
                                process.exit(1);
                            } else if(response.statusCode == 204) {
                                process.stdout.write(`Successfully deleted application ${options.application}!`);
                            } else {
                                process.stderr.write(`Could not delete application ${options.application}!`);
                                process.exit(1);
                            }
                        });
                    }
                },

                {
                    name: 'logs',
                    options: {
                        application: {
                            position: 1,
                            help: 'Name of the application to fetch logs for',
                            metavar: 'APPLICATION',
                            required: true
                        },
                        'container-id': {
                            list: true,
                            help: 'container id to fetch logs for',
                            metavar: 'CONTAINER_ID'
                        },
                        all: {
                            help: 'fetch logs for all containers',
                            flag: true,
                            default: false
                        }
                    },

                    callback: (options) => {
                        const local_request = {
                            get: (path, qs, callback) => {
                                const options = {
                                    url: `${config.config['api-url']}/${config.config['api-version']}/${path}`,
                                    headers: config.config.headers || {},
                                    method: 'GET',
                                    qs: qs,
                                    json: true,
                                    strictSSL: config.config.strict_ssl || true
                                };

                                async.waterfall(_.map(config.config.middleware || [], (middleware) => {
                                    return function(callback){
                                        middleware(options, callback);
                                    };
                                }), (/*err*/) => {
                                    const req_opts = {
                                        host: url.parse(options.url).hostname,
                                        path: url.parse(options.url).path,
                                        method: options.method,
                                        headers: options.headers || {}
                                    };

                                    if(url.parse(options.url).port) {
                                        req_opts.port = url.parse(options.url).port;
                                    }

                                    req_opts.headers['Content-Type'] = 'application/json';
                                    let protocol = url.parse(options.url).protocol;
                                    protocol = protocol.substring(0, protocol.length - 1);

                                    const req = protocols[protocol].request(req_opts, (response) => {
                                        return callback(undefined, response);
                                    });

                                    req.on('error', callback);

                                    if(req_opts.method === 'POST') {
                                        req.write(JSON.stringify(options.json));
                                    }

                                    req.end();
                                });
                            }
                        };

                        function get_application(callback) {
                            request.get(`applications/${options.application}`, {}, (err, response) => {
                                if(err) {
                                    return callback(new Error(`Could not fetch application ${options.application}!`));
                                } else if(response.statusCode == 404) {
                                    return callback(new Error(`Application ${options.application} does not exist!`));
                                } else if(response.statusCode == 200) {
                                    return callback(undefined, _.pluck(response.body.containers, 'id'));
                                }
                            });
                        }

                        function fetch_logs() {
                            _.forEach(options['container-id'], (container_id) => {
                                local_request.get(`logs/${options.application}/containers/${container_id}`, {}, (err, response) => {
                                    if(err || response.statusCode != 200) {
                                        process.stderr.write(`Could not fetch logs for container ${container_id} of application ${options.application}!\n`);
                                    } else {
                                        response.on('data', (chunk) => {
                                            try {
                                                const json = JSON.parse(chunk);
                                                if(json.type === 'stdout') {
                                                    process.stdout.write(`[${json.name}]\t ${json.data}\n`);
                                                } else if(json.type === 'stderr') {
                                                    process.stdout.write(colors.red(`[${json.name}]\t ${json.data}\n`));
                                                }
                                            } catch(err) {
                                                process.stderr.write(colors.red('Unable to parse log'));
                                            }
                                        });
                                    }
                                });
                            });
                        }

                        if(options.all) {
                            get_application((err, container_ids) => {
                                if(err) {
                                    process.stderr.write(err.message);
                                    process.exit(1);
                                } else {
                                    options['container-id'] = container_ids;
                                    fetch_logs();
                                }
                            });
                        } else if(!options['container-id']) {
                            get_application((err, container_ids) => {
                                if(err) {
                                    process.stderr.write(err.message);
                                    process.exit(1);
                                } else {
                                    process.stdout.write('Please pass any of the following container ids to fetch logs, or pass the --all flag to get logs for every container:\n');
                                    _.forEach(container_ids, (container_id) => {
                                        process.stdout.write(`${container_id}\n`);
                                    });
                                }
                            });
                        } else {
                            fetch_logs();
                        }

                    }
                }
            ]
        };
    }
};
