import { ViewExt, Impl as ViewExtImpl } from "./view-ext";

export const Unconstrained = Symbol('Unconstrained')

type ValueOf<T> = T[keyof T];

type Tupleized<T> = Array<ValueOf<T>>
type TupleizedUnconstrained<T> = Array<ValueOf<T> | typeof Unconstrained>

type DEBUG_LEVEL_ENUM = 0 | 1 | 2
const DEBUG_LEVEL = 0

/**
 *  Finds the first index for which predicate is false. Returns an index of
 *  array.length if it will never be false
 *  predFn takes the form of (tuple) => boolean
 * @param array
 * @param predFnx
 * @param startIdx
 */
export function gallop<T>(array: Array<T>, predFn: (tuple: T) => boolean, startIdx = 0): number {
    if (array.length - startIdx <= 0 || !predFn(array[startIdx])) {
        return startIdx;
    }

    let step = 1;

    // Step up until we've seen a false result from predFn
    while (startIdx + step < array.length && predFn(array[startIdx + step])) {
        startIdx += step;
        step = step << 1;
    }

    // Now step down until we get a false result
    step = step >> 1;
    while (step > 0) {
        if (startIdx + step < array.length && predFn(array[startIdx + step])) {
            startIdx += step;
        }
        step = step >> 1;
    }

    return startIdx + 1;
}

function debugPrintElements(elements) {
    return `\n${elements.map((el: any) => (hasRetractionMeta(el) ? "RETRACTION" : "") + JSON.stringify(el.map((v: any) => v === Unconstrained ? "¿¿" : v))).join("\n").toString()}`
}

// Mutates the input array!
// See https://doc.rust-lang.org/1.40.0/src/core/slice/mod.rs.html#1891 for a
// great explanation of this algorithm.
// Basically we bubble duplicates to the end of the array, then split the array
// to before dupes and after dupes. O(n)
// If the array is sorted, this will remove all duplicates.
// comparatorFn should return true if the items are the same.
function dedupBy<T>(array: Array<T>, comparatorFn: (a: T, b: T) => boolean) {
    let w = 1
    for (let r = 1; r < array.length; r++) {
        const rElement = array[r];
        const wElementPrev = array[w - 1];
        if (comparatorFn(rElement, wElementPrev)) {
            // The same so we keep `w` where it is
        } else {
            // We need to swap the elements
            // But only swap if their indices are different (otherwise it's no-op)
            if (r !== w) {
                array[r] = array[w]
                array[w] = rElement
            }
            w++
        }
    }
    array.splice(w)
}


export const sortTuple = (a: any, b: any): -1 | 0 | 1 => {
    if (a === Unconstrained || b === Unconstrained) {
        return 0
    }

    if (typeof a !== "object" && typeof b !== "object") {
        return a < b ? -1 : a === b ? 0 : 1
    }

    if (a.length != b.length) {
        throw new Error('Can\'t sort different sized tuples. Tuples are not the same length')
    }

    for (let index = 0; index < a.length; index++) {
        const elementA = a[index];
        const elementB = b[index];

        if (elementA === Unconstrained || elementB === Unconstrained) {
            continue
        }

        if (elementA === elementB) {
            continue
        }

        if (Array.isArray(elementA)) {
            return sortTuple(elementA, elementB)
        }

        if (typeof elementA == 'string') {
            return elementA < elementB ? -1 : 1
        }

        return elementA < elementB ? -1 : 1
    }

    return 0
};


interface Leaper<P, V> {
    count: (prefix: P, isAntiFilterOnly?: boolean) => number
    propose: (prefix: P) => Array<V>
    // Could be faster if we mutate vals
    intersect: (prefix: P, vals: Array<V>) => Array<V>
}

type OutputKeys = Array<string | number | symbol>
// Like extend but supports output tuples with unconstrained values that may be resolved by other leapers
export class ExtendWithUnconstrained<P, KName extends string | number | symbol, K, Val> implements Leaper<P, TupleizedUnconstrained<Val>> {
    keyFunc: (P: P) => Array<any>
    outputKeys: OutputKeys
    relation: RelationIndex<KName, K, Val>
    outputTupleFunc: (relationVals: Tupleized<Val>) => TupleizedUnconstrained<Val>
    isAnti: boolean

    startIdx: number = 0
    endIdx: number = 0
    // DEBUG only!
    __cachedKeyLen = 0

    constructor(keyFunc: (P: P) => Array<any>, keyLength: number, outputKeys: OutputKeys, relation: RelationIndex<KName, K, Val>, relationKeyOrder: any, isAnti: boolean = false) {
        this.keyFunc = keyFunc
        this.outputKeys = outputKeys
        this.relation = relation
        this.isAnti = isAnti
        const myKs = relationKeyOrder.slice(keyLength)
        const mapping = myKs.reduce((acc: { [key: number]: number }, k: any, i: number) => {
            acc[i] = outputKeys.indexOf(k)
            return acc
        }, {})
        this.outputTupleFunc = (relationVals) => {
            const out = new Array(outputKeys.length)
            out.fill(Unconstrained)
            relationVals.map((val, i) => {
                if (mapping[i] > -1) {
                    out[mapping[i]] = val
                }
            })
            return out
        }
    }

    toString() {
        return `
${JSON.stringify(this.relation.keyOrdering)}
${JSON.stringify(this.outputKeys)}
isAnti:${this.isAnti}:\n${debugPrintElements(this.relation.elements.map(el => this._reshape(el as any, this.__cachedKeyLen)))}
`
    }

    /**
     *
     * @param prefix
     * @param isAntiFilterOnly Should this act as a filter. In the case of only anti leapers
     */
    count(prefix: P, isAntiFilterOnly?: boolean): number {
        const key = this.keyFunc(prefix)
        this.__cachedKeyLen = key.length
        if (this.relation.elements.length === 0) {
            return 0
        }

        // First check if our first item is past the key. This means this row doesn't exist here
        if (sortTuple(this.relation.elements[0].slice(0, key.length), key) === 1) {
            this.startIdx = this.relation.elements.length
        } else {
            this.startIdx = gallop(this.relation.elements, (row: any) => sortTuple(row.slice(0, key.length), key) === -1)
        }

        if (DEBUG_LEVEL > 1) {
            if (this.isAnti) {
                console.log("Anti count:", prefix, key, this.relation.elements, this.startIdx)
            }
        }

        // Nothing found
        if (this.startIdx === this.relation.elements.length) {
            this.endIdx = this.startIdx
            if (this.isAnti) {
                return 1e12
            }
            return 0
        }

        this.endIdx = gallop(this.relation.elements, (row: any) => sortTuple(row.slice(0, key.length), key) === 0, this.startIdx)
        const count = this.endIdx - this.startIdx
        if (this.isAnti) {
            if (isAntiFilterOnly) {
                return count > 0 ? 0 : 1e12
            }
            return 1e12
        }
        return count
    }

