import { HINT_COOKIE } from "./session";

/**
 * Runs in the page's <head> (see the root layout), before anything is painted: when the "signed in" marker cookie (HINT_COOKIE) is there, it puts
 * `data-in` on <html>. The header links on the splash page are built once for everyone, so the CSS in globals.css shows the signed-in or the
 * signed-out version of each from that attribute, and a signed-in visitor never sees the wrong one. The server then confirms from the real session.
 * It lives in the layout (a server component) and not in the links themselves, because React warns about, and never runs, a script that a client
 * render creates.
 */
export const SIGNED_IN_HINT_SCRIPT = `(function(){try{if(/(^|; )${HINT_COOKIE}=1/.test(document.cookie))document.documentElement.setAttribute("data-in","")}catch(e){}})()`;
