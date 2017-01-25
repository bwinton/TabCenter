/* global require, exports:false */
'use strict';

const _ = require('sdk/l10n').get;

exports.getLocaleStrings = function () {
  return {
    closeTabsAbove: _('close_tabs_above'),
    closeTabsBelow: _('close_tabs_below'),
    moreTabs: (n) => _('more_tabs', n),
    sideLabel: _('side_label'),
    sideTooltip: _('side_tooltip'),
    sidebarShrink: _('sidebar_shrink'),
    sidebarOpen: _('sidebar_open'),
    topLabel: _('top_label'),
    topTooltip: _('top_tooltip'),
    tourTitleIntro: _('tour_title_intro'),
    tourTitleCollapse: _('tour_title_collapse'),
    tourTitleRestore: _('tour_title_restore'),
    dismissLabel: _('dismiss_label'),
    tourInstructionsIntro: _('tour_instructions_intro'),
    tourInstructionsCollapse: _('tour_instructions_collapse'),
    tourInstructionsRestore: _('tour_instructions_restore'),
    progressButtonIntro: _('progress_button_intro'),
    progressButtonCollapse: _('progress_button_collapse'),
    progressButtonRestore:  _('progress_button_restore')
  };
};
