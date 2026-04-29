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

  it('caps nested form fields and table columns while keeping redaction', () => {
    const fields = Array.from({ length: 35 }, (_, index) => {
      const number = index + 1;
      return `<label>Field ${number}<input id="field-${number}" value="secret-${number}" /></label>`;
    }).join('');
    const columns = Array.from(
      { length: 30 },
      (_, index) => `<th>Column ${index + 1}</th>`,
    ).join('');

    setPage(`
      <main>
        <h1>Wide admin surface</h1>
        ${fields}
        <table aria-label="Accounts">
          <thead><tr>${columns}</tr></thead>
          <tbody><tr><td>Example account</td></tr></tbody>
        </table>
      </main>
    `);

    const context = buildPageContext(document, window);

    expect(context.forms).toHaveLength(1);
    expect(context.forms?.[0]?.selector).toBeUndefined();
    expect(context.forms?.[0]?.fields).toHaveLength(20);
    expect(context.forms?.[0]?.fields[19]).toMatchObject({
      label: 'Field 20',
      valuePresent: true,
    });
    expect(
      context.forms?.[0]?.fields.map((field) => field.label),
    ).not.toContain('Field 21');

    expect(context.tables).toHaveLength(1);
    expect(context.tables?.[0]?.columns).toHaveLength(16);
    expect(context.tables?.[0]?.columns[15]).toBe('Column 16');
    expect(context.tables?.[0]?.columns).not.toContain('Column 17');
    expect(JSON.stringify(context)).not.toContain('secret-');
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

  it('does not use unlabeled form control values as fallback labels', () => {
    setPage(`
      <main>
        <h1>Profile</h1>
        <input id="unlabeled-email" value="secret@example.com" />
        <select id="unlabeled-account">
          <option selected>Acme confidential account</option>
        </select>
        <label>Status <select id="status"><option selected>Active</option></select></label>
      </main>
    `);

    const context = buildPageContext(document, window);

    expect(context.interactiveElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selector: '#unlabeled-email',
          label: '',
          valuePresent: true,
        }),
        expect.objectContaining({
          selector: '#unlabeled-account',
          label: '',
          valuePresent: true,
        }),
        expect.objectContaining({
          selector: '#status',
          label: 'Status',
        }),
      ]),
    );
    expect(context.forms?.[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selector: '#status',
          label: 'Status',
        }),
      ]),
    );
  });
});
