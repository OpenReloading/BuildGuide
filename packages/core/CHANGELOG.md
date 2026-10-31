# Changelog

## [0.2.6](https://github.com/OpenReloading/BuildGuide/compare/core-v0.2.5...core-v0.2.6) (2026-10-31)


### Features

* **core:** load the progress tools on demand from buildguide-progress.js ([#172](https://github.com/OpenReloading/BuildGuide/issues/172)) ([d3c34fd](https://github.com/OpenReloading/BuildGuide/commit/d3c34fd8b67ab6d942081e14f724b1a5b27b5d8f))


### Bug fixes

* **core:** render the board toolbar before the board ([#185](https://github.com/OpenReloading/BuildGuide/issues/185)) ([93489a9](https://github.com/OpenReloading/BuildGuide/commit/93489a9805979cfe25ed2f1bb6f4b9033ad56a26))


### Documentation

* data format and install on the home page ([#179](https://github.com/OpenReloading/BuildGuide/issues/179)) ([3edf9f7](https://github.com/OpenReloading/BuildGuide/commit/3edf9f725d8c3a5ddc1f1dd8a7104770b7e85100))
* example pages with the site tokens ([#180](https://github.com/OpenReloading/BuildGuide/issues/180)) ([6be88a3](https://github.com/OpenReloading/BuildGuide/commit/6be88a3b53d44a788a3d9bcd25745b7a07e3ac52))
* live wiring board and progress on the home page ([#177](https://github.com/OpenReloading/BuildGuide/issues/177)) ([1586629](https://github.com/OpenReloading/BuildGuide/commit/1586629a373d24b66953510fee7f66d2bdc98cc7))
* phone and touch checks with a browser test ([#183](https://github.com/OpenReloading/BuildGuide/issues/183)) ([fa7a277](https://github.com/OpenReloading/BuildGuide/commit/fa7a277800fadda3fbccab616c43be6d6a886f92))

## [0.2.5](https://github.com/OpenReloading/BuildGuide/compare/core-v0.2.4...core-v0.2.5) (2026-10-27)


### Features

* **core:** pinch and wheel zoom on boards that never trap the page scroll ([#141](https://github.com/OpenReloading/BuildGuide/issues/141)) ([3828b6d](https://github.com/OpenReloading/BuildGuide/commit/3828b6d0b289d6b76e09e9f742b124168156efa1))
* **core:** text steps component with a shared step shape ([#145](https://github.com/OpenReloading/BuildGuide/issues/145)) ([f39be44](https://github.com/OpenReloading/BuildGuide/commit/f39be44def94bc5d6dc14d41a6b43ba6a35c09f4))

## [0.2.4](https://github.com/OpenReloading/BuildGuide/compare/core-v0.2.3...core-v0.2.4) (2026-10-26)


### Features

* **docusaurus:** guide data as a file, not in every page head ([#119](https://github.com/OpenReloading/BuildGuide/issues/119)) ([de12c28](https://github.com/OpenReloading/BuildGuide/commit/de12c28bae1ca6c8d59e5b8cdc473bc2bb272ffa))
* **docusaurus:** more than one guide per site ([#123](https://github.com/OpenReloading/BuildGuide/issues/123)) ([4888e00](https://github.com/OpenReloading/BuildGuide/commit/4888e0010a5240ebb5681cd04682b01acd3cb50d))
* **mkdocs:** more than one guide per site ([#120](https://github.com/OpenReloading/BuildGuide/issues/120)) ([0dc598c](https://github.com/OpenReloading/BuildGuide/commit/0dc598ccb6068ac84ce56cfbb832557872c8cb6b))


### Bug fixes

* **mkdocs:** load the plugin's stylesheets before extra_css ([#117](https://github.com/OpenReloading/BuildGuide/issues/117)) ([f22bc90](https://github.com/OpenReloading/BuildGuide/commit/f22bc90e648d24b6c1b95ec3daa14f807df7d4ce))

## [0.2.3](https://github.com/OpenReloading/BuildGuide/compare/core-v0.2.2...core-v0.2.3) (2026-10-26)


### Features

* **core:** data-ag-scheme accepts dark and auto ([#107](https://github.com/OpenReloading/BuildGuide/issues/107)) ([3f148bb](https://github.com/OpenReloading/BuildGuide/commit/3f148bb5f4e30b293d683e1ad99e02800d03ea9b))
* **core:** font and size tokens, 24 px tick boxes ([#103](https://github.com/OpenReloading/BuildGuide/issues/103)) ([b75616f](https://github.com/OpenReloading/BuildGuide/commit/b75616fd94342f4b34c306ad55a979d76f30d8eb))
* **core:** undo after reset and import, no confirm() ([#105](https://github.com/OpenReloading/BuildGuide/issues/105)) ([2025067](https://github.com/OpenReloading/BuildGuide/commit/202506753b9b7d5ac8d4359d115f8418cb43c1d4))
* **core:** warning and caution levels for step notes ([#111](https://github.com/OpenReloading/BuildGuide/issues/111)) ([5f268c7](https://github.com/OpenReloading/BuildGuide/commit/5f268c79da124810c01495e0cd3d4259ad9d0dc4))


### Bug fixes

* **core:** ignore storage events of sessionStorage ([#106](https://github.com/OpenReloading/BuildGuide/issues/106)) ([bc99a3a](https://github.com/OpenReloading/BuildGuide/commit/bc99a3aced8ff8b328705401efac42bd9eff84e5))

## [0.2.2](https://github.com/OpenReloading/BuildGuide/compare/core-v0.2.1...core-v0.2.2) (2026-10-25)


### Features

* **core:** done state that keeps text readable ([#93](https://github.com/OpenReloading/BuildGuide/issues/93)) ([3375de4](https://github.com/OpenReloading/BuildGuide/commit/3375de47f49f877a7bc97bece207736b2dce3598))
* **docusaurus:** validate the guide data against the schema at build time ([#59](https://github.com/OpenReloading/BuildGuide/issues/59)) ([50dfd3e](https://github.com/OpenReloading/BuildGuide/commit/50dfd3ede07c46a5dc31f0d37c1877cfaee894b8))


### Bug fixes

* **core:** cross-tab ticks and keyboard focus on board connections ([#58](https://github.com/OpenReloading/BuildGuide/issues/58)) ([3d2548f](https://github.com/OpenReloading/BuildGuide/commit/3d2548f9a79fa2c050b4e9828a29414395bfd519))
* **core:** forced-colors markers for selected, done and current ([#94](https://github.com/OpenReloading/BuildGuide/issues/94)) ([7285df3](https://github.com/OpenReloading/BuildGuide/commit/7285df3d30901bf031312139e5e9a4a02927d3a4))
* **core:** readable board labels on phones, fullscreen height, board ratio ([#98](https://github.com/OpenReloading/BuildGuide/issues/98)) ([d1feaeb](https://github.com/OpenReloading/BuildGuide/commit/d1feaebba703fc01a6c3727b087d6d44cdf47835))
* resolve open SonarCloud issues ([#63](https://github.com/OpenReloading/BuildGuide/issues/63)) ([5f1ea64](https://github.com/OpenReloading/BuildGuide/commit/5f1ea645de9a66a2efed53095a167aba71f0f6c1))

## [0.2.1](https://github.com/OpenReloading/BuildGuide/compare/core-v0.2.0...core-v0.2.1) (2026-10-23)


### Features

* **core,docusaurus:** publish to GitHub Packages ([#27](https://github.com/OpenReloading/BuildGuide/issues/27)) ([c210a9a](https://github.com/OpenReloading/BuildGuide/commit/c210a9a57f62b00fafb0e121d057bb022184302f))
* **core,mkdocs,docusaurus:** combined guide component with tab navigation ([#44](https://github.com/OpenReloading/BuildGuide/issues/44)) ([776ec45](https://github.com/OpenReloading/BuildGuide/commit/776ec45deb2ffc4010d90b0dd04b8b414be20884))
* **core:** export, import and reset progress; print button ([#31](https://github.com/OpenReloading/BuildGuide/issues/31)) ([5361803](https://github.com/OpenReloading/BuildGuide/commit/53618037046a015d6e77ce0d2df28ad03b844cf0))


### Bug fixes

* **core,mkdocs:** Material instant navigation, anchor with a board pair ([#29](https://github.com/OpenReloading/BuildGuide/issues/29)) ([f1ca2e8](https://github.com/OpenReloading/BuildGuide/commit/f1ca2e82ea3571c4e27afa437c7c2512293f31c7))
* **core:** labels keep full opacity under host styles that dim small ([#25](https://github.com/OpenReloading/BuildGuide/issues/25)) ([027f83b](https://github.com/OpenReloading/BuildGuide/commit/027f83bfe90a375260b01b52066e0c2c8d9d57de))
* **core:** readable board routes, labels and badges ([#45](https://github.com/OpenReloading/BuildGuide/issues/45)) ([45142c8](https://github.com/OpenReloading/BuildGuide/commit/45142c8f79bc8285db3af67930aea0e668b4cfbd))


### Documentation

* getting started per host, reference, theming, migration ([#35](https://github.com/OpenReloading/BuildGuide/issues/35)) ([5251848](https://github.com/OpenReloading/BuildGuide/commit/525184837df00c45719b752ad0abc464296a55a8))
* usage examples per host, remove migration page, trim READMEs ([#42](https://github.com/OpenReloading/BuildGuide/issues/42)) ([7cbec68](https://github.com/OpenReloading/BuildGuide/commit/7cbec688d2adddbf4961504434023f2fa186a5cc))

## [0.2.0](https://github.com/OpenReloading/BuildGuide/compare/core-v0.1.0...core-v0.2.0) (2026-10-22)


### ⚠ BREAKING CHANGES

* **core,mkdocs,docusaurus:** components only, no page shell ([#18](https://github.com/OpenReloading/BuildGuide/issues/18))

### Features

* **core,mkdocs,docusaurus:** components only, no page shell ([#18](https://github.com/OpenReloading/BuildGuide/issues/18)) ([9b88f89](https://github.com/OpenReloading/BuildGuide/commit/9b88f89cd4cfb028408543f11bb8ce89ef512b98))
* **core:** short notice text on board pages ([#10](https://github.com/OpenReloading/BuildGuide/issues/10)) ([7cf1cf6](https://github.com/OpenReloading/BuildGuide/commit/7cf1cf60a2888cada21206b97061f7f0c4bc42f1))
