import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { ROUTES } from "../../lib/routes.ts";
import { buttonClass, EmptyState } from "../../lib/ui/index.ts";

/** Friendly fallback for unknown URLs and failed route loads. */
export function NotFoundPage() {
  return (
    <EmptyState
      title="Seite nicht gefunden"
      description="Diese Adresse gibt es in codes nicht."
      action={
        <Link to={ROUTES.scan} className={buttonClass()}>
          Zum Scanner
        </Link>
      }
    />
  );
}

export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-fg">
      <EmptyState
        title="Etwas ist schiefgelaufen"
        description="Die Seite konnte nicht geladen werden. Nach einem App-Update hilft meist ein Neuladen."
        action={
          <button type="button" className={buttonClass()} onClick={() => window.location.reload()}>
            Neu laden
          </button>
        }
      />
    </div>
  );
}