    isRetraction(tuple: any): boolean {
        return hasRetractionMeta(tuple)
    }

    _reshape<T>(tuple: Tupleized<Val>, keyLen: number) {
        const outputTuple = this.outputTupleFunc(tuple.slice(keyLen) as any)
        if (this.isRetraction(tuple)) {
            // @ts-ignore
            outputTuple[MetaSymbol] = { isRetraction: true }
        }
        return outputTuple
    }

    propose(prefix: P): Array<TupleizedUnconstrained<Val>> {
        const keyLen = this.keyFunc(prefix).length
        if (this.isAnti) {
            throw new Error("Antis shouldn't propose")
        }
        // console.log("In propose", this.relation.elements[0])
        return this.relation.elements.slice(this.startIdx, this.endIdx).map((tuple) => this._reshape(tuple as any, keyLen))
    }

    // Could be faster if we mutate vals
    // TODO rewrite this. It's gotten very messy
    intersect(prefix: P, vals: Array<TupleizedUnconstrained<Val>>): Array<TupleizedUnconstrained<Val>> {
        const keyLen = this.keyFunc(prefix).length
        if (DEBUG_LEVEL > 1 && this.isAnti) {
            console.log("INTERSECTION", this)
            console.log("key is", prefix, this.keyFunc(prefix))
            console.log("output key is", this.outputKeys)
            console.log("Vals is", vals)
            // @ts-ignore
            console.log("My elements are", this.relation.elements.map(e => this._reshape(e, keyLen)))
            console.log("My start/end", this.startIdx, this.endIdx)
        }
        let startIdx = this.startIdx;
        const out: Array<TupleizedUnconstrained<Val>> = []

        let valIndex = 0
        while (valIndex < vals.length && startIdx < this.endIdx) {
            const val = vals[valIndex]
            // If the input was a retraction it should taint the derived values
            const valIsRetraction = hasRetractionMeta(val)

            // @ts-ignore
            const output = this._reshape(this.relation.elements[startIdx], keyLen)
            const outputisRetraction = hasRetractionMeta(output)
            const ordResult = sortTuple(output, val)

            // No more results for this val
            if (ordResult > 0) {
                // If there are any unconstrained in our tuple, we have to reset
                // the start idx. I'm not sure if there's a way around this.
                // TODO
                if (output.some((item: any) => item === Unconstrained)) {
                    startIdx = this.startIdx
                }
                if (this.isAnti) {
                    out.push(val)
                }

                valIndex++
                continue
            }

            const hasMatch = ordResult === 0
            if (hasMatch && this.isAnti) {
                valIndex++

                // If there are any unconstrained in our tuple, we have to reset
                // the start idx. I'm not sure if there's a way around this.
                // TODO
                if (output.some((item: any) => item === Unconstrained)) {
                    startIdx = this.startIdx
                }

                continue
            }

            if (!hasMatch) {
                startIdx = gallop(this.relation.elements, (tuple: any) => {
                    const output = this._reshape(tuple, keyLen)
                    return sortTuple(output, val) === -1
                }, startIdx)
                continue
            }
            startIdx++

            // @ts-ignore
            if (DEBUG_LEVEL > 1) {
                console.log("Comparing my output:", output, "val", val, this.relation, hasMatch)
            }

            // If this is anti, we don't add it
            if (hasMatch && !this.isAnti) {
                // Check for unconstrained
                let filledInUnconstrained: null | TupleizedUnconstrained<Val> = null
                val.forEach((column, i) => {
                    if (column === Unconstrained && output[i] !== Unconstrained) {
                        if (filledInUnconstrained == null) {
                            filledInUnconstrained = [...val]
                        }
                        filledInUnconstrained[i] = output[i]
                    }
                })

                if (filledInUnconstrained) {
                    if (valIsRetraction || outputisRetraction) {
                        setRetractionMeta(filledInUnconstrained, true)
                    }
                    out.push(filledInUnconstrained)

                    // If there are any unconstrained in our tuple, we have to reset
                    // the start idx. I'm not sure if there's a way around this.
                    // TODO
                    if (startIdx === this.endIdx && output.some((item: any) => item === Unconstrained)) {
                        valIndex++
                        startIdx = this.startIdx
                    }
                    continue
                }
                out.push(val)
            }

            valIndex++
        }

        // If it's an anti query then add the rest of the vals because we add what didn't match.
        if (this.isAnti) {
            for (let index = valIndex; index < vals.length; index++) {
                out.push(vals[index])
            }
        }
        if (DEBUG_LEVEL > 1) {
            console.log("Returning: ", out)
        }


        return out
    }
}

/**
 * Returns a keyOrdering representing the joined key ordering
 * @param keyOrderings An array of keyOrderings
 */
export function joinKeyOrdering(keyOrderings: Array<Array<string>>): Array<string> {
    if (keyOrderings.length === 0) {
        return []
    } else if (keyOrderings.length === 1) {
        return keyOrderings[0]
    }

    let set = new Set<string>([])
    keyOrderings.forEach((keyOrdering) => {
        keyOrdering.forEach(k => set.add(k))
    })
    return [...set]
}

export function filterKeys(keysToKeep: Array<string>, keyOrder: Array<string>) {
    const set = new Set(keysToKeep)
    return keyOrder.filter(k => set.has(k))
}

