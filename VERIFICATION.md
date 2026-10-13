# Verification for 1.0.4

The checks below are reproducible using this checkout. They do not amount to a claim that every BetterTTV feature, Android device, advertisement or account scenario works.

| Area | Checked behavior | Environment |
| --- | --- | --- |
| Full bundle | BetterTTV 7.7.28 boots and opens its actual settings dialog | DOM regression + real Chrome |
| Navigation | Settings gear appears on the current anonymous mobile Twitch homepage and channel header; stays inside 390px viewport | Real live m.twitch.tv in fresh Chrome context |
| Nested spacing | Native action-container spacing is flattened with CSS, React nodes remain in place | Live mobile page + fixture |
| Playback | A live stream played with all injected modules present and no video error | Real Twitch stream in mobile Chrome |
| Rewind | Seek to about 80% of available history, VOD ready/playback, pause/resume, LIVE return | Real Twitch live/VOD APIs and Chrome media playback |
| Media controls | During rewind the media target is the VOD video rather than the muted live video | Real stream and runtime assertions |
| Deleted messages | Original standard/show/hide/highlight modes; red 30% background and full opacity for highlight; existing deleted-message history is left unchanged when options change; restored links disabled | Actual upstream handler with synthetic moderation/message data, real Chrome rendering |
| Split chat | Alternate rows, custom color, disabling clears existing stripes, reenabling restores them | Actual upstream renderer, real Chrome |
| Theme | Dark → light → dark while settings remain open; readable cards; system default and native system-change event | Real Chrome + native code/lint |
| Emotes | Global/channel/shared rendering, no replacements in usernames/links/input, image fallback, stale channel requests rejected, API/CDN responses including animated GIF | DOM regressions + live public API requests |
| Promotions | App/Turbo filtering preserves unrelated controls; recognized web/app page prompt chooses web | DOM regressions |
| Native chooser | Website navigation no longer invokes ACTION_VIEW; ordinary HTTP(S) stays in WebView, app-deeplink markers/custom schemes blocked | Native code reviewed and built; needs Android confirmation |
| Recovery | VAFT/Rewind worker constructors compose; worker options preserved; VAFT reload is suppressed during rewind and rate-limited | Regression tests + real stream smoke |

Run `node --test tests/*.test.cjs`, `node scripts/check-mobile-ui.cjs`, and `node scripts/check-live-mobile.cjs`. The last command uses a fresh anonymous browser context against live Twitch. Stream/VOD availability can change. It does not use the user's login or send chat messages.

Live chat moderation events, authenticated account features, channel-point/drop claims, all remaining desktop-derived BetterTTV functions, Android's chooser UI, background audio, PiP, device rotation and adblocking against an actual preroll/midroll are not fully verified. The moderation test invokes the real rendering handler with fixture data; it does not delete a real user's messages. Restoring without highlighting intentionally uses the original dimmed style; select **Restore and Highlight Deleted Messages** for red marking. No ad appeared during the live smoke, so successful adblocking is not claimed.

Screenshots and geometry/event records are in ignored `dist/mobile-preview/`. The local fixture is a UI-testing aid, not a copy of Twitch. The full BetterTTV bundle remains personal/local under its distribution license.

1.0.2 adds explicit sizing checks: global-module title font equals the original theme-setting title font (24px), switch track is 48?30px, and the settings dialog has no horizontal overflow at 320, 390 and 430px. Updated screenshots are saved as settings-320.png, settings-390.png and settings-430.png.

1.0.3 restores the exact upstream deleted-message handler and shared Twitch utility; source integrity hashes are recorded in scripts/bttv-core-integrity.json. Fixture tests now use upstream pendingProps/depth behavior and assert that changing the deletion setting does not rewrite existing deleted-message history. A real moderation event on the user?s Android session remains unverified.

1.0.4 real-site player-layout verification: timeline top 233.78px, mute/fullscreen bottoms 224.38px (about 9px separation) at 390px width. Hit-testing reaches the native mute button rather than timeline/tooltip; native mute toggles in both directions. Rewind, pause/resume and LIVE tests pass with all modules loaded. This remains a mobile Chrome test, not direct control of the user?s Android device.

1.0.5 fixes deleted-placeholder recovery by looking up the original renderer from the containing chat line (two fibres), rather than the deeply nested placeholder (fourteen fibres on live mobile Twitch). Shared Twitch utilities remain unchanged. scripts/check-live-deleted.cjs reproduces Twitch's own placeholder rendering locally on real incoming messages, without sending moderation actions; DEFAULT retains the notice, SHOW restores text with opacity 0.5, HIDE hides the row, HIGHLIGHT restores text with a red background. All four pass on mobile Chrome. Real server moderation on Android remains unverified. The integrity JSON records the pre-fix upstream baseline, not this deliberate one-line adapter. Release build/lint and 12 regressions pass.

1.0.6 reproduces the actual Twitch Open in App or Login Options bottom sheet with Keep using web. Added that exact browser label and Activate to close dialog; dismisses through React and hides the entire specific tw-modal-layer including backdrop as fallback. Live anonymous mobile Chrome shows no remaining prompt. Unrelated login dialogs remain untouched in regression. All 13 Node tests, release build/lint and APK signature verification pass. Android-device verification remains outstanding.

1.0.7 moves the actual portaled Tap to unmute tooltip above the moved native mute control (8px gap, measured bottom176.38 vs button top184.38 on real mobile Twitch). Retains Popper transform and uses an independent translate, recalculated from geometry. Resets tip positioning when timeline removed/hidden; native bottom-row lift now applies only while timeline visible. Mute toggles, rewind, pause/resume and LIVE pass; 13 regressions and release build/lint/signature pass. Optional TE_PLAYBACK_SOAK=1 in scripts/check-live-mobile.cjs records 60 seconds of frame-clock gaps, stalls, active videos and ad events. First muted observation: 3469 frames, p95 gap15ms, no waiting events, paused hidden VOD. This does not measure actual audio timestamps or prove post-ad A/V sync. No actual ad transition observed.
