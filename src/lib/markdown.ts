import { Marked, type Tokens } from 'marked';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import graphql from 'highlight.js/lib/languages/graphql';
import http from 'highlight.js/lib/languages/http';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import lua from 'highlight.js/lib/languages/lua';
import nginx from 'highlight.js/lib/languages/nginx';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const languages = { bash, css, dockerfile, graphql, http, javascript, json, lua, nginx, plaintext, python, sql, typescript, xml, yaml };
for (const [name, lang] of Object.entries(languages)) hljs.registerLanguage(name, lang);
hljs.registerAliases(['jsx'], { languageName: 'javascript' });
hljs.registerAliases(['tsx'], { languageName: 'typescript' });
hljs.registerAliases(['sh', 'shell', 'console'], { languageName: 'bash' });
hljs.registerAliases(['text', 'txt'], { languageName: 'plaintext' });

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const name = (lang ?? '').trim().split(/\s+/)[0].toLowerCase();
      const known = name && hljs.getLanguage(name);
      const html = known ? hljs.highlight(text, { language: name }).value : escapeHtml(text);
      return `<pre class="code"><code class="hljs">${html}</code>${name ? `<span class="code-lang">${escapeHtml(name)}</span>` : ''}</pre>`;
    },
    // Raw HTML in Markdown is shown as text, never injected (answers talk about XSS a lot).
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link(this: { parser: { parseInline(t: Tokens.Generic[]): string } }, { href, title, tokens }: Tokens.Link) {
      const safe = /^(https?:|mailto:|#|\/)/i.test(href) ? href : '#';
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safe)}"${t} target="_blank" rel="noopener noreferrer">${this.parser.parseInline(tokens)}</a>`;
    },
  },
});

export const renderMarkdown = (src: string) => marked.parse(src, { async: false }) as string;
export const renderInline = (src: string) => marked.parseInline(src, { async: false }) as string;
