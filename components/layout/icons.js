import {
  Bell,
  ChartColumn,
  CreditCard,
  Crown,
  House,
  KeyRound,
  LayoutDashboard,
  Layers,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Ticket,
  User,
  UserCog,
  Users,
} from "lucide-react";

// Server components pass icon *names* to client components (functions aren't serialisable).
export const ICONS = {
  home: House,
  dashboard: LayoutDashboard,
  ticket: Ticket,
  crown: Crown,
  card: CreditCard,
  receipt: ReceiptText,
  bell: Bell,
  user: User,
  users: Users,
  layers: Layers,
  tags: Tags,
  chart: ChartColumn,
  scroll: ScrollText,
  settings: Settings,
  shield: ShieldCheck,
  userCog: UserCog,
  key: KeyRound,
};

export function Icon({ name, className }) {
  const C = ICONS[name] || LayoutDashboard;
  return <C className={className} aria-hidden="true" />;
}
