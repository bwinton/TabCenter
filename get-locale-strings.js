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
    toggleHotkey: _('toggle_hotkey'),
    topLabel: _('top_label'),
    topTooltip: _('top_tooltip')
  };
};