type LeapJoinLogicFn<KVal, SourceVal, Extension> = (sourceRow: [KVal, ...Array<ValueOf<SourceVal>>], extension: Extension, isRetraction: boolean) => void
export function leapJoinHelper<KName extends string | number | symbol, KVal, SourceVal, Extension>(source: RelationIndex<KName, KVal, SourceVal>, leapers: Array<Leaper<[KVal, ...Array<ValueOf<SourceVal>>], Extension> & { isAnti?: boolean }>, logic: LeapJoinLogicFn<KVal, SourceVal, Extension>) {
    // Special case: no leapers
    if (leapers.length === 0) {
        source.elements.forEach(row => {
            const rowIsRetraction = hasRetractionMeta(row)
            // @ts-ignore
            logic(row, [], rowIsRetraction)
        })
        return
    }
    // Special case: only anti-leapers
    if (leapers.every(l => l.isAnti)) {
        source.elements.forEach(row => {
            // Do any leaper reject this row?
            if (leapers.some(l => l.count(row, true) === 0)) {
                return
            }

            const rowIsRetraction = hasRetractionMeta(row)
            // @ts-ignore
            logic(row, [], rowIsRetraction)
        })
        return
    }

    for (const row of source.elements) {
        // 1. Determine which leaper would propose the fewest values.
        let minIndex = Infinity;
        let minCount = Infinity;

        for (let index = 0; index < leapers.length; index++) {
            const leaper = leapers[index];
            if (!leaper.count) {
                console.warn('!!!!! - No leapers!', leaper)
            }
            const count = leaper.count(row)
            if (DEBUG_LEVEL > 1) {
                console.log("Leaper", leaper, "is proposing", count, "vals")
            }
            if (count < minCount) {
                minCount = count
                minIndex = index
            }
        }

        // 2. Have the least-proposing leaper propose their values.
        if (minCount > 0) {
            let vals = leapers[minIndex].propose(row)
            if (DEBUG_LEVEL > 1) {
                console.log("Leaper", leapers[minIndex], "proposed", vals)
            }
            // 3. Have the other leapers restrict the proposals.

            for (let index = 0; index < leapers.length; index++) {
                if (index !== minIndex) {
                    const leaper = leapers[index];
                    vals = leaper.intersect(row, vals)
                }
            }

            if (DEBUG_LEVEL > 0) {
                console.log("Joining Src:\n" + source.toString())
                let i = 0
                for (const leaper of leapers) {
                    console.log(`  Leaper[${i++}]${leapers[minIndex] === leaper ? "*" : ""} = ${leaper.toString()}`)
                }

                console.log("Src row is:", hasRetractionMeta(row) ? "RETRACTION:" : "", row)
                let proposals = leapers[minIndex].propose(row)
                console.log(`Leaper[${minIndex}] proposes: ${debugPrintElements(leapers[minIndex].propose(row))}`)
                i = 0
                for (const leaper of leapers) {
                    if (i !== minIndex) {
                        proposals = leaper.intersect(row, proposals)
                        console.log(`  Leaper[${i}] intersection result: ${debugPrintElements(proposals)}`)
                    }
                    i++
                }
                if (vals.length === 0) {
                    console.log(`With no join`)
                } else {
                    console.log(`With join results of: ${debugPrintElements(vals)}`)
                }
            }

            // @ts-ignore
            const rowIsRetraction = hasRetractionMeta(row)
            // 4. Call `logic` on each value
            for (const val of vals) {
                // @ts-ignore
                const valIsRetraction = hasRetractionMeta(val)
                logic(row, val, rowIsRetraction || valIsRetraction || false)
            }
        }

    }
}

const MetaSymbol: symbol = Symbol('meta')

function hasRetractionMeta(v: any): boolean {
    return !!v[MetaSymbol]?.isRetraction
}

function setRetractionMeta(v: any, isRetraction: boolean) {
    v[MetaSymbol] = { isRetraction }
}

export class RelationIndex<KName extends string | number | symbol, K, Val> {
    // Array of tuples
    elements: Array<[K, ...Array<ValueOf<Val>>]>
    keyOrdering: [KName, ...Array<keyof Val>]

    constructor(elements: Array<[K, ...Array<ValueOf<Val>>]>, keyOrdering: [KName, ...Array<keyof Val>]) {
        this.elements = elements
        this.keyOrdering = keyOrdering
    }

    toString() {
        return this.elements.map(el => `${hasRetractionMeta(el) ? "RETRACTION:" : ""}${JSON.stringify(el)}`).join("\n")
    }

    clone(): RelationIndex<KName, K, Val> {
        // @ts-ignore
        const cloned = new RelationIndex([...this.elements], [...this.keyOrdering])
        return cloned
    }

    dedup() {
        dedupBy(this.elements, (a, b) => sortTuple(a, b) === 0)
    }

    indexBy<NewKName extends keyof Val | KName, NewK extends ValueOf<Val> | K, NewVal extends { [NewKeyName in KName | keyof Val]: ValueOf<Val> | K }>(newkeyOrdering: [NewKName, ...Array<keyof NewVal>]): RelationIndex<NewKName, NewK, NewVal> {
        const keyMapping = this.keyOrdering.reduce((acc: { [key: string]: number }, k, idx) => {
            acc[k as string] = idx
            return acc
        }, {})

        const newData = this.elements.map(row => {
            const newRow = newkeyOrdering.map(k => row[keyMapping[k as string]])
            if (hasRetractionMeta(row)) {
                setRetractionMeta(newRow, true)
            }
            return newRow
        }) as Array<[NewK, ...Array<ValueOf<NewVal>>]>
        newData.sort((rowA, rowB) => sortTuple(rowA, rowB))
        return new RelationIndex(newData, newkeyOrdering)
    }

    filterElements(constants: Partial<{ [KeyName in KName]: K } & Val>, isAnti: boolean = false): RelationIndex<KName, K, Val> {
        if (isEmptyObj(constants)) {
            return this
        }

        const a = new RelationIndex(
            this.elements.filter(row => {
                return row.every((v, i) => {
                    const constantVal = constants[this.keyOrdering[i]]
                    if (constantVal !== undefined) {
                        const isEqual = (v === constantVal)
                        return isAnti ? !isEqual : isEqual
                    }
                    return true
                })
            }),
            this.keyOrdering
        )
        return a

    }

    assert(element: { [KeyName in KName]: K } & Val) {
        // @ts-ignore
        this.insertRow(this.keyOrdering.map(k => element[k]))
    }

    retract(element: { [KeyName in KName]: K } & Val) {
        // @ts-ignore
        const newRow = this.keyOrdering.map(k => element[k])
        newRow[MetaSymbol] = { isRetraction: true }
        this.insertRow(newRow, true)
    }

    insertRow(newRow: [K, ...Array<ValueOf<Val>>], isRetraction: boolean = false) {
        const insertIdx = gallop(this.elements, (row: any) => sortTuple(row, newRow) === -1)
        // Check if this is a retraction and if we have a matching datum to retract.
        // If so, we will remove the positive match and clear the slate.
        const nextDatum = this.elements[insertIdx]
        if (isRetraction) {
            if (nextDatum && !hasRetractionMeta(nextDatum) && sortTuple(nextDatum, newRow) === 0) {
                // We have a match, remove nextDatum from our elements
                this.elements.splice(insertIdx, 1)
                return
            }
        } else {
            // Check the opposite too. We added a retraction, and now we add an assertion
            if (nextDatum && hasRetractionMeta(nextDatum) && sortTuple(nextDatum, newRow) === 0) {
                // We have a match, remove nextDatum from our elements
                this.elements.splice(insertIdx, 1)
                return
            }

        }
        this.elements.splice(insertIdx, 0, newRow)
    }
}


interface Tell<Val> {
    assert: (v: Val) => void
}
interface Retract<Val> {
    retract: (v: Val) => void
}

interface MultiIndexRelation<T> {
    keys: () => Array<keyof T>
    isIndexedBy: (k: [keyof T, ...Array<keyof T>]) => number
    indexByK: (k: keyof T) => void
    indexBy: (ks: [keyof T, ...Array<keyof T>]) => RelationIndex<keyof T, keyof T, T>
}


