import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import { PublicLayout } from "@/components/discovery/layout";
import { discoverySearch } from "@/lib/discovery-search";
import { IndexPage } from "@/routes/index";
import { authSearch } from "@/lib/redirect";
import { checkoutSearch } from "@/lib/checkout-search";
import { redirectAuthenticated, requireSession } from "@/lib/route-guards";
import { SessionCheckError } from "@/components/discovery/session-check";
const rootRoute = createRootRoute({
  component: PublicLayout,
  notFoundComponent: () => (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p>Esta rota não existe.</p>
      <Link to="/" search={discoverySearch({})}>
        Voltar ao catálogo
      </Link>
    </main>
  ),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
  validateSearch: discoverySearch,
});
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nfts/$nftId",
  component: lazyRouteComponent(() => import("@/routes/nft"), "NftPage"),
});
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: lazyRouteComponent(() => import("@/routes/cart"), "CartPage"),
});
// The first private route: the guard waits for the stored session, sends
// anonymous users to the login (returning here) and shows a retry state when
// the session could not be confirmed. `step` is the mobile flow's step.
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkout",
  validateSearch: checkoutSearch,
  beforeLoad: requireSession,
  errorComponent: SessionCheckError,
  component: lazyRouteComponent(
    () => import("@/routes/checkout"),
    "CheckoutPage",
  ),
});
// The order page (pending, confirmed with the receipt, or declined): a real
// route, so it survives refresh and a new login.
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId",
  beforeLoad: requireSession,
  errorComponent: SessionCheckError,
  component: lazyRouteComponent(() => import("@/routes/order"), "OrderPage"),
});
// Collector account: one protected layout (sidebar on desktop, disclosure on
// mobile) with a real URL per section. The sections outside this version are
// honest pages inside the same layout.
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  beforeLoad: requireSession,
  errorComponent: SessionCheckError,
  component: lazyRouteComponent(
    () => import("@/routes/account"),
    "AccountLayout",
  ),
});
const accountIndexRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/account/profile", replace: true });
  },
});
const accountSection = <P extends string>(
  path: P,
  load: () => Promise<Record<string, React.ComponentType>>,
  name: string,
) =>
  createRoute({
    getParentRoute: () => accountRoute,
    path,
    component: lazyRouteComponent(load, name),
  });
const accountRoutes = [
  accountIndexRoute,
  accountSection(
    "profile",
    () => import("@/routes/account-profile"),
    "ProfilePage",
  ),
  accountSection(
    "wallets",
    () => import("@/routes/account-wallets"),
    "WalletsPage",
  ),
  accountSection(
    "favorites",
    () => import("@/routes/account"),
    "FavoritesPage",
  ),
  accountSection("activity", () => import("@/routes/account"), "ActivityPage"),
  accountSection("offers", () => import("@/routes/account"), "OffersPage"),
  accountSection(
    "downloads",
    () => import("@/routes/account"),
    "DownloadsPage",
  ),
  accountSection("support", () => import("@/routes/account"), "SupportPage"),
];
// Login and signup have real URLs; the target travels in a validated param.
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: authSearch,
  beforeLoad: redirectAuthenticated,
  component: lazyRouteComponent(() => import("@/routes/auth"), "LoginPage"),
});
const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  validateSearch: authSearch,
  beforeLoad: redirectAuthenticated,
  component: lazyRouteComponent(() => import("@/routes/auth"), "SignupPage"),
});
// Integration build only: a protected route that exercises `requireSession`
// before the first real private route (checkout) exists. The flag is replaced
// at build time, so the normal build drops this route entirely.
const testRoutes =
  import.meta.env.VITE_ENABLE_TEST_HARNESS === "true"
    ? [
        createRoute({
          getParentRoute: () => rootRoute,
          path: "/__private",
          beforeLoad: requireSession,
          errorComponent: SessionCheckError,
          component: () => (
            <main id="main">
              <h1>Área privada de teste</h1>
            </main>
          ),
        }),
      ]
    : [];
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    detailRoute,
    cartRoute,
    checkoutRoute,
    orderRoute,
    accountRoute.addChildren(accountRoutes),
    loginRoute,
    signupRoute,
    ...testRoutes,
  ]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
