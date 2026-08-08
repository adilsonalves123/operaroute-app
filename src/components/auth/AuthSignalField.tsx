/** Mesa de sinal — grade + radar + pontos (atmosfera auth). */
export function AuthSignalField() {
  return (
    <div className="auth-signal pointer-events-none absolute inset-0" aria-hidden>
      <div className="auth-signal-wash" />
      <div className="auth-signal-vignette" />

      <div className="auth-radar">
        <div className="auth-radar-ring auth-radar-ring-1" />
        <div className="auth-radar-ring auth-radar-ring-2" />
        <div className="auth-radar-ring auth-radar-ring-3" />
        <div className="auth-radar-sweep" />
      </div>

      <svg
        className="auth-constellation absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g className="auth-grid-lines" stroke="rgba(125, 211, 232, 0.06)" strokeWidth="1">
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`v${i}`} x1={120 * i} y1="0" x2={120 * i} y2="900" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={112 * i} x2="1440" y2={112 * i} />
          ))}
        </g>

        <path
          className="auth-link"
          d="M280 640 L420 480 L610 520 L780 340 L980 410 L1180 290"
          stroke="rgba(125, 211, 232, 0.35)"
          strokeWidth="1.25"
        />
        <path
          className="auth-link auth-link-delay"
          d="M180 300 L350 380 L520 260 L700 320 L900 220"
          stroke="rgba(201, 168, 124, 0.28)"
          strokeWidth="1"
        />

        {[
          [280, 640],
          [420, 480],
          [610, 520],
          [780, 340],
          [980, 410],
          [1180, 290],
          [350, 380],
          [700, 320],
        ].map(([x, y], i) => (
          <g key={`${x}-${y}`} className={`auth-blip auth-blip-${i % 4}`}>
            <circle cx={x} cy={y} r="2.5" fill={i % 3 === 0 ? "#c9a87c" : "#7dd3e8"} />
            <circle
              cx={x}
              cy={y}
              r="10"
              stroke={i % 3 === 0 ? "rgba(201,168,124,0.35)" : "rgba(125,211,232,0.3)"}
              strokeWidth="1"
              className="auth-blip-ring"
            />
          </g>
        ))}
      </svg>

      <div className="auth-hud-corner auth-hud-tl" />
      <div className="auth-hud-corner auth-hud-br" />
    </div>
  );
}
