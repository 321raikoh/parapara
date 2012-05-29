/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var Login;

function init() {
  loginInit();
  document.getElementById('loading').style.display = 'none';
}

/*
 * Navigation
 */

function updateWalls() {
  // XXX Display spinner while loading
  ParaPara.postRequest('api/mywalls', null, refreshWallList, getWallsFailed);
}

function refreshWallList(wallList) {
  var listContainer = document.getElementById('wallList');
  // XXX Factor this into a utility function somewhere
  while (listContainer.hasChildNodes()) {
    listContainer.removeChild(listContainer.lastChild);
  }
  var list = document.createElement("ul");
  for (var i = 0; i < wallList.length; ++i) {
    var li = document.createElement("li");
    li.textContent = wallList[i]['eventName'];
    list.appendChild(li);
  }
  listContainer.appendChild(list);
}

function getWallsFailed(reason, detail) {
  // XXX Automatically try again
  // XXX Finally give a link saying what happenned
  // XXX If the error is that we're logged out, do login stuff
  console.log(reason, detail);
}

/*
 * Login
 */

function loginInit() {
  Login = new ParaPara.Login('WMSESSID', loggedIn, loggedOut, loginError);
  Login.relogin();
}

function login() {
  document.getElementById('loginError').style.display = 'none';
  Login.login();
}

function logout() {
  Login.logout();
}

function loggedIn(email) {
  document.getElementById('loginMail').textContent = email;
  document.getElementById('loginStatusYes').style.display = 'block';
  document.getElementById('loginStatusNo').style.display = 'none';
  document.getElementById('loggedOut').style.display = 'none';
  document.getElementById('homeScreen').style.display = 'block';
  updateWalls();
}

function loggedOut() {
  document.getElementById('loginStatusYes').style.display = 'none';
  document.getElementById('loginStatusNo').style.display = 'block';
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('loggedOut').style.display = 'block';
}

function loginError(reason, detail) {
  var errorBlock = document.getElementById('loginError');
  errorBlock.textContent = "Login failed. Please try again.";
  errorBlock.style.display = 'block';
}

window.addEventListener("load", init, false);
