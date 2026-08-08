/** Campo de rotas animado — atmosfera da tela de autenticação. */
export function AuthRouteField() {
  return (
    <div className="auth-field pointer-events-none absolute inset-0" aria-hidden>
      <div className="auth-field-wash" />
      <div className="auth-field-grain" />
      <svg
        className="auth-field-routes absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <path
          className="auth-route auth-route-a"
          d="M-40 620 C 180 480, 320 720, 520 540 S 820 280, 1040 420 S 1280 620, 1500 380"
          stroke="url(#authGold)"
          strokeWidth="1.25"
        />
        <path
          className="auth-route auth-route-b"
          d="M-20 220 C 200 340, 380 120, 600 260 S 900 480, 1120 300 S 1320 160, 1480 240"
          stroke="url(#authInk)"
          strokeWidth="1"
        />
        <path
          className="auth-route auth-route-c"
          d="M 200 900 C 360 700, 480 820, 640 640 S 920 420, 1100 560 S 1300 720, 1440 640"
          stroke="url(#authCyan)"
          strokeWidth="1"
          opacity="0.55"
        />
        <circle className="auth-node auth-node-1" cx="520" cy="540" r="3.5" fill="#c9a87c" />
        <circle className="auth-node auth-node-2" cx="1040" cy="420" r="3" fill="#7dd3e8" />
        <circle className="auth-node auth-node-3" cx="640" cy="640" r="2.5" fill="#c9a87c" />
        <defs>
          <linearGradient id="authGold" x1="0" y1="0" x2="1440" y2="0">
            <stop stopColor="#c9a87c" stopOpacity="0" />
            <stop offset="0.35" stopColor="#c9a87c" stopOpacity="0.55" />
            <stop offset="0.7" stopColor="#c9a87c" stopOpacity="0.35" />
            <stop offset="1" stopColor="#c9a87c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="authInk" x1="0" y1="0" x2="1440" y2="0">
            <stop stopColor="#f3efe6" stopOpacity="0" />
            <stop offset="0.5" stopColor="#f3efe6" stopOpacity="0.12" />
            <stop offset="1" stopColor="#f3efe6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="authCyan" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#5ec8dc" stopOpacity="0" />
            <stop offset="0.5" stopColor="#5ec8dc" stopOpacity="0.35" />
            <stop offset="1" stopColor="#5ec8dc" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
