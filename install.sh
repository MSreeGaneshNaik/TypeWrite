#!/bin/bash
# TypeWrite installer — https://github.com/MSreeGaneshNaik/TypeWrite
# Downloads the source, builds TypeWrite on this Mac with Xcode, and installs it on
# your iPhone (plugged in and trusted) or, without one, in the iPhone Simulator.
# Run it again any time: it checks what you have against GitHub and only
# rebuilds when something changed. On an iPhone signed with a free Apple ID it
# also re-signs before iOS's 7-day limit runs out.
#   TYPEWRITE_FORCE=1           rebuild even when up to date
#   TYPEWRITE_TARGET=simulator  always use the Simulator
#   TYPEWRITE_TARGET=iphone     insist on a plugged-in iPhone
#   TYPEWRITE_TEAM=XXXXXXXXXX   sign with this Apple team instead of the one Xcode uses
set -euo pipefail

REPO="MSreeGaneshNaik/TypeWrite"
BRANCH="${TYPEWRITE_BRANCH:-main}"
BUNDLE="com.jericho.typewrite"
STATE_DIR="${HOME}/Library/Application Support/TypeWrite"
REFRESH_DAYS=6

if [ -t 1 ]; then
  B=$'\033[1m'; D=$'\033[2m'; C=$'\033[38;5;223m'; G=$'\033[38;5;77m'; R=$'\033[38;5;203m'; N=$'\033[0m'; CLR=$'\033[K'
else
  B=""; D=""; C=""; G=""; R=""; N=""; CLR=""
fi
STEP=0
TOTAL=7
step() { STEP=$((STEP + 1)); printf '\n%s[%s/%s]%s %s%s%s\n' "${C}" "${STEP}" "${TOTAL}" "${N}" "${B}" "$*" "${N}"; }   # what is happening
why()  { printf '      %s%s%s\n' "${D}" "$*" "${N}"; }                                                                # and why
ok()   { printf '      %s✓%s %s\n' "${G}" "${N}" "$*"; }
warn() { printf '      %s!%s %s\n' "${R}" "${N}" "$*"; }
die()  { printf '\n%s✗ %s%s\n\n' "${R}" "$*" "${N}" >&2; exit 1; }
rep()  { local s="" n="$2"; while [ "$n" -gt 0 ]; do s="${s}${1}"; n=$((n - 1)); done; printf '%s' "$s"; }

# Runs "$@" quietly behind an animated bar sized for about $1 seconds. The full
# output is kept in $LOG; if the command fails, its last lines are shown.
LOG=""
bar() {
  local expect="$1"; shift
  if [ ! -t 1 ]; then "$@" >"${LOG}" 2>&1 </dev/null || { tail -n 40 "${LOG}" >&2; return 1; }; return 0; fi
  local pid start=$SECONDS i=0 t fill
  local frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  "$@" >"${LOG}" 2>&1 </dev/null &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    t=$((SECONDS - start))
    fill=$((t * 24 / expect)); [ "$fill" -gt 23 ] && fill=23
    printf '\r      %s%s %s%s%s%s %s%ss%s%s' "${C}" "${frames[$((i % 10))]}" "$(rep ▰ "${fill}")" "${D}" "$(rep ▱ $((24 - fill)))" "${N}" "${D}" "${t}" "${N}" "${CLR}"
    i=$((i + 1)); sleep 0.1
  done
  t=$((SECONDS - start))
  if wait "$pid"; then
    printf '\r      %s✓ %s%s %sdone in %ss%s%s\n' "${G}" "$(rep ▰ 24)" "${N}" "${D}" "${t}" "${N}" "${CLR}"
  else
    printf '\r%s' "${CLR}"; tail -n 40 "${LOG}" >&2; return 1
  fi
}

# Reads a JSON file with macOS's built-in JavaScript, no extra tools needed.
# $1 = JSON file, $2 = function body that gets `d` (the parsed JSON) and returns a string.
json() {
  local js
  js="$(mktemp)"
  cat >"${js}" <<EOF
ObjC.import('Foundation');
function run(argv) {
  const text = ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null));
  if (!text) return "";
  const d = JSON.parse(text);
  $2
}
EOF
  osascript -l JavaScript "${js}" "$1" 2>/dev/null </dev/null || true
  rm -f "${js}"
}

