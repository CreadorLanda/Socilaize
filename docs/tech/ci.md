# CI — building the Android app

Builds run on GitHub's runners with `eas build --local`, so nothing queues on
Expo's servers. The free EAS queue has taken up to two hours; this takes
fifteen to twenty-five minutes and the minutes are free, because the
repository is public.

Building on a development machine is the obvious alternative and was not
available: an Android build needs roughly 14 GB of disk, and the machine this
was set up on had 1.3 GB.

## One-time setup

The workflow needs one secret. It fetches the signing credentials Expo already
holds, so the keystore never has to live in this repository:

1. **expo.dev → Account Settings → Access Tokens → Create Token**
2. **GitHub → Settings → Secrets and variables → Actions → New repository secret**
   - Name: `EXPO_TOKEN`
   - Value: the token

Without it the workflow stops at the build step with a message saying so,
rather than failing somewhere confusing twenty minutes in.

## Running it

**Manually** — Actions → *Build Android* → *Run workflow*. Choose:

| Input | Meaning |
|---|---|
| `profile` | `preview` for testing, `production` for release |
| `format` | `apk` to install on a phone, `aab` for the Play Store |

**Automatically** — every push to `main` that touches `mobile/`. A README edit
does not spend twenty minutes of runner time.

The finished binary is attached to the run as an artifact, kept for 14 days.

## APK or AAB

They are not interchangeable. An **AAB cannot be installed on a phone** — it is
a Play Store upload format, and Google builds the per-device APKs from it. For
handing a build to someone to try, you want an APK.

## What it checks before building

`expo-doctor`, `tsc --noEmit` and the test suite run first. Each of them has
caught something that would otherwise have failed the build well after the
slow part: a missing peer dependency, duplicate native modules, two lockfiles.

## When a build is not enough

Most changes do not need one. JavaScript reaches installed apps over the air —
see `updates.url` in `app.json`. A new build is only required for native
changes: adding a native module, or changing configuration like
`google-services.json`.
