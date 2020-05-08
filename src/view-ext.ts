import { View, RecentDatum } from './datalog'
import * as datalog from './datalog'

/**
 * A function that does some effect. It's up to you to undo that effect when you
 * get a Removed kind of RecentDatum
 */
type EffectFn<T> = (t: RecentDatum<T>) => void

export type Indexed<T> = { index: number, datum: T }

export interface ViewExt<T> extends datalog.View<T> {
  map<O>(f: (t: T) => O): ViewExt<O>;
  mapEffect<F extends EffectFn<T>>(f: F): void;

  reduce<Acc>(reducer: (accumulator: Acc, recentVal: datalog.RecentDatum<T>) => Acc, initialVal: Acc): ViewExt<Acc>

  sortBy(sortFn: (a: T, b: T) => -1 | 0 | 1): IndexedViewExt<T>
  orderBy(key: keyof T, ascending?: boolean): IndexedViewExt<T>
}

export interface IndexedViewExt<T> extends ViewExt<Indexed<T>> {
  take(n: number): IndexedViewExt<T> & ViewExt<Indexed<T>>
  drop(n: number): IndexedViewExt<T> & ViewExt<Indexed<T>>
  mapIndexed<O>(f: (t: T) => O): IndexedViewExt<O>
}

export class SingleItemView<T> implements datalog.View<T> {
  lastValSincePoll: T | null
  currentVal: T
  subscribers: Array<() => void> = []
  newDatumSubscribers: Array<(d: RecentDatum<T>) => void> = []
  modifiedSinceLastPolled = true

  constructor(initialVal: T) {
    this.currentVal = initialVal
    this.lastValSincePoll = null
  }

  copy(): View<T> {
    const copied = new SingleItemView(this.currentVal)
    copied.lastValSincePoll = this.lastValSincePoll

    return copied
  }

  _setValue(v: T) {
    this.modifiedSinceLastPolled = true
    this.currentVal = v
    this.newDatumSubscribers.forEach(subscriber => subscriber({ kind: datalog.Modified, datum: v, oldDatum: this.lastValSincePoll! }))
    this.subscribers.map(s => s())
  }

  recentData(): null | Array<RecentDatum<T>> {
    const lastVal = this.lastValSincePoll
    const modifiedSinceLastPolled = this.modifiedSinceLastPolled
    // Reset vals
    this.modifiedSinceLastPolled = false
    this.lastValSincePoll = this.currentVal
    if (lastVal === null) {
      return [{ kind: datalog.Added, datum: this.currentVal }]
    }

    return modifiedSinceLastPolled ? [{ kind: datalog.Modified, datum: this.currentVal, oldDatum: lastVal }] : null
  }

  readAllData(): Array<T> {
    this.modifiedSinceLastPolled = false
    this.lastValSincePoll = this.currentVal
    return [this.currentVal]
  }

  onChange(subscriber: () => void): () => void {
    this.subscribers.push(subscriber)
    return () => this.subscribers = this.subscribers.filter(s => s !== subscriber)
  }

  onNewDatum(subscriber: (d: RecentDatum<T>) => void): () => void {
    this.newDatumSubscribers.push(subscriber)
    return () => this.newDatumSubscribers = this.newDatumSubscribers.filter(s => s !== subscriber)
  }
}

function isPlainObj(o: any): boolean {
  return typeof o == 'object' && o.constructor == Object;
}

class MappedIndexedView<T, O> implements View<Indexed<O>> {
  innerView: View<Indexed<T>>
  // innerArray: Array<T> = []
  changes: Array<RecentDatum<Indexed<O>>> = []
  subscribers: Array<() => void> = []
  newDatumSubscribers: Array<(d: RecentDatum<Indexed<O>>) => void> = []
  mapFn: (t: T) => O

