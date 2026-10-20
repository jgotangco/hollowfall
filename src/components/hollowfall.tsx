import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { createGame, type GameApi } from "@/game/engine";
import type { Hud } from "@/game/types";

const EMPTY: Hud = {
  score: 0,
  best: 0,
  relics: [false, false, false],
  mode: "title",
  hint: "",
  time: 0,
};

function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function points(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(6, "0");
}

export function Hollowfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<GameApi | null>(null);
  const [hud, setHud] = useState<Hud>(EMPTY);
  const [scale, setScale] = useState(2);
  const [mix, setMix] = useState({ music: 0.75, sfx: 0.85, muted: false });

  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const wide = vw >= 900;
      const next = Math.max(
        1,
        Math.min(4, Math.floor(Math.min((vw - (wide ? 420 : 28)) / 160, (vh - (wide ? 120 : 250)) / 192))),
      );
      setScale(next);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, { onHud: setHud, onSettings: setMix });
    api.current = game;
    return () => {
      game.destroy();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    if (hud.mode === "pause" && mapRef.current) api.current?.paintMap(mapRef.current);
  }, [hud.mode]);

  function hold(code: string, on: boolean) {
    api.current?.setHeld(code, on);
  }

  const playing = hud.mode === "play" || hud.mode === "hurt" || hud.mode === "return";
  const names = ["Nia", "Ember", "Sunstone"] as const;

  return (
    <main className="stage">
      <header className="brand">
        <h1>HOLLOWFALL</h1>
        <p>The Amber Deep</p>
      </header>

      <div className="console" style={{ ["--px" as string]: String(scale) }}>
        <div className="crt">
          <canvas ref={canvasRef} width={160} height={192} aria-label="Hollowfall cavern" />
          <div className="scan" />
          <div className="vignette" />
          <span className="led" aria-hidden />
        </div>

        <div className="hudcol">
        {hud.mode === "title" && (
          <div className="card">
            <h2>THREE THINGS THE MOUNTAIN KEPT</h2>
            <p>
              Kit Calder goes down for <span className="dim">Nia</span>, <span className="dim">Ember</span>, and the{" "}
              <span className="dim">Sunstone</span>. Lanterns bank your score. Fall, and the spark flies home.
            </p>
            <div className="row">
              <button className="btn" type="button" onClick={() => { api.current?.unlock(); api.current?.start(); }}>
                Start
              </button>
              <span className="dim">Best {points(hud.best)}</span>
            </div>
          </div>
        )}

        {hud.mode === "win" && (
          <div className="card">
            <h2>DAYLIGHT</h2>
            <p>Nia has your sleeve. Ember is already on the rope.</p>
            <p>
              {points(hud.score)} <span className="dim">in {clock(hud.time)}</span>
            </p>
            <div className="row">
              <button className="btn" type="button" onClick={() => api.current?.restart()}>
                Descend again
              </button>
            </div>
          </div>
        )}

        <div className="relics" aria-label="Relics">
          {names.map((name, i) => (
            <span key={name} className={hud.relics[i] ? undefined : "off"}>
              {hud.relics[i] ? name : name}
            </span>
          ))}
          {playing && <b>{points(hud.score)}</b>}
        </div>

        <p className="hintbar">{hud.hint || "Arrows or WASD move · Z or Space jump · Up climbs and takes a balloon"}</p>

        {hud.mode === "pause" ? (
          <div className="panel">
            <div className="row">
              <button className="btn" type="button" onClick={() => api.current?.togglePause()}>
                <Play size={14} aria-hidden /> Resume
              </button>
              <button className="btn ghost" type="button" onClick={() => api.current?.restart()}>
                Restart
              </button>
            </div>
            <canvas ref={mapRef} className="mapbox" aria-label="Explored cavern" />
            <div className="sliders">
              <label>
                Music
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mix.music}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMix((m) => ({ ...m, music: v }));
                    api.current?.setMusic(v);
                  }}
                />
              </label>
              <label>
                Effects
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mix.sfx}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMix((m) => ({ ...m, sfx: v }));
                    api.current?.setSfx(v);
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="controls">
            <div className="dpad" role="group" aria-label="Move">
              <Pad k="u" label="Up" code="ArrowUp" onHold={hold}>
                <ChevronUp size={18} />
              </Pad>
              <Pad k="l" label="Left" code="ArrowLeft" onHold={hold}>
                <ChevronLeft size={18} />
              </Pad>
              <Pad k="r" label="Right" code="ArrowRight" onHold={hold}>
                <ChevronRight size={18} />
              </Pad>
              <Pad k="d" label="Down" code="ArrowDown" onHold={hold}>
                <ChevronDown size={18} />
              </Pad>
            </div>
            <button
              className="jump"
              type="button"
              aria-label="Jump"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                hold("Space", true);
              }}
              onPointerUp={() => hold("Space", false)}
              onPointerCancel={() => hold("Space", false)}
              onLostPointerCapture={() => hold("Space", false)}
            >
              JUMP
            </button>
            <div className="side-col">
              <button
                className="icon-btn"
                type="button"
                aria-label={mix.muted ? "Unmute" : "Mute"}
                onClick={() => api.current?.toggleMute()}
              >
                {mix.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                className="icon-btn"
                type="button"
                aria-label="Pause"
                disabled={!playing}
                onClick={() => api.current?.togglePause()}
              >
                <Pause size={18} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}

function Pad({
  k,
  label,
  code,
  onHold,
  children,
}: {
  k: string;
  label: string;
  code: string;
  onHold: (code: string, on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      className="pad"
      data-k={k}
      type="button"
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(code, true);
      }}
      onPointerUp={() => onHold(code, false)}
      onPointerCancel={() => onHold(code, false)}
      onLostPointerCapture={() => onHold(code, false)}
    >
      {children}
    </button>
  );
}
