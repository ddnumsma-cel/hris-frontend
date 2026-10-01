import type { SVGProps } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CircleCheck,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Fingerprint,
  Flag,
  FileQuestion,
  FileText,
  Folder,
  GraduationCap,
  HeartPulse,
  History,
  Home,
  IdCard,
  Inbox,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  LogOut,
  Menu,
  Moon,
  Network,
  Pencil,
  Plus,
  Search,
  SearchX,
  Settings,
  UserCheck,
  ShieldCheck,
  Sun,
  Trash2,
  RotateCw,
  Undo2,
  Upload,
  Share2,
  User,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

// Every icon in this app renders at a slightly thinner stroke (1.7) than
// Lucide's default (2) to match the design system's line weight.
const strokeWidth = 1.7;

export function GridIcon(props: IconProps) {
  return <LayoutGrid strokeWidth={strokeWidth} {...props} />;
}

export function CalendarIcon(props: IconProps) {
  return <Calendar strokeWidth={strokeWidth} {...props} />;
}

export function WalletIcon(props: IconProps) {
  return <Wallet strokeWidth={strokeWidth} {...props} />;
}

export function FolderIcon(props: IconProps) {
  return <Folder strokeWidth={strokeWidth} {...props} />;
}

export function FileIcon(props: IconProps) {
  return <FileText strokeWidth={strokeWidth} {...props} />;
}

export function ClockIcon(props: IconProps) {
  return <Clock strokeWidth={strokeWidth} {...props} />;
}

export function UsersIcon(props: IconProps) {
  return <Users strokeWidth={strokeWidth} {...props} />;
}

export function CheckSquareIcon(props: IconProps) {
  return <CheckSquare strokeWidth={strokeWidth} {...props} />;
}

export function BuildingIcon(props: IconProps) {
  return <Building2 strokeWidth={strokeWidth} {...props} />;
}

export function ShieldIcon(props: IconProps) {
  return <ShieldCheck strokeWidth={strokeWidth} {...props} />;
}

export function UserPlusIcon(props: IconProps) {
  return <UserPlus strokeWidth={strokeWidth} {...props} />;
}

export function BellIcon(props: IconProps) {
  return <Bell strokeWidth={strokeWidth} {...props} />;
}

export function SearchIcon(props: IconProps) {
  return <Search strokeWidth={strokeWidth} {...props} />;
}

export function ChevronDownIcon(props: IconProps) {
  return <ChevronDown strokeWidth={strokeWidth} {...props} />;
}

export function ChevronLeftIcon(props: IconProps) {
  return <ChevronLeft strokeWidth={strokeWidth} {...props} />;
}

export function ChevronRightIcon(props: IconProps) {
  return <ChevronRight strokeWidth={strokeWidth} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <Check strokeWidth={strokeWidth} {...props} />;
}

export function CheckCircleIcon(props: IconProps) {
  return <CircleCheck strokeWidth={strokeWidth} {...props} />;
}

export function XIcon(props: IconProps) {
  return <X strokeWidth={strokeWidth} {...props} />;
}

export function ArrowRightIcon(props: IconProps) {
  return <ArrowRight strokeWidth={strokeWidth} {...props} />;
}

export function AlertTriangleIcon(props: IconProps) {
  return <AlertTriangle strokeWidth={strokeWidth} {...props} />;
}

export function PersonIcon(props: IconProps) {
  return <User strokeWidth={strokeWidth} {...props} />;
}

export function HomeIcon(props: IconProps) {
  return <Home strokeWidth={strokeWidth} {...props} />;
}

export function CameraIcon(props: IconProps) {
  return <Camera strokeWidth={strokeWidth} {...props} />;
}

export function LogOutIcon(props: IconProps) {
  return <LogOut strokeWidth={strokeWidth} {...props} />;
}

export function SunIcon(props: IconProps) {
  return <Sun strokeWidth={strokeWidth} {...props} />;
}