  constructor(fromView: View<Indexed<T>>, mapFn: (t: T) => O) {
    this.innerView = fromView
    this.mapFn = mapFn
    // this.innerArray = this.innerView.readAllData()
    this.changes = this.innerView.readAllData().map((d) => ({ kind: datalog.Added, datum: { index: d.index, datum: mapFn(d.datum) } }))

    const onChange = (recentDatum: RecentDatum<Indexed<T>>) => {
      const scopeChanges: Array<RecentDatum<Indexed<O>>> = []

      switch (recentDatum.kind) {
        case datalog.Added:
          scopeChanges.push({ kind: datalog.Added, datum: { index: recentDatum.datum.index, datum: mapFn(recentDatum.datum.datum) } })
          break;
        case datalog.Removed:
          scopeChanges.push({ kind: datalog.Removed, datum: { index: recentDatum.datum.index, datum: mapFn(recentDatum.datum.datum) } })
          break;
        case datalog.Modified:
          scopeChanges.push({ kind: datalog.Modified, datum: { index: recentDatum.datum.index, datum: mapFn(recentDatum.datum.datum) }, oldDatum: { index: recentDatum.oldDatum.index, datum: mapFn(recentDatum.oldDatum.datum) } })
          break;
      }

      this.changes = this.changes.concat(scopeChanges)
      this.newDatumSubscribers.forEach(subscriber => {
        scopeChanges.forEach(change => subscriber(change))
      })
      this.subscribers.forEach(subscriber => {
        subscriber()
      })
    }

    this.innerView.onChange(() => {
      const recentData = this.innerView.recentData()
      recentData?.map(onChange)
    })
  }

  recentData() {
    if (this.changes.length > 0) {
      const recentChanges = this.changes
      this.changes = []
      return recentChanges
    }
    return null
  }

  readAllData() {
    this.changes = []
    return this.innerView.readAllData().map(({ index, datum }) => ({ index, datum: this.mapFn(datum) }))
  }

  onChange(f: () => void) {
    this.subscribers.push(f)
    return () => { this.subscribers = this.subscribers.filter(s => s !== f) }
  }

  onNewDatum(f: (d: RecentDatum<Indexed<O>>) => void) {
    this.newDatumSubscribers.push(f)
    return () => {
      this.newDatumSubscribers = this.newDatumSubscribers.filter(subscriber => {
        subscriber !== f
      })
    }
  }

  copy() {
    const copied = new MappedIndexedView(this.innerView, this.mapFn)
    return copied
  }
}



class SortedView<T> implements View<Indexed<T>> {
  innerView: View<T>
  sorted: Array<T> = []
  changes: Array<RecentDatum<Indexed<T>>> = []
  subscribers: Array<() => void> = []
  newDatumSubscribers: Array<(d: RecentDatum<Indexed<T>>) => void> = []
  sortFn: (a: T, b: T) => -1 | 0 | 1

