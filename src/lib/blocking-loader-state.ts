// External store — axios interceptors and navigation events update this,
// useSyncExternalStore reads it inside React.

let _apiPending = 0;
let _navPending = 0;
const _subscribers = new Set<() => void>();

function emit() {
  _subscribers.forEach((cb) => cb());
}

export function subscribe(cb: () => void): () => void {
  _subscribers.add(cb);
  return () => _subscribers.delete(cb);
}

export function getIsBlocking(): boolean {
  return _apiPending > 0 || _navPending > 0;
}

export function notifyRequestStart(): void {
  _apiPending += 1;
  emit();
}

export function notifyRequestEnd(): void {
  _apiPending = Math.max(0, _apiPending - 1);
  emit();
}

export function notifyNavStart(): void {
  _navPending = 1;
  emit();
}

export function notifyNavEnd(): void {
  _navPending = 0;
  emit();
}
