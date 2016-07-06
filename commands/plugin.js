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
                            'unsafe-perm': true
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
                                'unsafe-perm': true
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
                                'unsafe-perm': true
                            }, () => {
                                async.each(options.plugin, (plugin, callback) => {
                                    // if authorized plugin, set the source
                                    if(_.has(authorized_plugins, plugin)) {
                                        plugin = authorized_plugins[plugin].source;
                                    }

                                    npm.commands.install([plugin], (err/*, data*/) => {
                                        if(err) {
                                            process.stderr.write(`Failed to install plugin: ${plugin}\n`);
                                        }

                                        return callback();
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
                                'unsafe-perm': true
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

                            if(!err && response.statusCode != 200) {
                                authorized_plugins = response.body;
                            }

                            try {
                                fs.mkdirSync(PLUGINS_DIR);
                            } catch(err) {
                                process.stderr.write(err.message);
                            }

                            npm.load({
                                prefix: PLUGINS_DIR,
                                'unsafe-perm': true
                            }, () => {
                                if(_.has(authorized_plugins, options.plugin)) {
                                    options.plugin = authorized_plugins[options.plugin].source;
                                }

                                process.stdout.write(`Updating plugin: ${options.plugin}\n`);
                                npm.commands.update([options.plugin], (/*err, data*/) => {});
                            });
                        });
                    }
                }
            ]
        };
    }

};
