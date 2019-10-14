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

  let DEBUG_MODE = process.env.DEBUG_MODE == 1

  let SLACK_URL_MOTION = process.env.SLACK_URL_CM_MOTION
  let SLACK_URL_MOTION_JIRA = process.env.SLACK_URL_CM_MOTION_JIRA
  let SLACK_URL_MOTION_TESTING = process.env.SLACK_URL_CM_MOTION_TESTING
  let SLACK_URL_DM_PAUL = process.env.SLACK_URL_DM_PAUL

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
    console.log("DEBUG_MODE ON!")
    console.log(changelog)
    console.log(issue)
  }

  let ISSUE_TYPE = { '1': "bug",'10001': "story", '3': "task", '5': "subtask", '2': "new feature", '4': "improvement", '10000': "epic" }
  let EMOJI_DONE = ':check:'
  let EMOJI_VALIDATION = '🧐'
  let EMOJI_WIP = '🔜'
  let EMOJI_QAREFUSED = ':cross:'
  
  let sprintChanged = !!changelog ? changelog.items.find(item => item.field === "Sprint") : null
  let status = !!changelog ? changelog.items.find(item => item.field === "status") : null
  let addedToActiveSprint = sprintChangedToActiveSprint(issue.fields.customfield_10004)

  let isDone = !!status && status.toString === "Done"
  let toValidate = !!status && status.toString === "To Validate"
  let isQARefused = !!status && status.toString === "QA Refused"
  let issueType = ISSUE_TYPE[issue.fields.issuetype.id]

  let emoji = null
  let channel = SLACK_URL_MOTION_JIRA
  let greetings = getGreetings()
  let issueInformations = `<${jiraURL}/browse/${issue.key}|${issue.key}>: ${issue.fields.summary}`

  if (!sprintChanged) {

    if (isDone || toValidate || isQARefused) {

      emoji = EMOJI_DONE
      
      if (toValidate === true) {
        channel = SLACK_URL_MOTION_TESTING
        emoji = EMOJI_VALIDATION
      } else if (isQARefused === true) {
        channel = SLACK_URL_MOTION_TESTING
        emoji = EMOJI_QAREFUSED
      }
      else if (issueType == "subtask") {
        channel = SLACK_URL_DM_PAUL
      }

    } else {

      res.sendStatus(200)

    }
  } else if (sprintChanged.to === "") {

    console.log(`${issue.key} removed from ${sprintChanged.fromString}`)
    res.sendStatus(200)

  } else if (addedToActiveSprint) {

    emoji = EMOJI_WIP

  } else {

    console.log(`${issue.key} added to a closed or future sprint`)
    res.sendStatus(200)

  }

  if (!!emoji && !!channel) {
    let msg = `${greetings} ${emoji} ${issueInformations} (${user.displayName})`
    console.log(msg)

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
