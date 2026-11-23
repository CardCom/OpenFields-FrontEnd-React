// One look for every field on the checkout - the page's own inputs and the CardCom iframes
// (whose inside is styled by iframeFieldCss.ts with the same values: 48px tall, 16px text,
// 12px side padding, slate-900 text, slate-400 placeholder).

export const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

const border = (invalid: boolean) =>
  invalid
    ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/20'
    : 'border-slate-300 focus-within:border-brand-500 focus-within:ring-brand-500/20 focus:border-brand-500 focus:ring-brand-500/20';

const shell = 'h-12 w-full rounded-xl border bg-white transition focus-within:ring-4 focus:ring-4';

/** A plain <input> on the page. */
export const fieldClass = `${shell} ${border(false)} px-3 text-base text-slate-900 placeholder:text-slate-400 outline-none`;

/**
 * The box around a CardCom iframe (the iframe fills it, borderless). `focused` comes from
 * useFocusedIframe - CSS :focus-within does not see focus inside a cross-origin iframe.
 */
export const fieldBoxClass = (invalid: boolean, focused = false) => {
  const state = focused
    ? invalid
      ? 'border-rose-500 ring-4 ring-rose-500/20'
      : 'border-brand-500 ring-4 ring-brand-500/20'
    : invalid
      ? 'border-rose-500'
      : 'border-slate-300';
  return `h-12 w-full rounded-xl border bg-white transition overflow-hidden ${state}`;
};
