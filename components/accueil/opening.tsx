"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { SHIELD_PATH } from "@/components/heraldique/shield";
import "./opening.css";

/**
 * Opening screen (cahier des charges, 6.1; direction A « Monument »).
 *
 * White screen; three red bands cross from left to right, one after the
 * other, tighten and fold into the shield; « Croÿ » rises letter by letter
 * and the two dots of the ÿ fall last, in red. Under 3 seconds, once per
 * session, sped through by a click, a key or a scroll. With reduced motion,
 * the page simply fades in. Afterwards, the shield follows the pointer or
 * the tilt of the phone.
 */

export const SEEN_KEY = "croy:opening-seen";

/**
 * Runs in <head> before the first paint, on the home page only, so that
 * neither the final page nor the menu flashes before the opening.
 */
// On a slow phone, the opening must not keep the page blank: if it has not
// started within START_DEADLINE ms of the HTML, the page shows without it.
const START_DEADLINE = 1200;
export const openingScript = `(function(){if(!/^\\/(fr|en|de)\\/?$/.test(location.pathname))return;var d=document.documentElement,s=false;try{s=sessionStorage.getItem("${SEEN_KEY}")==="1"}catch(e){}if(!s&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("intro");window.__croyIntroSafety=setTimeout(function(){d.classList.remove("intro","intro-motion")},${START_DEADLINE})}})();`;

// Strong ease-out and ease-in-out; gravity curves for the falling dots.
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
const FALL = "cubic-bezier(0.55, 0.085, 0.68, 0.53)";
const REBOUND = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const TIMING = {
  sweep: { at: 120, dur: 560, stagger: 120 },
  contract: { at: 820, dur: 620 },
  fold: { dur: 480 },
  letters: { at: 1320, dur: 600, stagger: 80 },
  dots: { at: 1900, dur: 460, stagger: 100 },
  lede: { at: 1980, dur: 520, stagger: 90 },
};
const TILT_DEGREES = 7;

const DOT_FALL: Keyframe[] = [
  { transform: "translateY(-0.7em)", easing: FALL },
  { transform: "translateY(0)", offset: 0.62, easing: REBOUND },
  { transform: "translateY(-0.055em)", offset: 0.81, easing: FALL },
  { transform: "translateY(0)" },
];

// Same commands, so the clip can morph from a rectangle into the shield.
const SHIELD = [
  0, 0, 100, 0, 100, 68.571, 100, 98, 78, 112, 50, 120, 22, 112, 0, 98, 0,
  68.571,
];
const SQUARE = [
  0, 0, 100, 0, 100, 68.571, 100, 140, 100, 140, 50, 140, 0, 140, 0, 140, 0,
  68.571,
];
function shieldPath(p: number) {
  const v = SHIELD.map((end, i) =>
    (SQUARE[i] + (end - SQUARE[i]) * p).toFixed(3),
  );
  return `M${v[0]} ${v[1]} L${v[2]} ${v[3]} L${v[4]} ${v[5]} C${v[6]} ${v[7]} ${v[8]} ${v[9]} ${v[10]} ${v[11]} C${v[12]} ${v[13]} ${v[14]} ${v[15]} ${v[16]} ${v[17]} Z`;
}

