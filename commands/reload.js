'use strict';

const fs = require('fs');
const child_process = require('child_process');

const PID_FILE = '/var/run/containership.pid';

module.exports = {

    fetch: (/*core*/) => {
        return {
            commands: [
                {
                    name: 'reload',
                    options: {},

                    callback: (/*options*/) => {
                        fs.readFile(PID_FILE, (err, pid) => {
                            if(err) {
                                process.stderr.write('Error loading PID file. Does it exist?');
                                process.exit(1);
                            } else {
                                child_process.exec(`kill -1 ${pid.toString()}`, (err/*, stdout, stderr*/) => {
                                    if(err) {
                                        process.stderr.write('Error reloading the ContainerShip agent!');
                                        process.exit(1);
                                    } else {
                                        process.stderr.write('Successfully reloaded the ContainerShip agent!');
                                        process.exit(0);
                                    }
                                });
                            }
                        });
                    }
                }
            ]
        };
    }

};
