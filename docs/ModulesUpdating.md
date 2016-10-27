# Keeping Modules Up to Date

Whilst npm has an `npm outdated` command, keeping modules up to date can be a big
manual task.

However, there's various services that make this easier, and can even create pull
requests (PRs) automatically.

## Node/Npm

There's a couple of services known for npm that are worth investigating:

* [Greenkeeper.io](https://greenkeeper.io/)
  * [Loop](https://github.com/mozilla/loop) and
    [Activity Stream](https://github.com/mozilla/activity-stream/) (possibly
    others in Mozilla as well) have used this.
  * It is enabled on this repository - see
    [the list of PRs Greenkeeper has previously created](https://github.com/mozilla/example-addon-repo/pulls?utf8=%E2%9C%93&q=is%3Apr%20author%3Agreenkeeperio-bot%20)
  * The service creates a PR when first enabled to bring your package.json up to date.
  * The service then creates individual PRs for each package update.
  * If it can find them, it will give you the changelog information for each package
    within the PR.
  * As it creates PRs, your tests get run automatically.
  * Although the service operates with branches within your main repository, it
    also means that you can push additional changes to the branch to fix issues
    (e.g. test failures) due to package upgrades.
* [VersionEye](https://www.versioneye.com/)
  * VersionEye has good monitoring, and will send you email updates about out
    of date packages.
  * It can also now comment on PRs about out of date modules when a PR adds
    new dependencies.
  * Unfortunately it doesn't create PRs for updating your modules.

## Python/Pip

* [requires.io](https://requires.io/)
  * This is basically the Greenkeeper equivalent, but for python modules.
  * The PRs aren't quite as nice as the Greenkeeper ones as they don't separate
    out the packages / include the release notes. However, it still makes the
    process a lot simpler and more automated.
