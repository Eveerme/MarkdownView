interface LogoMarkProps {
  className?: string;
}

/** The product mark: a document cut from the page, with its own M. */
export const LogoMark = ({ className }: LogoMarkProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 1024 1024"
  >
    <path
      d="M318 158h286l206 206v462a46 46 0 0 1-46 46H318a46 46 0 0 1-46-46V204a46 46 0 0 1 46-46Z"
      fill="currentColor"
    />
    <path d="M604 158v160a46 46 0 0 0 46 46h160Z" fill="var(--background)" />
    <path
      d="M400 702V446l112 108 112-108v256"
      stroke="var(--background)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="66"
    />
  </svg>
);