export class Relation<T> implements MultiIndexRelation<T>, Tell<T>, Retract<T> {
    relations: Array<RelationIndex<keyof T, ValueOf<T>, { [K in keyof T]: T[K] }>> = []
    constructor() {
        this.relations = []
    }
    toString(): string {
        if (!this.relations[0]) {
            return ""
        }
        return "[" + this.relations[0]?.elements.map(el => hasRetractionMeta(el) ? `RETRACTION: ${JSON.stringify(el)}` : JSON.stringify(el)).join(", ") + "]"
    }

    dedup() {
        this.relations.forEach(relation => relation.dedup())
    }

    public get length(): number {
        if (this.relations.length === 0) {
            return 0
        }

        return this.relations[0].elements.length
    }

    clone(): Relation<T> {
        const cloned = new Relation<T>()
        cloned.relations = this.relations.map(relation => relation.clone())
        return cloned
    }

    merge(otherRelation: Relation<T>) {
        // TODO this can be faster if we remember the indices we started at. But easy just to do the simple thing for now
        const otherkeyOrdering = otherRelation.keys()
        otherRelation.relations[0].elements.forEach(row => {
            const isRetraction = hasRetractionMeta(row)
            const datum = otherkeyOrdering.reduce((acc, key, index) => {
                // @ts-ignore
                acc[key] = row[index]
                return acc
            }, {})
            if (isRetraction) {
                this.retract(datum as T)
            } else {
                this.assert(datum as T)
            }
        });
    }

    createInitialRelation(datum: T, isRetraction: boolean = false) {
        const entries = Object.entries(datum)
        const ks = entries.map(([k]) => k)
        const vals = entries.map(([, val]) => val)
        if (isRetraction) {
            // @ts-ignore
            vals[MetaSymbol] = { isRetraction: true }
        }
        const rel = new RelationIndex([vals] as any, ks as any) as any
        this.relations.push(rel)
    }

    assert(v: T) {
        if (this.relations.length === 0) {
            this.createInitialRelation(v)
            return
        }

        this.relations.forEach(relation => relation.assert(v))
    }

    retract(v: T) {
        if (this.relations.length === 0) {
            this.createInitialRelation(v, true)
            return
        }

        this.relations.forEach(relation => relation.retract(v))
    }


    _isIndexedByK(k: keyof T) {
        return this.relations.findIndex(relation => {
            return relation.keyOrdering[0] === k
        })
    }

    _isIndexedBy(ks: [keyof T, ...Array<keyof T>]) {
        return this.relations.findIndex(relation => {
            return relation.keyOrdering.every((k, i) => k === ks[i])
        })
    }

    isIndexedByK(k: keyof T) {
        return this._isIndexedByK(k)
    }

    isIndexedBy(ks: [keyof T, ...Array<keyof T>]) {
        return this._isIndexedBy(ks)
    }

    keys() {
        return this.relations[0].keyOrdering
    }

    indexByK(k: keyof T) {
        if (this.relations.length === 0) {
            console.warn("No Data to index by")
            const relation = new RelationIndex<keyof T, T[keyof T], T>([], [k])
            this.relations.push(relation)
            return relation
        }

        const indexedRelationIdx = this._isIndexedByK(k)
        if (indexedRelationIdx !== -1) {
            return this.relations[indexedRelationIdx]
        }

        const currentKeys: Array<keyof T> = this.keys()
        const newKeyOrdering = [k, ...currentKeys.filter(k2 => k2 !== k)]
        const newIndexedRelation = this.relations[0].indexBy(newKeyOrdering as any)
        // @ts-ignore
        this.relations.push(newIndexedRelation)
        return newIndexedRelation
    }

    indexBy(ks: [keyof T, ...Array<keyof T>]): RelationIndex<keyof T, keyof T, T> {
        if (this.relations.length === 0) {
            // console.warn("No Data to index by")
            return new RelationIndex<keyof T, keyof T, T>([], ks)
        }

        const indexedRelationIdx = this._isIndexedBy(ks)
        if (indexedRelationIdx !== -1) {
            // @ts-ignore
            return this.relations[indexedRelationIdx]
        }

        const newIndexedRelation = this.relations[0].indexBy(ks)
        // @ts-ignore
        this.relations.push(newIndexedRelation)
        // @ts-ignore
        return newIndexedRelation
    }
}

export const Added = Symbol("DatumAdded")
export const Removed = Symbol("DatumRemoved")
export const Modified = Symbol("DatumModified")
type DiffKind = typeof Added | typeof Removed | typeof Modified

export type RecentDatum<T> = {
    kind: typeof Added | typeof Removed
    datum: T
} | {
    kind: typeof Modified
    datum: T
    oldDatum: T
}

export class Variable<T> implements Tell<T>, Retract<T> {
    stable: Relation<T> = new Relation<T>()
    recent: Relation<T> = new Relation<T>()
    toAdd: Array<Relation<T>> = []
    _recentChanges: Array<Relation<T>> = []
    _subscribers: Array<(v: T, isRetraction: boolean) => void> = []
    meta: {
        isAnti: boolean
    } = { isAnti: false }
    // Keep track of the count of datums we've seen
    counts: Map<string, number> = new Map()
    name: string = ""

    setName(name: string) {
        this.name = name
    }

    toString(): string {
        return `
Variable ${this.name}:
    Counts: ${JSON.stringify([...this.counts])}
    Stable: ${this.stable.toString()}
    Recent: ${this.recent.toString()}
    ToAdd: ${this.toAdd.map(r => r.toString())}

`
    }

    clone(): Variable<T> {
        const cloned = new Variable<T>()
        cloned.stable = this.stable.clone()
        cloned.recent = this.recent.clone()
        cloned.toAdd = this.toAdd.map(toAdd => toAdd.clone())
        cloned.counts = new Map([...this.counts])
        return cloned
    }

    isEmpty(): boolean {
        return this.stable.length === 0 && this.recent.length === 0 && this.toAdd.length === 0
    }

    cloneAndTrack(): Variable<T> {
        const cloned = this.clone()
        this.onAssert((v, isRetraction) => isRetraction ? cloned.retract(v) : cloned.assert(v))
        return cloned
    }

    keys(): Array<string | number | symbol> {
        if (this.stable.length) {
            return this.stable.keys()
        } else if (this.recent.length) {
            return this.recent.keys()
        } else if (this.toAdd.length && this.toAdd[0].length) {
            return this.toAdd[0].keys()
        }
        throw new Error("Relation doesn't have any data. Can't infer schema")
    }

