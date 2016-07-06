#!/usr/bin/env node
'use strict';

const commands = require('./commands');
const config = require('./lib/config');
const pkg = require('./package.json');
const plugins = require('./lib/plugins');
const request = require('./lib/request');
const utils = require('./lib/utils');

const _ = require('lodash');
const API = require('containership.api');
const Core = require('containership.core');
const fs = require('fs');
const NomNom = require('nomnom');
const Scheduler = require('containership.scheduler');

let nomnom = new NomNom();

if(fs.existsSync(`${process.env.HOME}/.containership/cli.json`)) {
    config.load();
} else {
    config.set({
        'api-url': 'http://localhost:8080',
        'api-version': 'v1',
        'plugin-location': `${process.env.HOME}/.containership/plugins`
    });
}

const core = new Core({
    scheduler: new Scheduler(),
    api: new API()
});

core.cli = {
    middleware: []
};

request.core = core;

function set_middleware(middleware) {
    core.cli.middleware.push(middleware);
    core.cli.middleware = _.flatten(core.cli.middleware);
}

const subcommands = {};

// loads all default commands
_.forEach(commands, (command, command_name) => {
    const configuration = command.fetch(core);

    if(_.has(configuration, 'middleware')) {
        set_middleware(configuration.middleware);
    }

    if(configuration.commands.length === 1) {
        nomnom.command(configuration.commands[0].name).options(configuration.commands[0].options).callback(configuration.commands[0].callback);
    } else {
        subcommands[command_name] = new NomNom();
        _.forEach(configuration.commands, (cmd) => {
            subcommands[command_name].command(cmd.name).options(cmd.options).callback(cmd.callback);
        });
    }
});

// loads all plugin commands
_.forEach(plugins.list(), (plugin_name) => {
    let plugin = plugins.load(plugin_name);
    plugin_name = plugin_name.replace('containership.plugin.', '');

    if(!_.isUndefined(plugin)) {
        plugin = plugin.initialize();

        if(_.has(plugin, 'middleware')) {
            set_middleware(plugin.middleware);
        }

        subcommands[plugin_name] = new NomNom();
        _.forEach(plugin.commands, (cmd) => {
            subcommands[plugin_name].command(cmd.name).options(cmd.options).callback(cmd.callback);
        });
    }
});

let args;

if(_.has(subcommands, process.argv[2])) {
    args = utils.parse_env_vars(core).slice(1);
    nomnom = subcommands[process.argv[2]];
    nomnom.script(`${pkg.name} ${process.argv[2]}`);
} else {
    args = utils.parse_env_vars(core);

    _.forEach(subcommands, (subcommand, subcommand_name) => {
        nomnom.command(subcommand_name);
    });

    nomnom.script(pkg.name);
}

nomnom.option('version', {
    flag: true,
    abbr: 'v',
    help: 'print version and exit',
    callback: function(){
        return `v${pkg.version}`;
    }
});

nomnom.parse(args);
