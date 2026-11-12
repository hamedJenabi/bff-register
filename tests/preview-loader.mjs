// Next externalizes the Stripe SDK as an ES-module import.
export const resolve = (specifier, context, nextResolve) => {
  if (specifier === 'stripe' && process.env.BFF_PREVIEW === 'true') {
    return { url: new URL('./preview-stripe.cjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
};

// Node 18's custom loader needs an explicit format for Next's extensionless CLI.
export const load = (url, context, nextLoad) => nextLoad(url,
  url.endsWith('/node_modules/next/dist/bin/next') ? { ...context, format: 'commonjs' } : context);