    recentData(): Array<RecentDatum<T>> | null {
        if (!this.changed()) {
            return null
        }
        return this.recent.relations[0].elements.map(row => {
            // @ts-ignore
            const datum = fromEntries(row.map((v, i) => [this.recent.relations[0].keyOrdering[i], v]))
            return {
                kind: hasRetractionMeta(row) ? Removed : Added,
                datum: datum,
            }
        })
    }

    private lastReadAllData: Array<T> | null = null
    readAllData(): Array<T> {
        if (!this.changed() && this.lastReadAllData !== null) {
            return this.lastReadAllData
        }
        while (this.changed()) { }
        if (!this.stable.relations[0]) {
            return []
        }
        this.lastReadAllData = this.stable.relations[0].elements
            .filter(el => {
                return !hasRetractionMeta(el)
            })
            .map(row => {
                // @ts-ignore
                const datum = fromEntries(row.map((v, i) => [this.stable.relations[0].keyOrdering[i], v]))
                return datum
            })
        return this.lastReadAllData
    }

    _remapKeys<In, Out>(newKeyOrdering: { [K in keyof In]: keyof Out }): Variable<Out> {
        const out = new Variable<Out>()
        out.stable = this.stable as any
        out.recent = this.recent as any
        out.toAdd = this.toAdd as any
        return out
    }


    assert(v: T) {
        if (this.toAdd.length === 0) {
            this.toAdd.push(new Relation<T>())
        }
        const nextCount = this.updateCount(v, true)
        if (nextCount === 1) {
            this.toAdd[0].assert(v)
            this._subscribers.forEach(s => s(v, false))
        }
    }

    retract(v: T) {
        if (this.toAdd.length === 0) {
            this.toAdd.push(new Relation<T>())
        }
        const nextCount = this.updateCount(v, false)
        if (nextCount === 0) {
            this.toAdd[0].retract(v)
            this._subscribers.forEach(s => s(v, true))
        }
    }

    /**
     * Returns next count
     */
    updateCount(v: T, increment: boolean): number {
        // Sort the keys
        const sortedEntries = Object.entries(v).sort(([k1], [k2]) => k1 === k2 ? 0 : k1 < k2 ? -1 : 1)
        const sortedEntriesKey = JSON.stringify(sortedEntries)
        const existingCount = this.counts.get(sortedEntriesKey) ?? 0
        const nextCount = existingCount + (increment ? 1 : -1)
        this.counts.set(sortedEntriesKey, nextCount)
        return nextCount
    }

    getCount(v: T) {
        // Sort the keys
        const sortedEntries = Object.entries(v).sort(([k1], [k2]) => k1 === k2 ? 0 : k1 < k2 ? -1 : 1)
        const sortedEntriesKey = JSON.stringify(sortedEntries)
        return this.counts.get(sortedEntriesKey) ?? 0
    }

    onAssert(f: (v: T, isRetraction: boolean) => void) {
        this._subscribers.push(f)
    }

    removeOnAssert(f: (v: T, isRetraction: boolean) => void) {
        this._subscribers = this._subscribers.filter(onAssertFn => f !== onAssertFn)
    }

    onChange(f: () => void) {
        const subscribeFn = (datum: T, isRetraction: boolean) => {
            f()
        }
        if (!this.recent.length) {
            f()
        }
        this.onAssert(subscribeFn);
        return () => { this.removeOnAssert(subscribeFn) }
    }
    onNewDatum(f: (d: RecentDatum<T>) => void) {
        const subscribeFn = (datum: T, isRetraction: boolean) => {
            f({ kind: isRetraction ? Removed : Added, datum })
        }
        this.onAssert(subscribeFn);
        return () => { this.removeOnAssert(subscribeFn) }
    }

    // recentChanges(): Generator<T>{
    // function* () {

    //     this._recentChanges.map(relation => {
    //         const indexedRelation = relation.relations[0]
    //         const keyOrder = indexedRelation.keyOrdering
    //         indexedRelation.elements.map((e, i) => [keyOrder[i], e])
    //     })
    // }
    // }

    changed() {
        // 1. Merge this.recent into this.stable.
        if (this.recent.length > 0) {
            let recent = this.recent;
            this.recent = new Relation();

            if (this.stable.relations.length === 0) {
                // There is no relation, so let's just use the toAdd as our relation
                this.stable = recent
            } else {
                this.stable.merge(recent)
            }
        }

        // 2. Move this.toAdd into this.recent.
        if (this.toAdd.length > 0) {
            // 2a. Restrict `toAdd` to tuples not in `this.stable`.
            for (let toAddIndex = 0; toAddIndex < this.toAdd.length; toAddIndex++) {
                const toAdd = this.toAdd[toAddIndex]
                if (this.stable.relations.length === 0) {
                    // There is no relation, so let's just use the toAdd as our relation
                    toAdd.dedup()
                    this.recent = toAdd
                    continue
                }

                let indexedToAddIdx = -1
                const indexedStableIdx = this.stable.relations.findIndex((relation) => {
                    indexedToAddIdx = toAdd.isIndexedBy(relation.keyOrdering)
                    return indexedToAddIdx
                })

                let indexedToAdd
                let indexedStable: any

                if (indexedStableIdx !== -1 && indexedToAddIdx !== -1) {
                    indexedStable = this.stable.relations[indexedStableIdx]
                    indexedToAdd = toAdd.relations[indexedToAddIdx]
                } else {
                    indexedStable = this.stable.indexBy(this.stable.keys())
                    indexedToAdd = toAdd.indexBy(this.stable.keys())
                }


                if (indexedToAdd === undefined || indexedStable === undefined) {
                    // Shouldn't happen
                    throw new Error("Shouldn't happen")
                }

                // Filter out elements we've already seen in our relation
                // @ts-ignore
                indexedToAdd.elements = indexedToAdd.elements.filter(elem => {
                    let searchIdx = gallop(
                        indexedStable.elements,
                        (row: any) => sortTuple(row, elem) < 0);
                    if (searchIdx < indexedStable.elements.length &&
                        sortTuple(
                            indexedStable.elements[searchIdx], elem) === 0) {
                        // Check if this is a retraction, if so let it through
                        if (hasRetractionMeta(elem)) {
                            return true
                        }
                        return false
                    }

                    return true;
                });
            }

            // 2b. Merge all newly added relations.
            let toAdd = this.toAdd.pop();
            while (!!toAdd && this.toAdd.length > 0) {
                toAdd.merge(this.toAdd.pop() as any);
            }

            if (toAdd) {
                this.recent = toAdd;
            }
        }

        // Return true iff recent is non-empty.
        return !!this.recent.length;
    }

}

//     <V1, V2, V3>(logicFn: (joined: V1 & V2 & V3) => void, ...variables: [Variable<V1>, Variable<V2>, Variable<V3>]): void
// }

export function remapKeys(keyOrder: Array<string>, keyMap: { [key: string]: string }): Array<string> {
    return keyOrder.map(k => k in keyMap ? keyMap[k] : k)
}

