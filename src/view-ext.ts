import { View, RecentDatum } from './datalog'
import * as datalog from './datalog'

type UndoEffectFn = () => void

/**
 * A function that does some effect, and returns an callback to undo that effect
 */
type EffectFn<T> = (t: T) => UndoEffectFn

type Indexed<T> = { index: number, datum: T }

interface ViewExt<T> extends datalog.View<T> {
  map<O>(f: (t: T) => O): ViewExt<O>;
  mapEffect<F extends EffectFn<T>>(f: F): void;

  // reduce<Acc>(reducer: (accumulator: Acc, recentVal: datalog.RecentDatum<T>) => Acc): ViewExt<Acc>

  // sortBy(sortFn: (a: T, B: T) => -1 | 0 | 1): ViewExt<Indexed<T>>
  // orderBy(key: string, ascending?: boolean): ViewExt<Indexed<T>>

  // take(n: number): ViewExt<T>
  // drop(n: number): ViewExt<T>
}

function isPlainObj(o: any): boolean {
  return typeof o == 'object' && o.constructor == Object;
}

class ViewExtImpl<T> implements ViewExt<T> {
  innerView: View<T>
  constructor(v: View<T>) {
    this.innerView = v
  }
  recentData(): null | Array<RecentDatum<T>> {
    return this.innerView.recentData()
  }
  readAllData(): Array<T> {
    return this.innerView.readAllData()
  }

  // Returns unsubscribe fn
  onChange(subscriber: (t: T, isRetraction: boolean) => void): () => void {
    return this.innerView.onChange(subscriber)
  }

  onChangeRecentDatum(subscriber: (t: datalog.RecentDatum<T>) => void): () => void {
    return this.innerView.onChangeRecentDatum(subscriber)
  }

  map<O>(f: (t: T) => O): ViewExt<O> {
    const out = datalog._newTable<O>()
    this.innerView.onChange((v, isRetraction) => {
      if (!isRetraction) {
        out.assert(f(v))
      } else {
        out.retract(f(v))
      }
    })

    return new ViewExtImpl(out.view())
  }


  warnMissingUndo() {
    console.warn("Failed to lookup Undo FN. Is this value serializable?")
  }

  mapEffect<F extends EffectFn<T>>(f: F) {
    const out = datalog._newTable<typeof datalog.EmptyObj>()
    const fnLookup: any = {}
    this.innerView.onChange((v, isRetraction) => {
      const key = isPlainObj(v) ? JSON.stringify(v) : v
      if (!isRetraction) {
        const undoFn = f(v)
        fnLookup[key] = undoFn
      } else {
        const undoFn = fnLookup[key] || this.warnMissingUndo
        undoFn()
      }
    })
  }


}