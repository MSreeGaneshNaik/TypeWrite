"""Builds TypeWrite's typewriter sounds from real, freely licensed recordings.

Usage: python3 Tools/make_sounds.py TypeWrite/Resources/Sounds [--cache DIR]

Needs numpy, scipy and the ffmpeg command (it decodes the Opus and MP3 sources).
The recordings are downloaded once into the cache folder (a temp folder by
default). Who made each one and under which licence is in CREDITS-Sounds.txt,
next to the sounds.

What each file is cut from:
  key1-key4   four different letters struck on an Underwood 315 portable
  space       the same machine's space bar: escapement tick, then the bar's hollow thump
  backspace   the same machine: carriage pulled back a step, then the pawl dropping in
  jam         an Olivetti Dora (the Underwood's twin) with two type bars colliding
  bell        an antique machine's margin bell, with the keystroke under it filtered away
  return      the same antique machine: line-space click, carriage sliding, the stop
  feed        a platen knob rolled by hand: one detent click, then fast ratchet runs

Every file is mono, 16-bit, 44.1 kHz, starts on its first transient (so a key
sounds the moment it is pressed), and is levelled to sit with the others.
"""
import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import uniform_filter
from scipy.signal import butter, istft, sosfilt, stft

SR = 44100
DITHER = np.random.default_rng(7)  # fixed seed: the same sources always give the same files
UA = "TypeWriteSoundBuilder/2.0 (https://github.com/MSreeGaneshNaik/typewrite; Tools/make_sounds.py)"

COMMONS = "https://upload.wikimedia.org/wikipedia/commons/"
JS_TYPEWRITER = "https://raw.githubusercontent.com/pbinkley/js-typewriter/4d9f5c31c2401939fcceb9bf8e4b8f57e8892473/sounds/"

# name: (urls to try in order, sha256 of the first url when this script was written, quiet stretch for the noise print)
SOURCES = {
    # Sounds of Changes, recorded by Erik Pålsson. CC BY 3.0.
    "underwood": ([COMMONS + "transcoded/b/bb/Underwood_315_portable_typewriter.webm/Underwood_315_portable_typewriter.webm.240p.vp9.webm",
                   COMMONS + "b/bb/Underwood_315_portable_typewriter.webm"],
                  "27847f01563c9b5994b83aa7519f731c6c89a723b96877c84e626ed635704306", (13.40, 14.90)),
    "dora": ([COMMONS + "transcoded/d/da/Olivetti_Dora_portable_typewriter.webm/Olivetti_Dora_portable_typewriter.webm.240p.vp9.webm",
              COMMONS + "d/da/Olivetti_Dora_portable_typewriter.webm"],
             "4f8d31c4d4b3ff110d27f6a70b211fcb9e100d2f67e060b1a3c7a2e524be0c30", (12.70, 13.95)),
    # Freesound 345955 by knufds, CC0, as cut by pbinkley/js-typewriter (CC0).
    "knufds_bell": ([JS_TYPEWRITER + "345955__knufds__typewriter-bell.wav"],
                    "9c281f19a2ef8f8c19679609c6064d5986954548700ac9b97b5bfe31baab8a2c", None),
    "knufds_return": ([JS_TYPEWRITER + "345955__knufds__typewriter-carriage-reset.wav"],
                      "40d4974c28ecef7ac0f05483a8d0d0dddcd49fc29676c21efa9d44a370857669", (1.60, 1.69)),
    # pbinkley/js-typewriter scroll.wav, CC0 (its sounds come from monotraum, blukotek and knufds on Freesound, all CC0).
    "scroll": ([JS_TYPEWRITER + "scroll.wav"],
               "5e8892f85e93103b426868f22a372ec59a3cb704a41c117af4e70f47687e6ea0", (1.70, 1.84)),
}


# ---------- fetching and decoding ----------

def download(url, tries=6):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                return None
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(10 * (attempt + 1))  # Wikimedia answers bursts with 429; it clears in a minute
    return None


