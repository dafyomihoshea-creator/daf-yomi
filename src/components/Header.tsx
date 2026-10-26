import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Heart, LogIn, LogOut, User, BarChart3, ListMusic, Calendar, MessageCircle, Menu, X, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

export function Header() {
  const { user, signOut } = useAuth();
  const { t, dir } = useLanguage();

  const navLinks = [
    { to: "/", label: t("nav.home"), icon: BookOpen },
    { to: "/browse", label: t("nav.browse"), icon: BookOpen },
    { to: "/calendar", label: t("nav.calendar"), icon: Calendar },
    { to: "/articles", label: t("nav.articles"), icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-primary text-primary-foreground">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
            <Link to="/admin" title={t("nav.admin")}>
              <BookOpen className="h-5 w-5 text-accent-foreground" />
            </Link>
          </div>
          <Link to="/" className="flex flex-col">
            <h1 className="font-display text-lg font-bold leading-tight">{t("header.title")}</h1>
            <p className="text-xs text-primary-foreground/70 font-body">{t("header.subtitle")}</p>
          </Link>
        </div>
        <nav className="flex items-center gap-2 md:gap-4">
          {/* Desktop nav links */}
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-body text-primary-foreground/80 hover:text-primary-foreground transition-colors hidden sm:block"
            >
              {link.label}
            </Link>
          ))}
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/my-lessons" className="flex items-center gap-2 font-body cursor-pointer">
                    <Heart className="h-4 w-4" />
                    {t("nav.myLessons")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/playlists" className="flex items-center gap-2 font-body cursor-pointer">
                    <ListMusic className="h-4 w-4" />
                    {t("nav.playlists")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/messages" className="flex items-center gap-2 font-body cursor-pointer">
                    <MessageCircle className="h-4 w-4" />
                    {t("nav.messages")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/stats" className="flex items-center gap-2 font-body cursor-pointer">
                    <BarChart3 className="h-4 w-4" />
                    {t("nav.stats")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center gap-2 font-body cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 font-body gap-1.5">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.login")}</span>
              </Button>
            </Link>
          )}
          <LanguageToggle />
          <ThemeToggle />

          {/* Mobile hamburger menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-64 p-0">
              <div className="flex flex-col py-6 px-4 gap-1" dir={dir}>
                <p className="font-display text-lg font-bold mb-4 px-2">{t("header.title")}</p>
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link
                      to={link.to}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body text-foreground hover:bg-accent/10 transition-colors"
                    >
                      <link.icon className="h-4 w-4 text-muted-foreground" />
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                {user && (
                  <>
                    <div className="border-t border-border my-2" />
                    <SheetClose asChild>
                      <Link to="/my-lessons" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body text-foreground hover:bg-accent/10 transition-colors">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        {t("nav.myLessons")}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/playlists" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body text-foreground hover:bg-accent/10 transition-colors">
                        <ListMusic className="h-4 w-4 text-muted-foreground" />
                        {t("nav.playlists")}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/messages" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body text-foreground hover:bg-accent/10 transition-colors">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        {t("nav.messages")}
                      </Link>
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}
