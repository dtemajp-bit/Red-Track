// Set de íconos de línea simples, sin dependencias externas.
// Todos aceptan `size` y `color`/`className`, y heredan currentColor por defecto.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 18, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...rest}>
      {children}
    </svg>
  );
}

export function IconPanel(props) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </Svg>
  );
}

export function IconPin(props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </Svg>
  );
}

export function IconMap(props) {
  return (
    <Svg {...props}>
      <path d="M9 4.5 4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </Svg>
  );
}

export function IconSync(props) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 16" />
      <path d="M4 20v-4h4" />
    </Svg>
  );
}

export function IconAlert(props) {
  return (
    <Svg {...props}>
      <path d="M10.6 3.9 2.9 17.4a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.8h.01" />
    </Svg>
  );
}

export function IconUsers(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19c.6-3 3-5 6.2-5s5.6 2 6.2 5" />
      <circle cx="17.5" cy="8.7" r="2.4" />
      <path d="M16 13.6c2.4.4 4.2 2 4.7 4.4" />
    </Svg>
  );
}

export function IconReport(props) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M15 3.5V7h3.5" />
      <path d="M8.2 13.5v3M12 11.5v5M15.8 15v1.5" />
    </Svg>
  );
}

export function IconLogout(props) {
  return (
    <Svg {...props}>
      <path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3" />
      <path d="M16 16.5 20.5 12 16 7.5" />
      <path d="M20.5 12H9.5" />
    </Svg>
  );
}

export function IconMail(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.6" />
      <path d="m4 6.5 8 6.3 8-6.3" />
    </Svg>
  );
}

export function IconLock(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="10.5" width="14" height="9" rx="1.6" />
      <path d="M8 10.5V7.7a4 4 0 0 1 8 0v2.8" />
    </Svg>
  );
}

export function IconCamera(props) {
  return (
    <Svg {...props}>
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l1-1.6h7.8l1 1.6h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </Svg>
  );
}

export function IconPlus(props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconDownload(props) {
  return (
    <Svg {...props}>
      <path d="M12 4v11" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </Svg>
  );
}

export function IconCheck(props) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  );
}

export function IconClock(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconWifiOff(props) {
  return (
    <Svg {...props}>
      <path d="m2.5 2.5 19 19" />
      <path d="M9 15.8a5 5 0 0 1 6 0" />
      <path d="M5.5 12.3a10 10 0 0 1 2.8-1.9" />
      <path d="M12.7 8.05a10 10 0 0 1 5.8 2.75" />
      <path d="M2.5 8.5a14.5 14.5 0 0 1 3.2-2.2" />
      <path d="M15.4 5.1A14.5 14.5 0 0 1 21.5 8.5" />
      <path d="M12 19.5h.01" />
    </Svg>
  );
}
