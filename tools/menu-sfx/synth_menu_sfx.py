#!/usr/bin/env python3
"""Synthesizes the start-menu machinery sounds of HEADS Rescate Dorado (v70).
No third-party material: every sample is built here from noise, decaying metal modes and swept servo tones.

  python3 tools/menu-sfx/synth_menu_sfx.py [out_dir] [--plot spectrograms.png]

Writes logo / land / bar / unfold / lock / button .mp3 (mono, 44.1 kHz, ~96 kbps) into out_dir
(default public/assets/sfx/menu). Needs numpy, scipy and ffmpeg (matplotlib only for --plot).
Levels: each cue is scaled so its loudest 200 ms sits near -21 dBFS RMS and its peak stays under -3 dBFS;
the player (public/menusfx.js) then plays everything at a low master gain, below the game's own effects.
"""
import os, subprocess, sys, tempfile, wave
import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

SR = 44100
TARGET_RMS_DB = -16.5     # loudest 200 ms window (about -19 LUFS integrated on the sustained cues)
PEAK_CAP_DB = -3.0


# ---------------------------------------------------------------- helpers
def tt(d):
    return np.arange(int(round(d * SR))) / SR


def lpf(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'lowpass', fs=SR, output='sos'), x)


def hpf(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'highpass', fs=SR, output='sos'), x)


def bpf(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def svf_bp(x, fc, q):
    """Time-varying resonant band-pass (Chamberlin state-variable filter); fc is Hz per sample."""
    f = (2 * np.sin(np.pi * np.minimum(fc, SR / 6.5) / SR)).tolist()
    xl = x.tolist()
    q1 = 1.0 / q
    y = [0.0] * len(xl)
    low = band = 0.0
    for i in range(len(xl)):
        low += f[i] * band
        high = xl[i] - low - q1 * band
        band += f[i] * high
        y[i] = band
    return np.array(y) * q1


def smooth(x, hz):
    return lpf(x, hz, 1)


def env(n, a, r):
    """Raised-cosine fade in (a s) and out (r s)."""
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    if nr:
        e[-nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / nr)
    return e


def harm(f, amps, phase0=0.0):
    """Harmonic stack on an instantaneous fundamental f (Hz per sample)."""
    ph = 2 * np.pi * np.cumsum(f) / SR + phase0
    y = np.zeros(len(f))
    for k, a in enumerate(amps, 1):
        y += a * np.sin(k * ph)
    return y


def modal(freqs, decays, amps, dur, r, detune=0.004):
    """Struck metal: decaying sinusoids on (inharmonic) modes."""
    t = tt(dur)
    y = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        f = f * (1 + detune * r.standard_normal())
        y += a * np.exp(-t / d) * np.sin(2 * np.pi * f * t + r.uniform(0, 1.2))
    return y


def burst(dur, tau, lo, hi, r, amp=1.0):
    """Short filtered-noise transient (contact click)."""
    t = tt(dur)
    x = r.standard_normal(len(t)) * np.exp(-t / tau)
    return amp * (bpf(x, lo, hi) if hi else hpf(x, lo))


def thump(f0, f1, tau, dur, amp=1.0):
    """Body of a heavy part: sine dropping from f0 to f1 with an exponential decay."""
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / (tau * 0.5))
    return amp * np.exp(-t / tau) * np.sin(2 * np.pi * np.cumsum(f) / SR)


def mix(*xs):
    """Sum signals of different lengths (all start together)."""
    y = np.zeros(max(len(x) for x in xs))
    for x in xs:
        y[:len(x)] += x
    return y