# Asks a yes/no question on the keyboard, even though this script arrives through a pipe.
ask() {
  local answer=""
  { printf '      %s [y/N] ' "$1" >/dev/tty; } 2>/dev/null || return 1   # no keyboard (CI, ssh -T): treat as no
  read -r answer </dev/tty 2>/dev/null || return 1
  [[ "${answer}" =~ ^[Yy] ]]
}

banner() {
  printf '\n'
  printf '    %s██▄▄ ██▄▄  ▄▄██ ▄▄██%s\n' "${C}" "${N}"
  printf '    %s████▄████▄▄████▄████%s\n' "${C}" "${N}"
  printf '    %s████████████████████%s    %sT Y P E W R I T E%s\n' "${C}" "${N}" "${B}" "${N}"
  printf '    %s▀████▀████████▀████▀%s    %sby Jericho%s\n' "${C}" "${N}" "${D}" "${N}"
  printf '    %s ▀▀██ ▀▀████▀▀ ██▀▀ %s\n' "${C}" "${N}"
  printf '    %s ▄▄██ ▄▄████▄▄ ██▄▄ %s    A typewriter for your iPhone.\n' "${C}" "${N}"
  printf '    %s▄████▄████████▄████▄%s    %sEvery key clacks. The bell rings%s\n' "${C}" "${N}" "${D}" "${N}"
  printf '    %s████████████████████%s    %snear the margin.%s\n' "${C}" "${N}" "${D}" "${N}"
  printf '    %s████▀████▀▀████▀████%s\n' "${C}" "${N}"
  printf '    %s██▀▀ ██▀▀  ▀▀██ ▀▀██%s\n' "${C}" "${N}"
  printf '\n'
}

card() {   # $1 = title, then lines of body text (each under 44 characters)
  local title="$1"; shift
  printf '\n    %s╭──────────────────────────────────────────────╮%s\n' "${D}" "${N}"
  printf '    %s│                                              │%s\n' "${D}" "${N}"
  printf '    %s│%s  %s✓%s %s%s%s%s%s│%s\n' "${D}" "${N}" "${G}" "${N}" "${B}" "${title}" "${N}" "$(rep ' ' $((42 - ${#title})))" "${D}" "${N}"
  printf '    %s│                                              │%s\n' "${D}" "${N}"
  local line
  for line in "$@"; do
    printf '    %s│%s  %s%s%s│%s\n' "${D}" "${N}" "${line}" "$(rep ' ' $((44 - ${#line})))" "${D}" "${N}"
  done
  printf '    %s│                                              │%s\n' "${D}" "${N}"
  printf '    %s╰──────────────────────────────────────────────╯%s\n\n' "${D}" "${N}"
}

# Finds Xcode even when the command-line tools are the selected developer folder.
find_xcode() {
  local selected candidate
  selected="$(xcode-select -p 2>/dev/null || true)"
  if [[ "${selected}" == *.app/Contents/Developer ]] && [ -x "${selected}/usr/bin/xcodebuild" ]; then
    printf '%s' "${selected}"; return
  fi
  for candidate in /Applications/Xcode.app /Applications/Xcode-beta.app "${HOME}/Applications/Xcode.app"; do
    if [ -x "${candidate}/Contents/Developer/usr/bin/xcodebuild" ]; then
      printf '%s' "${candidate}/Contents/Developer"; return
    fi
  done
  candidate="$(mdfind "kMDItemCFBundleIdentifier == 'com.apple.dt.Xcode'" 2>/dev/null | head -1 || true)"
  if [ -n "${candidate}" ] && [ -x "${candidate}/Contents/Developer/usr/bin/xcodebuild" ]; then
    printf '%s' "${candidate}/Contents/Developer"
  fi
}

# The Apple team that signs builds for a real iPhone: the team Xcode has from
# Settings → Accounts, else the organisational unit of an Apple Development certificate.
find_team() {
  if [ -n "${TYPEWRITE_TEAM:-}" ]; then printf '%s' "${TYPEWRITE_TEAM}"; return; fi
  local team
  team="$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null \
    | sed -n 's/.*teamID = "\{0,1\}\([A-Z0-9]\{10\}\)"\{0,1\};.*/\1/p' | head -1 || true)"
  if [ -z "${team}" ]; then
    team="$(security find-certificate -c "Apple Development" -p 2>/dev/null \
      | openssl x509 -noout -subject 2>/dev/null \
      | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1 || true)"
  fi
  printf '%s' "${team}"
}

