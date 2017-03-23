'use strict';

const config = require('../lib/config');
const utils = require('../lib/utils');

const fs = require('fs');
const _ = require('lodash');
const npm = require('npm');
const request = require('request');
const flat = require('flat');
const async = require('async');
const mkdirp = require('mkdirp');
const semver = require('semver');

module.exports = {

    fetch: (/*core*/) => {
        const PLUGINS_DIR = config.config['plugin-location'] ? config.config['plugin-location'] : `${process.env.HOME}/.containership/plugins`;

        try {
            mkdirp.sync(`${PLUGINS_DIR}/node_modules`);
        } catch(err) {
            process.stderr.write(err.message);
            process.exit(1);
        }

        return {
            commands: [
                {
                    name: 'list',
                    options: {},

                    callback: (/*options*/) => {
                        npm.load({
                            prefix: PLUGINS_DIR,
                            'unsafe-perm': true,
                            force: true,
                            loglevel: 'silent'
                        }, () => {
                            npm.commands.ls([], { json: true }, (err, data) => {
                                utils.println([ ['%-40s', 'PLUGIN'], ['%-20s', 'VERSION'] ]);

                                try {
                                    _.forEach(data.dependencies, (plugin, name) => {
                                        if(name.indexOf('containership.plugin.') === 0) {
                                            name = name.substring(21, name.length);
                                        }

                                        utils.println([ ['%-40s', name], ['%-20s', plugin.version] ]);
                                    });
                                } catch(err) {
                                    process.stdout.write('No plugins installed!\n');
                                }
                            });
                        });

                    }
                },

                {
                    name: 'search',
                    options: {
                        plugin: {
                            position: 1,
                            help: 'Name of the plugin to configure',
                            metavar: 'PLUGIN'
                        }
                    },

                    callback: (options) => {
                        let authorized_plugins = {};

                        request({ url: 'http://plugins.containership.io', json: true }, (err, response) => {
                            if(!err && response.statusCode === 200) {
                                authorized_plugins = response.body;
                            }

                            npm.load({
                                prefix: PLUGINS_DIR,
                                'unsafe-perm': true,
                                force: true,
                                loglevel: 'silent'
                            }, () => {
                                let plugins = [];
                                if(_.has(options, 'plugin')) {
                                    const regex = new RegExp(options.plugin, 'g');
                                    _.forEach(_.keys(authorized_plugins), (name) => {
                                        if(regex.test(name)) {
                                            plugins.push(name);
                                        }
                                    });
                                } else {
                                    plugins = _.keys(authorized_plugins);
                                }

                                utils.println([ ['%-40s', 'PLUGIN'], ['%-100s', 'DESCRIPTION'] ]);
                                _.forEach(_.sortBy(plugins), (name) => {
                                    utils.println([ ['%-40s', name], ['%-100s', authorized_plugins[name].description] ]);
                                });
                            });
                        });
                    }
                },

                {
                    name: 'configure',
                    options: {
                        plugin: {
                            position: 1,
                            help: 'Name of the plugin to configure',
                            metavar: 'PLUGIN',
                            required: true
                        }
                    },

                    callback: (options) => {
                        let name = options.plugin;

                        if(name.indexOf('containership.plugin.') === 0) {
                            name = name.substring(21, name.length);
                        }

                        const config = _.omit(options, ['_', '0', 'plugin', 'subcommand']);

                        fs.writeFile(`${process.env.HOME}/.containership/${name}.json`, JSON.stringify(flat.unflatten(config), null, 2), (err) => {
                            if(err) {
                                process.stderr.write(err.message);
                                process.exit(1);
                            }

                            process.stdout.write(`Wrote ${name} configuration file!\n`);
                        });
                    }
                },

                {
                    name: 'add',
                    options: {
                        plugin: {
                            position: 1,
                            help: 'Name of the plugin to add',
                            metavar: 'PLUGIN',
                            required: true,
                            list: true
                        }
                    },

                    callback: (options) => {
                        request({ url: 'http://plugins.containership.io', json: true }, (err, response) => {
                            let authorized_plugins = {};

                            if (!err && response.statusCode === 200) {
                                authorized_plugins = response.body;
                            }

                            process.stdout.write(`Installing plugin(s): ${options.plugin.join(', ')}\n`);

                            npm.load({
                                prefix: PLUGINS_DIR,
                                'unsafe-perm': true,
                                force: true,
                                loglevel: 'silent'
                            }, () => {
                                async.each(options.plugin, (plugin, callback) => {
                                    const split = plugin.split('@');

                                    plugin = split[0];
                                    let specifiedVersion = split.length === 2 ? split[1] : '*';

                                    // if authorized plugin, set the source
                                    if(_.has(authorized_plugins, plugin)) {
                                        plugin = authorized_plugins[plugin].source;
                                    }

                                    npm.commands.view([`${plugin}@${specifiedVersion}`, 'version', 'containership'], { loglevel: 'silent' }, (err, data) => {
                                        if (err) {
                                            process.stderr.write(`Failed to retrieve plugin versions: ${plugin}\n`);
                                            process.stderr.write(JSON.stringify(err, null, 2));

                                            return callback();
                                        }

                                        const latestValidVersion = _.reduce(_.keys(data), (accumulator, version) => {
                                            const csInfo = data[version].containership;

                                            // if package json has plugin version support info listed and it
                                            // is not V1, ignore this version of the npm package
                                            if (csInfo && csInfo.plugin && csInfo.plugin.version !== 'v1') {
                                                return accumulator;
                                            }

                                            if (!accumulator || semver.lt(accumulator, version)) {
                                                return version;
                                            }

                                            return accumulator;
                                        }, null);

                                        if (!latestValidVersion) {
                                            process.stderr.write('Unable to find valid plugin version to install in the NPM registry');
                                            process.stderr.write('Containership V1 Plugins may not have containership.plugin.version === v2 in the package.json config');
                                            process.stderr.write(`Found plugin versions: ${JSON.stringify(_.keys(data))}`);

                                            return process.exit(1);
                                        }

                                        plugin = `${plugin}@${latestValidVersion}`;

                                        npm.commands.install([plugin], (err/*, data*/) => {
                                            if(err) {
                                                process.stderr.write(`Failed to install plugin: ${plugin}\n`);
                                            }

                                            return callback();
                                        });
                                    });
                                });
                            });
                        });
                    }
                },

                {
                    name: 'remove',
                    options: {
                        plugin: {
                            position: 1,
                            help: 'Name of the plugin to remove',
                            metavar: 'PLUGIN',
                            required: true,
                            list: true
                        }
                    },

                    callback: (options) => {
                        request({ url: 'http://plugins.containership.io', json: true }, (err, response) => {
                            let authorized_plugins = {};

                            if(!err && response.statusCode === 200) {
                                authorized_plugins = response.body;
                            }

                            process.stdout.write(`Uninstalling plugin(s): ${options.plugin.join(', ')}\n`);

                            npm.load({
                                prefix: PLUGINS_DIR,
                                'unsafe-perm': true,
                                force: true,
                                loglevel: 'silent'
                            }, () => {
                                async.each(options.plugin, function(plugin, callback) {
                                    // if authorized plugin, set the source
                                    if(_.has(authorized_plugins, plugin)) {
                                        plugin = authorized_plugins[plugin].source;
                                        if(plugin.lastIndexOf('/') != -1) {
                                            plugin = plugin.substring(plugin.lastIndexOf('/') + 1, plugin.length);
                                            if(plugin.indexOf('.git') != -1) {
                                                plugin = plugin.substring(0, plugin.indexOf('.git'));
                                            }
                                        }
                                    }

                                    npm.commands.uninstall([plugin], (err/*, data*/) => {
                                        if(err) {
                                            process.stderr.write(`Failed to uninstall ${plugin}\n`);
                                        }

                                        return callback();
                                    });
                                });
                            });
                        });
                    }
                },

                {
                    name: 'update',
                    options: {
                        plugin: {
                            position: 1,
                            help: 'Name of the plugin to remove',
                            metavar: 'PLUGIN',
                            required: true
                        }
                    },

                    callback: (options) => {
                        request({ url: 'http://plugins.containership.io', json: true }, (err, response) => {
                            let authorized_plugins = {};

                            if (!err && response.statusCode === 200) {
                                authorized_plugins = response.body;
                            }

                            npm.load({
                                prefix: PLUGINS_DIR,
                                'unsafe-perm': true,
                                force: true,
                                loglevel: 'silent'
                            }, () => {
                                const split = options.plugin.split('@');

                                options.plugin = split[0];
                                options.version = split.length === 2 ? split[1] : '*';

                                if(_.has(authorized_plugins, options.plugin)) {
                                    options.plugin = authorized_plugins[options.plugin].source;
                                }

                                npm.commands.view([`${options.plugin}@${options.version}`, 'version', 'containership'], { loglevel: 'silent' }, (err, data) => {
                                    if (err) {
                                        process.stderr.write(`Failed to retrieve plugin versions: ${options.plugin}\n`);
                                        process.stderr.write(JSON.stringify(err, null, 2));

                                        return process.exit(1);
                                    }

                                    const latestValidVersion = _.reduce(_.keys(data), (accumulator, version) => {
                                        const csInfo = data[version].containership;

                                        // if package json has plugin version support info listed and it
                                        // is not V1, ignore this version of the npm package
                                        if (csInfo && csInfo.plugin && csInfo.plugin.version !== 'v1') {
                                            return accumulator;
                                        }

                                        if (!accumulator || semver.lt(accumulator, version)) {
                                            return version;
                                        }

                                        return accumulator;
                                    }, null);

                                    if (!latestValidVersion) {
                                        process.stderr.write('Unable to find valid plugin version to install in the NPM registry');
                                        process.stderr.write('Containership V1 Plugins may not have containership.plugin.version == v2 in the package.json config');
                                        process.stderr.write(`Found plugin versions: ${JSON.stringify(_.keys(data))}`);

                                        return process.exit(1);
                                    }

                                    options.plugin = `${options.plugin}@${latestValidVersion}`;

                                    npm.commands.install([options.plugin], (err/*, data*/) => {
                                        if (err) {
                                            process.stderr.write(JSON.stringify(err, null, 2));
                                        }
                                    });
                                });
                            });
                        });
                    }
                }
            ]
        };
    }

};