def put(buf, x, at, gain=1.0):
    """Add x into buf at `at` seconds; the end of x is tapered so a cut-off tail never clicks."""
    i = int(round(at * SR))
    x = np.array(x, dtype=float)
    k = min(int(0.012 * SR), len(x) // 4)
    if k:
        x[-k:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(k) / k)
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += gain * x[:n]


def room(x, r, mix=0.12, tail=0.2, damp=4200):
    """Very small bright hall so the metal feels like it sits inside a ship, not in a void."""
    n = int(tail * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / (tail / 4.2))
    ir = lpf(ir, damp, 1)
    for d, g in ((0.011, 0.55), (0.019, 0.4), (0.031, 0.3)):   # early reflections
        ir[int(d * SR)] += g * 3
    ir[0] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(x, ir)
    out = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return out + mix * wet * np.sqrt(np.sum(x ** 2) / max(1e-9, np.sum(wet ** 2)))


# ---------------------------------------------------------------- the six cues
def make_logo():
    """Servo whoosh: the logo travels, pitch follows its speed (slow - fast - slow)."""
    r = np.random.default_rng(7)
    T = 0.74
    t = tt(T)
    n = len(t)
    u = np.clip((t - 0.04) / 0.60, 0, 1)
    v = smooth(np.sin(np.pi * u) ** 1.35, 45)
    wob = smooth(r.standard_normal(n), 22)
    wob /= wob.std()
    f0 = (150 + 440 * v) * (1 + 0.004 * wob + 0.005 * np.sin(2 * np.pi * 29 * t))
    servo = lpf(harm(f0, [1, .8, .62, .5, .34, .26, .17, .1]), 4200)
    servo *= (0.2 + 0.8 * v) * (1 + 0.07 * np.sin(2 * np.pi * 47 * t))
    sub = harm(f0 / 4, [1, .35]) * (0.25 + 0.75 * v)                       # motor body, the weight
    gear = (np.sin(2 * np.pi * np.cumsum(f0 * 6.9) / SR) * .6 + np.sin(2 * np.pi * np.cumsum(f0 * 10.6) / SR) * .35) * v ** 1.5
    air = svf_bp(r.standard_normal(n), 360 + 2500 * v ** 1.2, 1.5) * v ** 1.2
    sheen = hpf(r.standard_normal(n), 4200) * v ** 2.2
    y = 0.50 * servo + 0.34 * sub + 0.045 * gear + 0.95 * air + 0.075 * sheen
    y *= env(n, 0.045, 0.2)
    put(y, modal([430, 990, 2150], [.025, .018, .01], [.4, .25, .12], .12, r), 0.012, 0.35)   # clamp lets go
    put(y, modal([360, 760], [.03, .02], [.3, .2], .12, r), T - 0.16, 0.16)                    # soft arrival tick
    return room(y, r, 0.10, 0.18)


def make_land():
    """Soft heavy metallic thunk, then a little settling of the plate."""
    r = np.random.default_rng(21)
    buf = np.zeros(int(0.5 * SR))
    hit = mix(thump(105, 48, 0.085, 0.4, 1.0),
              modal([172, 318, 471, 703, 1162, 1655, 2490], [.17, .13, .10, .075, .05, .034, .02],
                    [.55, .5, .38, .26, .15, .08, .04], 0.4, r),
              burst(0.03, 0.006, 420, 3600, r, 0.7))
    put(buf, lpf(hit, 5200), 0.0, 1.0)
    put(buf, lpf(mix(modal([172, 318, 471, 703], [.11, .09, .07, .05], [.5, .4, .3, .2], 0.3, r),
                     thump(90, 52, 0.06, 0.2, 0.7), burst(0.02, 0.005, 420, 3000, r, 0.4)), 4200), 0.105, 0.28)
    put(buf, lpf(mix(modal([180, 330, 480], [.07, .05, .04], [.5, .35, .25], 0.2, r), thump(88, 54, 0.045, 0.15, 0.6)), 3600), 0.20, 0.1)
    return room(buf * env(len(buf), 0.0005, 0.12), r, 0.14, 0.2, 3800)


def make_bar():
    """A long bar sliding out on a rail: servo drive, friction, telescopic detents, stop."""
    r = np.random.default_rng(33)
    T = 0.82
    t = tt(T)
    n = len(t)
    # speed: quick pull-up, cruise (slight acceleration), brake before the stop at 0.62 s
    v = np.interp(t, [0, 0.09, 0.2, 0.52, 0.64, T], [0, 0.75, 0.9, 1.0, 0.0, 0.0])
    v = smooth(v, 30)
    f0 = 120 + 230 * v
    servo = lpf(harm(f0, [1, .72, .55, .4, .3, .2, .12]), 3600) * (0.15 + 0.85 * v)
    sub = harm(f0 / 3, [1, .3]) * v
    # rail friction: stick-slip texture on moving band-passed noise
    ss = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * np.cumsum(80 + 70 * v) / SR + 3 * smooth(r.standard_normal(n), 40)))
    fric = svf_bp(r.standard_normal(n), 700 + 1700 * v, 1.8) * ss * v ** 0.8
    scrape = hpf(r.standard_normal(n), 3000) * v ** 1.5 * (0.5 + 0.5 * ss)
    y = 0.42 * servo + 0.26 * sub + 0.95 * fric + 0.07 * scrape
    # telescopic stages: detent ticks that follow the speed
    pos, tk = 0.07, []
    while pos < 0.6:
        tk.append(pos)
        pos += 0.07 - 0.04 * float(np.interp(pos, [0.07, 0.3, 0.6], [0, 1, 0.2]))
    for p in tk:
        put(y, mix(modal([2300, 3300, 5100], [.008, .006, .004], [.5, .35, .2], .06, r), burst(0.01, 0.002, 1500, 0, r, 0.5)), p, 0.14 * (0.7 + 0.5 * r.random()))
    # the bar reaches its end: stop clack + weight
    stop = lpf(mix(modal([640, 1380, 2350], [.05, .035, .02], [.7, .45, .25], .25, r), thump(130, 70, .05, .2, .9), burst(.015, .004, 700, 4000, r, .8)), 6000)
    put(y, stop, 0.64, 0.75)
    y *= env(n, 0.03, 0.12)
    return room(y, r, 0.11, 0.2)


