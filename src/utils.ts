export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const safeJSON = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return undefined;
  }
};

export function debug(action: string, ...args: any[]) {
  if (typeof process !== 'undefined' && process.env['DEBUG'] === 'true') {
    console.log(`AiChat:DEBUG:${action}`, ...args);
  }
}

const startsWithSchemeRegexp = new RegExp('^(?:[a-z]+:)?//', 'i');
export const isAbsoluteURL = (url: string): boolean => {
  return startsWithSchemeRegexp.test(url);
};

export function isEmptyObj(obj: Object | null | undefined): boolean {
  if (!obj) return true;
  for (const _k in obj) return false;
  return true;
}