def fetch(name, cache):
    urls, sha, _ = SOURCES[name]
    path = os.path.join(cache, name)
    if not os.path.exists(path):
        data = next((d for d in map(download, urls) if d), None)
        if not data:
            sys.exit(f"Could not download {name} from {urls}\n"
                     f"(Wikimedia rate-limits busy networks: try again later, or save the file yourself as {path})")
        with open(path, "wb") as f:
            f.write(data)
    if hashlib.sha256(open(path, "rb").read()).hexdigest() != sha:
        print(f"  note: {name} is not the copy these cuts were measured on (re-encoded upstream?); "
              "the cuts follow the attacks, but check the result")
    return path


def decode(path):
    """Any audio or video file -> mono float64 at SR."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


# ---------- cleaning ----------

def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def denoise(x, quiet, most_db=12.0, n=512):
    """Light spectral gate: bins near the room's noise print are turned down by at most `most_db`."""
    kw = dict(fs=SR, nperseg=n, noverlap=n * 3 // 4)
    _, _, N = stft(quiet, **kw)
    thresh = 2.0 * np.mean(np.abs(N), axis=1, keepdims=True)  # ~6 dB over the noise
    _, _, X = stft(x, **kw)
    floor = 10 ** (-most_db / 20)
    open_ = np.clip(np.abs(X) / (thresh + 1e-12) - 1.0, 0.0, 1.0)  # 0 at the threshold, 1 at twice it
    gain = uniform_filter(floor + (1 - floor) * open_, size=(3, 3))  # smoothed, so no "musical" noise
    _, y = istft(X * gain, **kw)
    return y[:len(x)]


def source(name, cache):
    """Decoded, rumble-free, lightly de-noised recording."""
    x = highpass(decode(fetch(name, cache)), 40)
    quiet = SOURCES[name][2]
    if quiet:
        x = denoise(x, x[int(quiet[0] * SR):int(quiet[1] * SR)])
    return x


# ---------- cutting and shaping ----------

def snap(x, t, window=0.015):
    """Time of the attack nearest `t`: the first sample within +-window reaching a quarter of the local peak."""
    i0 = int((t - window) * SR)
    seg = np.abs(x[i0:int((t + window) * SR)])
    return (i0 + int(np.argmax(seg >= 0.25 * seg.max()))) / SR


def cut(x, start, end, attack=None):
    """x[start:end] in seconds. With `attack`, the cut follows that attack if the source has shifted slightly."""
    shift = snap(x, attack) - attack if attack is not None else 0.0
    return x[int((start + shift) * SR):int((end + shift) * SR)].copy()


def fades(x, fade_in, fade_out):
    n_in, n_out = int(fade_in * SR), int(fade_out * SR)
    if n_in:
        x[:n_in] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n_in))
    if n_out:
        x[-n_out:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n_out))
    return x


def join(a, b, overlap):
    """Equal-power crossfade of b onto the end of a."""
    n = int(overlap * SR)
    t = np.linspace(0, np.pi / 2, n)
    mid = a[-n:] * np.cos(t) + b[:n] * np.sin(t)
    return np.concatenate([a[:-n], mid, b[n:]])


def loudest_50ms(x):
    n = int(0.05 * SR)
    return 10 * np.log10(np.convolve(x * x, np.ones(n) / n, "valid").max() + 1e-12)


def level(x, target_db, peak_db=-3.0):
    """Sets the loudest 50 ms to `target_db` RMS, but never lets a peak pass `peak_db`."""
    g = 10 ** ((target_db - loudest_50ms(x)) / 20)
    peak = np.max(np.abs(x)) * g
    if peak > 10 ** (peak_db / 20):
        g *= 10 ** (peak_db / 20) / peak
    return x * g


def save(out, name, x):
    dither = (DITHER.random(len(x)) - DITHER.random(len(x))) / 32768  # TPDF, 1 LSB
    pcm = np.clip(np.round((x + dither) * 32767), -32768, 32767).astype(np.int16)
    wavfile.write(os.path.join(out, f"{name}.wav"), SR, pcm)
    print(f"{name}.wav  {len(x) / SR * 1000:4.0f} ms  peak {20 * np.log10(np.max(np.abs(x))):5.1f} dBFS  "
          f"loudest 50 ms {loudest_50ms(x):5.1f} dB")


