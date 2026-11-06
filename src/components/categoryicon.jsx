import {
  Tag, ShoppingBag, Utensils, Car, Home, Zap, Plane, Heart, GraduationCap,
  Dumbbell, Gift, Wallet, PiggyBank, Briefcase, Clapperboard, Coffee,
  Smartphone, Wrench, Shirt, PawPrint, BookOpen, Bus, Fuel, Beer, Gamepad2, Music,
} from "lucide-react";

const ICONS = {
  Tag, ShoppingBag, Utensils, Car, Home, Zap, Plane, Heart, GraduationCap,
  Dumbbell, Gift, Wallet, PiggyBank, Briefcase, Clapperboard, Coffee,
  Smartphone, Wrench, Shirt, PawPrint, BookOpen, Bus, Fuel, Beer, Gamepad2, Music,
};

export const ICON_NAMES = Object.keys(ICONS);

function CategoryIcon({ name, className, style }) {
  const Icon = ICONS[name] || Tag;
  return <Icon className={className} style={style} />;
}

export { CategoryIcon };
export default CategoryIcon;