import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { getPublicAppUrl } from "./config.server";
import { LANG_COOKIE, langFromCookieHeader, resolveLang } from "./lang-preference";

// Language for the first render: the server reads the request, so the HTML and
// the hydrated page agree and nothing switches language after load.
export const detectRequestLang = createIsomorphicFn()
  .server(() =>
    resolveLang({
      cookie: getCookie(LANG_COOKIE),
      acceptLanguage: getRequestHeader("accept-language"),
    }),
  )
  .client(() =>
    resolveLang({
      cookie: langFromCookieHeader(document.cookie),
      acceptLanguage: navigator.languages.join(","),
    }),
  );

// Absolute canonical/og:url base: the configured public origin on the server;
// the page origin when the root loader re-runs in the browser.
export const detectPublicOrigin = createIsomorphicFn()
  .server(() => getPublicAppUrl())
  .client(() => window.location.origin);
