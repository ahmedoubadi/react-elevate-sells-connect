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

export function setLocalStorageItemWithExpiry(key:string, value:string, expiryTimeInMs:number) {
  const now = new Date()

  // `item` is an object which contains the original value
  // as well as the time when it's supposed to expire
  const item = {
      value: value,
      expiry: now.getTime() + expiryTimeInMs,
  }
  localStorage.setItem(key, JSON.stringify(item))
}

export function getLocalStorageItemWithExpiry(key:string) {
  const itemStr = localStorage.getItem(key)
  // if the item doesn't exist, return null
  if (!itemStr) {
      return null
  }
  const item = JSON.parse(itemStr)
  const now = new Date()
  // compare the expiry time of the item with the current time
  if (now.getTime() > item.expiry) {
      // If the item is expired, delete the item from storage
      // and return null
      localStorage.removeItem(key)
      return null
  }
  return item.value
}