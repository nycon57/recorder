/**
 * @jest-environment jsdom
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  buildPageContext,
  inspectElementFromDom,
  inspectPageRegionFromDom,
  searchPageElementsFromDom,
} from '../entrypoints/content/context-engine';

function setPage(html: string, path = '/dashboard/customers') {
  document.body.innerHTML = html;
  Object.defineProperty(document, 'title', {
    value: 'Customers',
    configurable: true,
  });
  window.history.pushState({}, '', path);
}

describe('DOM-first page context engine', () => {
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 120,
      height: 32,
      top: 0,
      right: 120,
      bottom: 32,
      left: 0,
      toJSON: () => ({}),
    } as unknown as ReturnType<HTMLElement['getBoundingClientRect']>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects generic regions, snippets, viewport, and redacted field state', () => {
    setPage(`
      <header><button>New customer</button></header>
      <main>
        <h1>Customers</h1>
        <section aria-label="Customer table">
          <p>Manage active accounts and contacts.</p>
          <label>Email <input id="email" type="email" value="secret@example.com" placeholder="name@example.com" required /></label>
          <button id="save">Save</button>
        </section>
      </main>
    `);

    const context = buildPageContext(document, window);

    expect(context.app).toBe('unknown');
    expect(context.viewport).toMatchObject({ width: expect.any(Number) });
    expect(context.regions?.some((region) => region.kind === 'main')).toBe(
      true,
    );
    expect(
      context.snippets?.some((snippet) => snippet.text.includes('Customers')),
    ).toBe(true);

    const email = context.interactiveElements.find(
      (element) => element.selector === '#email',
    );
    expect(email).toMatchObject({
      valuePresent: true,
      required: true,
      placeholder: 'name@example.com',
    });
    expect(JSON.stringify(context)).not.toContain('secret@example.com');
  });

  it('searches and inspects current DOM elements without exposing raw input values', () => {
    setPage(`
      <main>
        <h1>Project settings</h1>
        <section aria-label="Secrets">
          <label>API token <input id="token" type="password" value="sk_live_secret" /></label>
          <button id="rotate" aria-expanded="false">Rotate token</button>
        </section>
      </main>
    `);

    const context = buildPageContext(document, window);
    const matches = searchPageElementsFromDom('rotate', context, document);
    const token = inspectElementFromDom('#token', context, document);
    const region = inspectPageRegionFromDom(
      context.regions?.[0]?.id ?? 'region-1',
      context,
      document,
    );

    expect(matches[0]).toMatchObject({ selector: '#rotate', expanded: false });
    expect(token).toMatchObject({ selector: '#token', valuePresent: true });
    expect(JSON.stringify({ matches, token, region })).not.toContain(
      'sk_live_secret',
    );
    expect(region.elements.length).toBeGreaterThan(0);
  });
});
