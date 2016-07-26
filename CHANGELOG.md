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
