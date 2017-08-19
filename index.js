// Hedgerow Hyllie twitter bot
// Mark Shepard
// http://agrikultura.triennal.se/artworks/hedgerow-hyllie/

const Twit = require('twit');
const parse = require('csv-parse');
const fs = require('fs');
const request = require('request');
const Forecast = require('forecast');
const tracery = require('tracery-grammar');

/*
const config = require('./config.js');
const T = new Twit(config);
*/

const T = new Twit({
	consumer_key: process.env.CONSUMER_KEY,
	consumer_secret: process.env.CONSUMER_SECRET,
	access_token: process.env.ACCESS_TOKEN,
	access_token_secret: process.env.ACCESS_TOKEN_SECRET
 });

const forecast = new Forecast({
  service: 'darksky',
  key: '5d2b8e5710f5bd5a6a9068e3c9250208',
  units: 'celcius',
  cache: true,     
  ttl: {            
    minutes: 14,
    seconds: 59
  }
});


var lat = '55.5691359';
var lon = '12.9681254';

var script = './data/HH-script.csv';
var sensorDataURL ='http://medialabmx.org/hedgerow/';

var parser = parse();

var statements = [];
var images = [];

var count = 0;
var interval = 1000*60*60;

var currentWeather = {};

var sensorNames = {
	temp: 'temperature',
	humidity: 'relative humidity',
	light: 'light',
	moisture: 'soil moisture',
	ph: 'soil pH',
	pwlevel: 'power level'
}
var sensorUnits = {
	temp: '°C',
	humidity: '%',
	light: 'lux',
	moisture: 'hPa',
	ph: '',
	pwlevel: 'mV',
	timestamp: ''
}
var sensorValues = {};

// load script
fs.createReadStream(script)
	.pipe(parser)
	.on('data', function (scriptData) {
		console.log(scriptData[0] + " : " + scriptData[1]);
		images.push(scriptData[0]);
		statements.push(scriptData[1]);
	});

// get current sensor data
request.get(sensorDataURL, function (error, response, sensorData) {
	if(error) {
		console.log(error.message);
	} else {
		console.dir(sensorData);
		sensorValues = JSON.parse(sensorData);
	}
});

// tweetbot

var tweetBot = setInterval(function(){

	var params = {status: ''};
	count++;

	switch (count) {

		case 1: // statements + images

			var x = Math.floor(Math.random() * statements.length);
			var statusUpdate = statements[x] + ' ' + Math.floor(Math.random()*1000);
			var imgPath = './images/'+images[x];
			var b64content = fs.readFileSync(imgPath, { encoding: 'base64' })

			// first we must post the media to Twitter
			T.post('media/upload', { media_data: b64content }, function (err, data, response) {
  				var mediaIdStr = data.media_id_string
  				var meta_params = { media_id: mediaIdStr }

  				T.post('media/metadata/create', meta_params, function (err, data, response) {
   					if (!err) {
      					// now we can reference the media and post a tweet (media will attach to the tweet)
      					var params = { status: statusUpdate, media_ids: [mediaIdStr] }

      					T.post('statuses/update', params, function (err, data, response) {
        					// console.log(data)
        					console.log('> success (media object');
      					})
    				}
  				})
			})
			break;

		case 2: // sensor data
			
			request.get(sensorDataURL, function (error, response, sensorData) {
			    if(error) {
 				   	console.log(error.message);
 				} else {
 		   			console.dir(sensorData);
    				sensorValues = JSON.parse(sensorData);
					var obj = sensorValues['2'];
					params.status = 'Currently my ';
					for (var i in obj) {
						if (i != 'nodeID' && i != 'timestamp' && i != 'pwlevel' && i != 'ph') {
							params.status += sensorNames[i] + ' is ' + obj[i] + sensorUnits[i] + ', ';
						}
					}
					tweetOut(params);
	    		}
			});
			break;

		case 3: // weather data

			forecast.get([lat, lon], function(err, weather) {
				if(err) return console.dir(err);
				console.dir(weather.currently.icon);
			  	currentWeather = weather;
				// weather report
				switch (currentWeather.currently.icon) {
					case 'clear-day':
						params.status = 'Looking good here. Clear skies all around!';
						break;
					case 'clear-night':
						params.status = 'Ah a clear night. Can you see the stars?';
						break;
					case 'rain':
						params.status = 'It is raining again. Good for me, not so much for you, I guess.';
						break;
					case 'snow':
						params.status = 'Brrr. Winter wonderland. I am going back to sleep';
						break;
					case 'sleet':
						params.status = 'Watch out for the little ice missiles. This sleet hurts my leaves!';
						break;
					case 'wind':
						params.status = 'Come close and I will shelter you from the wind.';
						break;
					case 'fog':
						params.status = 'Fog, fog everywhere. I can barely see you.';
						break;
					case 'cloudy':
						params.status = 'Clouds, clouds. Hope this sun will come out tomorrow!';
						break;
					case 'partly-cloudy-day':
						params.status = 'Make up your mind, sun. Either you are with us or against us!';
						break;
					case 'partly-cloudy-night':
						params.status = 'Dark sky, night sky, clouds come and go. Was that a shooting star?';
						break;
					default:
						params.status = 'I do not know what to make of this weather. Do you?';
						break;
				}
				tweetOut(params);
			});
			break;

		case 4: // more weather data

			params.status = 'Right now: ' + currentWeather.currently.summary + '. ' + currentWeather.hourly.summary;
			tweetOut(params);
			break;

		}

	if (count == 4) count = 0;

}, interval);

function tweetOut(params) {

	params.status += ' [' + Math.floor(Math.random()*1000) + ']';
	
	T.post('statuses/update', params,  function(error, tweet, response) {
		if(error) {
			console.dir(error);
		} else {
			console.log('> success');
		}
	});
}

