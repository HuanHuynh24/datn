import type { SVGProps } from 'react';

const paths = {
  home: <><path d="m2 10 10-8 10 8M5 9v13h5v-8h4v8h5V9" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4ZM11 13 22 2" /></>,
  message: <><path d="M3 3h18v14H8l-5 4ZM7 7h10M7 11h7" /></>,
  fire: <path d="M12 2c1 6-5 6-5 12 0 3 2 6 5 7-1-3 3-4 3-7 3 3 2 6 1 7 7-2 7-11-4-19Z" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  right: <path d="m9 5 7 7-7 7" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12c6 4 12 4 18 0M12 12v4" /></>,
  document: <><path d="M14 2H5v20h14V7Z M14 2v6h5M8 12h8M8 16h6" /></>,
  users: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6M22 21v-3a7 7 0 0 0-4-6" /></>,
  building: <><path d="M4 22V3h12v19M16 9h5v13M1 22h22M8 7h4M8 11h4M8 15h4M9 22v-3h3v3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  code: <><path d="m7 6-6 6 6 6m10-12 6 6-6 6M14 3l-4 18" /></>,
  chart: <><path d="M3 3v18h18M7 16l5-6 4 3 5-8" /><path d="M17 5h4v4" /></>,
  pen: <><path d="m15 3 6 6-12 12H3v-6ZM12 6l6 6" /><path d="m3 15 6 6" /></>,
  coins: <><ellipse cx="10" cy="6" rx="7" ry="3" /><path d="M3 6v5c0 4 14 4 14 0V6M3 11v5c0 4 14 4 14 0v-5M20 9v8c0 2-4 4-7 4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  shield: <><path d="m12 2 8 4v7c0 6-8 9-8 9s-8-3-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
};

export type IconName = keyof typeof paths;

export default function Icon({ name, className = '', ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`} {...props}>{paths[name]}</svg>;
}