  constructor(fromView: View<T>, sortFn: (a: T, b: T) => -1 | 0 | 1) {
    this.innerView = fromView
    this.sorted = this.innerView.readAllData().sort(sortFn)
    this.changes = this.sorted.map((datum, i) => ({ kind: datalog.Added, datum: { index: i, datum } }))
    this.sortFn = sortFn

    const onChange = ({ kind, datum }: RecentDatum<T>) => {
      const scopeChanges: Array<RecentDatum<Indexed<T>>> = []
      // const stableRelation = innerVar.stable.relations[0]
      // if (!stableRelation || stableRelation.elements.length === 0) {
      if (this.sorted.length === 0) {
        if (kind !== datalog.Added) {
          throw new Error("Unexpected! We don't have anything to remove or modify")
        }

        this.changes.push({ kind: datalog.Added, datum: { index: 0, datum } })
        this.sorted.push(datum)
        return
      }

      switch (kind) {
        case datalog.Added:
          // A new datum was added, let's find out where it goes in the list
          // const positionToInsert = datalog.gallop(elements, (tuple) => sortFn(toObj(tuple), datum) === -1)
          const positionToInsert = datalog.gallop(this.sorted, (d) => sortFn(d, datum) === -1)
          this.sorted.splice(positionToInsert, 0, datum)
          scopeChanges.push({ kind: datalog.Added, datum: { index: positionToInsert, datum } })

          // This will push Modified changes on index positions, but it's not
          // needed. Since callers will end up with the same thing if they just
          // follow the Added/Removed
          // for (let i = positionToInsert + 1; i < this.sorted.length; i++) {
          //   scopeChanges.push({
          //     kind: datalog.Modified,
          //     datum: { index: i, datum: this.sorted[i] },
          //     oldDatum: { index: i - 1, datum: this.sorted[i] }
          //   })
          // }
          break;
        case datalog.Removed:
          // A new datum was removed, let's find out where it was in the list
          const positionToRemove = datalog.gallop(this.sorted, (d) => sortFn(d, datum) === -1)
          // Check if the item is there
          if (datalog.sortTuple(this.sorted[positionToRemove], datum) !== 0) {
            throw new Error("Tried to remove a value that doesn't exist!!")
          }
          // Remove from our array
          this.sorted.splice(positionToRemove, 1)
          scopeChanges.push({ kind: datalog.Removed, datum: { index: positionToRemove, datum } })

          // This will push Modified changes on index positions, but it's not
          // needed. Since callers will end up with the same thing if they just
          // follow the Added/Removed
          // for (let i = positionToRemove; i < this.sorted.length; i++) {
          //   scopeChanges.push({
          //     kind: datalog.Modified,
          //     datum: { index: i, datum: this.sorted[i] },
          //     oldDatum: { index: i + 1, datum: this.sorted[i] }
          //   })
          // }
          break;
        case datalog.Modified:
          throw new Error("Not implemented! – Modification datum on indexed View")
        // Tricky case, we have to see where the item was, and where it should
        // go. I don't think it's possible unless we add a new field to
        // modified... (old value)
      }

      this.changes = this.changes.concat(scopeChanges)
      this.newDatumSubscribers.forEach(subscriber => {
        scopeChanges.forEach(change => subscriber(change))
      })
      this.subscribers.forEach(subscriber => {
        subscriber()
      })
    }

    this.innerView.onChange(() => {
      // this.innerView.recentData()?.map(onChange)
      const recentData = this.innerView.recentData()
      recentData?.map(onChange)
    })
    // this.innerView.recentData()?.map(onChange)




  }
  recentData() {
    if (this.changes.length > 0) {
      const recentChanges = this.changes
      this.changes = []
      return recentChanges
    }
    return null
  }

  readAllData() {
    this.changes = []
    return this.sorted.map((datum, index) => ({ index, datum }))
  }

  onChange(f: () => void) {
    this.subscribers.push(f)
    return () => { this.subscribers = this.subscribers.filter(s => s !== f) }
  }

  onNewDatum(f: (d: RecentDatum<Indexed<T>>) => void) {
    this.newDatumSubscribers.push(f)
    return () => {
      this.newDatumSubscribers = this.newDatumSubscribers.filter(subscriber => {
        subscriber !== f
      })
    }
  }

  copy() {
    const copied = new SortedView(this.innerView, this.sortFn)
    return copied
  }
}


export class Impl<T> implements ViewExt<T> {
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

  copy(): View<T> {
    return this.innerView.copy()
  }

  onChange(subscriber: () => void): () => void {
    return this.innerView.onChange(subscriber)
  }

  onNewDatum(subscriber: (d: RecentDatum<T>) => void): () => void {
    return this.innerView.onNewDatum(subscriber)
  }

  map<O>(f: (t: T) => O): ViewExt<O> {
    const out = datalog._newTable<O>()
    const onChange = ({ kind, datum }: RecentDatum<T>) => {
      if (kind === datalog.Added) {
        out.assert(f(datum))
      } else {
        out.retract(f(datum))
      }
    }
    this.innerView.onChange(() => {
      this.innerView.recentData()?.map(onChange)
    })
    this.innerView.recentData()?.map(onChange)

    return new Impl(out.view())
  }

  mapEffect<F extends EffectFn<T>>(f: F) {
    const onChange = (r: RecentDatum<T>) => {
      f(r)
    }
    this.innerView.onChange(() => {
      this.innerView.recentData()?.map(onChange)
    })
    this.innerView.recentData()?.map(onChange)
  }

