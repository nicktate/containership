'use strict';

const pkg = require('../package.json');

const _ = require('lodash');
const fs = require('fs');
const memwatch = require('memwatch-next');

const PID_FILE = '/var/run/containership.pid';

module.exports = {

    fetch: (core) => {
        return {
            commands: [
                {
                    name: 'agent',
                    options: core.options,

                    callback: (options) => {
                        if (process.env.CS_RECORD_MEM_LEAKS === 'true') {
                            memwatch.on('stats', (stats) => {
                                process.stdout.write('Memwatch Stats:');
                                process.stdout.write(JSON.stringify(stats, null, 2));
                            });

                            memwatch.on('leak', (info) => {
                                process.stdout.write('Memwatch Leaks:');
                                process.stdout.write(JSON.stringify(info, null, 2));
                            });
                        }

                        fs.writeFile(PID_FILE, process.pid, (err) => {
                            if(err) {
                                process.stderr.write('Error writing PID! Are you running containership as root?\n');
                                process.exit(1);
                            }

                            options.version = pkg.version;
                            options.mode = options.mode;
                            core.scheduler.load_options(_.pick(options, _.keys(core.scheduler.options)));
                            core.api.load_options(_.pick(options, _.keys(core.api.options)));
                            core.load_options(options);
                            core.initialize();
                        });
                    }
                }
            ]
        };
    }
};