# A plugged-in, paired iPhone: "identifier<TAB>udid<TAB>name<TAB>developer mode".
find_iphone() {
  local list
  list="$(mktemp)"
  xcrun devicectl list devices --json-output "${list}" >/dev/null 2>&1 </dev/null || true
  json "${list}" '
    for (const dev of ((d.result || {}).devices || [])) {
      const hw = dev.hardwareProperties || {}, cp = dev.connectionProperties || {}, dp = dev.deviceProperties || {};
      if (hw.platform !== "iOS" || hw.deviceType !== "iPhone") continue;
      if (cp.pairingState !== "paired" || cp.tunnelState === "unavailable") continue;
      return [dev.identifier, hw.udid || dev.identifier, dp.name || "iPhone", dp.developerModeStatus || "unknown"].join("\t");
    }
    return "";'
  rm -f "${list}"
}

# The best available iPhone simulator: "udid<TAB>name<TAB>iOS version". Prefers one
# that is already running, then the newest iOS.
find_simulator() {
  local list
  list="$(mktemp)"
  xcrun simctl list devices available -j >"${list}" 2>/dev/null </dev/null || true
  json "${list}" '
    let best = null;
    for (const runtime of Object.keys(d.devices || {})) {
      const m = runtime.match(/SimRuntime\.iOS-(\d+)-(\d+)/);
      if (!m) continue;
      const version = Number(m[1]) * 100 + Number(m[2]);
      for (const dev of d.devices[runtime]) {
        if (dev.isAvailable === false || !/^iPhone/.test(dev.name)) continue;
        const score = (dev.state === "Booted" ? 1e7 : 0) + version * 10 + (/Pro$/.test(dev.name) ? 1 : 0);
        if (!best || score > best.score) best = { score: score, udid: dev.udid, name: dev.name, os: m[1] + "." + m[2] };
      }
    }
    return best ? [best.udid, best.name, best.os].join("\t") : "";'
  rm -f "${list}"
}

