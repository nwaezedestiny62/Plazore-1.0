import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  Flag,
  LayoutGrid,
  Mail,
  Megaphone,
  Package,
  Percent,
  Repeat,
  Sparkles,
  Shield,
  Truck,
  Users,
  Coins,
} from "lucide-react";

const MAP = {
  users: Users,
  package: Package,
  truck: Truck,
  coins: Coins,
  shield: Shield,
  flag: Flag,
  mail: Mail,
  layout: LayoutGrid,
  spark: Sparkles,
  chart: BarChart3,
  activity: Activity,
  card: CreditCard,
  repeat: Repeat,
  percent: Percent,
  file: FileText,
  megaphone: Megaphone,
} as const;

export function TvIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = MAP[name as keyof typeof MAP] ?? LayoutGrid;
  return <Icon className={className ?? "h-6 w-6"} />;
}