export function reverseRemapKeys(keyOrder: Array<string>, keyMap: { [key: string]: string }): Array<string> {
    const reversekeyMap = Object.entries(keyMap).map(([k, v]) => [v, k]).reduce((acc: any, [k, v]) => { acc[k] = v; return acc }, {})
    return remapKeys(keyOrder, reversekeyMap)
}

type RemapKeys<In, Out> = { [K in keyof In]: keyof Out }
export function variableJoinHelper<V1, V1Out = V1>(logicFn: (joined: V1, isRetraction: boolean) => void, variables: [Variable<V1>], remapKeys: [RemapKeys<V1, V1Out>], constants: [Partial<V1>]): void;
export function variableJoinHelper<V1, V2, V1Out = V1, V2Out = V2>(logicFn: (joined: V1 & V2, isRetraction: boolean) => void, variables: [Variable<V1>, Variable<V2>], remapKeys: [RemapKeys<V1, V1Out>, RemapKeys<V2, V2Out>], constants: [Partial<V1>, Partial<V2>]): void;
export function variableJoinHelper<V1, V2, V3, V1Out = V1, V2Out = V2, V3Out = V3>(logicFn: (joined: V1 & V2 & V3, isRetraction: boolean) => void, variables: [Variable<V1>, Variable<V2>, Variable<V3>], remapKeys: [RemapKeys<V1, V1Out>, RemapKeys<V2, V2Out>, RemapKeys<V3, V3Out>], constants: [Partial<V1>, Partial<V2>, Partial<V3>]): void;

export function variableJoinHelper(logicFn: (source: any, isRetraction: boolean) => void, variables: Array<any>, remapKeys: Array<any>, constants: Array<any> = []) {
    while (variables.some(v => v.changed())) {
        innerVariableJoinHelper(logicFn, variables, remapKeys, constants, false)
    }
}

export function* variableJoinHelperGen(variables: Array<any>, remapKeys: Array<any>, constants: Array<any> = []): Generator<any> {
    const out: any[] = []
    // @ts-ignore
    variableJoinHelper(joint => out.push(joint), variables, remapKeys, constants)
    for (const i of out) {
        yield i
    }
}

export function innerVariableJoinHelper(logicFn: (source: any, isRetraction: boolean) => void, variables: Array<any>, remapKeyMetas: Array<any>, constants: Array<any> = [], stableOnly: boolean) {
    // We have to compare:
    // All the recents
    // every stable against every other recent
    // every 2 stables from the reset of the recents
    // and so on...
    // Except we don't need to check all stables against each other
    // This looks a lot like a permutation of 1's and 0's.
    // Where 1 is stable, and 0 is recent.
    // Example with 3 variables
    // 0 0 0 // Check all recents against each other
    // 0 0 1 // Check the rightmost stable against the other recents
    // 0 1 0
    // 0 1 1
    // ...
    // 1 1 1 // Don't check all stables
    //
    // That looks a lot like counting.

    if (variables[0].meta.isAnti) {
        throw new Error("First Table in Query cannot be an anti (.not) query.")
    } else if (variables.length === 2 && variables[1].meta.isAnti) {
        // throw new Error("Query must have more than 2 tables if one is an anti (.not) query")
    }

    // TODO order keys by remapKeyMetas
    const srckeyOrder: Array<string> = Object.values(remapKeyMetas[0])

    const fullOutputKeyOrder = joinKeyOrdering(variables.map((_, i) => Object.values(remapKeyMetas[i])))

    const outputKeyOrder = fullOutputKeyOrder.slice(srckeyOrder.length)
    const restKeyOrders = remapKeyMetas.slice(1).map((remapKeyMeta, i) => {
        // @ts-ignore
        const indexByKeyOrder = filterKeys(Object.values(remapKeyMeta), fullOutputKeyOrder)
        return indexByKeyOrder
    })

    if (DEBUG_LEVEL > 0) {
        console.log("Output key order is", outputKeyOrder)
    }

    const restKeyOrderSets = restKeyOrders.map(keyOrder => new Set(keyOrder))
    const restkeyLengths = restKeyOrderSets.map(keyOrderSet => srckeyOrder.filter(k => keyOrderSet.has(k)).length)

    let totalIterations = (2 ** variables.length) - 1 // minus 1 since we don't need to check the final state of all stable
    let currentIteration = 0

    // If we only want to query the stable relations. This will pick only the stable relations from all the variables and only run once
    if (stableOnly) {
        totalIterations += 1
        currentIteration = totalIterations - 1
    }

    // let currentIteration = totalIterations - 1
    while (currentIteration < totalIterations) {
        const anyUndefinedRelation = variables.some((v, i) => (currentIteration >> i) & 1 ? v.stable.relations.length === 0 : v.recent.relations.length === 0)
        if (anyUndefinedRelation) {
            currentIteration++
            continue
        }
        if (DEBUG_LEVEL > 0) {
            console.log("Comparing:\n" + variables.map((v, i) => (currentIteration >> i) & 1 ? `${i}: Stable. ${v.stable.toString()}` : `${i}: Recent. ${v.recent.toString()}`).join("\n"))
        }
        const indexedRelations = variables.map((variable, index) => {
            // check if we should return a recent or stable for this relation
            const relation = ((currentIteration >> index) & 1) ? variable.stable : variable.recent
            if (index !== 0) {
                const relationKeyOrder = restKeyOrders[index - 1]
                const relationKeyOrderSet = restKeyOrderSets[index - 1]
                const keyLength = restkeyLengths[index - 1]
                let indexedRelation = relation.indexBy(reverseRemapKeys(relationKeyOrder, remapKeyMetas[index]))
                // Filter the relation with known constants. Could make joins faster
                if (constants[index] !== undefined && constants[index] !== EmptyObj) {
                    indexedRelation = indexedRelation.filterElements(constants[index])
                }

                // @ts-ignore
                return new ExtendWithUnconstrained(
                    (src: any) => {
                        const keyTuple = src.filter((_: any, i: number) => relationKeyOrderSet.has(srckeyOrder[i]))
                        return keyTuple
                        // @ts-ignore
                        // return src[srckeyOrder.indexOf(relationKeyOrder[0])]
                    },
                    keyLength,
                    outputKeyOrder,
                    // @ts-ignore
                    indexedRelation,
                    relationKeyOrder,
                    variables[index].meta.isAnti
                )
            }

            // if (DEBUG_LEVEL > 0) {
            //     console.log("Src Key Order is:", srckeyOrder)
            //     console.log("Remap Key meta", srckeyOrder)
            // }
            let indexedRelation = relation.indexBy(reverseRemapKeys(srckeyOrder, remapKeyMetas[index]))
            // Filter the relation with known constants. Could make joins faster
            if (constants[index] !== undefined && constants[index] !== EmptyObj) {
                indexedRelation = indexedRelation.filterElements(constants[index])
            }

            return indexedRelation
        })
        leapJoinHelper(indexedRelations[0] as any, indexedRelations.slice(1) as any, (sourceRow, extension: any, isRetraction: boolean) => {
            const out: any = {}
            srckeyOrder.reduce((acc: any, k: any, i: any) => {
                if (isAutoKey(k)) {
                    return acc
                }
                acc[k] = sourceRow[i]
                return acc
            }, out)
            outputKeyOrder.reduce((acc, k, i) => {
                if (isAutoKey(k)) {
                    return acc
                }
                // @ts-ignore
                acc[k] = extension[i]
                return acc
            }, out)
            logicFn(out, isRetraction)
        })

        currentIteration++
    }
}

