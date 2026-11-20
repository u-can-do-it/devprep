# Next.js Interview Handbook

For a developer who knows React well and has shipped Next.js apps, but gets caught by the "simple" questions: what hydration is, why a component that renders on the server is still a Client Component, why data is stale. Each chapter explains the mechanism first, shows code, then lists the traps and a short answer you can say out loud.

Written against **Next.js 16.4** (November 2026), App Router first. Where Next.js 13 to 15 or the Pages Router behave differently, the text says so, because the interviewer usually asks about the version their own codebase runs.

Three kinds of callout appear throughout: **Trap** marks a common wrong answer, **Say it like this** is a model answer of interview length, and **Docs** links to the official pages the section is based on.

## How to use this guide

Read chapters 2 to 4 in order: rendering, hydration and the server/client split build on each other, and most trap questions come from mixing them up. The rest can be read in any order. Chapter 14 is a quick-fire list for the evening before, and chapter 15 is a glossary.

### Five sentences that carry most answers

1. Next.js is a server and a build tool in front of React. It decides **where** each component runs, **when** it renders, and **how long** the result is kept.
2. "Server-rendered" describes how the HTML was produced. "Server Component" describes where the component's code runs. Client Components are server-rendered too.
3. Hydration applies only to Client Components that arrived as HTML. React runs them again in the browser and attaches event handlers to the DOM that is already there.
4. Static versus dynamic is about **when** rendering happens: at build time (or revalidation) versus on each request. Reading request data such as cookies, headers or search params is what pushes work to request time.
5. Caching is several separate layers: per-request memoization, the server's data cache, prerendered output, and the browser's router cache. "Why is my data stale?" always means "which layer?".

If you can expand each of these for two minutes, you can handle most of a Next.js interview.

### Ask which version first

Defaults have flipped between major versions, so the correct answer to a caching or API question depends on the version. Asking "which version, and is it the App Router?" is a strong opening, not a stall.

| Version | What changed that interviewers ask about |
|---|---|
| 13 (2022) | App Router, Server Components, nested layouts, streaming. `fetch` cached by default. |
| 14 (2023) | Server Actions stable. Same cache-by-default behaviour. |
| 15 (2024) | `fetch`, `GET` Route Handlers and client-side page data are no longer cached by default. `params`, `searchParams`, `cookies()` and `headers()` become async. React 19. |
| 16 (2025) | Cache Components (`'use cache'`, Partial Prerendering). `middleware.ts` renamed to `proxy.ts`. Turbopack is the default bundler. Synchronous request APIs removed. `revalidateTag` needs a second argument; `updateTag` and `refresh` added. |
| 16.x (2026) | Partial Prefetching, `retry()` in error boundaries, `catchError`. |

There are also two caching models in Next.js 16, and a codebase uses one or the other:

- **Cache Components** (`cacheComponents: true` in `next.config.ts`): the current model, on by default in new `create-next-app` projects. You cache with the `'use cache'` directive and the page is partially prerendered.
- **The previous model** (flag off): what most existing apps still run. You cache with `fetch` options, `unstable_cache` and route segment config such as `export const revalidate = 60`.

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
```

> **Trap.** Answering "Next.js caches every `fetch` by default". That was true in 13 and 14 and has been false since 15. Say which version you mean.

> **Docs.** [Upgrading to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) · [Upgrading to version 15](https://nextjs.org/docs/app/guides/upgrading/version-15) · [Caching](https://nextjs.org/docs/app/getting-started/caching) · [Caching (previous model)](https://nextjs.org/docs/app/guides/caching-without-cache-components)

## Rendering: where and when HTML is made

Every rendering question reduces to two axes: **where** the HTML is produced (server or browser) and **when** (build time, request time, or in the background after a cache expires).

### The strategies in one table

| Strategy | HTML produced | When | Browser receives | Typical use |
|---|---|---|---|---|
| CSR (client-side rendering) | In the browser | After the JS loads | An empty `<div>` and JS | Tools behind a login, classic SPAs |
| SSG (static, prerendering) | On the server | At build time | Complete HTML | Marketing pages, docs, blogs |
| ISR (incremental static regeneration) | On the server | At build, then again in the background after revalidation | Complete HTML, possibly slightly stale | Catalogs, CMS content |
| SSR (dynamic rendering) | On the server | On every request | Complete HTML | Personalized pages |
| Streaming SSR | On the server | On every request, in chunks | A shell first, the rest as it resolves | Pages with slow data |
| PPR (partial prerendering) | On the server | Shell at build time, holes at request time | A static shell instantly, then streamed holes | Mostly static pages with personalized parts |

Everything except CSR sends real HTML, so everything except CSR needs [hydration](#hydration) for its interactive parts.

> **Say it like this.** "SSG renders once at build time, SSR renders on every request, ISR is SSG that re-renders in the background after a time window or an explicit invalidation. Streaming sends the SSR response in chunks behind Suspense boundaries, and PPR combines them: a static shell from the build with dynamic holes streamed per request."

### What the browser receives on the first load

On a direct visit to an App Router page the response contains three things:

1. **HTML**, so the user sees content before any JavaScript runs.
2. **The RSC Payload**, a serialized description of the rendered Server Component tree. On the first load it is inlined into the HTML as script tags.
3. **References to JavaScript chunks** for the Client Components on the page.

```html
<!-- simplified first response -->
<main>
  <h1>Hello</h1>
  <button>♡ 12</button>
</main>
<script>self.__next_f.push([1, "…RSC Payload chunk…"])</script>
<script src="/_next/static/chunks/app/page-3f2a.js" async></script>
```

The browser then paints the HTML, React uses the payload to rebuild the component tree, and the JavaScript hydrates the Client Components.

On a later **client-side navigation** (clicking a `<Link>`), there is no HTML at all. The router fetches only the RSC Payload for the segments that changed, React updates the DOM from it, and any Client Components on the new page render in the browser from scratch.

> **Trap.** "Next.js sends HTML on every navigation." Only the first document request returns HTML. After that the app behaves like an SPA that fetches RSC Payloads.

> **Docs.** [Server and Client Components: how they work](https://nextjs.org/docs/app/getting-started/server-and-client-components#how-do-server-and-client-components-work-in-nextjs) · [Linking and navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

### Server-rendered is not the same as Server Component

This is the single most common confusion, and interviewers probe it on purpose.

| | Runs on the server | Runs in the browser |
|---|---|---|
| **Server Component** | Yes | No |
| **Client Component** | Yes (to produce HTML on a direct visit) | Yes |

"Client" means the component **also** runs in the browser. It does not mean "only in the browser". Rendering Client Components to HTML on the server is plain SSR and existed long before Server Components.

```tsx
'use client';

export function Hello() {
  // On a direct visit this logs twice:
  // once in the terminal (server render), once in the browser console (hydration).
  console.log('Hello rendered');
  return <p>Hello</p>;
}
```

> **Say it like this.** "SSR is a technique: produce HTML on the server. A Server Component is a kind of component whose code never ships to the browser. Client Components are still server-rendered on the first load, then hydrated."

> **Docs.** [The server and client boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)

### Static and dynamic rendering

**Previous model (route level).** A route is static by default: rendered at build time and reused. The whole route becomes dynamic, rendered on every request, as soon as anything in its layouts or page uses a request-time API:

- `cookies()`, `headers()`, `draftMode()`, `connection()`
- the `searchParams` prop of a page
- a `fetch` with `cache: 'no-store'` or `next: { revalidate: 0 }`
- `export const dynamic = 'force-dynamic'`

One `cookies()` call in a root layout therefore makes every page under it dynamic.

**Cache Components (component level).** There is no route-wide switch. Next.js prerenders everything that can finish at build time into a static shell. A component that reads request data or awaits uncached data must either sit inside `<Suspense>` (it streams at request time) or be cached with `'use cache'` (it joins the shell). If it does neither, you get an error instead of a silently slow page.

`next build` prints which mode each route ended up in:

```text
Route (app)
┌ ○ /                   static
├ ● /blog/[slug]        static, from generateStaticParams
├ ◐ /products/[id]      partial prerender
└ ƒ /dashboard          dynamic, rendered on demand
```

> **Trap.** Testing caching or static behaviour in `next dev`. In development every page renders on demand on every request, so "it works on my machine" says nothing. Check with `next build && next start`.

> **Docs.** [Rendering philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) · [Caching (previous model): `dynamic`](https://nextjs.org/docs/app/guides/caching-without-cache-components#dynamic)

### Streaming and Suspense

Without streaming, the server waits for the slowest query before it sends anything. With streaming it sends the HTML it has, with each `<Suspense>` fallback in place of the slow part, and keeps the same HTTP response open. When a suspended component resolves, the server appends its HTML plus a tiny inline script that swaps it into the fallback's position.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading revenue…</p>}>
        <Revenue /> {/* slow: streams in later */}
      </Suspense>
      <Suspense fallback={<p>Loading orders…</p>}>
        <Orders /> {/* independent: arrives whenever it is ready */}
      </Suspense>
    </>
  );
}

async function Revenue() {
  const revenue = await getRevenue(); // 2 seconds
  return <p>{revenue}</p>;
}
```

A `loading.tsx` file is the same mechanism: Next.js wraps the page in a `<Suspense>` boundary with that file as the fallback.

> **Trap.** The status code is sent before the stream body. Once a fallback has been flushed the response is already `200 OK`, so a `notFound()` or `redirect()` that runs later cannot change it. Next.js renders the not-found UI and adds `<meta name="robots" content="noindex">`, or performs the redirect on the client. If you need a real `404` or `307`, decide before the first Suspense boundary, or in `proxy.ts`.

> **Trap.** Streaming needs every hop to pass chunks through. A reverse proxy that buffers responses (nginx by default) turns streaming back into "wait for everything".

