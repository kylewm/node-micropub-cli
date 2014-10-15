#!/usr/bin/env node
var clientId = 'node-micropub';

var argv = require('minimist')(process.argv.slice(2));
var http = require('http');
var request = require('request');
var cheerio = require('cheerio');

function collectEndpoints(userUrl, cb) {
    request(userUrl, function (error, response, html) {
        if (!error && response.statusCode == 200) {
            console.log("Successfully fetched " + userUrl);
            var $ = cheerio.load(html);
            var authEndpoint = $('link[rel="authorization_endpoint"]').attr('href');
            var tokenEndpoint = $('link[rel="token_endpoint"]').attr('href');
            var micropubEndpoint = $('link[rel="micropub"]').attr('href');
            if (!authEndpoint) {
                console.log("Could not find authorization_endpoint");
            } else if (!tokenEndpoint) {
                console.log("Could not find token_endpoint");
            } else if (!micropubEndpoint) {
                console.log("Could not find micropub endpoint");
            } else {
                cb(authEndpoint, tokenEndpoint, micropubEndpoint);
            }
        } else {
            console.log(error);
        }
    });
}

function authorize(userUrl, authEndpoint, cb) {
    var serverPort = 3445;
    var redirectUri = 'http://localhost:' + serverPort;

    var server = http.createServer(function (request, response) {
        var parsed = require('url').parse(request.url, true);
        var authCode = parsed.query.code;
        var me = parsed.query.me;

        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.write('Thanks! You can close this tab now.');
        response.end();

        if (me && authCode) {
            cb(me, authCode, redirectUri);
        } else {
            console.log('Unrecognized response from auth endpoint: ' + request.url);
        }

        request.connection.destroy();
        server.close();
    });

    server.listen(serverPort, function () {
        console.log('Please open this url in your browser:');
        console.log(authEndpoint + '?me=' + encodeURIComponent(userUrl)
                    + '&client_id=' + clientId
                    + '&redirect_uri=' + encodeURIComponent(redirectUri));
    });
}

function exchangeToken(tokenEndpoint, me, authCode, redirectUri, cb) {
    console.log('exchanging auth code for an access token: ' + tokenEndpoint);

    // post to token endpoint
    request.post(tokenEndpoint, {
        form: {
            me: me,
            code: authCode,
            redirect_uri: redirectUri,
            client_id: clientId
        }
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var data = require('querystring').parse(body);
            var accessToken = data.access_token;
            if (accessToken) {
                cb(accessToken);
            } else {
                console.log('could not understand access token ' + body);
            }
        }
    });

}


var userUrl = argv.url || argv.u;

collectEndpoints(userUrl, function (authEndpoint, tokenEndpoint, micropubEndpoint) {
    console.log("attempting to authorize with " + authEndpoint);
    authorize(userUrl, authEndpoint, function (me, authCode, redirectUri) {
        exchangeToken(tokenEndpoint, me, authCode, redirectUri, function (token) {

            console.log('access token: ' + token);

        });
    });
});