# Everything runs from main, so bash has read the whole script before any of it runs:
# a download cut off half-way does nothing instead of running half an installer.
main() {
  banner
  mkdir -p "${STATE_DIR}"
  LOG="${STATE_DIR}/last-run.log"

  step "Checking this Mac"
  [ "$(uname -s)" = "Darwin" ] || die "TypeWrite is built on a Mac with Xcode. Run this in Terminal on macOS."
  ok "macOS $(sw_vers -productVersion) on $(uname -m)."

  step "Looking for the latest version on GitHub"
  why "So a Mac that already installed TypeWrite only rebuilds when something changed."
  # The newest commit as a bare SHA. Offline or rate-limited → empty, and we simply reinstall.
  latest="$(curl -fsSL -H 'Accept: application/vnd.github.sha' "https://api.github.com/repos/${REPO}/commits/${BRANCH}" 2>/dev/null || true)"
  [[ "${latest}" =~ ^[0-9a-f]{40}$ ]] || latest=""
  short="${latest:0:7}"
  if [ -n "${latest}" ]; then ok "Latest is ${short}."; else why "GitHub didn't answer (offline or busy), so this installs the newest code."; fi

  step "Checking for Xcode"
  why "iPhone apps are built with Xcode, Apple's free developer app."
  developer="$(find_xcode)"
  if [ -z "${developer}" ]; then
    why "Xcode isn't installed. Opening it in the Mac App Store…"
    open "macappstore://apps.apple.com/app/id497799835" >/dev/null 2>&1 || true
    die "Install Xcode (free), open it once, then paste the same command again."
  fi
  export DEVELOPER_DIR="${developer}"
  xcode_version="$(xcodebuild -version 2>/dev/null </dev/null | head -1 || true)"
  major="$(printf '%s' "${xcode_version}" | sed -n 's/^Xcode \([0-9]*\).*/\1/p')"
  [ -n "${major}" ] || die "Xcode is installed but won't start from Terminal. Open Xcode once, accept its licence, then paste the same command again."
  [ "${major}" -ge 16 ] || die "TypeWrite needs Xcode 16 or later (this Mac has ${xcode_version}). Update Xcode in the App Store, then run this again."
  if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1 </dev/null; then
    open -a "${developer%/Contents/Developer}" >/dev/null 2>&1 || true
    die "Xcode needs to finish setting up. It's opening now: accept the licence, let it install its components, then paste the same command again."
  fi
  ok "Found ${xcode_version}."

  step "Choosing where to install"
  target="simulator"; device_id=""; device_udid=""; device_name=""; sim_udid=""; sim_name=""; team=""
  if [ "${TYPEWRITE_TARGET:-}" != "simulator" ]; then
    iphone="$(find_iphone)"
    if [ -n "${iphone}" ]; then
      IFS=$'\t' read -r device_id device_udid device_name devmode <<<"${iphone}"
      team="$(find_team)"
      if [ "${devmode}" = "disabled" ]; then
        warn "${device_name} has Developer Mode off. Turn it on: Settings → Privacy & Security → Developer Mode."
      elif [ -z "${team}" ]; then
        warn "Xcode has no Apple ID to sign with. Add yours (a free one works): Xcode → Settings → Accounts → +."
      else
        target="iphone"
      fi
    elif [ "${TYPEWRITE_TARGET:-}" = "iphone" ]; then
      die "No iPhone found. Plug it in with a cable, unlock it, tap Trust, then paste the same command again."
    fi
    if [ "${target}" != "iphone" ] && [ "${TYPEWRITE_TARGET:-}" = "iphone" ]; then
      die "Fix the step above, then paste the same command again."
    fi
  fi

  if [ "${target}" = "iphone" ]; then
    ok "Installing on ${device_name}, signed by Apple team ${team}."
    # Free teams can't share an app ID, so each team gets its own.
    bundle="${BUNDLE}.$(printf '%s' "${team}" | tr '[:upper:]' '[:lower:]')"
    key="iphone-${device_udid}"
  else
    [ -n "${device_name}" ] && why "Using the Simulator instead. Run this again once ${device_name} is ready."
    sim="$(find_simulator)"
    if [ -z "${sim}" ]; then
      why "No iPhone Simulator is installed yet. Xcode can download one (about 8 GB)."
      if ask "Download the iPhone Simulator now?"; then
        xcodebuild -downloadPlatform iOS </dev/null || die "The download didn't finish. Paste the same command again to retry."
        sim="$(find_simulator)"
      fi
      [ -n "${sim}" ] || die "Plug in your iPhone, or install the Simulator: Xcode → Settings → Components → iOS. Then paste the same command again."
    fi
    IFS=$'\t' read -r sim_udid sim_name sim_os <<<"${sim}"
    ok "Installing in the Simulator on ${sim_name} (iOS ${sim_os})."
    bundle="${BUNDLE}"
    key="simulator-${sim_udid}"
  fi

  # What was installed here last time: the commit and when it was signed.
  state="${STATE_DIR}/${key}"
  installed=""; installed_at=0
  if [ -f "${state}" ]; then read -r installed installed_at <"${state}" || true; fi
  age_days=$(( ($(date +%s) - ${installed_at:-0}) / 86400 ))
  present=1
  if [ "${target}" = "simulator" ] && ! xcrun simctl get_app_container "${sim_udid}" "${bundle}" >/dev/null 2>&1 </dev/null; then
    present=0
  fi

  if [ -n "${latest}" ] && [ "${installed}" = "${latest}" ] && [ "${present}" = 1 ] && [ "${TYPEWRITE_FORCE:-0}" != "1" ] \
     && { [ "${target}" = "simulator" ] || [ "${age_days}" -lt "${REFRESH_DAYS}" ]; }; then
    ok "You already have ${short}, the latest."
    if [ "${target}" = "simulator" ]; then
      xcrun simctl boot "${sim_udid}" >/dev/null 2>&1 </dev/null || true
      open -a Simulator --args -CurrentDeviceUDID "${sim_udid}" >/dev/null 2>&1 || true
      xcrun simctl launch "${sim_udid}" "${bundle}" >/dev/null 2>&1 </dev/null || true
    else
      xcrun devicectl device process launch --device "${device_id}" "${bundle}" >/dev/null 2>&1 </dev/null || true
    fi
    card "TypeWrite is up to date" "Nothing to download or rebuild."
    exit 0
  fi
  if [ -z "${installed}" ]; then why "TypeWrite isn't installed here yet, so it will be downloaded and built."
  elif [ -z "${latest}" ]; then why "Without an answer from GitHub, it reinstalls the newest code to be safe."
  elif [ "${installed}" = "unknown" ]; then why "Your copy was installed while GitHub was unreachable, so it will be updated to ${short}."
  elif [ "${installed}" != "${latest}" ]; then why "You have ${installed:0:7}, so it will be updated to ${short}."
  elif [ "${present}" = 0 ]; then why "TypeWrite was removed from this Simulator, so it will be reinstalled."
  elif [ "${TYPEWRITE_FORCE:-0}" = "1" ]; then why "Already the latest, but TYPEWRITE_FORCE=1 asks for a rebuild anyway."
  else why "Signed ${age_days} days ago. A free Apple ID's apps stop opening after 7 days, so it's re-signed now."
  fi

  TMP="$(mktemp -d)"
  trap 'rm -rf "${TMP}"' EXIT
  step "Downloading the source${short:+ ${short}}"
  why "From github.com/${REPO}, into a temporary folder that is deleted when this finishes."
  url="https://codeload.github.com/${REPO}/tar.gz/${latest:-refs/heads/${BRANCH}}"
  bar 4 bash -c 'set -o pipefail; curl -fsSL "$1" | tar -xz -C "$2"' _ "${url}" "${TMP}" \
    || die "Couldn't download from GitHub. Check your connection and try again."
  src="$(find "${TMP}" -maxdepth 1 -mindepth 1 -type d | head -1)"
  [ -d "${src}/TypeWrite.xcodeproj" ] || die "The download didn't contain TypeWrite.xcodeproj."

  step "Building TypeWrite"
  why "Xcode compiles it on this Mac. The first build takes a few minutes; updates are quicker."
  derived="${STATE_DIR}/DerivedData"
  if [ "${target}" = "iphone" ]; then
    bar 180 xcodebuild -project "${src}/TypeWrite.xcodeproj" -scheme TypeWrite -configuration Release \
      -destination "id=${device_udid}" -derivedDataPath "${derived}" -allowProvisioningUpdates \
      DEVELOPMENT_TEAM="${team}" PRODUCT_BUNDLE_IDENTIFIER="${bundle}" CODE_SIGN_STYLE=Automatic build \
      || die "The build failed (full log: ${LOG}). If it mentions signing, open Xcode → Settings → Accounts and check your Apple ID, then try again."
    app="${derived}/Build/Products/Release-iphoneos/TypeWrite.app"
  else
    bar 150 xcodebuild -project "${src}/TypeWrite.xcodeproj" -scheme TypeWrite -configuration Release \
      -destination "id=${sim_udid}" -derivedDataPath "${derived}" build \
      || die "The build failed. The full log is at ${LOG}"
    app="${derived}/Build/Products/Release-iphonesimulator/TypeWrite.app"
  fi
  [ -d "${app}" ] || die "The build finished but TypeWrite.app wasn't where Xcode puts it (${app})."

  step "Installing"
  if [ "${target}" = "iphone" ]; then
    why "Copying TypeWrite to ${device_name} over the cable. Keep it unlocked."
    bar 25 xcrun devicectl device install app --device "${device_id}" "${app}" \
      || die "Couldn't install on ${device_name}. Unlock it, keep it plugged in, and paste the same command again."
    printf '%s %s\n' "${latest:-unknown}" "$(date +%s)" >"${state}"
    if ! xcrun devicectl device process launch --device "${device_id}" "${bundle}" >/dev/null 2>&1 </dev/null; then
      card "TypeWrite is on ${device_name:0:24}" \
        "First time only, on the iPhone:" \
        "Settings → General → VPN & Device" \
        "Management → Apple Development → Trust." \
        "Then tap TypeWrite on your home screen." \
        "Run this line again any time to update."
      exit 0
    fi
  else
    why "Starting the Simulator and copying TypeWrite in."
    xcrun simctl boot "${sim_udid}" >/dev/null 2>&1 </dev/null || true
    open -a Simulator --args -CurrentDeviceUDID "${sim_udid}" >/dev/null 2>&1 || true
    bar 20 xcrun simctl install "${sim_udid}" "${app}" || die "Couldn't install in the Simulator. The log is at ${LOG}"
    printf '%s %s\n' "${latest:-unknown}" "$(date +%s)" >"${state}"
    xcrun simctl launch "${sim_udid}" "${bundle}" >/dev/null 2>&1 </dev/null || true
  fi

  if [ -n "${installed}" ]; then
    card "TypeWrite is updated" "Your sheets are kept." "Run this line again any time to update."
  else
    card "TypeWrite is ready" "Feed a sheet and start typing." "Run this line again any time to update."
  fi
}

main "$@"
