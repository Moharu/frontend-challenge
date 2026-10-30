import { Link } from "@tanstack/react-router";
import { useIdentity } from "@/data/session/identity";
import { toggleFavorite, useFavorites } from "@/data/account/hooks";
import { authLink } from "@/lib/redirect";
import { useReturnTarget } from "@/lib/return-target";
// The frame's heart (outline), filled when the NFT is a favorite.
const outline =
  "M10 18.89c-.28 0-.56-.1-.77-.29-.81-.71-1.59-1.37-2.28-1.96-2.01-1.72-3.75-3.2-4.96-4.66C.63 10.34 0 8.8 0 7.1c0-1.64.56-3.16 1.59-4.27C2.62 1.71 4.04 1.09 5.59 1.09c1.15 0 2.21.37 3.14 1.09.47.36.9.81 1.27 1.33.38-.52.8-.97 1.27-1.33.93-.72 1.99-1.09 3.14-1.09 1.55 0 2.97.62 4 1.74C19.44 3.94 20 5.46 20 7.1c0 1.7-.63 3.24-1.98 4.87-1.21 1.46-2.95 2.94-4.97 4.66-.69.59-1.47 1.25-2.28 1.96-.21.19-.49.29-.77.29Zm-4.41-16.62c-1.21 0-2.33.48-3.14 1.36C1.62 4.52 1.17 5.76 1.17 7.1c0 1.42.53 2.7 1.72 4.13 1.14 1.38 2.85 2.83 4.82 4.52.69.59 1.47 1.25 2.29 1.97.82-.71 1.6-1.38 2.29-1.97 1.97-1.68 3.68-3.13 4.82-4.52 1.19-1.43 1.72-2.7 1.72-4.13 0-1.35-.45-2.58-1.28-3.47-.81-.88-1.92-1.36-3.14-1.36-.89 0-1.7.28-2.43.84-.64.5-1.09 1.13-1.35 1.56a.74.74 0 0 1-1.27 0c-.26-.44-.71-1.06-1.35-1.56-.72-.56-1.54-.84-2.42-.84Z";
const filled =
  "M10 18.89c-.28 0-.56-.1-.77-.29-.81-.71-1.59-1.37-2.28-1.96-2.01-1.72-3.75-3.2-4.96-4.66C.63 10.34 0 8.8 0 7.1c0-1.64.56-3.16 1.59-4.27C2.62 1.71 4.04 1.09 5.59 1.09c1.15 0 2.21.37 3.14 1.09.47.36.9.81 1.27 1.33.38-.52.8-.97 1.27-1.33.93-.72 1.99-1.09 3.14-1.09 1.55 0 2.97.62 4 1.74C19.44 3.94 20 5.46 20 7.1c0 1.7-.63 3.24-1.98 4.87-1.21 1.46-2.95 2.94-4.97 4.66-.69.59-1.47 1.25-2.28 1.96-.21.19-.49.29-.77.29Z";
export function HeartIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d={on ? filled : outline} fill="currentColor" />
    </svg>
  );
}
// Favorite toggle (cards, related, recommendations and the detail). Signed
// out, it leads to the login and back to this page; the favorite is not
// applied automatically after signing in (the user clicks again).
export function FavoriteButton({
  nftId,
  name,
  className = "favorite",
  children,
}: {
  nftId: string;
  name: string;
  className?: string;
  children?: (on: boolean) => React.ReactNode;
}) {
  const identity = useIdentity();
  const target = useReturnTarget();
  const favorites = useFavorites();
  const on = favorites.data?.some((f) => f.nftId === nftId) ?? false;
  const content = children ? children(on) : <HeartIcon on={on} />;
  if (!identity.session)
    return (
      <Link
        className={className}
        {...authLink("login", target)}
        aria-label={`Favoritar ${name} (entre na sua conta)`}
      >
        {content}
      </Link>
    );
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={on ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      onClick={() => void toggleFavorite(nftId, name)}
    >
      {content}
    </button>
  );
}
