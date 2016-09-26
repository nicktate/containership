const _ = require('lodash');
const sprintf = require('sprintf-js').sprintf;

module.exports = {

    println: (formatting) => {
        if(_.isUndefined(formatting)) {
            process.stdout.write('\n');
        } else {
            const args = _.zip(formatting);

            const formatted = sprintf.apply(this,
                _.flatten([
                    args[0].join(' '),
                    args[1]
                ])
            );

            process.stdout.write(`${formatted}\n`);
        }
    },

    parse_env_vars: (core) => {
        const argv = process.argv;

        _.forEach(process.env, (value, name) => {
            if(name.indexOf('CS_') === 0) {
                name = name.substring(3, name.length).replace(/_/g, '-').toLowerCase();
                const flag = `--${name}`;

                if(!_.contains(process.argv, flag)) {
                    if(_.has(core.options, name)) {
                        if(core.options[name].list) {
                            value = value.split(',');
                        } else {
                            value = [value];
                        }

                        _.forEach(value, (v) => {
                            argv.push(flag);
                            argv.push(v);
                        });
                    } else if(_.has(core.scheduler.options, name)) {
                        if(core.scheduler.options[name].list) {
                            value = value.split(',');
                        } else {
                            value = [value];
                        }

                        _.forEach(value, (v) => {
                            argv.push(flag);
                            argv.push(v);
                        });
                    } else if(_.has(core.api.options, name)) {
                        if(core.api.options[name].list) {
                            value = value.split(',');
                        } else {
                            value = [value];
                        }

                        _.forEach(value, (v) => {
                            argv.push(flag);
                            argv.push(v);
                        });
                    }
                }
            }
        });

        return argv.slice(2);
    },

    parse_volumes: (volumes) => {
        return _.map(volumes, (volume) => {
            const parts = volume.split(':');

            volume = {
                container: 1 === parts.length ? parts[0] : parts[1]
            };

            if(1 < parts.length) {
                if(!_.isEmpty(parts[0])) {
                    volume.host = parts[0];
                }

                // ex: /host/path:/container/path:{propogationType}
                if(3 === parts.length) {
                    volume.propogation = parts[2];
                }
            }

            return volume;
        });
    },

    parse_tags: (tags) => {
        tags = _.map(tags, (tag) => {
            const idx = tag.indexOf('=');
            return [ tag.substring(0, idx), tag.substring(idx + 1, tag.length) ];
        });

        return _.zipObject(tags);
    },

    stringify_tags: (tags) => {
        tags = _.map(tags, (val, key) => {
            return [key, val].join('=');
        });

        if(!_.isEmpty(tags)) {
            return tags.join(', ');
        } else {
            return '-';
        }
    }

};
