/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define([ 'underscore',
         'backbone',
         'webL10n',
         'views/soma-view',
         'views/manage-character-view',
         'text!templates/manage-sessions.html' ],
function(_, Backbone, webL10n, SomaView, ManageCharacterView, templateString) {

  return SomaView.extend({
    initialize: function() {
      // Alias message box view
      this.messageBoxView = this.options.messageBoxView;

      // Register for updates to the list of characters
      this.listenTo(this.model.sessions, "sync", this.sync);
      this.listenTo(this.model.sessions, "error", this.error);
      this.listenTo(this.model.sessions, "request", this.request);

      // Manage currently selected session
      // A value of null for _selectedSessionId means "Use the latest session"
      this._selectedSessionId = null;
      Object.defineProperty(this, "latestSessionId",
        { get: function() {
            return this.model.get("latestSession")
                 ? this.model.get("latestSession").sessionId
                 : null;
          }
        });
      Object.defineProperty(this, "selectedSessionId",
        { get: function() {
            return this._selectedSessionId || this.latestSessionId;
          }
        });

      // Re-render on localize (there are one or two strings we set by code)
      var self = this;
      $(window).on("localized", null, function() { self.render(); });
    },

    events: {
      "click .refresh": "refresh",
      "click #new-session": "startSession",
      "click .end-session": "endSession",
      "click .restart-session": "restartSession"
    },

    render: function() {
      // Render template
      if (!this.template) {
        this.renderTemplate(templateString, this.getData());
      } else {
        _.extend(this.template.scope, this.getData());
        this.template.render();
        webL10n.translate(this.el);
      }

      // Make sure the right accordion is visible
      this.expandSubsection();

      return this;
    },

    getData: function() {
      var data = {
        sessionsLoaded: this.model.sessionsLoaded,
        haveSessions: this.model.sessionsLoaded &&
                      this.model.sessions.length > 0,
        noSessions: this.model.sessionsLoaded &&
                    this.model.sessions.length == 0,
        wall: this.model.toJSON(),
        sessions: []
      };

      if (this.model.sessionsLoaded) {
        data.sessions =
          _.chain(this.model.sessions.toJSON())
           // Annotate every sessions object with 'running' and 'canrestart'
           // (set to false here and upated below) properties
           .map(function(session) {
                  session.running = session.end === null;
                  session.canrestart = false;
                  session.characters =
                    _.map(session.characters, prepareCharacter);
                  return session;
                })
           // Fill in date properties
           .map(localizeSessionDates)
           // Reverse the list of sessions so newer ones appear first
           .reverse()
           .value();
        ;
        // Set 'canrestart' only on latest session
        if (data.sessions.length && !data.sessions[0].running) {
          data.sessions[0].canrestart = true;
        }
      }

      function prepareCharacter(character) {
        // I was getting some surprising (cross-browser) results where changes
        // to character here would persist across calls (despite the data for
        // character being produced by _.clone. As a result, changes to the
        // locale were not reflect in the result (since we'd detect that
        // character.title had been filled in---it was filled in with "No
        // name...").
        //
        // I didn't have time to trace down exactly how that came about but for
        // now as a workaround we simply clone the character first.
        // character here would 
        var result = _.clone(character);
        result.title = result.title ||
                       webL10n.get('untitled-id', { id: character.charId });
        return result;
      }

      return data;
    },

    sync: function() {
      // Detect if the session we are currently pointing to still exists, and,
      // if not update
      if (this.model.sessionsLoaded &&
          this._selectedSession &&
          !this.model.sessions.get(this._selectedSession)) {
        // XXX Test this
        this.changeSelectedSession(null);
      }

      this.render();
    },

    refresh: function() {
      this.model.fetchCharacters();
    },

    showSession: function(session, character) {
      // Expand appropriate session
      this._selectedSessionId = parseInt(session);
      this.expandSubsection();

      // If a character is specified, generate the appropriate view
      if (character) {
        var self = this;
        this.model.sessionsPromise.done(function (sessions) {
          self.characterView =
            new ManageCharacterView(
              {
                model: sessions.get(self.selectedSessionId)
                       .characters.get(parseInt(character))
              });
          // When the modal is hidden, trigger changed-session
          // This will ensure the URL gets updated to no longer reflect the
          // character ID
          self.characterView.on('hidden', function() {
            self.trigger('changed-session', self.selectedSessionId);
          });
          // Render the character
          self.$el.append(self.characterView.render().el);
        });
      }
    },

    expandSubsection: function() {
      // We don't bother expanding the session area if this is not visible.
      // This is because it uses a transition and if the content is in
      // a display:none subtree the transition won't run and bootstrap will get
      // confused.
      if (!this.$el.is(':visible'))
        return;

      // Select session based on the first matching session ID
      [ this.selectedSessionId, this.latestSessionId ]
        .every(function(candidateId) {
          var elem = $('#session-' + candidateId);
          if (elem.is(':visible')) {
            elem.collapse('show');
          }
          // If the item was NOT found, continue
          return elem.length == 0;
        });
    },

    // Generally the selected session is changed by clicking a URL or navigating
    // and we get told from the outside about it (via showSession).
    //
    // However, for some changes such as creating a new session, deleting
    // a session, or doing a sync that results in some sessions disappearing we
    // change the selected session from within and tell anyone who cares.
    changeSelectedSession: function(newSessionId) {
      this._selectedSessionId = newSessionId;
      this.trigger('changed-session', newSessionId);
    },

    startSession: function() {
      this.disableSessionControls();

      var view = this;
      this.model.startSession({
        success: function(session) {
          // If we are currently bound to a specific session then update to the
          // newly created event
          if (view._selectedSessionId !== null) {
            view.changeSelectedSession(session.id);
          }
        },
        complete: function() { view.enableSessionControls(); },
      });
    },

    endSession: function() {
      this.disableSessionControls();
      this.model.endSession(
        { complete: this.enableSessionControls.bind(this) }
      );
    },

    restartSession: function() {
      this.disableSessionControls();
      this.model.restartSession(
        { complete: this.enableSessionControls.bind(this) }
      );
    },

    disableSessionControls: function() {
      this.$("#new-session, .end-session .restart-session")
        .attr('disabled', 'disabled');
    },

    enableSessionControls: function() {
      this.$("#new-session, .end-session .restart-session")
        .removeAttr('disabled');
    },

    error: function(sessions, resp, xhr) {
      var key = resp['responseJSON'] !== undefined
              ? resp.responseJSON.error_key
              : resp.statusText;
      this.messageBoxView.setMessage(key,
        { keyPrefix: "session-save-failed", dismiss: true });
    },

    request: function(sessions, xhr, options) {
      this.messageBoxView.clearMessage();
    }
  });

  function localizeSessionDates(session) {
    // Prepare date strings.
    // e.g. for 'start'
    //   - start: '2013-08-03 08:36:21' => '2013-08-03T08:36:21+00:00'(RFC 3339)
    //   - startDatetime
    //   - startDate
    //   - startTime
    _.each([ "start", "end" ], function(part) {
      // Skip missing values (e.g. when session is running)
      if (!session[part])
        return;

      // Try to convert string to RFC 3339 and parse
      var str = session[part].replace(" ", "T") + "+00:00";
      var date = new Date(str);
      if (isNaN(date.getTime()))
        return;

      // Fill in strings
      session[part] = str;
      session[part + "Datetime"] = date.toLocaleString(webL10n.getLanguage());
      session[part + "Date"] = date.toLocaleDateString(webL10n.getLanguage());
      session[part + "Time"] = date.toLocaleTimeString(webL10n.getLanguage());
    });

    // Choose appropriate date string
    var key;
    if (!session.end) {
      var startDate = new Date(session.start);
      if (isToday(startDate)) {
        key = "session-started-today";
      } else if (isYesterday(startDate)) {
        key = "session-started-yesterday";
      } else {
        key = "session-started";
      }
    } else {
      var startDate = new Date(session.start);
      var endDate   = new Date(session.end);
      if (isSameDay(startDate, endDate)) {
        if (isToday(startDate)) {
          key = "session-range-same-date-today";
        } else if (isYesterday(startDate)) {
          key = "session-range-same-date-yesterday";
        } else {
          key = "session-range-same-date";
        }
      } else {
        key = "session-range";
      }
    }
    session.timeRangeL10nId = key;

    // Is it today in *this* timezone
    function isToday(date) {
      return date.getDate() == (new Date()).getDate();
    }
    // Is it yesterday in *this* timezone
    function isYesterday(date) {
      return date.getDate() == (new Date()).getDate() - 1;
    }
    // Are the dates on the same day in *this* timezone
    function isSameDay(dateA, dateB) {
      return dateA.getDate() == dateB.getDate();
    }

    return session;
  }
});
