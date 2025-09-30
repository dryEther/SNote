import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="SNote Logo"
  >
    <path
      d="M68,20 C78,20 80,25 80,35 C80,45 75,50 65,50 L35,50 C25,50 20,55 20,65 C20,75 22,80 32,80"
      stroke="currentColor"
      strokeWidth="12"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Logo;
