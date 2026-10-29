import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { PublicLayout } from "@/components/discovery/layout";
import { discoverySearch } from "@/lib/discovery-search";
import { IndexPage } from "@/routes/index";
import { authSearch } from "@/lib/redirect";
import { redirectAuthenticated } from "@/lib/route-guards";
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
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    detailRoute,
    cartRoute,
    loginRoute,
    signupRoute,
  ]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
