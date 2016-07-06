'use strict';

const child_process = require('child_process');
const _ = require('lodash');

module.exports = {

    fetch: (/*core*/) => {
        return {
            commands: [
                {
                    name: 'update',

                    options: {
                        tag: {
                            help: 'Specific Containership tag to download',
                            required: false,
                            abbr: 't'
                        }
                    },

                    callback: (options) => {
                        const npm = (process.platform === 'win32') ? 'npm.cmd' : 'npm';
                        let message = ['Updating Containership to'];
                        let args = ['install', '-g'];

                        if(_.has(options, 'tag')) {
                            args.push(`containership@${options.tag}`);
                            message = `${message} version ${options.tag}`;
                        } else {
                            args.push('containership');
                            message = `${message} latest version`;
                        }

                        process.stdout.write(`${message}\n`);

                        child_process.spawn(npm, args, {
                            stdio: 'inherit'
                        });
                    }
                }
            ]
        };
    }
};
