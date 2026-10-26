import { MessageCircle, Send, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface ShareButtonsProps { url: string; title: string; summary?: string; }

export function ShareButtons({ url, title, summary }: ShareButtonsProps) {
  const { t } = useLanguage();
  const encodedUrl = encodeURIComponent(url);
  const whatsappText = encodeURIComponent(summary ? `${title}\n\n${summary}\n\n${url}` : `${title} ${url}`);

  const links = [
    { name: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${whatsappText}`, className: "hover:bg-green-600/10 hover:text-green-600" },
    { name: "Telegram", icon: Send, href: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(title)}`, className: "hover:bg-blue-500/10 hover:text-blue-500" },
    { name: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, className: "hover:bg-blue-700/10 hover:text-blue-700" },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground font-body">{t("lesson.share")}</span>
      {links.map((link) => (
        <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className={`h-8 w-8 text-muted-foreground ${link.className}`}><link.icon className="h-4 w-4" /></Button>
        </a>
      ))}
    </div>
  );
}