# ---------- the ten sounds ----------

def key(uw, attack, trim_db):
    """One letter: slug through ribbon into the platen, the type bar's ring, the body thud under it.
    Starts 3 ms before the attack. The finger's tick on the key top comes ~40 ms earlier on the real
    machine and is left out, so the clack is not late."""
    x = cut(uw, attack - 0.003, attack + 0.237, attack)
    return level(fades(x, 0.001, 0.06), -24.5 + trim_db, peak_db=-2.0)


def build(out, cache):
    uw = source("underwood", cache)
    dora = source("dora", cache)

    # Four letters with different type bars: rings near 3.9/4.2/5.3 kHz, 2.0/2.8/3.4 kHz,
    # 1.0/3.2/4.0 kHz (the lightest blow) and 1.7/3.3/3.8 kHz (the longest ring).
    # A little of the natural difference in force is kept.
    for i, (attack, trim) in enumerate([(4.3348, 0.0), (7.0859, -0.4), (10.5478, -1.0), (9.7984, -0.5)]):
        save(out, f"key{i + 1}", key(uw, attack, trim))

    # Space bar: escapement tick, then the bar bottoming with a hollow thump 15-50 ms in.
    save(out, "space", level(fades(cut(uw, 4.7135, 4.8750, 4.7170), 0.001, 0.04), -26.5))

    # Backspace: the carriage dragged back a step (clack and thump), then the pawl
    # dropping into the rack as the key comes up ~140 ms later.
    save(out, "backspace", level(fades(cut(uw, 9.4275, 9.6650, 9.4320), 0.001, 0.05), -27.0))

    # Margin bell. The source has a keystroke under the ding; a 4th-order high-pass at
    # 3 kHz removes it and leaves the bell's partials (a beating 4.75/4.82 kHz pair,
    # a 9.5 kHz pair and a bright 12.1 kHz partial that dies first).
    bell = decode(fetch("knufds_bell", cache))
    bell = highpass(bell, 3000, order=4)
    bell = cut(bell, 0.0915, 0.8500, 0.0945)
    save(out, "bell", level(fades(bell, 0.0005, 0.20), -16.0, peak_db=-2.0))

    # Carriage return: line-space ratchet click, the carriage sliding back with the escapement
    # buzzing over the rack, and the heavy clunk at the margin stop with a small rebound.
    # 70 ms of the pause after the click and 150 ms of the slide are taken out, so the slide
    # starts 0.1 s in, the stop lands at 0.6 s and the file stays under 1.2 s.
    ret = source("knufds_return", cache)
    click = cut(ret, 0.2700, 0.3400, 0.2800)
    slide = cut(ret, 0.4100, 0.7800)
    stop = cut(ret, 0.9300, 1.6000)
    ret = join(join(click, slide, 0.02), stop, 0.04)
    save(out, "return", level(fades(ret, 0.002, 0.08), -17.5, peak_db=-1.5))

    # Paper feed: a single detent click first (0-45 ms, usable on its own as a ratchet tick),
    # then the knob rolled in bursts of clicks ~20 ms apart.
    sc = source("scroll", cache)
    click = fades(cut(sc, 2.1300, 2.1800, 2.1400), 0.001, 0.015)
    roll = fades(cut(sc, 1.0880, 2.1000), 0.002, 0.06)
    save(out, "feed", level(np.concatenate([click, np.zeros(int(0.012 * SR)), roll]), -22.0))

    # Jam: two type bars rising together and locking short of the platen (two dull clacks
    # 25 ms apart, no platen ring), then the typist's key knocking them free.
    save(out, "jam", level(fades(cut(dora, 7.3120, 7.5750, 7.3200), 0.001, 0.06), -26.0))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("out", help="folder for the .wav files, e.g. TypeWrite/Resources/Sounds")
    p.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "typewrite-sound-sources"),
                   help="where downloaded recordings are kept between runs")
    args = p.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("make_sounds.py needs the ffmpeg command (brew install ffmpeg / apt install ffmpeg).")
    os.makedirs(args.cache, exist_ok=True)
    build(args.out, args.cache)
