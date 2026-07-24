import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchTrigger } from "@/components/app/search-trigger";
import { UserMenu } from "@/components/app/user-menu";

export function AppTopbar({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-lg sm:px-6">
      <div className="md:hidden">
        <Logo showWordmark={false} />
      </div>
      <div className="flex-1">
        <SearchTrigger />
      </div>
      <ThemeToggle />
      <UserMenu name={name} email={email} avatarUrl={avatarUrl} />
    </header>
  );
}
