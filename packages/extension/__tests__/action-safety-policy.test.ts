/* global describe, expect, it, beforeEach */

import { classifyBrowserAction } from '../utils/action-safety-policy';

function element<T extends HTMLElement>(html: string, selector: string): T {
  document.body.innerHTML = html;
  const target = document.querySelector<T>(selector);
  expect(target).toBeTruthy();
  return target as T;
}

describe('action safety policy', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('allows read-only teaching actions', () => {
    const target = element<HTMLButtonElement>(
      '<button id="learn">Learn more</button>',
      '#learn',
    );

    expect(
      classifyBrowserAction({
        toolName: 'highlight_element',
        target,
        selector: '#learn',
      }),
    ).toMatchObject({ decision: 'allow', risk: 'read' });

    expect(
      classifyBrowserAction({
        toolName: 'scroll_to_element',
        target,
        selector: '#learn',
      }),
    ).toMatchObject({ decision: 'allow', risk: 'read' });
  });

  it('requires confirmation for ordinary mutating actions', () => {
    const button = element<HTMLButtonElement>(
      '<button id="open">Open details</button>',
      '#open',
    );

    expect(
      classifyBrowserAction({
        toolName: 'click_element',
        target: button,
        selector: '#open',
      }),
    ).toMatchObject({
      decision: 'confirm',
      risk: 'input',
      confirmationLabel: 'Click Open details',
    });
  });

  it('requires confirmation for destructive or externally visible labels', () => {
    const button = element<HTMLButtonElement>(
      '<button id="delete">Delete workspace</button>',
      '#delete',
    );

    expect(
      classifyBrowserAction({
        toolName: 'click_element',
        target: button,
        selector: '#delete',
      }),
    ).toMatchObject({
      decision: 'confirm',
      risk: 'destructive',
    });
  });

  it('blocks sensitive input fields without echoing typed text', () => {
    const input = element<HTMLInputElement>(
      '<label for="api">API key</label><input id="api" name="api_key" />',
      '#api',
    );

    const result = classifyBrowserAction({
      toolName: 'type_in_element',
      target: input,
      selector: '#api',
      text: 'sk-live-should-not-render',
    });

    expect(result).toMatchObject({
      decision: 'block',
      risk: 'sensitive',
    });
    expect(JSON.stringify(result)).not.toContain('sk-live-should-not-render');
  });

  it('requires confirmation for non-sensitive typing without echoing typed text', () => {
    const input = element<HTMLInputElement>(
      '<label for="name">Project name</label><input id="name" />',
      '#name',
    );

    const result = classifyBrowserAction({
      toolName: 'type_in_element',
      target: input,
      selector: '#name',
      text: 'Acme draft strategy',
    });

    expect(result).toMatchObject({
      decision: 'confirm',
      risk: 'input',
      confirmationLabel: 'Type 19 characters into Project name',
    });
    expect(JSON.stringify(result)).not.toContain('Acme draft strategy');
  });

  it('blocks password, payment, and one-time-code fields', () => {
    const password = element<HTMLInputElement>(
      '<input id="password" type="password" />',
      '#password',
    );
    expect(
      classifyBrowserAction({
        toolName: 'type_in_element',
        target: password,
        selector: '#password',
        text: 'secret',
      }),
    ).toMatchObject({ decision: 'block', risk: 'sensitive' });

    const payment = element<HTMLInputElement>(
      '<input id="card" autocomplete="cc-number" />',
      '#card',
    );
    expect(
      classifyBrowserAction({
        toolName: 'type_in_element',
        target: payment,
        selector: '#card',
        text: '4111111111111111',
      }),
    ).toMatchObject({ decision: 'block', risk: 'sensitive' });

    const otp = element<HTMLInputElement>(
      '<input id="otp" autocomplete="one-time-code" />',
      '#otp',
    );
    expect(
      classifyBrowserAction({
        toolName: 'type_in_element',
        target: otp,
        selector: '#otp',
        text: '123456',
      }),
    ).toMatchObject({ decision: 'block', risk: 'sensitive' });
  });

  it('blocks dangerous browser shortcuts and excessive repeats', () => {
    const body = document.body;

    expect(
      classifyBrowserAction({
        toolName: 'press_key',
        target: body,
        key: 'Meta+L',
      }),
    ).toMatchObject({ decision: 'block', risk: 'shortcut' });

    expect(
      classifyBrowserAction({
        toolName: 'press_key',
        target: body,
        key: 'Enter',
        repeat: 9,
      }),
    ).toMatchObject({ decision: 'block', risk: 'shortcut' });
  });

  it('blocks hidden, disabled, and extension-owned targets', () => {
    const hidden = element<HTMLButtonElement>(
      '<button id="hidden" hidden>Save</button>',
      '#hidden',
    );
    expect(
      classifyBrowserAction({
        toolName: 'click_element',
        target: hidden,
        selector: '#hidden',
      }),
    ).toMatchObject({ decision: 'block', risk: 'target' });

    const disabled = element<HTMLButtonElement>(
      '<button id="disabled" disabled>Save</button>',
      '#disabled',
    );
    expect(
      classifyBrowserAction({
        toolName: 'click_element',
        target: disabled,
        selector: '#disabled',
      }),
    ).toMatchObject({ decision: 'block', risk: 'target' });

    const owned = element<HTMLButtonElement>(
      '<div id="tribora-widget"><button id="stop">Stop</button></div>',
      '#stop',
    );
    expect(
      classifyBrowserAction({
        toolName: 'click_element',
        target: owned,
        selector: '#stop',
      }),
    ).toMatchObject({ decision: 'block', risk: 'target' });
  });
});