  reduce<Acc>(reducer: (accumulator: Acc, recentVal: datalog.RecentDatum<T>) => Acc, initalVal: Acc): ViewExt<Acc> {
    let acc = new SingleItemView(initalVal)
    const onChange = (r: RecentDatum<T>) => {
      const lastAcc = acc.currentVal
      const nextVal = reducer(acc.currentVal, r)
      if (lastAcc !== nextVal) {
        acc._setValue(nextVal)
      }
    }
    this.innerView.onChange(() => {
      this.innerView.recentData()?.map(onChange)
    })
    this.innerView.recentData()?.map(onChange)
    return new Impl(acc)
  }

  sortBy(sortFn: (a: T, b: T) => -1 | 0 | 1): IndexedViewExt<T> {
    return new IndexedImpl(new SortedView(this.innerView, sortFn))
  }

  orderBy(key: keyof T, ascending: boolean = true): IndexedViewExt<T> {
    const sortFn = (a: T, b: T): -1 | 0 | 1 => {
      const aEl = a[key]
      const bEl = b[key]
      const result = (aEl < bEl ? -1 : aEl > bEl ? 1 : 0)
      return result * (ascending ? 1 : -1) as -1 | 0 | 1
    }
    return this.sortBy(sortFn)
  }
}

export class IndexedImpl<T> implements IndexedViewExt<T> {
  innerView: ViewExt<Indexed<T>>
  filters: { take?: number, drop?: number } = {}
  constructor(fromView: View<Indexed<T>>) {
    this.innerView = new Impl(fromView)
  }

  take(n: number): IndexedViewExt<T> {
    const nextView = this.copy()
    nextView.filters.take = n
    nextView.filters.drop = this.filters.drop
    return nextView
  }

  drop(n: number): IndexedViewExt<T> {
    const nextView = this.copy()
    nextView.filters.drop = (this.filters.drop || 0) + n
    nextView.filters.take = this.filters.take ? Math.max(this.filters.take - n, 0) : this.filters.take
    return nextView
  }

  private passThruDatum(datum: Indexed<T>): boolean {
    if (!this.filters.take && !this.filters.drop) {
      return true
    }

    return (datum.index >= (this.filters.drop || 0) && datum.index < ((this.filters.take || Infinity) + (this.filters.drop || 0)))
  }

  recentData(): null | Array<RecentDatum<Indexed<T>>> {
    return this.innerView.recentData()?.filter((recentDatum) => {
      if (recentDatum.kind === datalog.Modified) {
        return this.passThruDatum(recentDatum.datum) || this.passThruDatum(recentDatum.oldDatum)
      }
      return this.passThruDatum(recentDatum.datum)
    }) || null
  }

  readAllData(): Array<Indexed<T>> {
    return this.innerView.readAllData().filter((datum) => this.passThruDatum(datum))
  }
  // Returns unsubscribe fn
  onChange(subscriber: () => void): () => void {
    return this.innerView.onChange(subscriber)
  }

  // Returns unsubscribe fn
  onNewDatum(subscriber: (d: RecentDatum<Indexed<T>>) => void): () => void {
    return this.innerView.onNewDatum(subscriber)
  }

  copy() {
    return new IndexedImpl(this.innerView.copy())
  }

  map<O>(f: (t: Indexed<T>) => O): ViewExt<O> {
    return this.innerView.map(f)
  }

  mapIndexed<O>(f: (t: T) => O): IndexedViewExt<O> {
    return new IndexedImpl(new MappedIndexedView(this.innerView, f))
  }

  mapEffect<F extends EffectFn<Indexed<T>>>(f: F): void {
    return this.innerView.mapEffect(f)
  }

  reduce<Acc>(reducer: (accumulator: Acc, recentVal: datalog.RecentDatum<Indexed<T>>) => Acc, initialVal: Acc): ViewExt<Acc> {
    return this.innerView.reduce(reducer, initialVal)
  }

  sortBy(sortFn: (a: Indexed<T>, b: Indexed<T>) => -1 | 0 | 1): IndexedViewExt<Indexed<T>> {
    return this.innerView.sortBy(sortFn)
  }

  orderBy(key: keyof Indexed<T>, ascending: boolean = true): IndexedViewExt<Indexed<T>> {
    return this.innerView.orderBy(key, ascending)
  }
}