def make_unfold():
    """Hydraulic / pneumatic unfolding: staged air releases as the segments swing out, actuator whir, linkage rattle."""
    r = np.random.default_rng(45)
    T = 1.0
    t = tt(T)
    n = len(t)
    nz = r.standard_normal(n)
    hiss = np.zeros(n)
    for at, lv, dc in ((0.0, 1.0, 0.17), (0.31, 0.5, 0.11), (0.6, 0.4, 0.1)):        # one release per hinge stage
        a = np.where(t >= at, np.minimum((t - at) / 0.012, 1) * np.exp(-np.maximum(t - at, 0) / dc), 0)
        hiss += lv * svf_bp(nz, 3300 - 1700 * np.clip((t - at) / 0.35, 0, 1), 1.1) * a
    v = smooth(np.interp(t, [0, 0.06, 0.2, 0.6, 0.86, T], [0, 0.6, 1.0, 0.85, 0.15, 0]), 25)
    f0 = 74 + 50 * v
    pump = lpf(harm(f0 * (1 + 0.004 * smooth(r.standard_normal(n), 30)), [1, .7, .5, .35, .2]), 520) * v
    whir = svf_bp(r.standard_normal(n), 160 + 220 * v, 3.5) * v * 2.2
    whine = np.sin(2 * np.pi * np.cumsum(520 + 380 * v) / SR) * v ** 1.5
    fric = svf_bp(r.standard_normal(n), 500 + 900 * v, 2.2) * v
    y = 0.95 * hiss + 0.34 * pump + 0.4 * whir + 0.03 * whine + 0.3 * fric
    # linkage rattle: short bursts of 2-3 small metal ticks right after each release
    for c, k in ((0.07, 3), (0.37, 3), (0.64, 2)):
        for j in range(k):
            at = c + j * r.uniform(0.018, 0.04) + r.uniform(0, 0.04)
            fr = r.uniform(900, 3000)
            put(y, mix(modal([fr, fr * 1.51, fr * 2.32], [.022, .015, .01], [.6, .35, .2], .09, r), burst(.008, .002, 1200, 0, r, .5)), at, r.uniform(0.2, 0.4))
    y *= env(n, 0.006, 0.14)
    return room(y, r, 0.10, 0.18)


def make_lock():
    """Latch / clamp: sharp clack, a heavier chunk as the bolt seats, a tiny spring ring."""
    r = np.random.default_rng(57)
    buf = np.zeros(int(0.36 * SR))
    put(buf, mix(modal([1180, 2310, 3470, 5200], [.03, .022, .014, .008], [.8, .55, .35, .15], .2, r), burst(.02, .003, 1500, 0, r, 1.0)), 0.0, 0.9)
    put(buf, lpf(mix(thump(150, 70, .05, .25, .9), modal([262, 541, 915, 1480], [.09, .065, .045, .03], [.6, .5, .35, .2], .25, r), burst(.015, .004, 500, 3000, r, .5)), 5000), 0.06, 1.0)
    put(buf, modal([3800, 4900], [.05, .035], [.3, .2], .2, r), 0.1, 0.1)
    return room(buf * env(len(buf), 0.0003, 0.08), r, 0.12, 0.18, 4200)


