/* global require, exports:false */

const self = require('sdk/self');
const SHIELD_PREF = 'extensions.tabcentertest1@mozilla.com.shield';
const {get, set} = require('sdk/preferences/service');
let study_duration = 14; // in days

const studyConfig = {
  name: self.addonId,
  duration: study_duration,
  variations: {
    'control': () => {set(SHIELD_PREF, 'control')},
    'enabled': () => {set(SHIELD_PREF, 'enabled')}
  }
};

exports.studyConfig = studyConfig;
