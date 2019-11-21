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

  let DEBUG_MODE = process.env.DEBUG == 1

  let SLACK_URL_MOTION = process.env.SLACK_URL_CM_MOTION
  let SLACK_URL_MOTION_JIRA = process.env.SLACK_URL_CM_MOTION_JIRA
  let SLACK_URL_MOTION_TESTING = process.env.SLACK_URL_CM_MOTION_TESTING
  let SLACK_URL_DM_PAUL = process.env.SLACK_URL_DM_PAUL

  let EMOJI_DONE = ':check:'
  let EMOJI_VALIDATION = '🧐'
  let EMOJI_WIP = '🔜'
  let EMOJI_QAREFUSED = ':cross:'

  if (DEBUG_MODE) {
    SLACK_URL_MOTION = SLACK_URL_DM_PAUL
    SLACK_URL_MOTION_JIRA = SLACK_URL_DM_PAUL
    SLACK_URL_MOTION_TESTING = SLACK_URL_DM_PAUL
  }

  let issue = req.body.issue
  let changelog = req.body.changelog
  let user = req.body.user
  let comment = req.body.comment
  let jiraURL = issue.self.split('/rest/api')[0]

  if (DEBUG_MODE) {
    console.log("=== DEBUG_MODE ON! ===")
    console.log("=== CHANGELOG: ===")
    console.log(changelog)
    console.log("=== ISSUE: ===")
    console.log(issue)
    console.log("=== COMMENT: ===")
    console.log(comment)
  }
  
  let sprintChanged = !!changelog ? changelog.items.find(item => item.field === "Sprint") : null
  let status = !!changelog ? changelog.items.find(item => item.field === "status") : null
  let isAddedToActiveSprint = sprintChangedToActiveSprint(issue.fields.customfield_10004)

  let isDone = !!status && status.toString.toLowerCase() === "done"
  let isToValidate = !!status && status.toString.toLowerCase() === "to validate"
  let isQARefused = !!status && status.toString.toLowerCase() === "qa refused"

  let emoji = null
  let channel = SLACK_URL_MOTION_JIRA
  let greetings = getGreetings()
  let issueInformations = `<${jiraURL}/browse/${issue.key}|${issue.key}>: ${issue.fields.summary}`

  if (!sprintChanged) {

    if (isDone || isToValidate || isQARefused) {

      emoji = EMOJI_DONE
      
      if (isToValidate === true) {
        channel = SLACK_URL_MOTION_TESTING
        emoji = EMOJI_VALIDATION
      } else if (isQARefused === true) {
        channel = SLACK_URL_MOTION_TESTING
        emoji = EMOJI_QAREFUSED
      }

    } else {

      res.sendStatus(200)

    }
  } else if (sprintChanged.to === "") {

    console.log(`${issue.key} removed from ${sprintChanged.fromString}`)
    res.sendStatus(200)

  } else if (isAddedToActiveSprint) {

    emoji = EMOJI_WIP

  } else {

    console.log(`${issue.key} added to a closed or future sprint`)
    res.sendStatus(200)

  }

  if (!!emoji && !!channel) {
    let msg = `${greetings} ${emoji} ${issueInformations} (${user.displayName})`

    postToSlack(msg, channel)
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
    let greetings = [ 'Ciao!', 'Buongiorno.', 'Xin chào!', 'Ahoy!', 'Plep !', 'Hey!', 'Wesh !', 'Hallo!', '¡Hola!', 'Hej!', 'Bonjours !', 'Plip !', 'Plop !', 'Glop !', 'Hi!', 'καλημέρα!', 'Salutations.', 'Salam!', 'Shalom!' ]
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
        if (DEBUG_MODE) {
          console.log(message)
        }

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
