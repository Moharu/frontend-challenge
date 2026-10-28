import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { IndexPage } from "@/routes/index";
const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p>This route does not exist.</p>
    </main>
  ),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