function isEmptyObj(obj: {}) {
    if (obj === EmptyObj) {
        return true
    }

    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false;
        }
    }

    return true;
}

interface Queryable<T extends {}> {
    (keyMap: Partial<T>): void
}
interface AntiQueryable<T extends {}> {
    not(keyMap: Partial<T>): void
}

export interface View<T extends {}> {
    recentData(): null | Array<RecentDatum<T>>
    readAllData(): Array<T>
    // Returns unsubscribe fn
    onChange(subscriber: () => void): () => void
    // Returns unsubscribe fn. Doesn't affect recentData calls
    onNewDatum(subscriber: (datum: RecentDatum<T>) => void): () => void
    // Clones recentData view state, but should preserve pointer to original data
    copy(): View<T>
}

interface Viewable<T extends {}> {
    view(): View<T>
}

export interface Table<T extends {}> extends Tell<T>, Retract<T>, Queryable<T>, AntiQueryable<T>, Viewable<T> {
}

type UnsubscribeFn = () => void
export interface MaterializedTable<T extends {}> extends Queryable<T>, AntiQueryable<T>, Viewable<T> {
    // Rerun the query to see the latest changes
    runQuery: () => void
    /**
    * Add implications to the query. This allows for recursion. The results of a query can feed back to the inputs of the query.
    */
    implies: (f: (datum: T, kind: typeof Added | typeof Removed) => void) => MaterializedTable<T>
    toString: () => string
    /**
     * Subscribe to when a dependency of this MaterializedTable has change.
     * Useful if you want to know when you should rerurn the query
     */
    onDependencyChange: (subscriber: () => void) => UnsubscribeFn
    viewExt: () => ViewExt<T>
    // queryVariables: null | Array<Variable<any>>
}

type PrivateMaterializeTableState = {}
function newMaterializedTable<T>(v: Variable<T>, runQuery: () => void, onDependencyChange: (s: () => void) => UnsubscribeFn): MaterializedTable<T> {
    const outVar = new Variable<T>()
    const innerTable = _newTable(v, true)
    const materializedTable = innerTable as unknown as MaterializedTable<T> & PrivateMaterializeTableState
    materializedTable.runQuery = runQuery

    materializedTable.implies = (f: (datum: T, kind: typeof Added | typeof Removed) => void) => {
        const implicationView = materializedTable.view()
        const implicationContext = new QueryContext()
        // const scheduledRunQuery = false
        const onRecentDatum = ({ kind, datum }: RecentDatum<T>) => {
            queryContext = implicationContext
            if (kind === Added) {
                queryContext.implicationState = { isRetraction: false }
                f(datum, kind)
            } else if (kind === Removed) {
                queryContext.implicationState = { isRetraction: true }
                f(datum, kind)
            } else {
                throw new Error("Unhandle modification ??")
            }
            queryContext = emptyQueryContext

            runQuery()
            // if (!scheduledRunQuery) {
            // runQuery()
            // hmm should we schedule this to run on the next tick?
            // setTimeout(() => runQuery(), 0)
            // }
        }
        implicationView.onChange(() => {
            implicationView.recentData()?.map(onRecentDatum);
        })
        implicationView.recentData()?.map(onRecentDatum);
        return materializedTable
    }
    materializedTable.onDependencyChange = onDependencyChange
    return materializedTable

}


class QueryContext {
    implicationState: null | {
        isRetraction: boolean
    } = null;
    variables: Array<any> = []
    remapKeys: Array<any> = []
    constants: Array<any> = []
    // Indices into which variales are anti
    antiVariablesIndices: Set<number> = new Set()

    addVariable<T>(v: Variable<T>, remapKeys: any, constantVals: any) {
        this.variables.push(v)
        this.remapKeys.push(remapKeys)
        this.constants.push(constantVals)
    }

}

function fromEntries<V>(entries: Array<[string, V]>): Object {
    let nonEmpty = false
    const o = {}
    for (let [k, v] of entries) {
        nonEmpty = true
        // @ts-ignore
        o[k] = v
    }
    return nonEmpty ? o : EmptyObj
}

const emptyQueryContext = new QueryContext()
let queryContext = emptyQueryContext
/**
 * Returns a auto generated suffix key (for when a key needs to be defined, but isn't from the user)
 * @param keyName
 */
function autoKey(keyName: string) {
    return '___' + keyName + Math.random().toString(36).substring(2, 10)
}

function isAutoKey(k: string): boolean {
    return k.startsWith('___')
}


// TODO these validators are not used
// type TypeValidator = { typeName: string, validate: (t: any) => boolean }
type TypeValidator<T> = { typeName: string, validate: (t: any) => t is T }
// type TableSchema<Keys extends string | number | symbol> = { [K in Keys]: TypeValidator }
type TableSchema<T> = { [K in keyof T]: TypeValidator<T[K]> }
export function newTable<T extends {}>(schema: TableSchema<T>): Table<T> {
    return _newTable(undefined, false, schema)
}

export const StringType = {
    typeName: 'string',
    validate: (t: any): t is string => typeof t === 'string'
}

export const NumberType = {
    typeName: 'number',
    validate: (t: any): t is number => typeof t === 'number'
}

export const BoolType = {
    typeName: 'boolean',
    validate: (t: any): t is boolean => typeof t === 'boolean'
}

export const ObjectType = {
    typeName: 'object',
    validate: (t: any): t is Object => typeof t === 'object'
}

export const ArrayType = {
    typeName: 'object',
    validate: (t: any): t is Array<any> => Array.isArray(t)
}

