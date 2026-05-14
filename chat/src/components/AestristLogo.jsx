// Aestrist wordmark logo — geometric "A" mark
export default function AestristLogo({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Aestrist"
    >
      {/* Outer diamond */}
      <rect
        x="4"
        y="4"
        width="24"
        height="24"
        rx="6"
        fill="var(--cn-accent)"
        opacity="0.15"
      />
      {/* "A" shape — two diagonal strokes meeting at apex with crossbar */}
      <path
        d="M16 7 L24 25 M16 7 L8 25 M11 19 L21 19"
        stroke="var(--cn-accent-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
