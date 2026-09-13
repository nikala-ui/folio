const IMMUTABLE_MESSAGE = "Cannot mutate an immutable plugin snapshot";

class ImmutableMap<K, V> extends Map<K, V> {
  constructor(entries: readonly (readonly [K, V])[]) {
    super();
    for (const [key, value] of entries) Map.prototype.set.call(this, key, value);
  }

  override set(): this { throw new TypeError(IMMUTABLE_MESSAGE); }
  override delete(): boolean { throw new TypeError(IMMUTABLE_MESSAGE); }
  override clear(): void { throw new TypeError(IMMUTABLE_MESSAGE); }
}

class ImmutableSet<T> extends Set<T> {
  constructor(values: readonly T[]) {
    super();
    for (const value of values) Set.prototype.add.call(this, value);
  }

  override add(): this { throw new TypeError(IMMUTABLE_MESSAGE); }
  override delete(): boolean { throw new TypeError(IMMUTABLE_MESSAGE); }
  override clear(): void { throw new TypeError(IMMUTABLE_MESSAGE); }
}

function isPlainObject(value: object): value is Record<PropertyKey, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function immutableObject<T extends object>(value: T, seen: WeakMap<object, unknown>): T {
  if (seen.has(value)) return seen.get(value) as T;

  let proxy: T;
  proxy = new Proxy(value, {
    get(target, property) {
      const result = Reflect.get(target, property, target);
      if (typeof result === "function") return result.bind(proxy);
      return clone(result, seen);
    },
    set() { throw new TypeError(IMMUTABLE_MESSAGE); },
    deleteProperty() { throw new TypeError(IMMUTABLE_MESSAGE); },
    defineProperty() { throw new TypeError(IMMUTABLE_MESSAGE); },
  });
  seen.set(value, proxy);
  return proxy;
}

const dateMutators = new Set([
  "setDate", "setFullYear", "setHours", "setMilliseconds", "setMinutes", "setMonth",
  "setSeconds", "setTime", "setUTCDate", "setUTCFullYear", "setUTCHours",
  "setUTCMilliseconds", "setUTCMinutes", "setUTCMonth", "setUTCSeconds", "setYear",
]);

function immutableDate(value: Date, seen: WeakMap<object, unknown>): Date {
  const target = new Date(value.getTime());
  const proxy = new Proxy(target, {
    get(current, property) {
      const result = Reflect.get(current, property, current);
      if (typeof result !== "function") return clone(result, seen);
      if (typeof property === "string" && dateMutators.has(property)) {
        return () => { throw new TypeError(IMMUTABLE_MESSAGE); };
      }
      return result.bind(current);
    },
    set() { throw new TypeError(IMMUTABLE_MESSAGE); },
    deleteProperty() { throw new TypeError(IMMUTABLE_MESSAGE); },
    defineProperty() { throw new TypeError(IMMUTABLE_MESSAGE); },
  });
  seen.set(value, proxy);
  Object.freeze(target);
  return proxy;
}

function immutableRegExp(value: RegExp, seen: WeakMap<object, unknown>): RegExp {
  const target = new RegExp(value.source, value.flags);
  target.lastIndex = value.lastIndex;
  const proxy = new Proxy(target, {
    get(current, property) {
      const result = Reflect.get(current, property, current);
      if (typeof result !== "function") return clone(result, seen);
      if (property === "compile") return () => { throw new TypeError(IMMUTABLE_MESSAGE); };
      return (...args: unknown[]) => {
        const working = new RegExp(current.source, current.flags);
        working.lastIndex = current.lastIndex;
        return Reflect.apply(result, working, args);
      };
    },
    set() { throw new TypeError(IMMUTABLE_MESSAGE); },
    deleteProperty() { throw new TypeError(IMMUTABLE_MESSAGE); },
    defineProperty() { throw new TypeError(IMMUTABLE_MESSAGE); },
  });
  seen.set(value, proxy);
  Object.freeze(target);
  return proxy;
}

function clone(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return immutableDate(value, seen);
  if (value instanceof RegExp) return immutableRegExp(value, seen);
  if (value instanceof Map) {
    const copy = new ImmutableMap<unknown, unknown>([]);
    seen.set(value, copy);
    for (const [key, child] of value) {
      Map.prototype.set.call(copy, clone(key, seen), clone(child, seen));
    }
    return copy;
  }
  if (value instanceof Set) {
    const copy = new ImmutableSet<unknown>([]);
    seen.set(value, copy);
    for (const child of value) Set.prototype.add.call(copy, clone(child, seen));
    return copy;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) return immutableObject(value, seen);

  const copy = Array.isArray(value) ? [] as unknown[] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      Object.defineProperty(copy, key, { ...descriptor, value: clone(descriptor.value, seen) });
    }
  }
  return copy;
}

function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  if (!Array.isArray(value) && !isPlainObject(value) && !(value instanceof Map) && !(value instanceof Set)) return value;
  seen.add(value);
  if (value instanceof Map) {
    for (const [key, child] of value) { freeze(key, seen); freeze(child, seen); }
  } else if (value instanceof Set) {
    for (const child of value) freeze(child, seen);
  } else {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) freeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

export function snapshot<T>(value: T): Readonly<T> {
  return freeze(clone(value, new WeakMap<object, unknown>()) as T);
}
