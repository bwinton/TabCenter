# TabCenter <a href="http://testpilot.dev.mozaws.net/experiments/tabcenter"><img align="right" src="https://img.shields.io/badge/available_on-Test_Pilot-0996F8.svg"></a>


Tabbed browsing is a concept that has existed for a long time without
being seriously re-evaluated. In that time, browsing behaviors have
changed. The web is now the central interaction point on desktop and
laptop computers. For many users, their browser is the only application
they ever open.

Tab Center is an attempt to solve some of the issues that have emerged
from the way people use tabs (most notably the “too many tabs” problem)
and provide a more versatile UI basis for future innovation.  The first
version of this Firefox add-on arranges tabs in a vertical rather than
horizontal fashion.  It is heavily inspired by and borrows ideas from the
excellent VerticalTabs add-on.

Feel free to [install the add-on][784891c9], read
[the full proposal][93e83452], or file [a new bug][94aea942]!  We also have a
[Contributor’s document](CONTRIBUTING.md), if you want to get involved and maybe
[fix some bugs][7c43e6dd].

#### Incompatibility Notes

We are incompatible with a number of add-ons:

- Hide Caption Titlebar Plus
- HTitle
- Tab Mix Plus
- Tab Groups
  - Tab Groups Helper
- Tree-Style Tabs
- TooManyTabs
- All-In-One Sidebar
- Firebug

Please let us know if you find any problems with extensions not mentioned.


[784891c9]: https://testpilot.firefox.com/experiments/tab-center "A link to Test Pilot."
[93e83452]: https://mozilla.invisionapp.com/share/GT22ZN6QW#/screens "The full multi-phase spec."
[94aea942]: https://github.com/bwinton/VerticalTabs/issues/new "Make a new GitHub issue."
[7c43e6dd]: https://github.com/bwinton/VerticalTabs/issues "The big list of issues."

### Development

After cloning this repository, run `npm install` and `npm install jpm` then:

* `jpm run` to spawn a new Firefox profile with the addon installed
* `jpm xpi` to generate an installable XPI file locally

Read more about [`jpm` on MDN](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/jpm)
