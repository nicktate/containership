'use strict';

const pkg = require('../package.json');

const _ = require('lodash');
const daemon = require('daemon');
const fs = require('fs');

const PID_FILE = '/var/run/containership.pid';

module.exports = {

    fetch: (core) => {
        return {
            commands: [
                {
                    name: 'agent',
                    options: core.options,

                    callback: (options) => {
                        if(process.env.NODE_ENV !== 'development') {
                            daemon({
                                stdout: process.stdout,
                                stderr: process.stderr
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
