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

var grammar = tracery.createGrammar({
	'response1': ['Hmm. I\'m not sure what you\'re asking me.', 'What\'s that you say?', 'What?','I didn\'t get that.', 'I\'m having a hard time understanding you.'],
	'response2': ['Want to know about my internal affairs?','The bees are so loud it\'s hard to hear you.','Do you know how to trap rabbits?','My berries are so ripe. Want some?'],
	'structure': ['#response1# #response2#']
})

grammar.addModifiers(tracery.baseEngModifiers); 

var welcomeMsg = 'You can ask me things by tweeting, for example, "@HedgerowHyllie temperature?" to get my current temperature. You can also ask me about humidity, light, moisture and ph.';

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

var stream = T.stream('user');

stream.on('follow', followed);

function followed(event) {
  var name = event.source.name;
  var screenName = event.source.screen_name;
  console.log('I was followed by: ' + name + ' ' + screenName);
  var message = {
  	'screen_name' : screenName,
  	'text' : 'Hej ' + screenName + '. ' + welcomeMsg
  }
	T.post('direct_messages/new', message, messageSent);
	function messageSent(err, reply) {
		if (err) {
			console.log(err.message);
		} else {
			console.log('Sent DM: ' + message.text);
		}
    }
}

stream.on('tweet', tweetEvent);

function tweetEvent(tweet) {

	console.log(tweet.text);
	var reply_to = tweet.in_reply_to_screen_name;
	var screenName = tweet.user.screen_name;
	var txt = tweet.text;
	var id = tweet.id_str;

	if (reply_to === 'HedgerowHyllie') {

		if (/temperature?/i.test(txt)) {

			var replyText = 'Hej @' + screenName + '. Currently my temperature is ' + sensorValues[0]['temp'] + sensorUnits['temp']; 
		
		} else if (/humidity?/i.test(txt)) {

			var replyText = 'Hej @' + screenName + '. Currently my humidity is ' + sensorValues[0]['humidity'] + sensorUnits['humidity']; 

		} else if (/moisture?/i.test(txt)) {

			var replyText = 'Hej @' + screenName + '. Currently my soil moisture is 7' + sensorUnits['moisture']; 

		} else if (/light?/i.test(txt)) {

			var replyText = 'Hej @' + screenName + '. Currently my ambient light level is ' + sensorValues[0]['light'] + sensorUnits['light']; 

		} else if (/ph?/i.test(txt)) {

			var replyText = 'Hej @' + screenName + '. Currently my soil ph is ' + sensorValues[0]['ph'] + sensorUnits['ph']; 

		} else {

			var replyText = '@'+screenName + ' ' + grammar.flatten('#structure#');

		}

		var params = { status: replyText, in_reply_to_status_id: id};

		tweetOut(params);

  	}
}

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
					var obj = sensorValues['0'];
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

	params.status += ' #agrikultura2017 ' + Math.floor(Math.random()*1000);
	
	T.post('statuses/update', params,  function(error, tweet, response) {
		if(error) {
			console.dir(error);
		} else {
			console.log('> success');
		}
	});
}