const session = {
  seen() {
    try {
      return sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  },
  mark() {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  },
};

/** Height above the baseline, in em, of the gap between the dots of ÿ and the y. */
function dieresisGap(style: CSSStyleDeclaration) {
  const px = 200;
  const canvas = document.createElement("canvas");
  canvas.width = 2 * px;
  canvas.height = 2 * px;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0.62;
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${px}px ${style.fontFamily}`;
  const base = Math.round(1.5 * px);
  const inkRows = (text: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, px / 2, base);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rows = new Array<boolean>(canvas.height).fill(false);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 40) {
          rows[y] = true;
          break;
        }
      }
    }
    return rows;
  };
  const plain = inkRows("y");
  const dotted = inkRows("ÿ");
  const bodyTop = plain.indexOf(true);
  let gapBottom = bodyTop - 1;
  while (gapBottom > 0 && !dotted[gapBottom]) gapBottom--;
  if (bodyTop < 0 || gapBottom <= 0) return 0.62;
  return (base - (gapBottom + bodyTop) / 2) / px;
}

/** Splits « Croÿ » into letters placed at their kerned positions. */
function buildName(word: HTMLElement) {
  word.removeAttribute("style");
  word.textContent = "Croÿ";
  const text = word.firstChild as Text;
  const style = getComputedStyle(word);
  const size = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight);
  const box = word.getBoundingClientRect();

  const probe = document.createElement("span");
  probe.style.cssText =
    "display:inline-block;width:0;height:0;vertical-align:baseline";
  word.append(probe);
  const baseline = probe.getBoundingClientRect().top - box.top;
  probe.remove();

  const range = document.createRange();
  const chars = [...text.data];
  let offset = 0;
  const lefts = chars.map((c) => {
    range.setStart(text, offset);
    range.setEnd(text, offset + c.length);
    offset += c.length;
    return range.getBoundingClientRect().left - box.left;
  });

  const em = (px: number) => `${(px / size).toFixed(4)}em`;
  const cut = baseline - dieresisGap(style) * size;
  const keepBelow = em(lineHeight - cut);
  word.textContent = "";
  word.style.width = em(box.width);
  word.style.height = em(lineHeight);

  chars.forEach((c, i) => {
    const ch = document.createElement("span");
    ch.className = "ch";
    ch.style.left = em(lefts[i]);
    if (c === "ÿ") {
      for (const side of ["left", "right"] as const) {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.textContent = "ÿ";
        dot.style.clipPath =
          side === "left"
            ? `inset(-1em 50% ${keepBelow} -0.5em)`
            : `inset(-1em -0.5em ${keepBelow} 50%)`;
        ch.append(dot);
      }
    }
    const glyph = document.createElement("span");
    glyph.className = "glyph";
    glyph.textContent = c === "ÿ" ? "y" : c;
    ch.append(glyph);
    word.append(ch);
  });
}

// Critically damped spring, one per axis, response 0.45 s: no overshoot.
function spring(response = 0.45) {
  return {
    k: ((2 * Math.PI) / response) ** 2,
    c: (4 * Math.PI) / response,
    x: 0,
    v: 0,
    to: 0,
    step(dt: number) {
      const a = -this.k * (this.x - this.to) - this.c * this.v;
      this.v += a * dt;
      this.x += this.v * dt;
    },
    still() {
      return Math.abs(this.x - this.to) < 1e-4 && Math.abs(this.v) < 1e-3;
    },
  };
}

function renderPronunciation(text: string) {
  // The pronounced word, between quotes, is set in italics.
  return text
    .split(/([«“„][^»”“]+[»”“])/)
    .map((part, i) => (/^[«“„]/.test(part) ? <i key={i}>{part}</i> : part));
}

export function Opening({
  tagline,
  pronunciation,
  cueLabel,
  cueTarget,
  skipLabel,
  shieldLabel,
}: {
  tagline: { text: string; lang: string } | null;
  pronunciation: { text: string; lang: string } | null;
  cueLabel: string;
  cueTarget: string | null;
  skipLabel: string;
  shieldLabel: string;
}) {
  const root = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);

  // On a client-side visit to the home page, the script in the HTML did not
  // run: decide here, before the paint.
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (
      !session.seen() &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      html.classList.add("intro");
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const section = root.current!;
    const word = section.querySelector<HTMLElement>(".word")!;
    const shieldSvg = section.querySelector<SVGSVGElement>(".shield")!;
    const clip = section.querySelector<SVGPathElement>(".shield-clip")!;
    const tiltEl = section.querySelector<HTMLElement>(".shield-tilt")!;
    const field = overlay.current!.querySelector<HTMLElement>(".intro-field")!;
    const clockEl = overlay.current!.querySelector<HTMLElement>(".fold-clock")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let anims: Animation[] = [];
    let playing = false;
    let alive = true;

    const tilt = {
      enabled: false,
      x: spring(),
      y: spring(),
      raf: 0,
      last: 0,
      aim(nx: number, ny: number) {
        if (!this.enabled) return;
        this.x.to = Math.max(-1, Math.min(1, nx));
        this.y.to = Math.max(-1, Math.min(1, ny));
        if (!this.raf) {
          this.last = performance.now();
          this.raf = requestAnimationFrame((t) => this.frame(t));
        }
      },
      frame(now: number) {
        const dt = Math.min(0.064, (now - this.last) / 1000);
        this.last = now;
        const n = Math.max(1, Math.ceil(dt * 240));
        for (let i = 0; i < n; i++) {
          this.x.step(dt / n);
          this.y.step(dt / n);
        }
        const still = this.x.still() && this.y.still();
        tiltEl.style.transform =
          still && this.x.to === 0 && this.y.to === 0
            ? ""
            : `rotateX(${(-this.y.x * TILT_DEGREES).toFixed(3)}deg) rotateY(${(this.x.x * TILT_DEGREES).toFixed(3)}deg)`;
        this.raf = still ? 0 : requestAnimationFrame((t) => this.frame(t));
      },
      stop() {
        this.enabled = false;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        tiltEl.style.transform = "";
      },
    };

    const add = (
      el: Element,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
    ) => {
      const a = el.animate(keyframes, { fill: "both", ...options });
      anims.push(a);
      return a;
    };

    const settle = () => {
      if (!alive) return;
      playing = false;
      clearTimeout(
        (window as unknown as { __croyIntroSafety?: number }).__croyIntroSafety,
      );
      html.classList.remove("intro", "intro-motion");
      for (const a of anims) a.cancel();
      anims = [];
      clip.setAttribute("d", shieldPath(1));
      session.mark();
      tilt.enabled = !reduced;
    };

    const fontsReady = async () => {
      const family = getComputedStyle(word).fontFamily;
      await Promise.race([
        document.fonts.load(`500 100px ${family}`, "Croÿ").catch(() => {}),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    };

    async function play() {
      await fontsReady();
      if (!alive) return;
      buildName(word);
      // Too slow to start: the page is already shown, it stays as it is.
      if (!html.classList.contains("intro")) {
        session.mark();
        tilt.enabled = !reduced;
        return;
      }
      clearTimeout(
        (window as unknown as { __croyIntroSafety?: number }).__croyIntroSafety,
      );
      window.scrollTo(0, 0);

      const vw = innerWidth;
      const vh = innerHeight;
      const shield = shieldSvg.getBoundingClientRect();
      const h = Math.min(shield.height * 2.6, vh * 0.5);
      const from = { x: 0, y: (vh - h) / 2, w: vw, h };
      Object.assign(field.style, {
        left: `${from.x}px`,
        top: `${from.y}px`,
        width: `${from.w}px`,
        height: `${from.h}px`,
      });
      html.classList.add("intro-motion");
      playing = true;
      const T = TIMING;

      // 1. Three red bands cross the screen, one after the other.
      field.querySelectorAll("i").forEach((band, i) =>
        add(band, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: T.sweep.dur,
          delay: T.sweep.at + i * T.sweep.stagger,
          easing: EASE_OUT,
        }),
      );

      // 2. They tighten into the exact place of the fasces in the shield.
      const to = `translate(${shield.left - from.x}px, ${shield.top - from.y}px) scale(${shield.width / from.w}, ${shield.height / from.h})`;
      add(field, [{ transform: "none" }, { transform: to }], {
        duration: T.contract.dur,
        delay: T.contract.at,
        easing: EASE_IN_OUT,
      });

      // 3. The shield takes over: its outline closes and the base folds.
      const handoff = T.contract.at + T.contract.dur;
      add(overlay.current!, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 1,
        delay: handoff,
      });
      add(shieldSvg, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 1,
        delay: handoff,
      });
      add(
        section.querySelector(".shield-field")!,
        [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: 320,
          delay: handoff,
          easing: EASE_OUT,
        },
      );
      section.querySelectorAll(".shield-edge").forEach((edge) =>
        add(edge, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: T.fold.dur + 140,
          delay: handoff - 40,
          easing: EASE_OUT,
        }),
      );
      const clock = add(clockEl, [{ opacity: 0 }, { opacity: 1 }], {
        duration: T.fold.dur,
        delay: handoff,
        easing: EASE_OUT,
      });
      clip.setAttribute("d", shieldPath(0));
      const fold = () => {
        if (!alive) return;
        clip.setAttribute(
          "d",
          shieldPath(Number(getComputedStyle(clockEl).opacity)),
        );
        if (clock.playState !== "finished" && clock.playState !== "idle") {
          requestAnimationFrame(fold);
        }
      };
      requestAnimationFrame(fold);

      // 4. The name rises letter by letter.
      word.querySelectorAll(".glyph").forEach((glyph, i) =>
        add(
          glyph,
          [
            { transform: "translateY(calc(100% + 0.35em))" },
            { transform: "none" },
          ],
          {
            duration: T.letters.dur,
            delay: T.letters.at + i * T.letters.stagger,
            easing: EASE_OUT,
          },
        ),
      );

      // 5. The two dots of the ÿ fall last, in red.
      word.querySelectorAll(".dot").forEach((dot, i) => {
        const at = T.dots.at + i * T.dots.stagger;
        add(dot, [{ opacity: 0 }, { opacity: 1 }], {
          duration: 110,
          delay: at,
        });
        add(dot, DOT_FALL, { duration: T.dots.dur, delay: at });
      });

      // 6. The line and the way in.
      section.querySelectorAll(".lede > *, .cue").forEach((el, i) =>
        add(
          el,
          [
            { opacity: 0, transform: "translateY(0.6rem)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: T.lede.dur,
            delay: T.lede.at + i * T.lede.stagger,
            easing: EASE_OUT,
          },
        ),
      );

      Promise.all(anims.map((a) => a.finished)).then(settle, () => {});
    }

    // A click, a key or a scroll finishes the opening quickly instead of cutting it.
    const skip = () => {
      if (!playing) return;
      playing = false;
      for (const a of anims) a.updatePlaybackRate(7);
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        ["Escape", "Enter", " ", "ArrowDown", "PageDown", "Tab"].includes(e.key)
      )
        skip();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !e.isPrimary) return;
      tilt.aim(
        (e.clientX / innerWidth) * 2 - 1,
        (e.clientY / innerHeight) * 2 - 1,
      );
    };
    const rest = () => tilt.aim(0, 0);
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") rest();
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const angle = screen.orientation?.angle ?? 0;
      const [side, front] =
        angle === 90
          ? [e.beta, -e.gamma]
          : angle === 270 || angle === -90
            ? [-e.beta, e.gamma]
            : [e.gamma, e.beta - 40];
      tilt.aim(side / 25, front / 25);
    };
    // iOS asks for permission, and only after a touch on the shield.
    const askOrientation = () => {
      const D = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      D.requestPermission?.()
        .then((state) => {
          if (state === "granted")
            addEventListener("deviceorientation", onOrientation);
        })
        .catch(() => {});
    };
    const shieldSlot = section.querySelector(".shield-slot")!;
    const needsPermission =
      "DeviceOrientationEvent" in window &&
      typeof (
        DeviceOrientationEvent as unknown as { requestPermission?: unknown }
      ).requestPermission === "function";

    addEventListener("pointerdown", skip, { capture: true });
    addEventListener("wheel", skip, { passive: true });
    addEventListener("touchmove", skip, { passive: true });
    addEventListener("keydown", onKey);
    addEventListener("resize", skip);
    skipButton.current!.addEventListener("click", skip);
    addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", rest);
    addEventListener("pointerup", onPointerUp);
    addEventListener("blur", rest);
    if ("DeviceOrientationEvent" in window) {
      if (needsPermission)
        shieldSlot.addEventListener("click", askOrientation, { once: true });
      else addEventListener("deviceorientation", onOrientation);
    }

    if (html.classList.contains("intro")) {
      play();
    } else {
      session.mark();
      tilt.enabled = !reduced;
      // Without the opening, the dots of the ÿ are still set in red.
      fontsReady().then(() => {
        if (alive) buildName(word);
      });
    }

    return () => {
      alive = false;
      for (const a of anims) a.cancel();
      tilt.stop();
      html.classList.remove("intro", "intro-motion");
      removeEventListener("pointerdown", skip, { capture: true });
      removeEventListener("wheel", skip);
      removeEventListener("touchmove", skip);
      removeEventListener("keydown", onKey);
      removeEventListener("resize", skip);
      removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", rest);
      removeEventListener("pointerup", onPointerUp);
      removeEventListener("blur", rest);
      removeEventListener("deviceorientation", onOrientation);
      shieldSlot.removeEventListener("click", askOrientation);
    };
  }, []);

  return (
    <>
      <section ref={root} className="opening" aria-labelledby="nom">
        <div className="shield-slot">
          <div className="shield-tilt">
            <svg
              className="shield"
              viewBox="0 0 100 120"
              role="img"
              aria-label={shieldLabel}
            >
              <defs>
                <clipPath id="opening-shield-clip">
                  <path className="shield-clip" d={SHIELD_PATH} />
                </clipPath>
              </defs>
              <g clipPath="url(#opening-shield-clip)">
                <rect
                  className="shield-field"
                  x="0"
                  y="0"
                  width="100"
                  height="140"
                />
                <g className="shield-fasces">
                  <rect x="0" y="17.143" width="100" height="17.143" />
                  <rect x="0" y="51.429" width="100" height="17.143" />
                  <rect x="0" y="85.714" width="100" height="17.143" />
                </g>
              </g>
              <path
                className="shield-edge"
                pathLength={1}
                d="M50 0 L0 0 L0 68.571 C0 98 22 112 50 120"
              />
              <path
                className="shield-edge"
                pathLength={1}
                d="M50 0 L100 0 L100 68.571 C100 98 78 112 50 120"
              />
            </svg>
          </div>
        </div>

        <h1 className="name" id="nom">
          <span className="sr-only">Croÿ</span>
          <span className="word" aria-hidden="true">
            Croÿ
          </span>
        </h1>

        {(tagline || pronunciation) && (
          <div className="lede">
            {tagline && (
              <p className="tagline" lang={tagline.lang}>
                {tagline.text}
              </p>
            )}
            {pronunciation && (
              <p className="pron" lang={pronunciation.lang}>
                {renderPronunciation(pronunciation.text)}
              </p>
            )}
          </div>
        )}

        {cueTarget && (
          <a className="cue" href={`#${cueTarget}`}>
            {cueLabel}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 2v11M3 8.5 8 13.5l5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </section>

      <div ref={overlay} className="intro-overlay" aria-hidden="true">
        <div className="intro-field">
          <i />
          <i />
          <i />
        </div>
        <span className="fold-clock" />
      </div>
      <button ref={skipButton} type="button" className="intro-skip">
        {skipLabel}
      </button>
    </>
  );
}
