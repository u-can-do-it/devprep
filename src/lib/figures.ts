// Figures that guides can embed. A guide places one with a fenced block whose language is
// `figure` and whose only line is the figure's key below (see README, "Guides").
// Plain data, free of DOM and Solid, so scripts/validate.ts can import it to check the names.

/** A grid of steps: one row per subject, one column per phase, read left to right. */
export interface StepGridFigure {
  /** Accessible name of the whole figure. */
  title: string;
  /** What a highlighted step means. */
  legend: string;
  columns: { title: string; tip: string }[];
  rows: {
    name: string;
    note: string;
    tip: string;
    /** One per column. */
    steps: { title: string; note: string; tip: string; highlight?: boolean }[];
  }[];
}

export const FIGURES: Record<string, StepGridFigure> = {
  'rendering-strategies': {
    title: 'Rendering strategies, step by step',
    legend: 'HTML is rendered in this step',
    columns: [
      {
        title: 'Build time',
        tip: 'Runs once, when you run next build, before any user exists. Whatever is rendered here is the same for everyone.',
      },
      {
        title: 'Each request',
        tip: 'Runs on the server every time someone asks for the page. Only here are cookies, headers and search params known.',
      },
      {
        title: 'Browser',
        tip: "Runs on the user's device after the response arrives. In every server-rendered strategy this step is the same: the HTML is painted and React hydrates only the Client Components. Server Components are never hydrated. The strategies differ in when the HTML was made, not in what is hydrated.",
      },
    ],
    rows: [
      {
        name: 'CSR',
        note: 'client-side',
        tip: 'Client-side rendering. The server only delivers files and the browser builds the whole page. A classic single-page app.',
        steps: [
          {
            title: 'Bundle JS',
            note: 'no HTML rendered',
            tip: 'The bundler compiles your components into JavaScript files. No component is executed, so no HTML with content exists yet.',
          },
          {
            title: 'Send empty page',
            note: 'HTML shell + JS',
            tip: 'The server returns the same near-empty HTML for every URL: a root div and script tags. Nothing is rendered on the server.',
          },
          {
            title: 'Render the DOM',
            note: 'no hydration',
            tip: 'React starts with createRoot, creates every DOM node, then fetches the data. Content appears only after the JavaScript has loaded. There is no server HTML, so nothing is hydrated.',
            highlight: true,
          },
        ],
      },
      {
        name: 'SSG',
        note: 'static',
        tip: 'Static site generation, also called prerendering. The page is rendered once and reused for every visitor.',
        steps: [
          {
            title: 'Render HTML',
            note: 'once, for everyone',
            tip: 'Next.js runs the components during next build and saves the HTML together with the RSC Payload. Every visitor gets this same output.',
            highlight: true,
          },
          {
            title: 'Serve saved HTML',
            note: 'from disk or CDN',
            tip: 'No rendering happens. The saved file is returned as it is, usually from a CDN, so the response is as fast as a static file.',
          },
          {
            title: 'Paint + hydrate',
            note: 'Client Components only',
            tip: 'The saved HTML is painted immediately. React then loads and hydrates only the Client Components. Server Components are never hydrated, here or in any other strategy.',
          },
        ],
      },
      {
        name: 'ISR',
        note: 'revalidated',
        tip: 'Incremental static regeneration. A static page that is re-rendered after the build, by time or on demand, without a redeploy.',
        steps: [
          {
            title: 'Render HTML',
            note: 'first version',
            tip: 'Same as SSG: the first version of the page is rendered at build time. Params not listed in generateStaticParams are rendered on their first visit instead.',
            highlight: true,
          },
          {
            title: 'Serve saved HTML',
            note: 're-render if stale',
            tip: 'The saved page is served. If it is past its revalidation window or its tag was invalidated, this request still gets the old page and triggers a re-render in the background.',
            highlight: true,
          },
          {
            title: 'Paint + hydrate',
            note: 'Client Components only',
            tip: 'Same as SSG: the HTML is painted and only the Client Components hydrate. The visitor who triggered the refresh may see slightly stale content; the next visitor gets the fresh version.',
          },
        ],
      },
      {
        name: 'SSR',
        note: 'per request',
        tip: 'Server-side rendering, called dynamic rendering in Next.js. The page is rendered again for every request.',
        steps: [
          {
            title: 'Bundle only',
            note: 'nothing rendered',
            tip: 'The code is compiled and bundled, but the route is not rendered, because its output depends on the request: cookies, headers or search params.',
          },
          {
            title: 'Render HTML',
            note: 'on every request',
            tip: 'The server fetches the data and renders the whole page for this one request. Without streaming, the response waits for the slowest query.',
            highlight: true,
          },
          {
            title: 'Paint + hydrate',
            note: 'Client Components only',
            tip: 'Exactly the same as SSG in the browser: the HTML is painted, then only the Client Components hydrate, and Server Components never do. The only difference is that this HTML was rendered for this request, so it is fresher and arrived later.',
          },
        ],
      },
      {
        name: 'Streaming',
        note: 'chunked SSR',
        tip: 'SSR sent in pieces. Suspense boundaries (or loading.tsx) mark the parts that may arrive later.',
        steps: [
          {
            title: 'Bundle only',
            note: 'nothing rendered',
            tip: 'Nothing is rendered ahead of time, exactly as with plain SSR.',
          },
          {
            title: 'Render in chunks',
            note: 'fallbacks first',
            tip: 'The server sends the HTML it has straight away, with Suspense fallbacks in place of the slow parts, and keeps the response open. Each part is appended when its data resolves.',
            highlight: true,
          },
          {
            title: 'Paint in chunks',
            note: 'hydrate chunk by chunk',
            tip: 'The shell is painted first. Later chunks swap into their fallbacks as they arrive, and React hydrates the Client Components of each Suspense boundary independently. Server Components are still never hydrated.',
          },
        ],
      },
      {
        name: 'PPR',
        note: 'partial',
        tip: 'Partial prerendering. Static and streaming in one response, and the default once Cache Components is enabled.',
        steps: [
          {
            title: 'Render the shell',
            note: 'static parts only',
            tip: 'Next.js renders until it reaches something that needs a request, and saves the result, including Suspense fallbacks, as the static shell. Content cached with "use cache" is part of it.',
            highlight: true,
          },
          {
            title: 'Stream the holes',
            note: 'dynamic parts only',
            tip: 'The shell is sent instantly, like a static page. In the same response the server renders only the dynamic holes and streams them in.',
            highlight: true,
          },
          {
            title: 'Shell first',
            note: 'holes stream in',
            tip: 'The static shell is painted at once, then the dynamic parts replace their fallbacks. Only the Client Components hydrate, as their chunks arrive.',
          },
        ],
      },
    ],
  },
};