def make_button():
    """Small mechanical click, then a soft electromagnetic power-up (warm, not an arcade beep)."""
    r = np.random.default_rng(69)
    T = 0.4
    buf = np.zeros(int(T * SR))
    put(buf, mix(modal([2100, 3300, 4700], [.012, .009, .006], [.8, .5, .3], .08, r), burst(.012, .0025, 1800, 0, r, .8), thump(320, 190, .022, .08, .7)), 0.0, 0.9)
    t = tt(0.34)
    n = len(t)
    sweep = 330 + 400 * (1 - np.exp(-t / 0.11))
    e = np.sin(np.pi * np.clip(t / 0.34, 0, 1)) ** 1.5 * np.exp(-t / 0.25)
    up = np.zeros(n)
    for cents, amp in ((-4, .5), (4, .5)):                       # slight detune = shimmer
        up += amp * lpf(harm(sweep * 2 ** (cents / 1200), [1, .5, .3, .15]), 2600)
    up += 0.45 * np.sin(2 * np.pi * np.cumsum(sweep * 1.5) / SR)  # a fifth above
    up += 0.4 * np.sin(2 * np.pi * np.cumsum(sweep / 4) / SR)      # coil hum underneath
    up *= e
    put(buf, up, 0.045, 0.30)
    put(buf, np.sin(2 * np.pi * 2840 * tt(.2)) * np.exp(-tt(.2) / .06) * env(int(.2 * SR), .03, 0), 0.2, 0.012)   # a trace of gold gleam
    return room(buf * env(len(buf), 0.0003, 0.08), r, 0.10, 0.16, 4200)


# name: (builder, trim dB, limiter squash in dB: pulls the sharp transient down so the body of short cues is not lost)
CUES = {'logo': (make_logo, 0.0, 0), 'land': (make_land, 0.0, 4), 'bar': (make_bar, -1.0, 0),
        'unfold': (make_unfold, -1.0, 0), 'lock': (make_lock, -0.5, 6), 'button': (make_button, -1.0, 9)}


# ---------------------------------------------------------------- level, trim, encode
def limit(x, db, release=0.05, look=0.003):
    """Look-ahead peak limiter: caps the loudest peak `db` below where it is (instant attack, smooth release)."""
    th = np.max(np.abs(x)) * 10 ** (-db / 20)
    k = int(look * SR)
    g = np.minimum(1.0, th / np.maximum(maximum_filter1d(np.abs(x), size=2 * k + 1), 1e-9))
    rel = np.exp(-1 / (release * SR))
    gl = g.tolist()
    for i in range(1, len(gl)):
        gl[i] = min(gl[i], gl[i - 1] * rel + (1 - rel))
    return x * uniform_filter1d(np.array(gl), size=k + 1)


def level(x, trim_db, squash=0):
    x = x - np.mean(x)
    x = lpf(hpf(x, 40, 2), 9500, 1)
    if squash:
        x = limit(x, squash)
    w = int(0.2 * SR)
    p = np.cumsum(x ** 2)
    rms = np.sqrt(np.maximum(p[w:] - p[:-w], 0) / w)
    g = 10 ** ((TARGET_RMS_DB + trim_db) / 20) / max(rms.max(), 1e-9)
    peak = np.max(np.abs(x)) * g
    cap = 10 ** (PEAK_CAP_DB / 20)
    if peak > cap:
        g *= cap / peak
    return x * g


def trim(x):
    a = np.abs(x)
    keep = np.nonzero(a > a.max() * 10 ** (-44 / 20))[0]
    end = min(len(x), keep[-1] + int(0.02 * SR))
    x = x[:end].copy()
    nf = min(int(0.03 * SR), len(x))
    x[-nf:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nf) / nf)
    nfi = int(0.0004 * SR)
    x[:nfi] *= np.linspace(0, 1, nfi)
    return x


def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


def encode(x, out):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        write_wav(wav, x)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '96k', out], check=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    plot = sys.argv[sys.argv.index('--plot') + 1] if '--plot' in sys.argv else None
    if plot and plot in args:
        args.remove(plot)
    out = args[0] if args else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'assets', 'sfx', 'menu')
    os.makedirs(out, exist_ok=True)
    made = {}
    for name, (fn, trim_db, squash) in CUES.items():
        x = trim(level(fn(), trim_db, squash))
        encode(x, os.path.join(out, name + '.mp3'))
        made[name] = x
        print(f'{name:7s} {len(x) / SR:5.2f}s  peak {20 * np.log10(np.max(np.abs(x))):6.1f} dBFS')
    if plot:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(len(made), 2, figsize=(13, 2.3 * len(made)), gridspec_kw={'width_ratios': [1, 1.6]})
        for i, (name, x) in enumerate(made.items()):
            t = np.arange(len(x)) / SR
            ax[i, 0].plot(t, x, lw=.5)
            ax[i, 0].set_ylim(-1, 1)
            ax[i, 0].set_title(name, loc='left', fontsize=9)
            ax[i, 1].specgram(x, NFFT=1024, Fs=SR, noverlap=896, cmap='magma', vmin=-110, vmax=-30)
            ax[i, 1].set_ylim(0, 9000)
        fig.tight_layout()
        fig.savefig(plot, dpi=70)


if __name__ == '__main__':
    main()
