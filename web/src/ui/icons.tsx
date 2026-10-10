// Inline SVG icons on a 24px grid: 1.75px strokes with round ends, like a felt pen on a flyer.
// An icon is decoration (aria-hidden) unless it gets a title.
import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number; title?: string };

function Svg({ size = 16, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" /></Svg>
);

export const StopIcon = (props: IconProps) => (
  <Svg {...props}><rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" /></Svg>
);

export const PauseIcon = (props: IconProps) => (
  <Svg {...props}><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" /></Svg>
);

export const VolumeIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></Svg>
);

export const VolumeOffIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></Svg>
);

export const LinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Svg>
);

export const CopyIcon = (props: IconProps) => (
  <Svg {...props}><rect x="8.5" y="8.5" width="11" height="11" /><path d="M15.5 8.5v-4h-11v11h4" /></Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4.5 12.5l5 5 10-11" /></Svg>
);

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const SendIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 12h15M13 5.5l6.5 6.5-6.5 6.5" /></Svg>
);

export const CodeIcon = (props: IconProps) => (
  <Svg {...props}><path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5" /></Svg>
);

export const ExternalIcon = (props: IconProps) => (
  <Svg {...props}><path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H4.5V7H10" /></Svg>
);

export const HistoryIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4.5v4h4M12 8v4l3 2" /></Svg>
);

export const UsersIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.4 2.3 4 4.7" />
  </Svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Svg {...props}><path d="M6 9l6 6 6-6" /></Svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}><path d="M9 6l6 6-6 6" /></Svg>
);

// The band: a spark.
export const SparkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M11 3c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5C8.1 9.9 10.4 7.6 11 3z" fill="currentColor" stroke="none" />
    <path d="M19 15.5c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3z" fill="currentColor" stroke="none" />
  </Svg>
);

export const HeadphonesIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3.5" y="14" width="4" height="6.5" /><rect x="16.5" y="14" width="4" height="6.5" /></Svg>
);

export const BoltIcon = (props: IconProps) => (
  <Svg {...props}><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /></Svg>
);

export const WaveIcon = (props: IconProps) => (
  <Svg {...props}><path d="M2 12c2-6 4-6 5 0s3 6 5 0 3-6 5 0 3 6 5 0" /></Svg>
);

export const AutopilotIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 11a7.5 7.5 0 0 1 13-4.5L19.5 8.5M19.5 4v4.5H15" />
    <path d="M19.5 13a7.5 7.5 0 0 1-13 4.5L4.5 15.5M4.5 20v-4.5H9" />
  </Svg>
);

// A low-pass filter curve.
export const FilterIcon = (props: IconProps) => (
  <Svg {...props}><path d="M2.5 8h9c3 0 4 2 5.5 6s2 5.5 4.5 5.5" /></Svg>
);

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);

export const WarningIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 3.5L21.5 20h-19z" /><path d="M12 10v4.5M12 17.25v.5" /></Svg>
);

export const InfoIcon = (props: IconProps) => (
  <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.5v.5" /></Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>
);

export const MixerIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 4v16M12 4v16M19 4v16" />
    <rect x="3" y="13" width="4" height="3" fill="currentColor" />
    <rect x="10" y="7" width="4" height="3" fill="currentColor" />
    <rect x="17" y="11" width="4" height="3" fill="currentColor" />
  </Svg>
);

export const ChatIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 4.5h16v11H9.5L4 19.5z" /></Svg>
);

export const RoomIcon = (props: IconProps) => (
  <Svg {...props}><path d="M3.5 20.5V9l8.5-5.5L20.5 9v11.5" /><path d="M9 20.5v-6h6v6" /></Svg>
);

export const ArrowUpIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 19.5v-15M5.5 11L12 4.5l6.5 6.5" /></Svg>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5" /></Svg>
);

// A step sequencer row: the groove.
export const StepsIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="9" width="3.5" height="6" fill="currentColor" stroke="none" />
    <rect x="8.5" y="9" width="3.5" height="6" />
    <rect x="14" y="9" width="3.5" height="6" fill="currentColor" stroke="none" />
    <rect x="19.5" y="9" width="1.5" height="6" />
  </Svg>
);

// A half-filled circle: a new colour or timbre.
export const ColourIcon = (props: IconProps) => (
  <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" /></Svg>
);

// Arcs that spread out: reverb and delay.
export const SpaceIcon = (props: IconProps) => (
  <Svg {...props}><path d="M5 12h.5M9 7.5a6 6 0 0 1 0 9M13 4.5a10 10 0 0 1 0 15M17.5 3a13 13 0 0 1 0 18" /></Svg>
);

// An arrow onto a floor: the drop.
export const DropIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 3.5v11M6.5 9.5l5.5 5.5 5.5-5.5M4 20h16" /></Svg>
);

// Segments of a bar: the phases of the set.
export const PhaseIcon = (props: IconProps) => (
  <Svg {...props}><path d="M3 8.5h4.5v7H3zM9.5 8.5h7v7h-7zM18.5 8.5H21v7h-2.5z" /><path d="M12.5 5v14" /></Svg>
);

export const WrenchIcon = (props: IconProps) => (
  <Svg {...props}><path d="M14.5 4a5 5 0 0 0-4.6 6.9L3.5 17.3l3.2 3.2 6.4-6.4A5 5 0 0 0 20 9.5l-3 3-3.5-1-1-3.5 3-3a5 5 0 0 0-1-1z" /></Svg>
);

// A light bulb: an idea.
export const BulbIcon = (props: IconProps) => (
  <Svg {...props}><path d="M9 18.5h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.6h5v-.6c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></Svg>
);

// Reactions to a version, in place of emoji.
export const FlameIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.6-8.8 2.3 1.5 3.4 3.6 3.4 5.6 1-.6 1.7-1.7 1.9-3 2 1.6 3.1 3.8 3.1 6.2 0 3.6-2.6 6.2-5.5 6.2z" /></Svg>
);

export const DanceIcon = (props: IconProps) => (
  <Svg {...props}><circle cx="13" cy="4.5" r="2" /><path d="M7 9.5l4-2 3 2.5 3.5-1M11 7.5l-1 6.5 3.5 3-1.5 4.5M10 14l-3.5 3-1 3.5" /></Svg>
);

export const SleepIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 9h6l-6 7h6M14 5h5l-5 6h5" /></Svg>
);

// All icons by name, for the style guide.
export const ICONS = {
  play: PlayIcon, pause: PauseIcon, stop: StopIcon, volume: VolumeIcon, volumeOff: VolumeOffIcon, link: LinkIcon, copy: CopyIcon,
  check: CheckIcon, close: CloseIcon, send: SendIcon, code: CodeIcon, external: ExternalIcon, history: HistoryIcon,
  users: UsersIcon, chevronDown: ChevronDownIcon, chevronRight: ChevronRightIcon, spark: SparkIcon,
  headphones: HeadphonesIcon, bolt: BoltIcon, wave: WaveIcon, autopilot: AutopilotIcon, filter: FilterIcon,
  clock: ClockIcon, warning: WarningIcon, info: InfoIcon, plus: PlusIcon, mixer: MixerIcon, chat: ChatIcon, room: RoomIcon,
  arrowUp: ArrowUpIcon, arrowDown: ArrowDownIcon, steps: StepsIcon, colour: ColourIcon, space: SpaceIcon, drop: DropIcon,
  phase: PhaseIcon, wrench: WrenchIcon, bulb: BulbIcon, flame: FlameIcon, dance: DanceIcon, sleep: SleepIcon,
} as const;
