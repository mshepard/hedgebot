const Twit = require('twit');
const parse = require('csv-parse');
const fs = require('fs');
const request = require('request');
const Forecast = require('forecast');
const tracery = require('tracery-grammar');

/*
const T = new Twit(config);
const config = require('./config.js');
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
  cache: true,      // Cache API requests 
  ttl: {            // How long to cache requests. Uses syntax from moment.js: http://momentjs.com/docs/#/durations/creating/ 
    minutes: 27,
    seconds: 45
  }
});


var lat = '55.5691359';
var lon = '12.9681254';
var script = './data/HH-script.csv';
var sensorDataURL ='http://hedgerowhyllie.hopto.org/';
var imgPath = './images/hh.jpg'
var parser = parse();
var statements = [];
var count = 0;
var interval = 1000*60*1;
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
	'question': ['what','really','you don\'t say','huh','seriously','say what'],
	'verb': ['think','bet','guess','know','am certain','feel','doubt'],
	'verb2': ['are being','wish you were','want to be','love being','are acting','hate being'],
	'qualifier': ['a little','somewhat','totally','really','completely','simply','all too','overly'],
	'adjective': ['strange','silly','rediculous','human','lazy','simplistic','self-absorbed'],
	'structure':['#question.capitalize#? I #verb# you #verb2# #qualifier# #adjective#.']
})

grammar.addModifiers(tracery.baseEngModifiers); 

var welcomeMsg = 'You can ask me things by tweeting, for example, "@HedgerowHyllie temperature?" to get my current temperature. Other values include humidity, light, moisture, ph.';

// load script

fs.createReadStream(script)
	.pipe(parser)
	.on('data', function (scriptData) {
		console.dir(scriptData[0]);
		statements = scriptData;
	});

// get current weather data

forecast.get([lat, lon], function(err, weather) {
  if(err) return console.dir(err);
  	console.dir(weather);
  	currentWeather = weather;
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

// twitter stream

var stream = T.stream('user');

// Anytime someone follows me
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

// Tweet event
function tweetEvent(tweet) {

	console.log(tweet.text);

	// Who is this in reply to?
	var reply_to = tweet.in_reply_to_screen_name;
	// Who sent the tweet?
	var name = tweet.user.screen_name;
	// What is the text?
	var txt = tweet.text;
	// If we want the conversation thread
	var id = tweet.id_str;

	// if it is a reply
	if (reply_to === 'HedgerowHyllie') {

		// parse reply
		
		if (/temperature?/i.test(txt)) {

			var replyText = 'Hej @' + name + '. Currently my temperature is ' + sensorValues[0]['temp'] + sensorUnits['temp']; 
		
		} else if (/humidity?/i.test(txt)) {

			var replyText = 'Hej @' + name + '. Currently my humidity is ' + sensorValues[0]['humidity'] + sensorUnits['humidity']; 

		} else if (/moisture?/i.test(txt)) {

			var replyText = 'Hej @' + name + '. Currently my soil moisture is ' + sensorValues[0]['moisture'] + sensorUnits['moisture']; 

		} else if (/light?/i.test(txt)) {

			var replyText = 'Hej @' + name + '. Currently my ambient light level is ' + sensorValues[0]['light'] + sensorUnits['light']; 

		} else if (/ph?/i.test(txt)) {

			var replyText = 'Hej @' + name + '. Currently my soil ph is ' + sensorValues[0]['ph'] + sensorUnits['ph']; 

		} else {

			// Reply back to the sender
			var replyText = '@'+name + ' ' + grammar.flatten('#structure#');

		}
    	
    	// Post that tweet
    	T.post('statuses/update', { status: replyText, in_reply_to_status_id: id}, tweeted);

		// Make sure it worked!
		function tweeted(err, reply) {
  			if (err) {
        			console.log(err.message);
  			} else {
    			console.log('Tweeted: ' + reply.text);
  			}
		}
  	}
}

// tweetbot

var tweetBot = setInterval(function(){

	var statusUpdate = '';
	count++;

	switch (count) {
		case 1:
			// statements
			statusUpdate = statements[Math.floor(Math.random() * statements.length)];
			// statusUpdate += ' #agrikultura';
			tweetOut(statusUpdate);
			break;
		case 2:
			// get current sensor data
			request.get(sensorDataURL, function (error, response, sensorData) {
			    if(error) {
 				   	console.log(error.message);
 				} else {
 		   			console.dir(sensorData);
    				sensorValues = JSON.parse(sensorData);
    				// sensor readings
					var obj = sensorValues['0'];
					console.log('my temp: '+ obj.temp);
					statusUpdate = 'Currently my ';
					for (var i in obj) {
						if (i != 'nodeID' && i != 'timestamp' && i != 'pwlevel') {
							statusUpdate += sensorNames[i] + ' is ' + obj[i] + sensorUnits[i] + ', ';
						}
					}
					// statusUpdate += '#agrikultura';
					tweetOut(statusUpdate);
	    		}
			});
			break;

		case 3:
		// get current weather data
			forecast.get([lat, lon], function(err, weather) {
				if(err) return console.dir(err);
				console.dir(weather.currently.icon);
			  	currentWeather = weather;
				// weather report
				switch (currentWeather.currently.icon) {
					case 'clear-day':
						statusUpdate = 'Looking good here. Clear skies all around!';
						break;
					case 'clear-night':
						statusUpdate = 'Ah a clear night. Can you see the stars?';
						break;
					case 'rain':
						statusUpdate = 'It is raining again. Good for me, not so much for you, I guess.';
						break;
					case 'snow':
						statusUpdate = 'Brrr. Winter wonderland. I am going back to sleep';
						break;
					case 'sleet':
						statusUpdate = 'Watch out for the little ice missiles. This sleet hurts my leaves!';
						break;
					case 'wind':
						statusUpdate = 'Come close and I will shelter you from the wind.';
						break;
					case 'fog':
						statusUpdate = 'Fog, fog everywhere. I can barely see you.';
						break;
					case 'cloudy':
						statusUpdate = 'Clouds, clouds. Hope this sun will come out tomorrow!';
						break;
					case 'partly-cloudy-day':
						statusUpdate = 'Make up your mind, sun. Either you are with us or against us!';
						break;
					case 'partly-cloudy-night':
						statusUpdate = 'Dark sky, night sky, clouds come and go. Was that a shooting star?';
						break;
					default:
						statusUpdate = 'I do not know what to make of this weather. Do you?';
						break;
				}
				// statusUpdate += ' #agrikultura';
				tweetOut(statusUpdate);
			});
			break;

		case 4:
			statusUpdate = 'Right now: ' + currentWeather.currently.summary + '. ' + currentWeather.hourly.summary;
			//statusUpdate += ' #agrikultura';
			tweetOut(statusUpdate);
			break;

		case 5:
			var b64content = fs.readFileSync(imgPath, { encoding: 'base64' })

			// first we must post the media to Twitter
			T.post('media/upload', { media_data: b64content }, function (err, data, response) {
  				// now we can assign alt text to the media, for use by screen readers and
  				// other text-based presentations and interpreters
  				var mediaIdStr = data.media_id_string
  				var altText = 'Snails come to visit'
  				var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
  				statusUpdate = 'Look who\'s come to visit! ' + Math.floor(Math.random()*1000);

  				T.post('media/metadata/create', meta_params, function (err, data, response) {
   					if (!err) {
      					// now we can reference the media and post a tweet (media will attach to the tweet)
      					var params = { status: statusUpdate, media_ids: [mediaIdStr] }

      					T.post('statuses/update', params, function (err, data, response) {
        					console.log(data)
      					})
    				}
  				})
			})
			break;
		}

	if (count == 5) count = 0;

}, interval);

function tweetOut(update) {

		update += ' ' + Math.floor(Math.random()*1000);
		console.log('tweet: ' + update);

		T.post('statuses/update', {status: update},  function(error, tweet, response) {
			if(error) {
				console.dir(error);
			} else {
				console.log('> success');
			}
		});
	}
}

