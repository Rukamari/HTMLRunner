type ElementConstructor<T extends Element> = { new (): T };

/** Get an element by id and verify its concrete DOM class at runtime. */
export function getById<T extends Element>(
  id: string,
  ctor: ElementConstructor<T>,
): T | null {
  const element = document.getElementById(id);
  return element instanceof ctor ? element : null;
}

/** Query a single element and verify its concrete DOM class at runtime. */
export function queryOne<T extends Element>(
  selector: string,
  ctor: ElementConstructor<T>,
  root: ParentNode = document,
): T | null {
  const element = root.querySelector(selector);
  return element instanceof ctor ? element : null;
}