> **Docs.** [Streaming](https://nextjs.org/docs/app/guides/streaming) · [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading)

### Partial Prerendering

Partial Prerendering (PPR) is static rendering and streaming in the same response. At build time Next.js renders the route until it hits something that needs a request, and saves the result, including the Suspense fallbacks, as a **static shell**. At request time the shell is sent immediately (it can come from a CDN) and the server streams the holes.

```tsx
// app/page.tsx  (cacheComponents: true)
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { cacheLife } from 'next/cache';

export default function Page() {
  return (
    <>
      <h1>Shop</h1>                   {/* static: part of the shell */}
      <FeaturedProducts />            {/* cached: part of the shell */}
      <Suspense fallback={<p>Loading cart…</p>}>
        <CartSummary />               {/* reads cookies: streamed per request */}
      </Suspense>
    </>
  );
}

async function FeaturedProducts() {
  'use cache';
  cacheLife('hours');
  const products = await db.product.findMany({ where: { featured: true } });
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}

async function CartSummary() {
  const cartId = (await cookies()).get('cart')?.value;
  const cart = await getCart(cartId);
  return <p>{cart.items.length} items</p>;
}
```

PPR was an experimental flag in Next.js 14 and 15. In 16 that flag is gone, and PPR is simply how rendering works once Cache Components is enabled.

> **Say it like this.** "With PPR the Suspense boundary is the line between static and dynamic. Everything outside the boundaries, plus the fallbacks, is prerendered and served instantly. What is inside streams in per request."

> **Docs.** [Caching: prerendering](https://nextjs.org/docs/app/getting-started/caching#prerendering) · [Optimizing the static shell](https://nextjs.org/docs/app/guides/optimizing-the-static-shell)

## Hydration

If you have only ever written components and watched them work, this is the chapter that closes the gap.

### What hydration is

A server-rendered page arrives as HTML that looks finished but does nothing: no click handlers, no state, no effects. Hydration is the step that turns it into a running React app.

1. The server renders the Client Components to HTML.
2. The browser paints that HTML. The page is visible but inert.
3. The JavaScript for the Client Components downloads.
4. React calls those components again in the browser and, instead of creating DOM nodes, walks the existing DOM and matches each node to what it just rendered.
5. React attaches event handlers, wires up state, and runs effects (`useEffect`, `useLayoutEffect`).

After step 5 it is an ordinary React app.

```tsx
import { createRoot, hydrateRoot } from 'react-dom/client';

// CSR: the container is empty, React creates every DOM node.
createRoot(document.getElementById('root')!).render(<App />);

// SSR: the container already holds server HTML, React adopts it.
hydrateRoot(document.getElementById('root')!, <App />);
```

Next.js makes the `hydrateRoot` call for you, which is why you can ship apps for years without thinking about it.

> **Say it like this.** "Hydration is React taking over server-rendered HTML. It renders the Client Components again in the browser, matches the output to the DOM that is already there instead of recreating it, attaches event handlers and runs effects."

> **Docs.** [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) · [Next.js glossary: hydration](https://nextjs.org/docs/app/glossary#hydration)

### What gets hydrated and what does not

| Situation | Hydration? | Why |
|---|---|---|
| Server Component | Never | Its code is not in the browser. There is nothing to run and nothing to attach. |
| Client Component, first page load | Yes | It arrived as HTML and needs handlers and state. |
| Client Component, after a `<Link>` navigation | No | There is no server HTML for it. It renders in the browser from scratch, like in an SPA. |
| Pure CSR app (Vite SPA) | No | The DOM is created by `createRoot`. There is nothing to adopt. |
| Pages Router page | Yes, the whole page | Every component there is a client component in today's terms. |

For Server Components React still needs to know the shape of the tree, which is what the RSC Payload is for. React reads it to rebuild the tree and find the slots where Client Components live, then hydrates only those slots.

```tsx
// app/post/[id]/page.tsx (Server Component)
export default async function Page({ params }: PageProps<'/post/[id]'>) {
  const { id } = await params;
  const post = await getPost(id);
  return (
    <article>
      <h1>{post.title}</h1>            {/* static HTML, never hydrated */}
      <LikeButton likes={post.likes} /> {/* the only hydrated part */}
    </article>
  );
}
```

> **Trap.** "The component is rendered on the server, so why does React attach events to it?" The description of hydration ("React renders the components again and attaches handlers") is about Client Components. A Server Component cannot have an `onClick` in the first place.

### Why hydration has a cost

- **Double work.** The component code ships to the browser and runs a second time to rebuild what the server already produced.
- **The inert gap.** Between paint and the end of hydration the page looks ready but does not respond. Long hydration shows up as poor INP and total blocking time.
- **Double data.** The data is sent once as HTML and again as serialized props so the client render can produce the same result.

This is the real argument for Server Components: code that only produces markup never ships and never hydrates. It is also why you keep `'use client'` boundaries small and near the leaves.

React softens the cost with **selective hydration**: each `<Suspense>` boundary hydrates independently, React yields to the browser between them, and if the user clicks inside a boundary that is not hydrated yet, React hydrates that one first and replays the click.

> **Docs.** [New Suspense SSR architecture in React 18](https://github.com/reactwg/react-18/discussions/37) · [Web Vitals](https://web.dev/articles/vitals)

### Hydration mismatches

The rule: **the first render in the browser must produce exactly what the server produced.** When it does not, you get "Hydration failed because the server rendered HTML didn't match the client".

Typical causes:

- Values that differ per environment or per call: `Date.now()`, `new Date().toLocaleString()` (the server's time zone and locale are not the user's), `Math.random()`.
- Branching on the environment during render: `typeof window !== 'undefined'`, `localStorage`, `window.innerWidth`, `navigator.language`.
- Invalid HTML nesting, such as `<div>` inside `<p>` or `<a>` inside `<a>`. The browser repairs the markup while parsing, so the DOM no longer matches.
- Browser extensions that inject attributes or nodes.
- A CDN or proxy that rewrites the HTML.
- A CSS-in-JS library that is not set up for server rendering.

```tsx
'use client';

export function Clock() {
  // Server: "14:03:07" in UTC. Browser: "15:03:09" in the user's zone. Mismatch.
  return <p>{new Date().toLocaleTimeString()}</p>;
}
```

React treats a mismatch as an error it can recover from: it logs it, throws away the server HTML for that part of the tree up to the nearest `<Suspense>` boundary, and renders it again on the client. The result is correct but slower, and the user may see a flash. Recovery is not guaranteed to patch every attribute, so a mismatch is a bug to fix, not a warning to ignore.

> **Docs.** [Hydration error reference](https://nextjs.org/docs/messages/react-hydration-error)

### Fixing a mismatch

In order of preference:

**1. Make the value deterministic.** Compute it once on the server and pass it down, or render something that does not depend on the environment.

```tsx
// Server Component: one value, embedded in the HTML and in the payload
export default function Page() {
  return <Timestamp iso={new Date().toISOString()} />;
}
```

**2. Render the browser-only part after hydration.** The first client render matches the server, then an effect updates it. This costs one extra render and a visible change.

```tsx
'use client';
import { useEffect, useState } from 'react';

export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(new Date(iso).toLocaleTimeString()), [iso]);
  return <time dateTime={iso}>{text ?? '—'}</time>;
}
```

**3. Use `useSyncExternalStore` for browser state.** Its third argument is the value used on the server and during hydration, which is exactly the problem being solved.

```tsx
'use client';
import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```

**4. Skip server rendering for that component.** For widgets that cannot render on the server at all, such as maps or rich text editors. This must be done from a Client Component.

```tsx
'use client';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => <p>Loading map…</p>,
});
```

**5. Let the server know the value.** A theme stored in `localStorage` is invisible to the server; the same theme in a cookie is not. Where a cookie is not an option, a small inline script that runs before hydration can set the attribute.

**6. `suppressHydrationWarning` as the last resort.** It tells React to keep what is in the DOM for that one element. It works one level deep and only for text and attributes.

```tsx
<time dateTime={iso} suppressHydrationWarning>
  {new Date(iso).toLocaleTimeString()}
</time>
```

> **Trap.** `if (typeof window !== 'undefined')` inside render is not a fix. It is the cause: the server takes one branch and the browser takes the other. Environment checks belong in effects and event handlers.

> **Trap.** `useState(() => localStorage.getItem('theme'))` throws on the server, because `localStorage` does not exist there. Client Components run on the server too.

> **Trap.** Generating ids with a counter or `Math.random()`. Use `useId`, which produces the same id on the server and the client.

> **Docs.** [Preventing flash before hydration](https://nextjs.org/docs/app/guides/preventing-flash-before-hydration) · [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) · [Lazy loading: skipping SSR](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr) · [`useId`](https://react.dev/reference/react/useId)

### Hydration trap questions

- **Does `'use client'` turn off server rendering?** No. The component is still rendered to HTML on the server on a direct visit. Only `next/dynamic` with `ssr: false` skips that.
- **Do effects run on the server?** No. `useEffect` and `useLayoutEffect` run only in the browser, after hydration. `useState` initializers and the component body do run on the server.
- **Does hydration happen on every navigation?** No, only when a document is loaded. Client-side navigations render new Client Components directly in the browser.
- **Does React throw the server HTML away and rebuild it?** No, it reuses the DOM nodes. It rebuilds only the part where it found a mismatch.
- **Does a page with no Client Components ship any JavaScript?** Yes: the React runtime and the Next.js router are always there, so `<Link>` navigation and prefetching work. What it does not ship is your component code.
- **Can I hydrate only part of a page?** That is what you already get. Server Components are never hydrated, so only the Client Component islands are, and Suspense boundaries let React do it piece by piece.

## Server and Client Components

In the App Router every component is a Server Component unless something puts it on the client side of a boundary. The questions here test whether you know where that boundary is and what can pass through it.

### What each kind can do

| | Server Component | Client Component |
|---|---|---|
| How you get one | Default in `app/` | Reached through a file that starts with `'use client'` |
| `async` component with `await` | Yes | No (read promises with `use`) |
| Database, filesystem, secrets | Yes | No |
| `useState`, `useEffect`, `useContext`, event handlers | No | Yes |
| Browser APIs (`window`, `localStorage`) | No | Yes, in effects and handlers |
| Code shipped to the browser | No | Yes |
| Rendered to HTML on the first load | Yes | Yes |
| Re-renders in the browser | No | Yes |

A useful way to decide: start on the server, and move a component to the client only when it needs state, effects, event handlers or a browser API.

> **Docs.** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · [React: Server Components](https://react.dev/reference/rsc/server-components)

### `'use client'` marks a boundary, not a component

The directive goes at the top of a file, before the imports. It declares an **entry point into the client module graph**: that file, and everything it imports, directly or transitively, becomes part of the browser bundle.

```tsx
// app/ui/search.tsx
'use client';

import { useState } from 'react';
// results.tsx has no directive, but it is client code now
import { Results } from './results';

export function Search() {
  const [query, setQuery] = useState('');
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Results query={query} />
    </>
  );
}
```

Consequences worth saying out loud:

- You do **not** need the directive in every client file, only in the files that Server Components import.
- A file with no directive is not automatically a Server Component. It becomes whatever imports it.
- The boundary is about the **import graph**, not about the render tree. That distinction is what makes the `children` pattern below work.

> **Trap.** Putting `'use client'` at the top of a layout or page "so hooks work". Everything that file imports is now shipped to and hydrated in the browser. Extract the interactive piece into its own small client file instead.

> **Trap.** The three directives are easy to mix up. `'use client'` marks a client entry point. `'use server'` marks **Server Functions** that the client can call. It does not make a Server Component. Server Components have no directive at all. `'use cache'` marks a function or component whose result is cached.

> **Docs.** [`'use client'`](https://nextjs.org/docs/app/api-reference/directives/use-client) · [React: `'use client'`](https://react.dev/reference/rsc/use-client)

### The RSC Payload

When Server Components render, the output is not HTML. It is the **RSC Payload**, a compact serialized stream that contains:

- the rendered result of the Server Components (the elements, text and props they produced),
- placeholders for each Client Component, with a reference to the JavaScript chunk that implements it,
- the props passed from Server Components to those Client Components.

Next.js uses it in three places: together with the Client Components to produce the first HTML, during hydration so React can rebuild the tree, and as the whole response for client-side navigations and Server Action results. You can see it in the Network tab as requests with an `_rsc` query parameter and the `text/x-component` content type.

> **Say it like this.** "The RSC Payload is the serialized output of the Server Components: rendered markup as data, holes for Client Components with pointers to their JavaScript, and the props for those holes. React on the client merges it into the existing tree, which is why navigation keeps client state."

### What can cross the boundary

Props that go from a Server Component to a Client Component are serialized into the payload, so they must be serializable by React.

| Crosses | Does not cross |
|---|---|
| Strings, numbers, booleans, `null`, `undefined`, `bigint` | Functions, including event handlers |
| Plain objects and arrays | Class instances |
| `Date`, `Map`, `Set`, typed arrays | Symbols that are not global |
| Promises | Anything holding a database connection, stream or closure |
| JSX elements (rendered Server Component output) | |
| Server Functions (`'use server'`), as references | |

```tsx
// Server Component
export default function Page() {
  const onSave = () => console.log('saved');

  // ✗ Error: Event handlers cannot be passed to Client Component props.
  return <SaveButton onClick={onSave} />;
}
```

```tsx
// ✓ A Server Function crosses as a reference the client can call.
import { savePost } from './actions'; // file starts with 'use server'

export default function Page() {
  return <SaveButton action={savePost} />;
}
```

> **Trap.** Everything you pass as a prop ends up in the page source. Passing a whole user row to a Client Component that only shows the name leaks the email and password hash too. Pick fields on the server.

> **Docs.** [Passing data from Server to Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components#passing-data-from-server-to-client-components) · [Data security](https://nextjs.org/docs/app/guides/data-security)

### Composing Server and Client Components

A Server Component can import and render a Client Component. The reverse import does not work: importing a module from a client file pulls it into the browser bundle, so it stops being a Server Component, and fails outright if it touches a database or `server-only`.

What a Client Component can do is **render Server Component output that was passed to it**, usually as `children`.

```tsx
// app/ui/modal.tsx
'use client';
import { useState, type ReactNode } from 'react';

export function Modal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div role="dialog">
      <button onClick={() => setOpen(false)}>Close</button>
      {children}
    </div>
  );
}
```

```tsx
// app/page.tsx (Server Component)
import { Modal } from './ui/modal';
import { Cart } from './ui/cart'; // Server Component, reads the database

export default function Page() {
  return (
    <Modal>
      <Cart />
    </Modal>
  );
}
```

`Cart` runs on the server. `Modal` receives its rendered output as data and decides where to put it. It never sees `Cart`'s code.

The same pattern is how context providers work without turning the app into client code:

```tsx
// app/providers.tsx
'use client';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
```

```tsx
// app/layout.tsx (still a Server Component)
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

> **Trap.** "Wrapping the app in a client provider makes everything a Client Component." It does not. The provider imports nothing from your pages; they reach it as already-rendered `children`.

> **Trap.** A third-party component that uses hooks but ships without `'use client'` fails when rendered from a Server Component. Re-export it from your own file that starts with `'use client'`.

### Keeping server code out of the browser

Nothing stops you from importing a server module into a client file by accident. Two guards exist:

```ts
// lib/db.ts
import 'server-only'; // build error if this file is ever reached from client code

export async function getUser(id: string) {
  return db.user.findUnique({ where: { id } });
}
```

- `server-only` turns an accidental client import into a build error instead of a leaked secret or a runtime crash. `client-only` does the opposite for code that needs `window`.
- Environment variables without the `NEXT_PUBLIC_` prefix are not included in the browser bundle. In client code they are simply `undefined`, which fails quietly.

> **Docs.** [Preventing environment poisoning](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning) · [Environment variables](https://nextjs.org/docs/app/guides/environment-variables)

### How Server Components update

A Server Component has no state and never re-renders in the browser. Its output changes only when it runs again **on the server** and a new RSC Payload arrives. That happens on:

- navigation to a route that contains it,
- `router.refresh()` in a Client Component, or `refresh()` inside a Server Action,
- a Server Action that revalidates data (`updateTag`, `revalidateTag`, `revalidatePath`),
- background revalidation of cached content.

React merges the new payload into the current tree, so Client Components keep their state: an open dropdown stays open and a half-typed input keeps its text.

Not everything interactive needs a Client Component either. `<form action={serverFunction}>`, `<details>`, `<a>`, elements with the `popover` attribute and plain CSS states all work from a Server Component, because the browser provides the behaviour.

### Server and Client Component trap questions

- **Can a Server Component use hooks?** Not the stateful ones. `useState`, `useEffect`, `useContext` and anything built on them are unavailable. `use` and `useId` work.
- **Can a Client Component be `async`?** No. Fetch in a Server Component and pass the data or the promise down, or use a client data library.
- **Can I import a Server Component into a Client Component?** No. Pass it as `children` or another prop.
- **Is a Client Component rendered on the server?** Yes, on a direct visit. See [Server-rendered is not the same as Server Component](#server-rendered-is-not-the-same-as-server-component).
- **Can I read `window` in a Client Component body?** Not during render, because render also runs on the server. Use an effect or an event handler.
- **Where does a `console.log` in a Server Component appear?** In the server terminal. In development Next.js also replays it in the browser console, labelled as a server log.
- **Do Server Components make the app faster automatically?** They remove code from the bundle and move data fetching next to the data. A slow query is still slow, which is what Suspense and caching are for.

## Routing and file conventions

Routing is defined by folders in `app/`. A folder is a URL segment, and special file names inside it decide what renders there.

### Special files and how they nest

| File | Purpose |
|---|---|
| `page.tsx` | The UI of a route. A segment is only reachable if it has a `page` or a `route`. |
| `layout.tsx` | Shared UI around child segments. Keeps its state across navigation. |
| `template.tsx` | Like a layout, but re-created on every navigation. |
| `loading.tsx` | Suspense fallback for the segment. |
| `error.tsx` | Error boundary for the segment. Must be a Client Component. |
| `not-found.tsx` | UI for `notFound()` and unmatched URLs. |
| `global-error.tsx` | Error boundary that replaces the root layout. |
| `route.ts` | An HTTP endpoint (Route Handler) instead of a page. |
| `default.tsx` | Fallback for a parallel route slot. |

Inside one segment the files wrap each other in a fixed order:

```tsx
<Layout>
  <Template>
    <ErrorBoundary fallback={<Error />}>
      <Suspense fallback={<Loading />}>
        <ErrorBoundary fallback={<NotFound />}>
          <Page />
        </ErrorBoundary>
      </Suspense>
    </ErrorBoundary>
  </Template>
</Layout>
```

Two frequent trap questions fall straight out of that order:

- `error.tsx` does **not** catch errors thrown by the `layout.tsx` in the same folder, because the layout sits outside the boundary. Put an `error.tsx` in the parent segment, and use `global-error.tsx` for the root layout.
- `loading.tsx` does **not** cover data fetched in the same segment's layout, for the same reason.

> **Docs.** [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) · [Layouts and pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)

### Layouts, templates and what re-renders

A layout is preserved when you navigate between the pages under it. It is not re-rendered, its Client Components keep their state, and the server does not even re-run it: the router requests only the segments that changed. This is called partial rendering.

That has consequences interviewers like:

- A layout has no `searchParams` prop and cannot know the current pathname, because both would go stale. Read them in the page, or in a Client Component with `useSearchParams` and `usePathname`.
- A layout cannot pass props to `children`. If a layout and a page need the same data, fetch it in both and let [request memoization](#request-memoization-is-not-caching) deduplicate it.
- An auth check that lives only in a layout does not run again on navigation between its pages. See [Where auth checks belong](#where-auth-checks-belong).

A **template** gets a new instance on every navigation: state resets and effects run again. Use it for enter animations, per-page effects such as logging a page view, or resetting a form.

The root layout is required and must render `<html>` and `<body>`.

> **Docs.** [`layout.js`: caveats](https://nextjs.org/docs/app/api-reference/file-conventions/layout#caveats) · [`template.js`](https://nextjs.org/docs/app/api-reference/file-conventions/template)

### Dynamic routes and async params

| Folder | Matches | `params` |
|---|---|---|
| `blog/[slug]` | `/blog/a` | `{ slug: 'a' }` |
| `docs/[...path]` | `/docs/a`, `/docs/a/b` (not `/docs`) | `{ path: ['a', 'b'] }` |
| `docs/[[...path]]` | `/docs` as well | `{ path: undefined }` or the array |

Since Next.js 15, `params` and `searchParams` are **promises**:

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params;
  const { page = '1' } = await props.searchParams;
  // ...
}
```

```tsx
// In a Client Component, unwrap with `use` or read the hook.
'use client';
import { use } from 'react';

export function Title({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params); // or: useParams<{ slug: string }>().slug
  return <h1>{slug}</h1>;
}
```

`generateStaticParams` lists the param values to prerender at build time:

```tsx
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

What happens to a value that is not in the list depends on the model. In the previous model it is rendered on the first request and then cached, unless `export const dynamicParams = false` makes it a 404. With Cache Components the function must return at least one value, and other URLs get a prerendered shell that is filled in and cached after the first visit.

> **Trap.** Writing `({ params }) => params.slug` synchronously. It worked through 14, warned in 15 and is removed in 16. The same goes for `cookies()` and `headers()`, which must be awaited.

> **Docs.** [Dynamic route segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) · [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)

### Route groups, private folders, parallel and intercepting routes

- **Route group `(marketing)`**: organizes files and lets a set of routes share a layout without adding a URL segment. It is also how you get several root layouts.
- **Private folder `_components`**: excluded from routing, for colocated code.
- **Parallel route `@modal`**: a named slot that the parent layout receives as a prop next to `children`, rendered at the same time and able to have its own loading and error states. Each slot needs a `default.tsx` for URLs it has no match for; since 16 the build fails without one.
- **Intercepting route `(.)photo/[id]`**: shows another route inside the current layout on client-side navigation. Combined with a parallel slot this gives a modal with a shareable URL: clicking a photo opens the modal, while loading the URL directly renders the full page.

```tsx
// app/layout.tsx
type Props = { children: React.ReactNode; modal: React.ReactNode };

export default function Layout({ children, modal }: Props) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

> **Docs.** [Route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) · [Parallel routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) · [Intercepting routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)

### Navigation, prefetching and the router hooks

`<Link>` renders an `<a>` and upgrades it: it navigates on the client without a document reload, re-renders only the segments that change, and prefetches the target when the link scrolls into view.

| `prefetch` value | What is prefetched |
|---|---|
| default (`auto`) | A static route completely. A dynamic route only down to its nearest `loading.tsx`. With Partial Prefetching enabled, the route's prerendered shell. |
| `true` | The full route, including data. |
| `false` | Nothing, not even on hover. |

Prefetching runs only in production builds.

The hooks come from `next/navigation` and work only in Client Components:

```tsx
'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function Sort() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(`${pathname}?${params}`);
  };

  return <button onClick={() => setSort('price')}>Sort by price</button>;
}
```

`useSearchParams` needs special care. Search params are unknown at build time, so in a prerendered route the hook forces everything up to the nearest `<Suspense>` boundary to render on the client only. Without a boundary that would be the whole page, so the production build fails with "Missing Suspense boundary with useSearchParams".

```tsx
<Suspense fallback={<SortFallback />}>
  <Sort />
</Suspense>
```

> **Trap.** Importing `useRouter` from `next/router`. That is the Pages Router hook, and in `app/` it throws "NextRouter was not mounted". The App Router one lives in `next/navigation` and has no `query`, `pathname` or `events`.

> **Trap.** Using a plain `<a href>` for internal links. It works, but it reloads the document, so all client state is lost and nothing is prefetched.

> **Docs.** [`<Link>`](https://nextjs.org/docs/app/api-reference/components/link) · [Prefetching](https://nextjs.org/docs/app/guides/prefetching) · [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) · [Missing Suspense with CSR bailout](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout)

### Error, not-found and redirect behaviour

```tsx
// app/dashboard/error.tsx
'use client'; // error boundaries need state, so they must be Client Components

type Props = { error: unknown; retry: () => void };

export default function Error({ error, retry }: Props) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  );
}
```

`retry()` re-fetches and re-renders the segment. It became stable in 16.3; before that the prop was `reset()`, which only re-renders without fetching again.

Points that come up:

- In production, an error thrown in a Server Component reaches `error.tsx` with a **generic message and a `digest`**. The original message stays on the server so it cannot leak. Match the digest against the server logs.
- Error boundaries catch errors thrown **while rendering**. An error in an event handler or in a promise that settles later is not caught; handle it with `try/catch` and state.
- Expected failures such as validation errors should be **returned** from a Server Action as data, not thrown.
- `notFound()` renders the nearest `not-found.tsx`. `global-error.tsx` replaces the root layout, so it has to render its own `<html>` and `<body>`.

`redirect()` and `notFound()` work by **throwing** a special error that Next.js catches further up. That produces a classic bug:

```ts
'use server';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  const title = String(formData.get('title'));
  try {
    const post = await db.post.create({ data: { title } });
    redirect(`/posts/${post.id}`); // ✗ throws, and the catch below swallows it
  } catch {
    return { error: 'Could not create the post' };
  }
}
```

Call `redirect()` after the `try` block. It responds with `307` by default, `308` from `permanentRedirect()`, and `303` when it follows a Server Action form submission.

> **Docs.** [Error handling](https://nextjs.org/docs/app/getting-started/error-handling) · [`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error) · [`redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect) · [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)

## Data fetching

In the App Router you fetch where you render. There is no `getServerSideProps`, and you rarely need `useEffect` for initial data.

One note on the examples: with Cache Components enabled, an uncached `await` has to sit inside `<Suspense>` or the data has to be cached with `'use cache'`. The snippets in this chapter leave that out to stay short. The [caching chapter](#caching-and-revalidation) covers it.

### Fetching in Server Components

```tsx
// app/posts/page.tsx
import { db } from '@/lib/db';

export default async function Page() {
  const posts = await db.post.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

The component is `async`, the query runs on the server during render, and neither the query nor the database credentials reach the browser. No API route sits in between.

> **Trap.** Calling your own Route Handler from a Server Component (`fetch('http://localhost:3000/api/posts')`). It adds a network round trip to reach code that is already in the same process, and it breaks at build time when no server is listening. Call the function that the Route Handler calls.

> **Docs.** [Fetching data](https://nextjs.org/docs/app/getting-started/fetching-data)

### Waterfalls and parallel fetching

Two awaits in a row run one after the other, and so do a parent and a child that each fetch: the child cannot start until the parent has rendered.

```tsx
// ✗ Sequential: total time is the sum
const user = await getUser(id);
const posts = await getPosts(id);

// ✓ Parallel: total time is the slowest one
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

When the pieces render in different parts of the page, give each its own component and Suspense boundary instead. They fetch in parallel and each appears as soon as it is ready:

```tsx
<Suspense fallback={<ProfileSkeleton />}>
  <Profile id={id} />
</Suspense>
<Suspense fallback={<PostsSkeleton />}>
  <Posts id={id} />
</Suspense>
```

If a child's fetch is hidden behind a parent's slower `await`, start it early without awaiting it (the preload pattern):

```tsx
export default async function Page({ params }: PageProps<'/item/[id]'>) {
  const { id } = await params;
  void getItem(id); // starts now; getItem is wrapped in React.cache
  const allowed = await checkAccess();
  return allowed ? <Item id={id} /> : null; // Item awaits the same promise
}
```

### Request memoization is not caching

Because there is no prop drilling from layouts to pages, the same data function is often called several times in one render: in the layout, the page and `generateMetadata`. To make that free, calls are deduplicated **within a single request**:

- identical `fetch` calls (`GET`, same URL and options) are memoized automatically,
- anything else, such as an ORM call, needs React's `cache`.

```ts
// lib/data.ts
import { cache } from 'react';
import 'server-only';

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
```

```tsx
// Both calls hit the database once per request.
export async function generateMetadata({ params }: PageProps<'/users/[id]'>) {
  const user = await getUser((await params).id);
  return { title: user?.name };
}

export default async function Page({ params }: PageProps<'/users/[id]'>) {
  const user = await getUser((await params).id);
  return <h1>{user?.name}</h1>;
}
```

The memo is dropped when the request ends. It does not apply inside Route Handlers, which are not part of a React render.

> **Trap.** Mixing up `cache` from React with real caching. React's `cache` lasts for one request and exists for deduplication. `'use cache'`, `unstable_cache` and `fetch(..., { cache: 'force-cache' })` persist **across** requests.

> **Docs.** [`fetch`: memoization](https://nextjs.org/docs/app/api-reference/functions/fetch#memoization) · [React `cache`](https://react.dev/reference/react/cache)

### Streaming data to Client Components

A Server Component can start a request and hand the unresolved promise to a Client Component, which reads it with `use`. The page does not wait for the data, and the client does not fetch again.

```tsx
// app/page.tsx (Server Component)
import { Suspense } from 'react';
import { Comments } from './comments';

export default function Page() {
  const comments = getComments(); // not awaited
  return (
    <Suspense fallback={<p>Loading comments…</p>}>
      <Comments promise={comments} />
    </Suspense>
  );
}
```

```tsx
// app/comments.tsx
'use client';
import { use } from 'react';

export function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = use(promise); // suspends until the server resolves it
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}
```

> **Docs.** [React `use`](https://react.dev/reference/react/use) · [Streaming data to the client](https://nextjs.org/docs/app/guides/streaming#streaming-data-to-the-client)

### When to fetch on the client

Server Components do not replace client-side fetching. Use SWR or TanStack Query when the data depends on something only the browser knows or changes without navigation: search-as-you-type, infinite scroll, polling, live updates, optimistic mutations.

What to avoid is fetching a page's **initial** data in `useEffect`. The request cannot start until the JavaScript has loaded and hydrated, the HTML contains only a spinner, and crawlers that do not run JavaScript see nothing.

> **Say it like this.** "Initial data comes from Server Components so it is in the HTML. Data that changes in response to user input after load is fetched on the client with a library that handles caching and race conditions."

> **Docs.** [Client-side data fetching](https://nextjs.org/docs/app/guides/client-side-data-fetching)

## Caching and revalidation

This is where most candidates lose points, usually by describing one caching layer when the question is about another, or by quoting defaults from the wrong version. Start every answer by naming the layer and the version.

### The four layers

| Layer | What it stores | Where | Lifetime | Purpose |
|---|---|---|---|---|
| Request memoization | Return values of identical `fetch` calls and `React.cache` functions | Server memory | One request | Call the same data function in several components without refetching |
| Data cache | Results of cached `fetch` calls, `unstable_cache` and `'use cache'` functions | Server: memory, disk or a remote store | Across requests, until revalidated | Avoid hitting the data source again |
| Prerendered output (the "full route cache") | HTML and RSC Payload of static routes and static shells | Server disk or a CDN | Until revalidated or redeployed | Avoid rendering again |
| Client cache (the "router cache") | RSC Payloads of visited and prefetched segments | Browser memory | The session; cleared on reload | Instant navigation and back/forward |

The layers stack. A request can skip rendering entirely (prerendered output), or render but skip the database (data cache), or hit the database once instead of three times (memoization). And the browser may not make a request at all (client cache).

> **Say it like this.** "When data looks stale I work from the outside in: is the browser reusing a cached payload, was the route prerendered, is the data function itself cached, and when was each last revalidated?"

### How the defaults changed

| | Next.js 13 and 14 | Next.js 15 and 16 (previous model) | Next.js 16 with Cache Components |
|---|---|---|---|
| `fetch` in a Server Component | Cached indefinitely | Not cached | Not cached; must be in `<Suspense>` or under `'use cache'` |
| `GET` Route Handler | Cached | Not cached | Prerendered if it reads no request or uncached data |
| Page data in the client cache | Reused for 30 seconds | Not reused | Controlled by `cacheLife`'s `stale` |
| How you opt in | You opted **out** (`no-store`) | `cache: 'force-cache'`, `revalidate`, `unstable_cache` | `'use cache'` |

The direction is consistent: from implicit caching you had to switch off, to explicit caching you switch on.

### The previous model: fetch options and route config

```ts
// not cached
fetch(url);

// cached until revalidated
fetch(url, { cache: 'force-cache' });

// cached, refreshed at most once an hour
fetch(url, { next: { revalidate: 3600 } });

// cached and tagged for on-demand invalidation
fetch(url, { cache: 'force-cache', next: { tags: ['posts'] } });

// never cached, and makes the route dynamic
fetch(url, { cache: 'no-store' });
```

For anything that is not `fetch`, wrap the function:

```ts
import { unstable_cache } from 'next/cache';

export const getUser = unstable_cache(
  async (id: string) => db.user.findUnique({ where: { id } }),
  ['user'],                              // key prefix; the arguments are added to it
  { tags: ['user'], revalidate: 3600 },
);
```

And a route can set defaults for itself:

```ts
// app/blog/page.tsx
export const revalidate = 3600;          // re-render this route at most once an hour
export const dynamic = 'force-dynamic';  // or 'auto' | 'force-static' | 'error'
```

> **Trap.** "My `fetch` is not cached, but the page shows old data." In a static route the `fetch` runs once, at build time, because the **route** is prerendered. The fetch result is not cached; the page is. Give the route a `revalidate`, or make it dynamic.

> **Trap.** The lowest `revalidate` among a route's layouts, page and fetches applies to the whole route. And the value must be a literal: `export const revalidate = 60 * 10` is not valid.

> **Trap.** These route segment options (`dynamic`, `revalidate`, `fetchCache`, `dynamicParams`) do not exist once Cache Components is enabled.

> **Docs.** [Caching (previous model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) · [`fetch`](https://nextjs.org/docs/app/api-reference/functions/fetch) · [`unstable_cache`](https://nextjs.org/docs/app/api-reference/functions/unstable_cache) · [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

### Cache Components and `'use cache'`

With `cacheComponents: true`, every piece of a page falls into one of three groups, and you choose the group per component, not per route:

| Group | How you mark it | When it renders |
|---|---|---|
| Static | Nothing: synchronous code, imports, pure computation | Build time, part of the static shell |
| Cached | `'use cache'` on the function or component | Build time or first use, then reused until revalidated |
| Dynamic | Wrap in `<Suspense>` | Every request, streamed into the shell |

```ts
// lib/data.ts (data-level caching)
import { cacheLife, cacheTag } from 'next/cache';

export async function getProducts(category: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  return db.product.findMany({ where: { category } });
}
```

```tsx
// UI-level caching: the rendered output is cached
async function Footer() {
  'use cache';
  cacheLife('days');
  const links = await getFooterLinks();
  return (
    <footer>
      {links.map((l) => (
        <a key={l.href} href={l.href}>{l.label}</a>
      ))}
    </footer>
  );
}
```

The **cache key** is built from the build id, the function's identity, its arguments, and any variables it closes over. `getProducts('shoes')` and `getProducts('hats')` are separate entries without any work from you.

`cacheLife` takes a profile with three numbers:

| Profile | `stale` (client reuse) | `revalidate` (background refresh) | `expire` (hard limit) |
|---|---|---|---|
| `default` | 5 min | 15 min | never |
| `seconds` | 30 s | 1 s | 1 min |
| `minutes` | 5 min | 1 min | 1 h |
| `hours` | 5 min | 1 h | 1 day |
| `days` | 5 min | 1 day | 1 week |
| `weeks` | 5 min | 1 week | 30 days |
| `max` | 5 min | 30 days | 1 year |

Rules that produce trap questions:

- **No request data inside `'use cache'`.** `cookies()` and `headers()` cannot be called in a cached scope, because the result would be shared between users. Read the value outside and pass it in as an argument, where it becomes part of the key. `'use cache: private'` exists for per-user results that should live only in that user's browser.
- **Uncached async work must be inside `<Suspense>`.** Otherwise it would block the whole page, and Next.js reports an error that names the route.
- **Non-deterministic values need a decision.** `Math.random()`, `Date.now()` and `crypto.randomUUID()` either go behind `await connection()` (a new value per request) or inside `'use cache'` (one value shared until revalidation).
- **Arguments must be serializable.** JSX `children` are allowed as long as the cached component only passes them through.
- **The default store is in memory, per server instance.** On serverless or with several replicas, entries are not shared unless you use `'use cache: remote'` with a cache handler. Entries never survive a new deployment, because the build id is in the key.
- **Very short lifetimes are not prerendered.** With the `seconds` profile or an `expire` under five minutes, the content becomes a dynamic hole instead of part of the shell.

```tsx
// Reading a cookie outside the cached scope, and using it as part of the key
async function Recommendations() {
  const segment = (await cookies()).get('segment')?.value ?? 'default';
  return <RecommendationList segment={segment} />;
}

async function RecommendationList({ segment }: { segment: string }) {
  'use cache';
  cacheLife('hours');
  const items = await getRecommendations(segment);
  return <ul>{items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

> **Docs.** [Caching](https://nextjs.org/docs/app/getting-started/caching) · [`'use cache'`](https://nextjs.org/docs/app/api-reference/directives/use-cache) · [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) · [`connection`](https://nextjs.org/docs/app/api-reference/functions/connection) · [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)

### Time-based revalidation is stale-while-revalidate

`revalidate: 60` does not mean "content is never more than 60 seconds old". It means:

1. For 60 seconds after rendering, every request gets the cached version.
2. The first request **after** that still gets the cached version, and triggers a re-render in the background.
3. Requests after the re-render finishes get the new version. If the re-render fails, the old version keeps being served.

Nothing regenerates on a timer. On a page nobody visits for a day, the next visitor sees day-old content and it is the visitor after that who sees fresh content. With `cacheLife`, the `expire` value is the hard limit: past it, a request waits for fresh content instead of receiving stale content.

> **Say it like this.** "ISR is stale-while-revalidate. The revalidation window is the minimum age at which a request may trigger a background refresh, not a maximum age for what users see."

### On-demand revalidation

| API | Where it can be called | Effect |
|---|---|---|
| `revalidateTag(tag, 'max')` | Server Actions, Route Handlers | Marks tagged entries stale. The next visit gets the stale version while a fresh one is built. |
| `updateTag(tag)` | Server Actions only | Expires tagged entries immediately and re-renders the current route in the same response. The user sees their own change. |
| `revalidatePath(path)` | Server Actions, Route Handlers | Invalidates everything cached for a route. Broad; prefer tags. |
| `refresh()` from `next/cache` | Server Actions only | Re-renders the current route's uncached parts. Does not invalidate cached data. |
| `router.refresh()` | Client Components | Requests a new RSC Payload for the current route. Keeps client state. Does not invalidate server caches. |

```ts
// app/actions.ts
'use server';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  const title = String(formData.get('title'));
  const post = await db.post.create({ data: { title } });
  updateTag('posts'); // the author must see the new post immediately
  redirect(`/posts/${post.id}`);
}
```

```ts
// app/api/revalidate/route.ts (called by a CMS webhook)
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  if (request.headers.get('x-webhook-secret') !== process.env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  // readers may get the old list for one more request
  revalidateTag('posts', 'max');
  return Response.json({ revalidated: true });
}
```

> **Trap.** `revalidateTag('posts')` with one argument is the pre-16 signature. In 16 it is deprecated and a TypeScript error; pass a profile, or use `updateTag` when you need the change to be visible at once.

> **Docs.** [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) · [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) · [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) · [`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) · [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh)

### The client cache

The router keeps RSC Payloads in browser memory so navigation does not always need the server:

- **Layouts and loading states** are reused across navigations.
- **Pages** are not reused by default since 15, except on back and forward, where the previous page is restored along with its scroll position.
- **Prefetched static routes** are reused for five minutes.
- A full page reload clears everything.

It is invalidated by `router.refresh()`, and from a Server Action by `updateTag`, `revalidatePath`, and setting or deleting a cookie.

> **Trap.** Mutating through a `fetch` to a Route Handler and expecting the page to update. The router knows nothing about that request. Either call `router.refresh()` afterwards, or do the mutation in a Server Action, where revalidation and the UI update travel in the same response.

> **Docs.** [Glossary: client cache](https://nextjs.org/docs/app/glossary#client-cache) · [`staleTimes`](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes)

### Caching trap questions

- **Fresh in development, stale in production?** Development renders every request on demand and prerenders nothing. Reproduce with a production build.
- **Different users see different versions of a page after a deploy to several replicas?** Each instance has its own cache. Use a shared cache handler. See [Self-hosting](#self-hosting-and-multiple-instances).
- **One `cookies()` call slowed down the whole site?** In the previous model a request-time API in the root layout makes every route dynamic. Move the read into the component that needs it, behind Suspense.
- **Could a cache leak one user's data to another?** Yes, if a cached function reads user-specific data without the user being part of the key. `'use cache'` prevents the obvious version by forbidding `cookies()` inside it; `unstable_cache` does not.
- **Does `revalidate` run on a schedule?** No. Regeneration is triggered by a request that arrives after the window.
- **Are HTML and the RSC Payload cached separately?** They are produced and revalidated together. A cache layer that lets them drift apart causes pages that show different data on a direct visit and on navigation.

## Server Functions, Server Actions and forms

A Server Function is an `async` function marked with `'use server'` that the browser can call. A **Server Action** is a Server Function used for a mutation: passed to a form's `action`, or called inside a transition.

### What happens when you call one

The function's code stays on the server. The client receives only a reference, an opaque id. Calling it sends a `POST` request to the current URL with that id and the serialized arguments. The server runs the function and can return the result together with a re-rendered RSC Payload in the same response, so data and UI update in one round trip.

There are two ways to define one:

```tsx
// Inline, in a Server Component
export default function Page() {
  async function subscribe(formData: FormData) {
    'use server';
    await db.subscriber.create({ data: { email: String(formData.get('email')) } });
  }
  return (
    <form action={subscribe}>
      <input name="email" type="email" required />
      <button>Subscribe</button>
    </form>
  );
}
```

```ts
// In a separate file, which is the only way to import one into a Client Component
// app/actions.ts
'use server';

export async function subscribe(formData: FormData) {
  // ...
}
```

> **Trap.** `'use server'` at the top of a file turns **every export** into an endpoint that anyone can call with a `POST`. Do not put helpers or data-fetching functions in that file, and do not add the directive to a file to "make it run on the server".

> **Docs.** [Mutating data](https://nextjs.org/docs/app/getting-started/mutating-data) · [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions) · [React: Server Functions](https://react.dev/reference/rsc/server-functions)

### Forms, pending state and progressive enhancement

`<form action={serverFunction}>` works as a plain HTML form `POST` if JavaScript has not loaded, and as a background request with no page reload once it has. The same code covers both.

For validation messages and pending state you need a Client Component and three hooks:

```ts
// app/actions.ts
'use server';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

export type State = { error?: string; ok?: boolean };

export async function subscribe(_prev: State, formData: FormData): Promise<State> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email address' };
  await db.subscriber.create({ data: parsed.data });
  return { ok: true };
}
```

```tsx
// app/subscribe-form.tsx
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { subscribe, type State } from './actions';

function Submit() {
  const { pending } = useFormStatus(); // must be rendered inside the <form>
  return <button disabled={pending}>{pending ? 'Sending…' : 'Subscribe'}</button>;
}

export function SubscribeForm() {
  const [state, formAction] = useActionState<State, FormData>(subscribe, {});
  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <Submit />
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p>Subscribed.</p>}
    </form>
  );
}
```

- `useActionState` holds what the action returned and gives the action its previous state as the first argument.
- `useFormStatus` reports whether the surrounding form is submitting.
- `useOptimistic` shows the expected result immediately and rolls back if the action fails.

> **Trap.** Calling `useFormStatus` in the same component that renders the `<form>`. It reads the status of a **parent** form, so it has to live in a child.

> **Trap.** Throwing for validation errors. A thrown error goes to the error boundary and replaces the form. Return expected errors as state.

> **Docs.** [Forms](https://nextjs.org/docs/app/guides/forms) · [`useActionState`](https://react.dev/reference/react/useActionState) · [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus) · [`useOptimistic`](https://react.dev/reference/react/useOptimistic)

### Every Server Function is a public endpoint

This is the security point interviewers look for. The function is reachable by a direct `POST`, whether or not your UI renders a button for it.

```ts
'use server';
import { z } from 'zod';
import { verifySession } from '@/lib/dal';

const input = z.object({ postId: z.string().uuid() });

export async function deletePost(raw: unknown) {
  // 1. Who is calling?
  const session = await verifySession();

  // 2. Is the input what the types claim?
  const { postId } = input.parse(raw);

  // 3. Are they allowed to do this?
  const post = await db.post.findUnique({ where: { id: postId } });
  if (post?.authorId !== session.userId) {
    throw new Error('Forbidden');
  }

  await db.post.delete({ where: { id: postId } });
}
```

- **Authenticate and authorize inside every function.** A check in the page that renders the button protects nothing.
- **Validate the input at runtime.** TypeScript types are erased, and `FormData` values are strings or files that the caller controls.
- **Return only what the UI needs.** The return value is sent to the browser.
- **Closures travel.** Variables that an inline action closes over are sent to the client and back, encrypted. That prevents tampering in transit, but do not treat it as a place for secrets.

What Next.js does for you: actions accept only `POST`; the `Origin` header is compared with the host to block cross-site requests (`serverActions.allowedOrigins` adds trusted proxies); action ids are unguessable and unused actions are removed from the build; the request body is limited to 1 MB by default. These reduce the attack surface. They do not replace the checks above.

> **Docs.** [Data security: mutating data](https://nextjs.org/docs/app/guides/data-security#mutating-data) · [`serverActions` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)

### What Server Functions are not for

- **Reading data.** They use `POST`, are not cached, and the client dispatches them **one at a time**, so three calls run in sequence. Read in Server Components, or through a Route Handler when the client must fetch.
- **A public API.** Action ids change between builds and the protocol is internal. Webhooks, mobile clients and other services need a Route Handler.

| | Server Action | Route Handler |
|---|---|---|
| Called by | Your own React UI | Anything that speaks HTTP |
| Methods | `POST` only | Any |
| URL | None you control | A stable path |
| Typical use | Form submissions and mutations | Webhooks, public APIs, file downloads, OAuth callbacks |
| Updates the UI | In the same response | No, the caller decides |

### Mutation flow: revalidate, redirect, cookies

A complete action does four things in order: check, mutate, invalidate, navigate.

```ts
'use server';
import { cookies } from 'next/headers';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export async function login(_prev: unknown, formData: FormData) {
  const user = await authenticate(formData);
  if (!user) return { error: 'Wrong email or password' };

  (await cookies()).set('session', await createSession(user.id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
  updateTag(`user-${user.id}`);
  redirect('/dashboard'); // outside any try/catch
}
```

Cookies can be **set or deleted only in a Server Function or a Route Handler**. A Server Component can read them but not write them: by the time it renders, the response headers may already be on their way.

> **Trap.** Performing a mutation while rendering, for example logging the user out when a page sees `?logout=1`. `GET` requests are prefetched, retried and crawled, so the side effect runs when nobody asked for it.

> **Docs.** [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) · [Redirecting](https://nextjs.org/docs/app/guides/redirecting)

## Route Handlers and Proxy

### Route Handlers

A `route.ts` file turns a segment into an HTTP endpoint built on the Web `Request` and `Response` APIs.

```ts
// app/api/posts/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const session = await verifySession();
  // ...
  return new Response(null, { status: 204 });
}
```

Facts that get asked:

- A segment cannot have both `page.tsx` and `route.ts`. The URL would be ambiguous.
- `GET` handlers are not cached by default since 15. In the previous model, `export const dynamic = 'force-static'` caches one. With Cache Components a `GET` handler follows the same rules as a page.
- `params` is a promise here as well.
- Request memoization does not apply. A Route Handler is not a React render.
- A handler that authenticates with cookies needs its own CSRF protection. The automatic `Origin` check covers Server Actions only.

> **Docs.** [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) · [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) · [Backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)

### Proxy, formerly Middleware

`proxy.ts` in the project root runs before a matched request reaches a route. It can redirect, rewrite, set headers, or respond directly. Until Next.js 16 the file was `middleware.ts`; the old name is deprecated.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('session');
  if (!hasSession && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static files and images, or the function runs for every asset.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Good uses: redirects and rewrites that depend on the request, locale detection, A/B bucketing, security headers such as a CSP nonce, and returning a real `404` or redirect before streaming starts.

Limits:

- There is **one** proxy file, and it runs on every matched request, including prefetches. Keep it fast: no database queries, no slow `fetch`.
- It is for **optimistic** checks, such as "is there a session cookie at all?". It is not where authorization is decided.
- `'use cache'` and `fetch` caching options have no effect inside it.
- `proxy.ts` runs on the Node.js runtime. The Edge runtime is not supported there.

> **Trap.** "Middleware runs on the Edge." That was the default for `middleware.ts`. In 16 `proxy.ts` is Node.js only.

> **Trap.** Treating the proxy as the security boundary. In March 2025 a vulnerability (CVE-2025-29927) let a crafted request header skip middleware completely. Apps that also checked access next to their data were not exposed.

> **Docs.** [Proxy](https://nextjs.org/docs/app/getting-started/proxy) · [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

### Node.js and Edge runtimes

Next.js has two server runtimes. **Node.js** is the default and has every Node API. **Edge** is a restricted, Web-standard runtime that starts quickly, lacks many Node APIs (no filesystem, limited packages) and does not support ISR. In Next.js 16 `export const runtime = 'edge'` on a route is deprecated, and Node.js is the answer unless a platform requires otherwise.

> **Docs.** [Edge runtime](https://nextjs.org/docs/app/api-reference/edge)

## Authentication and security

### Where auth checks belong

The recommended structure is a **data access layer** (DAL): one server-only module that verifies the session, and data functions that call it. Access control sits next to the data, so no route can forget it.

```ts
// lib/dal.ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const verifySession = cache(async () => {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await decrypt(token) : null;
  if (!session) redirect('/login');
  return session;
});

export async function getInvoices() {
  const { userId } = await verifySession();
  const rows = await db.invoice.findMany({ where: { userId } });
  // Return only what the UI needs, not whole rows.
  return rows.map(({ id, amount, dueDate }) => ({ id, amount, dueDate }));
}
```

Where each layer fits:

| Place | Role |
|---|---|
| Data access layer | The real check. Every read and every mutation goes through it. |
| Server Actions and Route Handlers | Call the DAL. Each is a public endpoint. |
| Pages | May redirect for a good experience, but the data layer still checks. |
| Proxy | Optimistic redirect based on the cookie, to avoid rendering a page that will redirect anyway. |
| Layouts | Not a place for checks. A layout is not re-rendered when you navigate between its pages. |

> **Say it like this.** "I check authorization as close to the data as possible, in a server-only data layer that every Server Component, Server Action and Route Handler goes through. The proxy only does a cheap redirect, and I never rely on a layout, because layouts are not re-rendered on navigation."

> **Docs.** [Authentication](https://nextjs.org/docs/app/guides/authentication) · [Data security](https://nextjs.org/docs/app/guides/data-security)

### Secrets and environment variables

- Variables are server-only unless they start with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_` values are **inlined into the JavaScript bundle at build time**. They are not read when the server starts.
- On the server, variables are read at runtime only in code that runs at request time. In a prerendered page the value from build time is baked into the HTML.

> **Trap.** Building one Docker image and promoting it from staging to production, expecting `NEXT_PUBLIC_API_URL` to change with the environment. It was frozen when the image was built. Read the value on the server at request time and pass it down, or build per environment.

Other ways data leaks:

- Props passed to Client Components are in the page source. Return narrow objects from the data layer.
- A module with secrets imported into client code. Guard it with `import 'server-only'`.
- Error messages. In production Next.js replaces Server Component error messages with a digest for this reason; do not undo that by sending `error.message` to the client yourself.

### Common security questions

- **XSS.** React escapes text by default. The risks are `dangerouslySetInnerHTML`, `href={userInput}` with a `javascript:` URL, and injected third-party scripts. A nonce-based Content Security Policy is set in `proxy.ts`, which makes the affected pages render dynamically.
- **CSRF.** Server Actions are `POST`-only and check `Origin` against the host. Route Handlers that rely on cookies need `SameSite` cookies and their own origin or token check.
- **Open redirects.** `redirect(searchParams.next)` sends users wherever an attacker's link says. Allow only relative paths or a list of known hosts.
- **Image proxy abuse.** `next/image` fetches remote images on the server. Restrict it with `images.remotePatterns` so it cannot be pointed at arbitrary hosts.
- **Rate limiting.** Nothing is built in. Server Actions and Route Handlers that are expensive or sensitive need it from your infrastructure or your code.

> **Docs.** [Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy) · [Environment variables](https://nextjs.org/docs/app/guides/environment-variables) · [Production checklist](https://nextjs.org/docs/app/guides/production-checklist)

## Performance and SEO

Performance questions are usually "the app is slow, what do you look at?". A good answer names the metric, the cause in Next.js terms, and the fix.

### What Next.js optimizes for you

- **Code splitting** per route, and Server Components that ship no code at all.
- **Prefetching** of links in the viewport, and streaming so slow data does not block the first byte.
- **`next/image`**: resizes on demand, serves modern formats, lazy-loads by default and reserves space so the layout does not jump.
- **`next/font`**: downloads fonts at build time and serves them from your own domain, with a size-adjusted fallback to avoid layout shift.
- **`next/script`**: controls when third-party scripts load.

```tsx
import Image from 'next/image';
import { Inter } from 'next/font/google';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export default function Hero() {
  return (
    <section className={inter.className}>
      {/* width and height reserve the space; preload: this is the LCP element */}
      <Image src="/hero.jpg" alt="Desk setup" width={1200} height={600} preload />
      <Script src="https://example.com/analytics.js" strategy="lazyOnload" />
    </section>
  );
}
```

| `next/script` strategy | When it loads |
|---|---|
| `beforeInteractive` | Before any Next.js code and before hydration. Root layout only. |
| `afterInteractive` (default) | Early, after some hydration has happened. |
| `lazyOnload` | During browser idle time. |

> **Trap.** `priority` on `next/image` is deprecated since 16. Use `preload` for the LCP image, or `loading="eager"` when you only want to turn lazy loading off.

> **Trap.** `next/image` needs `width` and `height`, or `fill` with a sized parent, or a static import. Remote hosts must be allowed in `images.remotePatterns`.

> **Docs.** [Images](https://nextjs.org/docs/app/getting-started/images) · [`<Image>`](https://nextjs.org/docs/app/api-reference/components/image) · [Fonts](https://nextjs.org/docs/app/getting-started/fonts) · [Scripts](https://nextjs.org/docs/app/guides/scripts)

### Reducing client JavaScript

1. **Push `'use client'` down.** Make the button a Client Component, not the page.
2. **Pass server output through client wrappers** with `children`, so a client layout shell does not drag its content into the bundle.
3. **Keep heavy libraries on the server.** Markdown parsing, syntax highlighting and date formatting can run in Server Components and send only the result.
4. **Lazy-load what is not needed at first paint**, such as a chart below the fold or an editor behind a button.

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const Editor = dynamic(() => import('./editor'), {
  loading: () => <p>Loading editor…</p>,
});

export function Comment() {
  const [editing, setEditing] = useState(false);
  if (editing) return <Editor />;
  return <button onClick={() => setEditing(true)}>Edit</button>;
}
```

5. **Measure.** Use a bundle analyzer to find what is large, and `optimizePackageImports` for libraries with big barrel files.

The React Compiler (`reactCompiler: true`) memoizes components automatically. It reduces re-renders; it does not reduce bundle size.

> **Docs.** [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) · [Package bundling](https://nextjs.org/docs/app/guides/package-bundling) · [`reactCompiler`](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)

### Core Web Vitals in Next.js terms

| Metric | What hurts it | What helps |
|---|---|---|
| TTFB | Rendering everything per request, slow queries before the first byte | Static shells, caching, streaming behind Suspense |
| LCP | The main image or heading arrives late or is rendered on the client | Server-render the LCP element, `preload` the hero image, `next/font` |
| CLS | Images without dimensions, late-loading fonts, fallbacks smaller than the content | `width`/`height`, `next/font`, skeletons the size of the real content |
| INP | Long hydration, large Client Component trees, heavy handlers | Less client JavaScript, transitions, splitting work |

> **Trap.** "Streaming fixes performance." It improves TTFB and first paint. A Suspense fallback that is a different size from the content it replaces creates layout shift, and a slow query is still slow for the part that waits on it.

> **Docs.** [Streaming and Web Vitals](https://nextjs.org/docs/app/guides/streaming#streaming-and-web-vitals) · [Production checklist](https://nextjs.org/docs/app/guides/production-checklist)

### Metadata and SEO

Metadata is exported from a `layout` or `page`, statically or from a function. It works only in Server Components.

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next';

type Props = PageProps<'/blog/[slug]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug); // deduplicated with the page's own call
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { images: [post.cover] },
  };
}
```

Metadata merges from the root layout down, and `title: { template: '%s | Acme' }` in a layout formats the titles of its pages. File conventions cover the rest: `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `icon.png`.

Why server rendering matters for SEO: a crawler that does not run JavaScript sees only the first HTML response. Both Server and Client Components contribute to it, as long as the content does not appear only after an effect or a user action.

SEO traps specific to the App Router:

- **Soft 404.** `notFound()` called after streaming has started returns `200` with a `noindex` tag, not a `404`. Check existence before the first Suspense boundary.
- **Client-only content.** A `useSearchParams` call without a tight Suspense boundary renders its whole subtree on the client, so that content is missing from the HTML.
- **Streaming metadata.** For browsers, `generateMetadata` may resolve after the shell is sent. For bots that only read HTML, Next.js detects the user agent and waits, so the tags are in `<head>`.

> **Docs.** [Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) · [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) · [JSON-LD](https://nextjs.org/docs/app/guides/json-ld)

## The Pages Router

Plenty of production code still lives in `pages/`, and "compare the two routers" is a standard question. The important difference: in the Pages Router data is fetched **before** rendering by a function next to the page, and every component is a client component in today's terms.

### The data fetching functions

```tsx
// pages/blog/[slug].tsx
import type { GetStaticPaths, GetStaticProps } from 'next';

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await getPosts()).map((p) => ({ params: { slug: p.slug } })),
  // false: 404 · true: show a fallback first · 'blocking': SSR on the first visit
  fallback: 'blocking',
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const post = await getPost(String(params?.slug));
  if (!post) return { notFound: true };
  return { props: { post }, revalidate: 60 }; // ISR
};

export default function Post({ post }: { post: Post }) {
  return <h1>{post.title}</h1>;
}
```

| Function | Runs | Result |
|---|---|---|
| `getStaticProps` | At build time, and again in the background when `revalidate` is set | SSG or ISR |
| `getStaticPaths` | At build time | The list of dynamic paths to prerender |
| `getServerSideProps` | On every request | SSR |
| `getInitialProps` | On the server for the first load, in the browser on navigation | Legacy; avoid |

They work only in page files, never in components. The returned props are serialized to JSON and embedded in the HTML as `<script id="__NEXT_DATA__">`, so the browser can hydrate with the same data. On client-side navigation Next.js fetches that JSON from the server instead of a full page.

> **Trap.** Returning a `Date` or `undefined` from `getServerSideProps` fails with "Error serializing … returned from getServerSideProps". Props must be plain JSON.

> **Docs.** [`getStaticProps`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-props) · [`getStaticPaths`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-paths) · [`getServerSideProps`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props) · [ISR in the Pages Router](https://nextjs.org/docs/pages/guides/incremental-static-regeneration)

### Hydration and special files in the Pages Router

- **The whole page hydrates.** Every component's code is in the bundle. There is no way to keep a component server-only, which is the problem Server Components solve.
- **`_app.tsx`** wraps every page: global CSS, providers, persistent layout.
- **`_document.tsx`** customizes `<html>` and `<body>`. It renders only on the server, so event handlers there never run.
- **`pages/api/*.ts`** are API routes with Node-style `(req, res)` handlers.
- **`next/head`** sets the title and meta tags from inside components.

> **Trap.** `useRouter().query` is an empty object on the first render of a statically optimized page, because the query string is unknown at build time. It is filled in after hydration; wait for `router.isReady`.

> **Docs.** [Custom App](https://nextjs.org/docs/pages/building-your-application/routing/custom-app) · [Custom Document](https://nextjs.org/docs/pages/building-your-application/routing/custom-document) · [API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)

### Mapping to the App Router

| Pages Router | App Router |
|---|---|
| `getServerSideProps` | An `async` Server Component that reads request data |
| `getStaticProps` | An `async` Server Component that is prerendered or cached |
| `revalidate` in `getStaticProps` | `cacheLife`, or `revalidate` in the previous model |
| `getStaticPaths` | `generateStaticParams` |
| `_app.tsx` and `_document.tsx` | The root `layout.tsx` |
| `pages/api/*` | `route.ts` |
| `next/head` | `metadata` and `generateMetadata` |
| `useRouter` from `next/router` | Hooks from `next/navigation` |
| Everything hydrates | Only Client Components hydrate |

Both routers can live in the same project, which is how apps migrate page by page. The same URL cannot be defined in both.

> **Say it like this.** "The Pages Router fetches data per page before render and hydrates the whole page. The App Router fetches inside components on the server, streams the result, and hydrates only the Client Components. Layouts, streaming and caching are finer-grained as a result."

> **Docs.** [App Router migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration)

## Deployment and operations

Senior interviews move from "how does it work" to "how do you run it". Most of these questions are about what breaks when there is more than one server.

### What a build produces

`next build` compiles the app into `.next/`, prerenders the static routes, and prints the route table. `next start` runs a Node.js server over that output.

| `output` setting | Result | Use |
|---|---|---|
| default | `.next/` plus `node_modules` | `next start` on a server |
| `'standalone'` | A minimal server with only the files it needs traced into `.next/standalone` | Docker images |
| `'export'` | Plain HTML, CSS and JS in `out/` | Static hosting with no server |

A static export has no server, so everything that needs one is unavailable: Server Actions, `cookies()` and `headers()`, ISR, `proxy.ts`, redirects, rewrites and headers from the config, intercepting routes, dynamic routes without `generateStaticParams`, and the default image optimizer.

> **Docs.** [Deploying](https://nextjs.org/docs/app/getting-started/deploying) · [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) · [Static exports](https://nextjs.org/docs/app/guides/static-exports)

### Self-hosting and multiple instances

A single `next start` process works out of the box. With several replicas behind a load balancer, check each of these:

- **The cache is per instance.** Prerendered pages and cached data live in memory and on local disk. With three pods, a revalidation reaches one of them and the other two keep serving the old version. Configure a shared store: `cacheHandler` for ISR and `fetch` entries, `cacheHandlers` for `'use cache'`.
- **Server Action encryption key.** Each build generates a key for encrypting action closures. Instances that do not share it fail with "Failed to find Server Action". Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the same value everywhere.
- **Version skew.** During a rolling deploy, a browser on the old version asks the new servers for chunks and actions that no longer exist. Set `deploymentId` so Next.js can detect the mismatch and reload, and keep old static assets available for a while.
- **Streaming through the proxy.** nginx buffers responses by default, which defeats streaming. Send `X-Accel-Buffering: no`.
- **Image optimization** runs on your servers and uses CPU and memory. Size for it or use an external loader.
- **Environment variables.** `NEXT_PUBLIC_` values are fixed at build time, as covered in [Secrets and environment variables](#secrets-and-environment-variables).

```js
// next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  deploymentId: process.env.DEPLOYMENT_VERSION,
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // rely on the shared store, not per-instance memory
  async headers() {
    const noBuffering = { key: 'X-Accel-Buffering', value: 'no' };
    return [{ source: '/:path*', headers: [noBuffering] }];
  },
};
```

> **Say it like this.** "On one instance Next.js just works. On several I need a shared cache handler so revalidation reaches every replica, a fixed Server Actions encryption key, a deployment id for version skew, and a reverse proxy that does not buffer streamed responses."

> **Docs.** [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) · [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works) · [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) · [`deploymentId`](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId)

### When Next.js is the wrong choice

A senior answer includes the cases where you would not pick it:

- **An internal tool behind a login with a separate backend.** No SEO, no public pages. A Vite SPA with a client router is simpler to build, host and reason about.
- **A content site with almost no interactivity.** A static-first framework such as Astro ships less JavaScript with less machinery.
- **Long-lived connections.** Route Handlers do not handle WebSocket upgrades, so real-time features need a separate service.
- **Only static hosting is available.** A static export works but gives up most of what makes Next.js worth choosing.
- **A small team that cannot absorb the churn.** The caching model changed in 13, 15 and 16. That is a real maintenance cost.

What it is good at: public, SEO-sensitive products that mix static and personalized content, where one codebase covering rendering, data access and mutations is an advantage.

> **Docs.** [Single-page applications with Next.js](https://nextjs.org/docs/app/guides/single-page-applications) · [Deploying to platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms)

## Rapid-fire trap questions

Short answers to the questions that are easy to get wrong under pressure. Each one is explained in the chapter it belongs to.

### Rendering and hydration

- **SSR versus Server Components?** SSR produces HTML on the server. Server Components are components whose code never reaches the browser. Client Components are also server-rendered.
- **What is hydration?** React running the Client Components in the browser and attaching handlers to existing server HTML instead of creating the DOM.
- **Are Server Components hydrated?** No. Only Client Components.
- **Does a CSR app hydrate?** No. `createRoot` builds the DOM; there is nothing to adopt.
- **Does `'use client'` mean browser-only?** No. It still renders to HTML on the server on a direct visit.
- **How do you render something only in the browser?** `next/dynamic` with `ssr: false` from a Client Component, or after mount in an effect.
- **What causes a hydration mismatch?** A first client render that differs from the server's: time, randomness, `window` checks, invalid HTML nesting, browser extensions.
- **Static or dynamic, who decides?** Whether rendering needs request data. Check the `next build` output, not `next dev`.

### Components and boundaries

- **Can you pass a function from a Server to a Client Component?** No, unless it is a Server Function.
- **Can a Client Component import a Server Component?** No. Pass it as `children`.
- **Does `'use server'` make a Server Component?** No. It marks functions the client can call.
- **Does a client context provider make its children client components?** No. They pass through as rendered output.
- **Can a Client Component be `async`?** No. Use `use` with a promise from the server.
- **How does a Server Component update?** It re-runs on the server after navigation, `router.refresh()`, or a revalidating Server Action.

### Routing and navigation

- **Layout versus template?** A layout persists and keeps state across navigation. A template is re-created each time.
- **Why can a layout not read `searchParams`?** It is not re-rendered on navigation, so the value would be stale.
- **Does `error.tsx` catch errors from its own layout?** No. The layout is outside that boundary.
- **Why must `error.tsx` be a Client Component?** Error boundaries hold state and offer a retry handler.
- **Why does `useSearchParams` need Suspense?** It forces client-side rendering up to the nearest boundary in a prerendered route.
- **`params.id` is undefined?** `params` is a promise since 15. Await it.
- **Why did `redirect()` not work inside `try`?** It throws, and your `catch` swallowed it.
- **`useRouter` throws "NextRouter was not mounted"?** Imported from `next/router` instead of `next/navigation`.

### Data, caching and mutations

- **Is `fetch` cached by default?** Not since 15. It was in 13 and 14.
- **`React.cache` versus `'use cache'`?** One request versus across requests.
- **What does `revalidate: 60` guarantee?** That a refresh can start after 60 seconds, triggered by a request. Not a maximum age.
- **`revalidateTag` versus `updateTag`?** Stale-while-revalidate versus immediate expiry in a Server Action.
- **Why is data stale after a mutation?** Nothing was invalidated, or the mutation went through a Route Handler and the router was never refreshed.
- **Can you read cookies inside `'use cache'`?** No. Read outside and pass the value as an argument.
- **Are Server Actions safe because the id is secret?** No. Each one is a public `POST` endpoint and must authenticate, authorize and validate.
- **Should you fetch data with a Server Action?** No. They are sequential, uncached `POST` requests.
- **Where can you set a cookie?** In a Server Function or a Route Handler, not while rendering.

### Tooling and operations

- **Middleware or Proxy?** Same thing. `middleware.ts` became `proxy.ts` in 16 and runs on Node.js.
- **Is the proxy enough for authorization?** No. It is an optimistic check. Verify next to the data.
- **When is `NEXT_PUBLIC_` read?** At build time. It is inlined into the bundle.
- **What breaks with several replicas?** Per-instance caches, the Server Actions encryption key, version skew.
- **What does a static export give up?** Everything that needs a server: Server Actions, cookies, ISR, the proxy, image optimization.
- **Which bundler does Next.js use?** Turbopack by default since 16. Webpack remains available as an opt-out.

## Glossary

Short definitions for the terms used in this guide, in the wording the documentation uses.

- **App Router.** The router in the `app/` directory, introduced in 13 and built on React Server Components.
- **App Shell.** A per-route prerender of everything that does not depend on the URL's data. With Partial Prefetching it is what a link prefetches by default.
- **Cache Components.** The Next.js 16 caching model: `'use cache'`, `cacheLife`, `cacheTag`, and partial prerendering of every route.
- **Client cache (router cache).** RSC Payloads kept in browser memory for visited and prefetched segments.
- **Client Component.** A component reached through a `'use client'` file. Its code ships to the browser; it is still rendered to HTML on the server for a direct visit.
- **CSR (client-side rendering).** The browser builds the DOM from JavaScript. No server HTML, no hydration.
- **Data access layer (DAL).** A server-only module that centralizes data reads and the authorization checks around them.
- **Dynamic rendering.** Rendering at request time, because the output depends on request data.
- **Full route cache.** The stored HTML and RSC Payload of a prerendered route.
- **Hydration.** React attaching event handlers and state to server-rendered HTML by rendering the Client Components again in the browser.
- **Hydration mismatch.** The first client render produced different output from the server's.
- **ISR (incremental static regeneration).** Updating prerendered content after the build, by time or on demand, without a redeploy. Also called revalidation.
- **Layout.** UI shared by the routes below it. Not re-rendered on navigation between them.
- **Memoization (request).** Reusing a function's result within one server render pass.
- **Partial Prefetching.** A link prefetches the route's App Shell instead of the whole page.
- **Partial Prerendering (PPR).** A prerendered static shell with dynamic parts streamed in at request time.
- **Prefetching.** Loading a route's data in the background before the user navigates to it.
- **Prerendering.** Rendering at build time or during revalidation. Also called static rendering or SSG.
- **Proxy.** `proxy.ts`, code that runs before a request reaches a route. Formerly Middleware.
- **Request-time APIs.** `cookies()`, `headers()`, `searchParams`, `draftMode()`, `connection()`: reading them requires a request.
- **Revalidation.** Replacing cached content with a fresh version, after a time window or on demand.
- **Route Handler.** A `route.ts` file that defines HTTP method handlers for a path.
- **RSC Payload.** The serialized output of the Server Components: rendered elements, placeholders for Client Components, and their props.
- **Selective hydration.** React hydrating Suspense boundaries independently and prioritizing the one the user interacts with.
- **Server Action.** A Server Function used for a mutation, through a form `action` or a transition.
- **Server Component.** The default in `app/`. Runs only on the server and adds nothing to the client bundle.
- **Server Function.** An `async` function marked `'use server'` that the client can call over `POST`.
- **SSG (static site generation).** See prerendering.
- **SSR (server-side rendering).** Producing HTML on the server, for each request unless qualified otherwise.
- **Static shell.** The prerendered part of a route, including Suspense fallbacks, sent before any dynamic content.
- **Streaming.** Sending one HTTP response in chunks as Suspense boundaries resolve.
- **Suspense boundary.** `<Suspense>` with a fallback. In Next.js it is the line between what is prerendered and what streams.
- **Turbopack.** The Rust bundler that is the default in Next.js 16.
- **Version skew.** Clients running an older build than the server after a deploy.

### Further reading

- [Next.js documentation](https://nextjs.org/docs) and its own [glossary](https://nextjs.org/docs/app/glossary)
- [The server and client boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary), the best single page on chapters 2 to 4
- [Rendering philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy), for the "why" behind component-level rendering
- [Caching](https://nextjs.org/docs/app/getting-started/caching) and [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [Data security](https://nextjs.org/docs/app/guides/data-security) and [Authentication](https://nextjs.org/docs/app/guides/authentication)
- [Production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [React: Server Components](https://react.dev/reference/rsc/server-components) and [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)

To drill these topics, switch to the question list and filter by the Next.js tag.