export function _newTable<T extends {}>(existingVar?: Variable<T>, isDerived?: boolean, schema?: TableSchema<T>): Table<T> {
    const variable = existingVar || new Variable<T>()
    const table = (keymap: any) => {
        // We are in an implication clause here, so the keymap is actually datum
        if (!!queryContext.implicationState) {
            const datum: T = keymap
            if (queryContext.implicationState.isRetraction) {
                variable.retract(datum)
            } else {
                variable.assert(datum)
            }
            return
        }

        const constants = fromEntries(Object.entries(keymap).filter(([k, v]: any) => {
            if (typeof v === 'object' && v && 'ns' in v && v.ns === FreeVarNS) {
                return false
            }
            return true
        }))

        // If there's a schema, use that. Otherwise attempt to infer from the variable
        const inferredKeys = schema ? Object.keys(schema) : variable.keys()
        const remapKeys = fromEntries(Object.entries(keymap).map(([k, v]: any) => {
            if (typeof v === 'object' && v && 'ns' in v && v.ns === FreeVarNS) {
                return [k, v.k]
            }
            return [k, autoKey(k)]
        }))
        // fill in missing keys
        inferredKeys.forEach(k => {
            if (!(k in remapKeys)) {
                // @ts-ignore
                remapKeys[k] = autoKey(k)
            }
        })

        queryContext.addVariable(variable, remapKeys, constants)
    }

    const antiQuery = (keymap: any) => {
        // Adds the variable
        table(keymap)
        queryContext.antiVariablesIndices.add(queryContext.variables.length - 1)
    }

    table.not = antiQuery

    table._innerVar = variable

    if (!isDerived) {
        table.assert = (args: T) => {
            // Trick where we reverse the semantics if we are in a retraction
            if (queryContext.implicationState?.isRetraction) {
                variable.retract(args)
            } else {
                variable.assert(args)
            }
        }
        table.retract = (args: T) => {
            // // Same trick as above
            if (queryContext.implicationState?.isRetraction) {
                variable.assert(args)
            } else {
                variable.retract(args)
            }
        }
    }

    // table.clone = () => variable.clone()
    table.view = (): View<T> => {
        // It would be nice to use something like a weakref here
        // TODO: This is a potential source of memory leaks since the view can never
        // be reclaimed unless the table also gets reclaimed.
        let cloned = variable.cloneAndTrack() as unknown as View<T>
        const copyFn = () => { const cloned = variable.cloneAndTrack() as unknown as View<T>; cloned.copy = copyFn; return cloned }
        cloned.copy = copyFn
        return cloned
    }

    table.viewExt = (): ViewExt<T> => {
        return new ViewExtImpl<T>(table.view())
    }

    // queryableVariable.changed = variable.changed

    table.toString = () => variable.toString()
    return table
}

const FreeVarNS = Symbol("FreeVariable")
const FreeVarGenerator: any = new Proxy({}, {
    get: function (obj, prop) {
        return { ns: FreeVarNS, k: prop }
    }
});

export type SchemaOf<V> = V extends Table<infer T> ? T : never

export const EmptyObj = {}

export type QueryFn<Out> = (freeVars: Out) => void
export function query<Out>(queryFn: QueryFn<Out>): MaterializedTable<Out> {
    queryContext = new QueryContext()
    // @ts-ignore – a trick
    queryFn(FreeVarGenerator)
    const savedQueryContext = queryContext
    queryContext = new QueryContext()
    // Split variables into parts
    const parts: any = [[]]
    let keySetSeen = new Set(Object.values(savedQueryContext.remapKeys[0]))
    // Clone the variables so each query has it's own notions of stable/recent
    let queryVariables = savedQueryContext.variables.map((v: Variable<any>, i: number) => {
        const cloned = v.cloneAndTrack()
        const isAnti = savedQueryContext.antiVariablesIndices.has(i)

        if (isAnti) {
            cloned.meta.isAnti = true
            cloned.onAssert(() => {
                // Move everything to the stable relation
                while (cloned.changed()) { }
            })
            // Move everything to the stable relation
            while (cloned.changed()) { }
        }

        return cloned
    })

    savedQueryContext.remapKeys.forEach((remapKeys, i) => {
        if (i === 0) {
            return parts[0] = [[queryVariables[0]], [remapKeys], [savedQueryContext.constants[0]]]
        }

        const lastPart = parts[parts.length - 1]
        const vals = Object.values(remapKeys)
        if (vals.some(k => keySetSeen.has(k))) {
            lastPart[0].push(queryVariables[i])
            lastPart[1].push(savedQueryContext.remapKeys[i])
            lastPart[2].push(savedQueryContext.constants[i])
            vals.forEach(k => { keySetSeen.add(k) })
        } else {
            keySetSeen = new Set(vals)
            const newPart = [
                [queryVariables[i]],
                [savedQueryContext.remapKeys[i]],
                [savedQueryContext.constants[i]]
            ]
            parts.push(newPart)
        }
    })

    // @ts-ignore
    const variableParts = parts.map(([variables, remapKeys, constants]) => {
        const outVar = new Variable()
        const runInnerQuery = () => {
            variableJoinHelper((join, isRetraction) => { isRetraction ? outVar.retract(join) : outVar.assert(join) }, variables, remapKeys, constants)
        }
        return [outVar, runInnerQuery]
    })

    const outVar = new Variable<Out>()
    // @ts-ignore
    const joinFn = (join, isRetraction) => {
        isRetraction ? outVar.retract(join) : outVar.assert(join)
    }
    const innerVars = variableParts.map(([v]: any) => v)

    const constantParts = variableParts.map(() => EmptyObj)

    const runQuery = () => {
        variableParts.forEach(([_v, runInnerQuery]: any) => {
            runInnerQuery()
        })

        // If some output from the parts is empty, the whole query will be empty
        if (variableParts.some(([v]: [Variable<any>]) => v.isEmpty())) {
            return
        }

        // TODO this seems buggy. Queries should work even if there isn't data available
        const remapKeysPart = variableParts.map(([v, _runQuery]: any) => fromEntries(v.keys().map((k: any) => [k, k])))

        variableJoinHelper(joinFn, innerVars, remapKeysPart, constantParts)
    }


    let dependencyChangeSubscribers: Array<() => void> = []
    queryVariables.forEach(v => {
        v.onAssert(() => {
            dependencyChangeSubscribers.forEach(f => f())
        })
    })
    const onDependencyChange = (subscriber: () => void) => {
        dependencyChangeSubscribers.push(subscriber)
        return () => {
            dependencyChangeSubscribers = dependencyChangeSubscribers.filter(f => f !== subscriber)
        }
    }
    const outMaterializedTable = newMaterializedTable(outVar, runQuery, onDependencyChange)

    // Run query once
    outMaterializedTable.runQuery()

    // @ts-ignore
    outMaterializedTable.queryVariables = queryVariables

    outVar.setName("Query")
    // @ts-ignore
    outMaterializedTable.toString = () => outVar.toString()

    return outMaterializedTable
}

export function intoTable<T>(data: Array<T>) {
    const table = _newTable<T>(undefined, false, undefined)
    for (const datum of data) {
        table.assert(datum)
    }
    return table
}