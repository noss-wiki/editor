import { stack } from "./error";

export type EventMap = { [x: string]: DataMap };
type DataMap = { [y: string]: unknown };

interface EventData<E = string> {
  readonly type: E;
  readonly parallel: boolean;
  readonly cancelable: boolean;
  readonly defaultPrevented: boolean;
  /**
   * @internal
   */
  readonly _stopped: boolean;

  readonly preventDefault: () => void;
  readonly stopImmediatePropagation: () => void;
}

type Listener<E = string, T = DataMap> = (e: T & EventData<E>) => MaybePromise<undefined | boolean>;
type MaybePromise<T> = T | Promise<T>;

export class EventFull<T extends EventMap> {
  private name: string;

  constructor(provider?: string) {
    this.name = provider ?? this.constructor.name;
  }

  private map: { [E in keyof T & string]: Listener<E, T[E]>[] } = {} as {
    [E in keyof T & string]: Listener<E, T[E]>[];
  };

  on<E extends keyof T & string>(event: E, callback: Listener<E, T[E]>) {
    if (!this.map[event]) this.map[event] = [];
    this.map[event].push(callback);
  }

  /**
   * Emits the event `event`, with the data.
   * Because listeners can be async, this method returns a promise.
   *
   * @returns A boolean indicating where the event was canceled or not.
   */
  async emit<E extends keyof T & string>(event: E, data: T[E], cancelable = true) {
    if (!this.map[event]) return false;
    const provided = { ...data, ...constructEventData(event, false, cancelable) };
    for (const callback of this.map[event]) {
      const res = stack(`${this.name}.emit`)(await callback(provided));
      if (provided._stopped) break;
      else if (res === false) provided.preventDefault();
    }
    return provided.defaultPrevented;
  }

  emitParallel<E extends keyof T & string>(event: E, data: T[E]) {
    if (!this.map[event]) return;
    const provided = { ...data, ...constructEventData(event, true, false) };
    for (const callback of this.map[event]) {
      stack(`${this.name}.emit`)(callback(provided));
      if (provided._stopped) break;
    }
  }
}

function constructEventData<E>(event: E, parallel: boolean, cancelable: boolean): EventData<E> {
  return {
    type: event,
    parallel,
    cancelable,
    defaultPrevented: false,

    preventDefault() {
      // @ts-ignore : This property is read-only to the listeners
      if (this.cancelable) this.defaultPrevented = true;
    },

    _stopped: false,
    /**
     * Stops event listeners that come after this one, from being called.
     * If `parallel` is true, this will only work if used before an await statement.
     */
    stopImmediatePropagation() {
      // @ts-ignore : This property is read-only to the listeners
      this._stopped = true;
    },
  };
}
