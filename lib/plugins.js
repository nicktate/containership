'use strict';

const config = require('./config');

const fs = require('fs');
const _ = require('lodash');
const colors = require('colors');

module.exports = {

    list: () => {
        try {
            return fs.readdirSync(`${config.config['plugin-location']}/node_modules`);
        } catch(err) {
            process.stderr.write(colors.red('Invalid plugin path provided!\n'));
        }
    },

    load: (plugin_name) => {
        try {
            const plugin_path = `${config.config['plugin-location']}/node_modules/${plugin_name}`;
            const plugin = require(plugin_path);

            if(_.isString(plugin.type) && plugin.type == 'cli' || _.isArray(plugin.type) && _.contains(plugin.type, 'cli')) {
                return plugin;
            }
        } catch(err) {
            process.stderr.write(colors.yellow(`Failed to load ${plugin_name} plugin\n`));
        }
    }
};
