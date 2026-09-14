/**
 * The application's icon vocabulary, on top of lucide (shadcn's icon set).
 *
 * Two reasons this is a named map rather than direct lucide imports at every
 * call site. It fixes the meaning of an icon — `Icon.Sold` is a gavel
 * everywhere, and changing that is one line here — and it defaults the size to
 * 16px, which is the size this UI uses almost everywhere; lucide defaults to 24.
 *
 * lucide ships as bundled SVG components, so nothing is fetched at runtime.
 */
import {
  Activity, AlarmClock, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Ban, Bell, BookOpen, Bug, Calendar,
  Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, ChevronsUpDown, CircleAlert, CircleCheck,
  CircleHelp, CircleX, ClipboardList, Clock, Code, Coins, Copy, Cpu, Database, Dot, Download, Ellipsis, ExternalLink,
  Eye, EyeOff, FileCode, FileText, Filter, Flag, FolderOpen, Gavel, GraduationCap, GripVertical, Hash, Inbox, Info,
  Key, Layers, LayoutGrid, Lightbulb, Link2, List, ListChecks, LoaderCircle, Lock, LogOut, Maximize2, Medal, Megaphone,
  Menu, Minimize2, Package, PanelLeft, Pause, Pencil, Percent, Play, Plus, Puzzle, RefreshCw, RotateCcw, Save, Scale, Search,
  Send, Server, Settings, Shield, ShieldCheck, Sparkles, Square, SquareCheck, Target, Terminal, Timer, TrendingUp,
  TriangleAlert, Trash2, Trophy, Undo2, Unlock, Upload, UserPlus, UserX, Users, Wallet, Wifi, WifiOff, X, Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type IconProps = React.ComponentProps<LucideIcon> & { size?: number };

/** Default to 16px and hide from assistive tech — an icon beside a label is decoration. */
const at = (C: LucideIcon, extra?: string) =>
  function Ico({ size = 16, className, ...p }: IconProps) {
    return <C size={size} aria-hidden className={cn(extra, className)} {...p} />;
  };

export const Icon = {
  // verdicts and outcomes
  Check: at(Check),
  CheckAll: at(CheckCheck),
  X: at(X),
  Alert: at(TriangleAlert),
  Info: at(Info),
  Help: at(CircleHelp),
  CircleCheck: at(CircleCheck),
  CircleAlert: at(CircleAlert),
  CircleX: at(CircleX),
  Dot: at(Dot),

  // the contest
  Trophy: at(Trophy),
  Medal: at(Medal),
  Gavel: at(Gavel),
  Coins: at(Coins),
  Wallet: at(Wallet),
  Puzzle: at(Puzzle),
  Bug: at(Bug),
  Code: at(Code),
  FileCode: at(FileCode),
  Flag: at(Flag),
  Scale: at(Scale),
  Target: at(Target),
  Graduation: at(GraduationCap),
  Spark: at(Sparkles),

  // time
  Clock: at(Clock),
  Timer: at(Timer),
  Alarm: at(AlarmClock),
  Calendar: at(Calendar),
  Pause: at(Pause),
  Play: at(Play),

  // navigation and chrome
  Grid: at(LayoutGrid),
  Menu: at(Menu),
  More: at(Ellipsis),
  Panel: at(PanelLeft),
  ChevronLeft: at(ChevronLeft),
  ChevronRight: at(ChevronRight),
  ChevronDown: at(ChevronDown),
  ChevronUp: at(ChevronUp),
  ChevronsLeft: at(ChevronsLeft),
  ChevronsRight: at(ChevronsRight),
  ChevronsUpDown: at(ChevronsUpDown),
  ArrowLeft: at(ArrowLeft),
  ArrowRight: at(ArrowRight),
  ArrowUp: at(ArrowUp),
  ArrowDown: at(ArrowDown),
  Sort: at(ArrowUpDown),
  External: at(ExternalLink),
  Link: at(Link2),
  Expand: at(Maximize2),
  Collapse: at(Minimize2),

  // actions
  Plus: at(Plus),
  Edit: at(Pencil),
  Trash: at(Trash2),
  Save: at(Save),
  Copy: at(Copy),
  Send: at(Send),
  Upload: at(Upload),
  Download: at(Download),
  Refresh: at(RefreshCw),
  Undo: at(Undo2),
  Reset: at(RotateCcw),
  Search: at(Search),
  Filter: at(Filter),
  Spinner: at(LoaderCircle, "animate-spin"),

  // people and access
  Users: at(Users),
  UserPlus: at(UserPlus),
  UserBan: at(UserX),
  Ban: at(Ban),
  Lock: at(Lock),
  Unlock: at(Unlock),
  Key: at(Key),
  Shield: at(Shield),
  ShieldCheck: at(ShieldCheck),
  Logout: at(LogOut),
  Settings: at(Settings),

  // content and monitoring
  Bell: at(Bell),
  Megaphone: at(Megaphone),
  List: at(List),
  ListChecks: at(ListChecks),
  Clipboard: at(ClipboardList),
  Inbox: at(Inbox),
  File: at(FileText),
  Folder: at(FolderOpen),
  Package: at(Package),
  Layers: at(Layers),
  Server: at(Server),
  Activity: at(Activity),
  Database: at(Database),
  Cpu: at(Cpu),
  Terminal: at(Terminal),
  Hash: at(Hash),
  Percent: at(Percent),
  Trend: at(TrendingUp),
  Book: at(BookOpen),
  Lightbulb: at(Lightbulb),
  Eye: at(Eye),
  EyeOff: at(EyeOff),
  Wifi: at(Wifi),
  WifiOff: at(WifiOff),
  Zap: at(Zap),
  Grip: at(GripVertical),
  Square: at(Square),
  SquareCheck: at(SquareCheck),
};
