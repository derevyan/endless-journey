import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createRootRoute, ErrorComponent, Outlet } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { GeneralError } from "@/shared/components/errors/general-error";
import { NotFoundError } from "@/shared/components/errors/not-found-error";
import { ThemeProvider } from "@/providers/theme-provider";

import "../index.css";
import { setQueryClient } from "../stores/store-actions";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Set up query client reference for store actions (cache invalidation)
setQueryClient(queryClient);

// Production error component - clean UI for end users
function ProductionErrorComponent(_props: ErrorComponentProps) {
  return (
    <ThemeProvider>
      <GeneralError />
    </ThemeProvider>
  );
}

// Use TanStack's default ErrorComponent in development for better debugging
// Use our clean production component in production
const RouteErrorComponent = import.meta.env.DEV ? ErrorComponent : ProductionErrorComponent;

// Not found component - displayed when route doesn't exist
function NotFoundComponent() {
  return (
    <ThemeProvider>
      <NotFoundError />
    </ThemeProvider>
  );
}

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
        {/* {import.meta.env.DEV && <TanStackRouterDevtools />} */}
      </QueryClientProvider>
    </ThemeProvider>
  ),
  errorComponent: RouteErrorComponent,
  notFoundComponent: NotFoundComponent,
});
