const config = require('./config');

const _ = require('lodash');
const async = require('async');
const request = require('request');

module.exports = {

    core: null,

    get: function(path, qs, get_callback) {
        const options = {
            url: `${config.config['api-url']}/${config.config['api-version']}/${path}`,
            headers: config.config.headers || {},
            method: 'GET',
            qs: qs,
            json: true,
            strictSSL: config.config.strict_ssl || true
        };

        async.waterfall(_.map(this.core.cli.middleware || [], (middleware) => {
            return (callback) => {
                middleware(options, callback);
            };
        }), (err) => {
            if(err) {
                throw err;
            }

            request(options, get_callback);
        });
    },

    put: function(path, qs, body, put_callback) {
        const options = {
            url: `${config.config['api-url']}/${config.config['api-version']}/${path}`,
            headers: config.config.headers || {},
            method: 'PUT',
            qs: qs,
            json: body,
            strictSSL: config.config.strict_ssl || true
        };

        async.waterfall(_.map(this.core.cli.middleware || [], (middleware) => {
            return (callback) => {
                middleware(options, callback);
            };
        }), (err) => {
            if(err) {
                throw err;
            }

            request(options, put_callback);
        });
    },

    post: function(path, qs, body, post_callback) {
        const options = {
            url: `${config.config['api-url']}/${config.config['api-version']}/${path}`,
            headers: config.config.headers || {},
            method: 'POST',
            qs: qs,
            json: body,
            strictSSL: config.config.strict_ssl || true
        };

        async.waterfall(_.map(this.core.cli.middleware || [], (middleware) => {
            return (callback) => {
                middleware(options, callback);
            };
        }), (err) => {
            if(err)
                throw err;

            request(options, post_callback);
        });
    },

    delete: function(path, qs, delete_callback) {
        const options = {
            url: `${config.config['api-url']}/${config.config['api-version']}/${path}`,
            headers: config.config.headers || {},
            method: 'DELETE',
            qs: qs,
            json: true,
            strictSSL: config.config.strict_ssl || true
        };

        async.waterfall(_.map(this.core.cli.middleware || [], (middleware) => {
            return (callback) => {
                middleware(options, callback);
            };
        }), (err) => {
            if(err) {
                throw err;
            }

            request(options, delete_callback);
        });
    }

};
