# v1.30 - Welcome on board! 🛳

### New Features:

* Simplified large look for new tabs.
* Onboarding tour.

### Fixes:

* Add event_type field.  (Fixes #939.)
* Tab animation fixes.  (Fixes #918, #897.)
* Restore Places controllers after rearranging navigator-toolbox. . 🎉  (Fixes #583.)
* Always check toggledon attribute against 'true'.
* Tour videos had a black border.
* Toolbar customization.
* "Close Other Tabs" confirmation dialog.  (Fixes #937.)
* Toggle top/side tabs focuses wrong tab.  (Fixes #849.)
* Don't allow tabs opened from pinned tabs to open above them.  (Fixes #932.)
* Pinned tabs get closed from 'Close Tabs Above' context option.  (Fixes #928.)
* pinned tabs stay to the left when on top.  (Fixes #927.)
* compatibility with Toolbar Position Changer add-on
* Rework pinned tabs.  (Fixes #880, #888, #879, #817, #881.)
* Merge all tab resize requests in an event loop turn.
* updateWindowResizers doesn't exist sometimes.
* Splitter only accepts left clicks.  (Fixes #900.)
* Scroll to open tab correctly after exiting the tab column
* Drag & scroll on reversed tabs.


# v1.29 - Windows and Linux.

### Fixes:

* Restore each window session on windows and linux.
* Restore persistant attributes for win and linux (not per window yet).  (Fixes #818.)


# v1.28 - Go somewhere else…

### Fixes:

* Fix update links.  (Fixes #727.)


# v1.27 - Waffling…

### New Features:

* Add a toggle to switch between side tabs and top tabs.  (Fixes #691.)
* Add twenty [new locales](https://pontoon.mozilla.org/projects/test-pilot-tab-center/)!
* Save TabCenter state per-window.  (Fixes #391, #431, #528.)
* Reverse display order for "Open Tabs Above" option

### Fixes:

* Reversed scroll.
* Print preview.  (Fixes #791, #792.)
* Resize tabs on initing a tab.
* Upgrade will not reverse tabs.  (Fixes #780.)
* Scroll jump to top of tab list.  (Fixes #738, #693.)
* reversed mouse-wheel scrolling.  (Fixes #776.)
* Errors.
* Remove popuphidden event listener on unload.
* Cleaner Animations.  (Fixes #758.)
* Theme Changes in Win and Linux.  (Fixes #476.)
* Mouse enter after toggle.  (Fixes #759.)
* pin-button dynamic tooltiptext.  (Fixes #751.)
* Typo, and change to array for filter.
* Visible tabs null on changing groups.  (Fixes #754.)
* Restore urlbar value.  (Fixes #739.)
* Don't allow tab to be hidden if there is no label.  (Fixes #750, #752.)
* Check for tab.label before trying to match.
* Init pin-button with "shrink" tooltip.  (Fixes #742.)
* Search input overflow.  (Fixes #743.)
* Separate tabactions and tabgroupchange in clearfind.  (Fixes #733.)
* Force pinned width to be half of window size, or less, when resizing the window.  (Fixes #604.)
* Do not scroll selected tab into view on mouse out/in.  (Fixes #730.)
* Right click on various buttons shouldn't activate them.  (Fixes #472.)
* Only clear visible tabs when using tabgroups to switch.
* Re-work the Telemetry ping.  🎧
* Hide tab center in print preview mode.  (Fixes #721.)
* refreshThumbAndLabel is now a function.  (Fixes #718.)
* Filter only through visible tabs.  (Fixes #692.)
* First tab title should not become "new tab".  (Fixes #564.)
* Fix initial tab scrolling.  (Fixes #698.)
* Allow autocomplete to expand to full width in windows fullscreen.  (Fixes #705.)
* On change of overflow, keep scroll position the same.  (Fixes #669.)
* Hide TC in windows fullscreen with sidebar open.


# v1.26 - Tweaks and other crop.

### Fixes:

* Allow light colored expand icon in dev theme.  (Fixes #679.)
* Link from pinned tab does not change focus.  (Fixes #672.)
* Clean up crop, remove crop mutation listener.
* Default tabs to opening below.
* Don't clear search on mouse out when open.  (Fixes #663.)
* Crop the too-longtitles of tabs.  (Fixes #656.)
* Hide sidebar and awesomebar in fullscreen.  (Fixes #660, #307, #642.)


# v1.25 - Shield-ready.

### New Features:

* Change defaults.

### Fixes:

* Add crop when opening with hotkey.  (Fixes #637, #633.)
* Update href of Test Pilot badge link.
* Return of the Scroll Bar…  (Fixes #551.)
* Handle touch support in a nicer way.
* Start page loses focus with pinned tabs.  (Fixes #605.)
* Keep search context menu open in windows.  (Fixes #612.)
* Clear search filter on new tab.  (Fixes #620.)
* Only load thumbnails when tabs are large.
* Don't shrink the panel immediately on exitting.
* Delete tabs without waiting for animation to finish. 🐎 🏁  (Fixes #306.)
* Allow pasting into find-input when unpinned.  (Fixes #572.)
* Scroll to the correct tab when Tab Center is expanded.
* Find icon stays in place even when searching with long strings.  (Fixes #599.)
* Keep expanded on hover for context menus.  (Fixes #470, #572.)
* Uh, actually fix the arrows on overflow. 🙄
* Put window controls in a better position during fullscreen.  (Fixes #509.)
* Rebuild newtab button.  (Fixes #471.)
* Smooth out scrolling in expanded sidebar.  (Fixes #273, #492.)
* Search box should not overflow.  (Fixes #573.)
* Remove left border from Windows 7 and 8.  𝌉  (Fixes #150.)

# v1.24 - Stuff.

### New Features:

* Scroll tabbrowser when dragging a tab. 📜 📑  (Fixes #500.)
* More styling updates.  🖼  (Fixes #473.)
* Add a hidden option to disable thumbnails. 🕵  (Fixes #439.)
* Styling Change/Refresh.  🍾

### Fixes:

* Handle retina devices in the thumbnails! 🌱 🌷
* Take the sidebar into account when determining the autocomplete's place.
* Run the initialization code for _all_ the new windows. 🌠  (Fixes #529.)
* Introduce delay before resizing tabs.  ⏱  (Fixes #465.)
* Switch to canvas! 🖼  (Fixes #516.)
* Disappearing labels. 📛  (Fixes #475, #511.)
* Forgot to remove an "a".  🅰️
* Adjust Selected Tab Appearance and Stuff.
* Hide private browsing icon. 🕵  (Fixes #502.)
* Alignment and Flex Changes to Try and Prevent Toolbar Shifting. 💪
* Add Mac Specific Styling. 🍎
* Re-add the palette on uninstall.  🎨  (Fixes #479.)
* Double-clicking on thumbnails no longer opens new tabs. ⛵  (Fixes #457.)
* Hide wyciwyg:// uris. ❓❓❓

# v1.23 - More styles.

### Fixes:

* Various style fixes. 💅🏻
* Ignore all .DS_Store files.
* Use a non-blurry find icon.
* Hide splitter when in fullscreen.  (Fixes #441.)
* Use a better API for thumbnail loading.  (Fixes #427.)
* Tab title is font-weight normal on small tabs.  (Fixes #425.)
* Restore the close tabs message on uninstall.  (Fixes #426.)

# v1.22 - Big Findy Tunes.

### New Features:

* Show larger tab thumbnails when there is extra space.  ‼️ 💯
* Add a search box to quickly filter your tabs. 🔍

### Fixes:

* Click on find icon to focus the find bar. 🌁
* Toolbar icons correctly change color in dark themes.  (Fixes #305.)
* Load thumbnails for all sites. 💅🖼  (Fixes #411, #415, #167, #353.)
* Make sure the splitter doesn’t grow too large.  🐞  (Fixes #414.)
* Resize on deleting a tab.
* Only show light pin if dark theme in linux.
* Don't show the really wide splitter in fullscreen.  👀  (Fixes #392.)

# v1.21 - Sidebar updates, part 1.

The first batch of sidebar changes…

### Features:

* Set pref in options to change new tab opening location. 👆👇‽ 👌 (Fixes #322.)
* Make the pinned sidebar resizable. ⟸║⟹ 😃 (Fixes #23.)

### Fixes:

* Remove slide-in animation from dragging tabs. 🐉 📑  (Fixes #326.)
* Reopening a tab scrolls to it instead of the bottom.  (Fixes #338.)
* Show muted icon if no sound playing. 🙊  (Fixes #323.)

# v1.20 - More fixes.

Keeping on knocking out the most reported problems.

### Fixes:

* Bottom tab is no longer cut off. ✂️  (Fixes #238.)
* Don't double-wrap the telemetry ping. 📞🏡  (Fixes #327.)
* Remove the white bar from the titlebar. 📶  (Fixes #319.)
* Allow onunload trigger to resolve before animating tab close.  ❌🔜  (Fixes #317.)
* Keep sidebar expanded when hovering over context menu.  ⏭  (Fixes #287, #312.)
* Don't show unidentified buttons in the tab's toolbar.  (Fixes #4, #304.)
* Remove margin from popups.  (Fixes #135.)


# v1.19 - First two-week sprint.

I think that was kinda long to wait for a release. I might push those out sooner next time…

### New features:

* Nicer animation when opening and closing tabs.

### Fixes:

* Move new tabs to the top of the list. (Fixes #3.)
* Don't hide the toolbar in customize mode. (Fixes #168.)
* Fix scrolling to selected tab. (Fixes #245.)
* Don't show sidetabs on popups. (Fixes #135.)
* Fix the colours for light and dark themes. (Fixes #132.)


# v1.18 - Everything on the side…

### Fixes:

* Much cleanup, most of which should be invisible.
  * @ericawright added ESLint and StyleLint, and cleaned up all the errors! 💯
* Fixed possibly the second most reported bug (#62). Sidebars now work correctly!


# v1.17 - Everything in its right place.

### Fixes:

* Finally fixed #105, possibly the most duplicated issue in this repo! 🎉
* That's all.


# v1.16 - Measure all the things!

Okay, only some of the things…
See [this page](https://github.com/bwinton/VerticalTabs/blob/master/docs/metrics.md) for details of what we're tracking.


# v1.15 - Fiery Death release!

(Mostly for XUL Bindings, which do the absolute worst thing in every given scenario.  😠)
Anyways…

### Fixes:

* Fixed Customize Mode!  🎉
* Added back the first two context menu items!  (Like anyone right-clicks…  Hah!  😉)


# v1.14 - Making people happy!

Some small, but I would claim important, fixes.  🙂

### Fixes:

* The urlbar autocomplete box no longer covers the whole window (#102).
* Linux users can once again see the url they're hovering over (#100).
* And finally, we now mention that we're a TestPilot experiment (#101).

Thank you everyone for testing Tab Center and reporting all the issues!


# v1.13 - Post smoke-test cleanup.

We got a lot of good feedback from the first round of Test Pilot, and so thought we would fix some of the bugs!

### Fixes:

* Trackpad scrolling should work again.
* Pinned tabs are now distinguishable from normal tabs.
* The activity indicator for pinned tabs doesn't look hideous.
* The first tab is no longer always named "New Tab".
* The less-useful alltabs dropdown has been hidden.
* ![Magic](http://img.pandawhale.com/26648-Doug-Henning-Magic-gif-szhM.gif)


# v1.12 - Minor updates.

Just some minor clean up for the incoming Test Piloteers!  🚀

### Fixes:

* Add an icon and description to the add-ons page.
* Stop duplicating items in the all-tabs popup.
* Mostly fix pinned tabs when uninstalling the add-on.
  * A restart of the browser will get them all back if anything goes wrong, but it should be much better now…


# v1.11 - Now with auto-updating!

### Fixes:

* Style Fixes for Dark Themes.
* Style Fixes for Audio Indicators.
* Style Fixes for Private Browsing.
* Multiple Window Support!  \o/
  * The second window is now bigger than 88 pixels!
  * No longer messes everything up when uninstalling!


# v1.10 - Let's Test Updates!

Lots of changes, mostly fixing things QA found.

### Fixes:

* Remove all the options, since they didn't work.
  * Theme support.
  * Tabs-on-right support.
* Show the DevTools and Findbar.
* Show the pin button in Dark-Themed Dev Edition.
* Persist the pinned state across sessions.


# v1.9 - Pre-TestPilot Test Release!

The first release with enough stuff fixed to be considered for inclusion in Test Pilot.
