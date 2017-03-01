/* global require, exports:false */

const self = require('sdk/self');
const {get, set} = require('sdk/preferences/service');
let study_duration = 14; // in days

let emptyFn = () => {};

const studyConfig = {
  name: self.addonId,
  duration: study_duration,
  variations: {
    'control': emptyFn,
    'default': emptyFn,
    'small-tabs': emptyFn
  }
};

exports.studyConfig = studyConfig;
