export function AiIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Large central sparkle */}
      <path d="M8 2 L8.9 6.1 L13 7 L8.9 7.9 L8 12 L7.1 7.9 L3 7 L7.1 6.1 Z" />
      {/* Small sparkle top-right */}
      <path d="M12.5 1 L12.85 2.65 L14.5 3 L12.85 3.35 L12.5 5 L12.15 3.35 L10.5 3 L12.15 2.65 Z" />
      {/* Dot bottom-left */}
      <circle cx="3.5" cy="13" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
