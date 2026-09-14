/** Fachada provisória quando o ponto ainda não tem foto. */
export function PontoPlaceholderArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect className="ponto-ph-sky" x="0" y="0" width="640" height="360" />
      <path
        className="ponto-ph-ground"
        d="M0 268h640v92H0z"
      />
      {/* Prédio */}
      <path
        className="ponto-ph-wall"
        d="M168 268V128h304v140H168z"
      />
      <path
        className="ponto-ph-stroke"
        d="M168 128h304v140H168z"
        strokeWidth="3"
        fill="none"
      />
      {/* Toldo */}
      <path
        className="ponto-ph-awning"
        d="M148 128h344l-18 36H166l-18-36z"
      />
      <path
        className="ponto-ph-awning-stripe"
        d="M166 128h40l-18 36h-40zM246 128h40l-18 36h-40zM326 128h40l-18 36h-40zM406 128h40l-18 36h-40z"
      />
      {/* Porta */}
      <rect className="ponto-ph-door" x="286" y="188" width="68" height="80" rx="4" />
      <circle className="ponto-ph-knob" cx="342" cy="230" r="3.5" />
      {/* Janelas */}
      <rect className="ponto-ph-window" x="196" y="188" width="64" height="48" rx="3" />
      <rect className="ponto-ph-window" x="380" y="188" width="64" height="48" rx="3" />
      <path className="ponto-ph-stroke" d="M228 188v48M196 212h64M412 188v48M380 212h64" strokeWidth="1.5" />
      {/* Letreiro */}
      <rect className="ponto-ph-sign" x="248" y="152" width="144" height="22" rx="3" />
      <path
        className="ponto-ph-sign-text"
        d="M268 163h104"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Planta */}
      <ellipse className="ponto-ph-plant" cx="214" cy="262" rx="14" ry="8" />
      <path className="ponto-ph-plant" d="M214 262c-8-18-2-28 0-32 4 6 10 16 0 32z" />
      <ellipse className="ponto-ph-plant" cx="426" cy="262" rx="14" ry="8" />
      <path className="ponto-ph-plant" d="M426 262c-8-18-2-28 0-32 4 6 10 16 0 32z" />
    </svg>
  );
}
