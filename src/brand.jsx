import React from "react";

/* Marca "Órbita" en línea: sol radiante + anillos concéntricos + planeta 3D.
   Copia del sistema de marca en docs/manual-identidad/svg/logo-orbita.svg. */
export default function OrbitaMark({ size = 32, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Órbita"
    >
      <defs>
        <radialGradient id="ob-core" cx="38%" cy="35%" r="65%">
          <stop offset="0" stopColor="#FFF6E0" />
          <stop offset="30%" stopColor="#FFD27A" />
          <stop offset="65%" stopColor="#FF8A5C" />
          <stop offset="100%" stopColor="#C2410C" />
        </radialGradient>
        <radialGradient id="ob-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFB85C" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#A855F7" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ob-ring" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <radialGradient id="ob-planet" cx="38%" cy="35%" r="70%">
          <stop offset="0" stopColor="#93C5FD" />
          <stop offset="55%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E2A78" />
        </radialGradient>
      </defs>
      <g transform="rotate(-24 32 32)">
        <ellipse cx="32" cy="32" rx="29" ry="8.8" fill="none" stroke="url(#ob-ring)" strokeWidth="1.2" opacity="0.3" />
        <ellipse cx="32" cy="32" rx="21.5" ry="6.5" fill="none" stroke="url(#ob-ring)" strokeWidth="1.4" opacity="0.6" />
        <ellipse cx="32" cy="32" rx="14" ry="4.3" fill="none" stroke="url(#ob-ring)" strokeWidth="1.6" opacity="0.95" />
      </g>
      <circle cx="32" cy="32" r="14" fill="url(#ob-halo)" />
      <circle cx="32" cy="32" r="5.5" fill="url(#ob-core)" />
      <circle cx="32" cy="32" r="1.4" fill="#FFF6E0" opacity="0.9" />
      <circle cx="58.5" cy="20.2" r="2.8" fill="url(#ob-planet)" />
      <ellipse cx="57.7" cy="19.5" rx="0.9" ry="0.6" fill="#FFFFFF" opacity="0.85" transform="rotate(-22 57.7 19.5)" />
      <circle cx="19.7" cy="40.5" r="1.5" fill="#F9A8D4" />
    </svg>
  );
}
