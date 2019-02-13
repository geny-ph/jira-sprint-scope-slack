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

  // DEBUG LOGS – for n00bz
  // console.log('Changelog:\n' + util.inspect(changelog, false, null) )
  // console.log('Issue:\n' + util.inspect(issue, false, null) )
  // console.log('Comment:\n' + util.inspect(comment, false, null) )
  //console.log('Customfield_10004:\n' + util.inspect(issue.fields.customfield_10004, false, null) )
    
  let sprintChanged = !!changelog ? changelog.items.find(item => item.field === "Sprint") : null
  let status = !!changelog ? changelog.items.find(item => item.field === "status") : null
  let isDone = !!status && status.toString === "Done"
  let addedToActiveSprint = sprintChangedToActiveSprint(issue.fields.customfield_10004)

  if (!sprintChanged) {

    console.log('No Sprint change')
    console.log(`isDone == ${isDone}`)

    if (isDone) {
      let msg = `${user.displayName} marked ${issue.key} as ${issue.fields.status.name}`
      console.log(msg)
      let fixVersions = 'none'
      if (!!issue.fields.fixVersions) {
        fixVersions = ''
        issue.fields.fixVersions.forEach(function(version) { fixVersions += fixVersions.length ? ', ' + version.name : version.name } )
      }

      let postData = {
        text: msg,
        attachments: [
          {
            fallback: `${user.displayName} marked <${jiraURL}/browse/${issue.key}|${issue.key} as ${issue.fields.status.name}>`,
            color: 'good',
            title: `<${jiraURL}/browse/${issue.key}|${issue.key}>: ${issue.fields.summary}`,
            fields: [
              {
                title: "Type",
                value: `${issue.fields.issuetype.name}`,
                short: true
              },
              {
                title: "Fixed version",
                value: `${fixVersions}`,
                short: true
              },
            ]
          }
        ]
      }

      let options = {
        method: 'post',
        body: postData,
        json: true,
        url: process.env.SLACK_URL
      }

      request(options, function(err, response, body) {
        if (err) {
          console.error('error posting json: ', err)
        } else {
          console.log('alerted Slack')
          res.sendStatus(200)
        }
      })

    }
    else {

      res.sendStatus(200)

    }
  } else if (sprintChanged.to === "") {

    console.log(`${issue.key} removed from ${sprintChanged.fromString}`)
    res.sendStatus(200)

  } else if (addedToActiveSprint) {

    console.log(`${issue.key} added to an active sprint: ${sprintChanged.toString}`)

    let postData = {
      text: `${user.displayName} added an issue to ${sprintChanged.toString}`,
      attachments: [
        {
          fallback: `${user.displayName} added <${jiraURL}/browse/${issue.key}|${issue.key}: ${issue.fields.summary}> to ${sprintChanged.toString}`,
          color: 'good',
          title: `<${jiraURL}/browse/${issue.key}|${issue.key}>: ${issue.fields.summary}`,
          fields: [
            {
              title: "Type",
              value: `${issue.fields.issuetype.name}`,
              short: true
            },
            {
              title: "Motion Team",
              value: `${issue.fields.customfield_11400}`,
              short: true
            }
          ]
        }
      ]
    }

    let options = {
      method: 'post',
      body: postData,
      json: true,
      url: process.env.SLACK_URL
    }

    request(options, function(err, response, body) {
      if (err) {
        console.error('error posting json: ', err)
      } else {
        console.log('alerted Slack')
        res.sendStatus(200)
      }
    })

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
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
module.exports = app;
