'use strict';

const
  express = require('express'),
  bodyParser = require('body-parser'),
  request = require('request'),
  util = require('util');

var app = express();
app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.post('/motion-stories-bugs-to-slack', function(req, res) {
  let issue = req.body.issue,
      changelog = req.body.changelog,
      user = req.body.user,
      comment = req.body.comment,
      jiraURL = issue.self.split('/rest/api')[0];

  let urlMotion = process.env.SLACK_URL_CM_MOTION
  let urlMotionTesting = process.env.SLACK_URL_CM_MOTION_TESTING
  let urlPaul = process.env.SLACK_URL_DM_PAUL

  // // DEBUG
  urlMotion = urlPaul
  urlMotionTesting = urlPaul
  
  let sprintChanged = !!changelog ? changelog.items.find(item => item.field === "Sprint") : null
  let status = !!changelog ? changelog.items.find(item => item.field === "status") : null
  let isDone = !!status && status.toString === "Done"
  let toValidate = !!status && status.toString === "To Validate"
  let addedToActiveSprint = sprintChangedToActiveSprint(issue.fields.customfield_10004)
  let issueInformations = `<${jiraURL}/browse/${issue.key}|${issue.key}>: ${issue.fields.summary}`
  let greetings = getGreetings()
  let emojiDone = '✅'
  let emojiValidation = '🛂'

  if (!sprintChanged) {

    if (isDone || toValidate) {

      let channel = urlMotion
      let emoji = emojiDone
      
      if (toValidate === true) {
        channel = urlMotionTesting
        emoji = emojiValidation
      }

      let msg = `${greetings} ${emoji} ${issueInformations} (${user.displayName})`
      postToSlack(msg, channel)

    } else {

      res.sendStatus(200)

    }
  } else if (sprintChanged.to === "") {

    console.log(`${issue.key} removed from ${sprintChanged.fromString}`)
    res.sendStatus(200)

  } else if (addedToActiveSprint) {

    let msg = `${greetings} ${user.displayName} added ${issueInformations} to ${sprintChanged.toString}`
    console.log(`${msg}`)

    postToSlack(msg, urlMotion)

  } else {

    console.log(`${issue.key} added to a closed or future sprint`)
    res.sendStatus(200)

  }

  /*
   * Take an array of sprints (strings) and if you find one where state=active
   * then return true.
   */
  function sprintChangedToActiveSprint(sprints) {
    // its possible there are no sprints
    if (!sprints) {
      return false
    }

    for (let i=0; i < sprints.length; i++) {

      if (sprints[i].includes('state=ACTIVE')) {
        return true
      } else if (i === sprints.length - 1) {
        return false
      }

    }
  }

  /*
   * Pick a friendly greetings word.
   */
  function getGreetings() {
    let greetings = [ 'Ahoy!', 'Plep,', 'Hey,', 'Wesh,', 'Hallo!', '¡Hola!', 'Hej!', 'Bonjours,', 'Plip,', 'Plop,', 'Glop,', 'Hi!', 'καλημέρα!', 'Salutations,', '!سلام', '!שָׁלוֹם' ]
    let index = Math.floor(Math.random()*greetings.length)
    return greetings[index]
  }

  /*
   * Post $message to Slack channel with $url
   */
  function postToSlack(message, url) {
    let postData = {
      text: message
    }

    let options = {
      method: 'post',
      body: postData,
      json: true,
      url: url
    }

    request(options, function(err, response, body) {
      if (err) {
        console.error('error posting json: ', err)
      } else {
        console.log('Message successfully sent to Slack')
        res.sendStatus(200)
      }
    })
   }
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
module.exports = app;
