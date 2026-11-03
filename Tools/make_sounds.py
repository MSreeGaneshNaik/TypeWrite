"""Synthesizes TypeWrite's typewriter sounds from scratch (no samples, no licences).

Usage: python3 Tools/make_sounds.py TypeWrite/Resources/Sounds

Every sound is built from three ingredients a real machine makes:
noise bursts (impacts), damped sines (the steel frame ringing) and short
ticks (the escapement letting the carriage step).
"""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
OUT = sys.argv[1]


def t_axis(seconds):
    return np.arange(int(SR * seconds)) / SR


def band(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def high(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def low(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def burst(rng, length, decay, lo, hi, at=0.0, total=0.2):
    """A filtered noise impact starting at `at` seconds."""
    out = np.zeros(int(SR * total))
    n = int(SR * length)
    t = np.arange(n) / SR
    env = np.exp(-t / decay) * (1 - np.exp(-t / 0.00025))
    piece = band(rng.standard_normal(n), lo, hi) * env
    start = int(SR * at)
    end = min(start + n, len(out))
    out[start:end] += piece[: end - start]
    return out


def ring(freqs, amps, decays, at=0.0, total=0.2, phase_rng=None):
    """Damped sines: the frame or a bell ringing after a hit."""
    out = np.zeros(int(SR * total))
    start = int(SR * at)
    t = np.arange(len(out) - start) / SR
    for f, a, d in zip(freqs, amps, decays):
        phase = phase_rng.uniform(0, 2 * np.pi) if phase_rng is not None else 0
        out[start:] += a * np.sin(2 * np.pi * f * t + phase) * np.exp(-t / d) * (1 - np.exp(-t / 0.0004))
    return out


def finish(x, peak_db, fade=0.01):
    x = x - np.mean(x)
    n = int(SR * fade)
    x[-n:] *= np.linspace(1, 0, n)
    x = x / (np.max(np.abs(x)) + 1e-9) * (10 ** (peak_db / 20))
    return x


def save(name, x):
    wavfile.write(f"{OUT}/{name}.wav", SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    print(f"{name}.wav  {len(x) / SR * 1000:.0f} ms")


def key(seed):
    rng = np.random.default_rng(seed)
    total = 0.16
    s = 1 + rng.uniform(-0.08, 0.08)
    x = np.zeros(int(SR * total))
    # Fingertip on the key top: tiny and bright.
    x += 0.10 * burst(rng, 0.004, 0.0008, 3500, 9000, at=0.0, total=total)
    # Type bar hitting the platen through the ribbon: the clack.
    x += 1.00 * burst(rng, 0.03, 0.0035 * s, 1600, 7500, at=0.003, total=total)
    x += 0.55 * burst(rng, 0.05, 0.009, 500, 2200, at=0.003, total=total)
    # Steel frame and segment ringing briefly.
    x += 0.10 * ring([310 * s, 640 * s, 1180 * s, 2950 * s], [0.9, 0.7, 0.45, 0.25],
                     [0.030, 0.022, 0.016, 0.010], at=0.003, total=total, phase_rng=rng)
    # Low thump of the desk.
    x += 0.10 * ring([128 * s], [1.0], [0.018], at=0.004, total=total)
    # Escapement lets the carriage step one space.
    x += 0.32 * burst(rng, 0.006, 0.0012, 2800, 9500, at=0.021 + rng.uniform(-0.003, 0.003), total=total)
    return finish(x, -5)


def space():
    rng = np.random.default_rng(91)
    total = 0.17
    x = 0.85 * burst(rng, 0.06, 0.010, 250, 1600, at=0.002, total=total)
    x += 0.25 * burst(rng, 0.01, 0.002, 2000, 6000, at=0.002, total=total)
    x += 0.16 * ring([170, 420, 900], [1.0, 0.5, 0.3], [0.03, 0.02, 0.012], at=0.003, total=total, phase_rng=rng)
    x += 0.38 * burst(rng, 0.006, 0.0012, 2800, 9500, at=0.024, total=total)
    return finish(x, -8)


def backspace():
    rng = np.random.default_rng(57)
    total = 0.12
    x = 0.7 * burst(rng, 0.02, 0.004, 900, 5000, at=0.002, total=total)
    x += 0.5 * burst(rng, 0.006, 0.0012, 3000, 9000, at=0.030, total=total)
    x += 0.08 * ring([520, 1300], [1, 0.5], [0.02, 0.01], at=0.002, total=total, phase_rng=rng)
    return finish(x, -9)


def bell():
    rng = np.random.default_rng(3)
    total = 1.5
    f0 = 1765.0
    # Partials of a small steel dome bell, with a detuned twin for shimmer.
    x = ring([f0, f0 * 1.0035, f0 * 2.32, f0 * 4.25, f0 * 6.63],
             [1.0, 0.35, 0.42, 0.22, 0.10],
             [0.95, 0.80, 0.45, 0.22, 0.12], at=0.002, total=total, phase_rng=rng)
    # The clapper's tap.
    x += 0.5 * burst(rng, 0.008, 0.0015, 2500, 9000, at=0.001, total=total)
    return finish(x, -4, fade=0.05)


def carriage_return():
    rng = np.random.default_rng(11)
    total = 0.62
    x = np.zeros(int(SR * total))
    # Lever pushed: the line-space ratchet clicks twice.
    x += 0.55 * burst(rng, 0.012, 0.0025, 1800, 8000, at=0.004, total=total)
    x += 0.45 * burst(rng, 0.012, 0.0025, 1800, 8000, at=0.040, total=total)
    # The carriage sliding back on its rails.
    n = int(SR * 0.36)
    t = np.arange(n) / SR
    slide_env = np.sin(np.pi * np.clip(t / 0.36, 0, 1)) ** 1.5
    slide = band(rng.standard_normal(n), 700, 3200) * slide_env * 0.22
    start = int(SR * 0.06)
    x[start:start + n] += slide
    # Escapement teeth rattling past, slowing as it travels.
    tick_time = 0.07
    gap = 0.010
    while tick_time < 0.40:
        x += 0.12 * burst(rng, 0.004, 0.0008, 3000, 9500, at=tick_time, total=total)
        tick_time += gap
        gap *= 1.06
    # Hitting the margin stop.
    x += 1.0 * burst(rng, 0.05, 0.008, 300, 2400, at=0.43, total=total)
    x += 0.5 * burst(rng, 0.02, 0.003, 2000, 7000, at=0.43, total=total)
    x += 0.18 * ring([140, 360, 820], [1.0, 0.6, 0.35], [0.05, 0.03, 0.02], at=0.432, total=total, phase_rng=rng)
    return finish(x, -4)


def paper_feed():
    rng = np.random.default_rng(23)
    total = 0.9
    x = np.zeros(int(SR * total))
    # Paper rustle around the platen.
    n = int(SR * 0.75)
    t = np.arange(n) / SR
    rustle = low(high(rng.standard_normal(n), 900), 6000)
    flutter = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 7 * t + rng.uniform(0, 6)))
    env = np.sin(np.pi * np.clip(t / 0.75, 0, 1))
    x[int(SR * 0.04):int(SR * 0.04) + n] += rustle * flutter * env * 0.25
    # The platen knob's ratchet.
    tick_time = 0.05
    while tick_time < 0.78:
        x += 0.35 * burst(rng, 0.006, 0.0011, 2200, 9000, at=tick_time, total=total)
        tick_time += 0.052 + rng.uniform(-0.006, 0.006)
    return finish(x, -7, fade=0.04)


def jam():
    rng = np.random.default_rng(5)
    total = 0.2
    x = 0.8 * burst(rng, 0.03, 0.006, 200, 1200, at=0.002, total=total)
    x += 0.2 * ring([95, 230], [1, 0.4], [0.04, 0.02], at=0.002, total=total)
    return finish(x, -10)


for i in range(4):
    save(f"key{i + 1}", key(100 + i * 17))
save("space", space())
save("backspace", backspace())
save("bell", bell())
save("return", carriage_return())
save("feed", paper_feed())
save("jam", jam())