export function MoonIcon(props: IconProps) {
  return <Moon strokeWidth={strokeWidth} {...props} />;
}

export function FingerprintIcon(props: IconProps) {
  return <Fingerprint strokeWidth={strokeWidth} {...props} />;
}

export function BriefcaseIcon(props: IconProps) {
  return <Briefcase strokeWidth={strokeWidth} {...props} />;
}

export function GraduationCapIcon(props: IconProps) {
  return <GraduationCap strokeWidth={strokeWidth} {...props} />;
}

export function FlagIcon(props: IconProps) {
  return <Flag strokeWidth={strokeWidth} {...props} />;
}

export function BarChartIcon(props: IconProps) {
  return <BarChart3 strokeWidth={strokeWidth} {...props} />;
}

export function EditIcon(props: IconProps) {
  return <Pencil strokeWidth={strokeWidth} {...props} />;
}

export function TrashIcon(props: IconProps) {
  return <Trash2 strokeWidth={strokeWidth} {...props} />;
}

export function UserMinusIcon(props: IconProps) {
  return <UserMinus strokeWidth={strokeWidth} {...props} />;
}

export function OrgChartIcon(props: IconProps) {
  return <Network strokeWidth={strokeWidth} {...props} />;
}

export function DownloadIcon(props: IconProps) {
  return <Download strokeWidth={strokeWidth} {...props} />;
}

export function InboxIcon(props: IconProps) {
  return <Inbox strokeWidth={strokeWidth} {...props} />;
}

export function SearchXIcon(props: IconProps) {
  return <SearchX strokeWidth={strokeWidth} {...props} />;
}

export function FileQuestionIcon(props: IconProps) {
  return <FileQuestion strokeWidth={strokeWidth} {...props} />;
}

export function UploadIcon(props: IconProps) {
  return <Upload strokeWidth={strokeWidth} {...props} />;
}

export function IdCardIcon(props: IconProps) {
  return <IdCard strokeWidth={strokeWidth} {...props} />;
}

export function HeartPulseIcon(props: IconProps) {
  return <HeartPulse strokeWidth={strokeWidth} {...props} />;
}

export function PlusIcon(props: IconProps) {
  return <Plus strokeWidth={strokeWidth} {...props} />;
}

export function HistoryIcon(props: IconProps) {
  return <History strokeWidth={strokeWidth} {...props} />;
}

export function LoaderIcon(props: IconProps) {
  return <Loader2 strokeWidth={strokeWidth} {...props} />;
}

export function MenuIcon(props: IconProps) {
  return <Menu strokeWidth={strokeWidth} {...props} />;
}

export function LockIcon(props: IconProps) {
  return <Lock strokeWidth={strokeWidth} {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <Settings strokeWidth={strokeWidth} {...props} />;
}

export function UserCheckIcon(props: IconProps) {
  return <UserCheck strokeWidth={strokeWidth} {...props} />;
}

export function MailIcon(props: IconProps) {
  return <Mail strokeWidth={strokeWidth} {...props} />;
}

export function MapPinIcon(props: IconProps) {
  return <MapPin strokeWidth={strokeWidth} {...props} />;
}

export function MoreVerticalIcon(props: IconProps) {
  return <MoreVertical strokeWidth={strokeWidth} {...props} />;
}

export function PhoneIcon(props: IconProps) {
  return <Phone strokeWidth={strokeWidth} {...props} />;
}

export function ListIcon(props: IconProps) {
  return <List strokeWidth={strokeWidth} {...props} />;
}

export function ReturnIcon(props: IconProps) {
  return <Undo2 strokeWidth={strokeWidth} {...props} />;
}

export function RefreshIcon(props: IconProps) {
  return <RotateCw strokeWidth={strokeWidth} {...props} />;
}

export function ShareIcon(props: IconProps) {
  return <Share2 strokeWidth={strokeWidth} {...props} />;
}
