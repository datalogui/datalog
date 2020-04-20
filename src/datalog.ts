// @ts-ignore
import * as DataFrog from '../datafrog-js/index.js'

type ValueOf<T> = T[keyof T];

type Tupleized<T> = Array<ValueOf<T>>
type TupleizedUnconstrained<T> = Array<ValueOf<T> | typeof Unconstrained>

type DEBUG_LEVEL_ENUM = 0 | 1
const DEBUG_LEVEL = 0

// type Tupleized<K, Val> = [K, ...Array<ValueOf<Val>>]

interface Leaper<P, V> {
    count: (prefix: P) => number
    propose: (prefix: P) => Array<V>
    // Could be faster if we mutate vals
    intersect: (prefix: P, vals: Array<V>) => Array<V>
}

class ExtendWith<P, KName extends string | number | symbol, K, Val> implements Leaper<P, Tupleized<Val>> {
    keyFunc: (P: P) => K
    relation: RelationIndex<KName, K, Val>

    startIdx: number = 0
    endIdx: number = 0

    constructor(keyFunc: (P: P) => K, relation: RelationIndex<KName, K, Val>) {
        this.keyFunc = keyFunc
        this.relation = relation
    }

    count(prefix: P): number {
        const key = this.keyFunc(prefix)
        this.startIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === -1
        )
        // Nothing found
        if (this.startIdx === this.relation.elements.length) {
            this.endIdx = this.startIdx
            return 0
        }

        this.endIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === 0, this.startIdx)
        return this.endIdx - this.startIdx
    }

    propose(prefix: P): Array<Tupleized<Val>> {
        return this.relation.elements.slice(this.startIdx, this.endIdx).map(([_, ...rest]) => rest)
    }

    // Could be faster if we mutate vals
    intersect(prefix: P, vals: Array<Tupleized<Val>>): Array<Tupleized<Val>> {
        const key = this.keyFunc(prefix)
        let startIdx = this.startIdx;
        return vals.filter(val => {
            startIdx = DataFrog.gallop(this.relation.elements, ([_, ...rest]: any) => {
                return DataFrog.sortTuple(rest, val) === -1
            }, startIdx)
            if (startIdx >= this.relation.elements.length) {
                return false
            }

            return DataFrog.sortTuple(this.relation.elements[startIdx]?.slice(1), val) === 0
        })
    }
}

export const Unconstrained = DataFrog.Unconstrained as symbol

type OutputKeys = Array<string | number | symbol>
// Like extend but supports output tuples with unconstrained values that may be resolved by other leapers
export class ExtendWithUnconstrained<P, KName extends string | number | symbol, K, Val> implements Leaper<P, TupleizedUnconstrained<Val>> {
    keyFunc: (P: P) => Array<any>
    outputKeys: OutputKeys
    relation: RelationIndex<KName, K, Val>
    outputTupleFunc: (relationVals: Tupleized<Val>) => TupleizedUnconstrained<Val>

    startIdx: number = 0
    endIdx: number = 0

    constructor(keyFunc: (P: P) => Array<any>, keyLength: number, outputKeys: OutputKeys, relation: RelationIndex<KName, K, Val>, relationKeyOrder: any) {
        this.keyFunc = keyFunc
        this.outputKeys = outputKeys
        this.relation = relation
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

    count(prefix: P): number {
        const key = this.keyFunc(prefix)
        this.startIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row.slice(0, key.length), key) === -1
        )

        // Nothing found
        if (this.startIdx === this.relation.elements.length) {
            this.endIdx = this.startIdx
            return 0
        }

        this.endIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row.slice(0, key.length), key) === 0, this.startIdx)
        return this.endIdx - this.startIdx
    }

    propose(prefix: P): Array<TupleizedUnconstrained<Val>> {
        const keyLen = this.keyFunc(prefix).length
        return this.relation.elements.slice(this.startIdx, this.endIdx).map((tuple) => this.outputTupleFunc(tuple.slice(keyLen) as any))
    }

    // Could be faster if we mutate vals
    intersect(prefix: P, vals: Array<TupleizedUnconstrained<Val>>): Array<TupleizedUnconstrained<Val>> {
        const keyLen = this.keyFunc(prefix).length
        let startIdx = this.startIdx;
        const out: Array<TupleizedUnconstrained<Val>> = []

        let valIndex = 0
        while (valIndex < vals.length && startIdx < this.relation.elements.length) {
            const val = vals[valIndex]

            // @ts-ignore
            const output = this.outputTupleFunc(this.relation.elements[startIdx]?.slice(keyLen))
            const ordResult = DataFrog.sortTuple(output, val)

            // No more results for this val
            if (ordResult > 0) {
                valIndex++
                continue
            }

            const hasMatch = ordResult === 0
            if (!hasMatch) {
                startIdx = DataFrog.gallop(this.relation.elements, (tuple: any) => {
                    const output = this.outputTupleFunc(tuple.slice(keyLen))
                    return DataFrog.sortTuple(output, val) === -1
                }, startIdx)
                continue
            }
            startIdx++

            // @ts-ignore
            // const output = this.outputTupleFunc(this.relation.elements[startIdx]?.slice(keyLen))
            // const hasMatch = DataFrog.sortTuple(output, val) === 0
            if (DEBUG_LEVEL > 0) {
                console.log("Comparing my output:", output, "val", val, this.relation, hasMatch)
            }

            if (hasMatch) {
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
                    out.push(filledInUnconstrained)
                    continue
                }
                out.push(val)
            }
            valIndex++
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

type LeapJoinLogicFn<KVal, SourceVal, Extension> = (sourceRow: [KVal, ...Array<ValueOf<SourceVal>>], extension: Extension) => void
export function leapJoinHelper<KName extends string | number | symbol, KVal, SourceVal, Extension>(source: RelationIndex<KName, KVal, SourceVal>, leapers: Array<Leaper<[KVal, ...Array<ValueOf<SourceVal>>], Extension>>, logic: LeapJoinLogicFn<KVal, SourceVal, Extension>) {
    if (leapers.length === 0) {
        console.log("source is", source)
        // @ts-ignore
        source.elements.forEach(row => logic(row, []))
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
            if (DEBUG_LEVEL > 0) {
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
            if (DEBUG_LEVEL > 0) {
                console.log("Leaper", leapers[minIndex], "proposed", vals)
            }
            // 3. Have the other leapers restrict the proposals.

            for (let index = 0; index < leapers.length; index++) {
                if (index !== minIndex) {
                    const leaper = leapers[index];
                    vals = leaper.intersect(row, vals)
                    if (DEBUG_LEVEL > 0) {
                        console.log("Leaper ", leapers[index], "intesersected", vals)
                        // @ts-ignore
                        console.log("Leaper it's elements were", leapers[index].relation.elements)
                    }
                }
            }

            // 4. Call `logic` on each value
            for (const val of vals) {
                logic(row, val)
            }
        }

    }
}

export class RelationIndex<KName extends string | number | symbol, K, Val> {
    // Array of tuples
    elements: Array<[K, ...Array<ValueOf<Val>>]>
    keyOrdering: [KName, ...Array<keyof Val>]

    constructor(elements: Array<[K, ...Array<ValueOf<Val>>]>, keyOrdering: [KName, ...Array<keyof Val>]) {
        this.elements = elements
        this.keyOrdering = keyOrdering
    }

    clone(): RelationIndex<KName, K, Val> {
        // @ts-ignore
        const cloned = new RelationIndex([...this.elements], [...this.keyOrdering])
        return cloned
    }

    indexBy<NewKName extends keyof Val | KName, NewK extends ValueOf<Val> | K, NewVal extends { [NewKeyName in KName | keyof Val]: ValueOf<Val> | K }>(newkeyOrdering: [NewKName, ...Array<keyof NewVal>]): RelationIndex<NewKName, NewK, NewVal> {
        const keyMapping = this.keyOrdering.reduce((acc: { [key: string]: number }, k, idx) => {
            acc[k as string] = idx
            return acc
        }, {})

        const newData = this.elements.map(row => newkeyOrdering.map(k => row[keyMapping[k as string]])) as Array<[NewK, ...Array<ValueOf<NewVal>>]>
        newData.sort((rowA, rowB) => DataFrog.sortTuple(rowA, rowB))
        return new RelationIndex(newData, newkeyOrdering)
    }

    filterElements(constants: Partial<{ [KeyName in KName]: K } & Val>): RelationIndex<KName, K, Val> {
        if (isEmptyObj(constants)) {
            return this
        }

        const a = new RelationIndex(
            this.elements.filter(row => {
                return row.every((v, i) => {
                    const constantVal = constants[this.keyOrdering[i]]
                    if (constantVal !== undefined) {
                        return v === constantVal
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

    insertRow(newRow: [K, ...Array<ValueOf<Val>>]) {
        const insertIdx = DataFrog.gallop(this.elements, (row: any) => DataFrog.sortTuple(row, newRow) === -1)
        this.elements.splice(insertIdx, 0, newRow)
    }

    extendWith<P>(keyFunc: (prefix: P) => K): ExtendWith<P, KName, K, Val> {
        return new ExtendWith(keyFunc, this)
    }
}


interface Tell<Val> {
    assert: (v: Val) => void
    // retract: (v: Val) => void
}

interface MultiIndexRelation<T> {
    keys: () => Array<keyof T>
    isIndexedBy: (k: [keyof T, ...Array<keyof T>]) => number
    indexByK: (k: keyof T) => void
    indexBy: (ks: [keyof T, ...Array<keyof T>]) => RelationIndex<keyof T, keyof T, T>
}


export class Relation<T> implements MultiIndexRelation<T>, Tell<T> {
    relations: Array<RelationIndex<keyof T, ValueOf<T>, { [K in keyof T]: T[K] }>> = []
    constructor() {
        this.relations = []
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
            const datum = otherkeyOrdering.reduce((acc, key, index) => {
                // @ts-ignore
                acc[key] = row[index]
                return acc
            }, {})
            this.assert(datum as T)
        });
    }

    createInitialRelation(datum: T) {
        // const ks = Object.keys(datum)
        // const vals = ks.map(k => datum[k])
        const entries = Object.entries(datum)
        const ks = entries.map(([k]) => k)
        const vals = entries.map(([, val]) => val)
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

    indexByk(k: keyof T) {
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

    // @ts-ignore
    indexBy(ks: [keyof T, ...Array<keyof T>]) {
        if (this.relations.length === 0) {
            // console.warn("No Data to index by")
            return new RelationIndex<keyof T, keyof T, T>([], ks)
        }

        const indexedRelationIdx = this._isIndexedBy(ks)
        if (indexedRelationIdx !== -1) {
            return this.relations[indexedRelationIdx]
        }

        const newIndexedRelation = this.relations[0].indexBy(ks)
        // @ts-ignore
        this.relations.push(newIndexedRelation)
        return newIndexedRelation
    }
}

export class Variable<T> implements Tell<T> {
    stable: Relation<T> = new Relation<T>()
    recent: Relation<T> = new Relation<T>()
    toAdd: Array<Relation<T>> = []
    _recentChanges: Array<Relation<T>> = []

    clone(): Variable<T> {
        const cloned = new Variable<T>()
        clone.stable = this.stable.clone()
        clone.recent = this.recent.clone()
        clone.toAdd = this.toAdd.map(toAdd => toAdd.clone())
        return clone
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

    recentData(): Array<T> | null {
        if (!this.changed()) {
            return null
        }
        return this.recent.relations[0].elements.map(row => {
            // @ts-ignore
            return fromEntries(row.map((v, i) => [this.recent.relations[0].keyOrdering[i], v]))
        })
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
        this.toAdd[0].assert(v)
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

                // @ts-ignore
                indexedToAdd.elements = indexedToAdd.elements.filter(elem => {
                    let searchIdx = DataFrog.gallop(
                        indexedStable.elements,
                        (row: any) => DataFrog.sortTuple(row, elem) < 0);
                    if (searchIdx < indexedStable.elements.length &&
                        DataFrog.sortTuple(
                            indexedStable.elements[searchIdx], elem) === 0) {
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
export function variableJoinHelper<V1, V1Out = V1>(logicFn: (joined: V1) => void, variables: [Variable<V1>], remapKeys: [RemapKeys<V1, V1Out>], constants: [Partial<V1>]): void;
export function variableJoinHelper<V1, V2, V1Out = V1, V2Out = V2>(logicFn: (joined: V1 & V2) => void, variables: [Variable<V1>, Variable<V2>], remapKeys: [RemapKeys<V1, V1Out>, RemapKeys<V2, V2Out>], constants: [Partial<V1>, Partial<V2>]): void;
export function variableJoinHelper<V1, V2, V3, V1Out = V1, V2Out = V2, V3Out = V3>(logicFn: (joined: V1 & V2 & V3) => void, variables: [Variable<V1>, Variable<V2>, Variable<V3>], remapKeys: [RemapKeys<V1, V1Out>, RemapKeys<V2, V2Out>, RemapKeys<V3, V3Out>], constants: [Partial<V1>, Partial<V2>, Partial<V3>]): void;

export function variableJoinHelper(logicFn: (source: any) => void, variables: Array<any>, remapKeys: Array<any>, constants: Array<any> = []) {
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

export function innerVariableJoinHelper(logicFn: (source: any) => void, variables: Array<any>, remapKeyMetas: Array<any>, constants: Array<any> = [], stableOnly: boolean) {
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

    // TODO order keys by remapKeyMetas
    // const srckeyOrder = remapKeys(variables[0].keys(), remapKeyMetas[0])
    const srckeyOrder: Array<string> = Object.values(remapKeyMetas[0])

    // const fullOutputKeyOrder = joinKeyOrdering(variables.map((v, i) => remapKeys(v.keys(), remapKeyMetas[i]) as any))
    const fullOutputKeyOrder = joinKeyOrdering(variables.map((_, i) => Object.values(remapKeyMetas[i])))

    const outputKeyOrder = fullOutputKeyOrder.slice(srckeyOrder.length)
    // const restKeyOrders = variables.slice(1).map((variable, i) => {
    const restKeyOrders = remapKeyMetas.slice(1).map((remapKeyMeta, i) => {
        // @ts-ignore
        // const indexByKeyOrder = filterKeys(remapKeys(variable.keys(), remapKeyMetas[i + 1]), fullOutputKeyOrder)
        const indexByKeyOrder = filterKeys(Object.values(remapKeyMeta), fullOutputKeyOrder)
        return indexByKeyOrder
    })

    const restKeyOrderSets = restKeyOrders.map(keyOrder => new Set(keyOrder))
    // const restKeyLengths = restKeyOrderSet.map(s => srcK)
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
        const indexedRelations = variables.map((variable, index) => {
            // check if we should return a recent or stable for this relation
            const relation = ((currentIteration >> index) & 1) ? variable.stable : variable.recent
            if (index !== 0) {
                const relationKeyOrder = restKeyOrders[index - 1]
                const relationKeyOrderSet = restKeyOrderSets[index - 1]
                const keyLength = restkeyLengths[index - 1]
                let indexedRelation = relation.indexBy(reverseRemapKeys(relationKeyOrder, remapKeyMetas[index]))
                // Filter the relation with known constants. Could make joins faster
                if (constants[index] !== undefined) {
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
                    relationKeyOrder
                )
            }
            let indexedRelation = relation.indexBy(reverseRemapKeys(srckeyOrder, remapKeyMetas[index]))
            // Filter the relation with known constants. Could make joins faster
            if (constants[index] !== undefined) {
                indexedRelation = indexedRelation.filterElements(constants[index])
            }

            return indexedRelation
        })
        leapJoinHelper(indexedRelations[0] as any, indexedRelations.slice(1) as any, (sourceRow, extension: any) => {
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
            logicFn(out)
        })

        currentIteration++
    }
}

function isIdentityKeyMap(keyMap: { [key: string]: string }): boolean {
    return Object.entries(keyMap).every(([k, v]) => k === v)
}

function variableJoinIntoVariable(outVar: Variable<any>, variables: Array<any>, remapKeyMetas: Array<any>, constants: Array<any>, stableOnly: boolean) {
    // @ts-ignore
    for (const outDatum of variableJoinHelperGen(variables, remapKeys, constants)) {
        outVar.assert(outDatum)
    }
}

export function* crossJoinVariables(variables: Array<any>) {
    // yield* variableJoinHelperGen(variables as any, variables.map(v => fromEntries(v.keys().map((k) => [k, k]))) as any, [])
}

function isEmptyObj(obj: {}) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false;
        }
    }

    return true;
}

interface Table<T extends {}> extends Tell<T> {
    (keyMap: Partial<T>): void
    assert(datum: T): void
    recentData(): Array<T> | null
}


class QueryContext {
    variables: Array<any> = []
    remapKeys: Array<any> = []
    constants: Array<any> = []

    addVariable<T>(v: Variable<T>, remapKeys: any, constantVals: any) {
        this.variables.push(v)
        this.remapKeys.push(remapKeys)
        this.constants.push(constantVals)

    }
    clear() {
        this.variables = []
        this.remapKeys = []
        this.constants = []
    }
}

function fromEntries<V>(entries: Array<[string, V]>): Object {
    const o = {}
    for (let [k, v] of entries) {
        // @ts-ignore
        o[k] = v
    }
    return o
}

let queryContext = new QueryContext()
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

export function newTable<T extends {}>(existingVar?: Variable<T>, isDerived?: boolean): Table<T> {
    const variable = existingVar || new Variable<T>()
    const queryableVariable = (keymap: any) => {
        const constants = fromEntries(Object.entries(keymap).filter(([k, v]: any) => {
            if (typeof v === 'object' && v && 'ns' in v && v.ns === FreeVarNS) {
                return false
            }
            return true
        }))
        const inferredKeys = variable.keys()
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
    queryableVariable._innerVar = variable

    if (!isDerived) {
        queryableVariable.assert = (args: T) => variable.assert(args)
    }

    queryableVariable.recentData = () => variable.recentData()
    // queryableVariable.changed = variable.changed

    return queryableVariable
}

const FreeVarNS = Symbol("FreeVariable")
const FreeVarGenerator: any = new Proxy({}, {
    get: function (obj, prop) {
        return { ns: FreeVarNS, k: prop }
    }
});

export type SchemaOf<V> = V extends Table<infer T> ? T : never

type QueryFn<Out> = (freeVars: Out) => void
export function query<Out>(queryFn: QueryFn<Out>): Table<Out> {
    queryContext = new QueryContext()
    // @ts-ignore – a trick
    queryFn(FreeVarGenerator)
    // Split variables into parts
    const parts: any = [[]]
    let keySetSeen = new Set(Object.values(queryContext.remapKeys[0]))
    // console.log("Source keys are", queryContext)
    queryContext.remapKeys.forEach((remapKeys, i) => {
        if (i === 0) {
            return parts[0] = [[queryContext.variables[0]], [remapKeys], [queryContext.constants[0]]]
        }

        const lastPart = parts[parts.length - 1]
        const vals = Object.values(remapKeys)
        if (vals.some(k => keySetSeen.has(k))) {
            lastPart[0].push(queryContext.variables[i])
            lastPart[1].push(queryContext.remapKeys[i])
            lastPart[2].push(queryContext.constants[i])
            vals.forEach(k => { keySetSeen.add(k) })
        } else {
            keySetSeen = new Set(vals)
            const newPart = [
                [queryContext.variables[i]],
                [queryContext.remapKeys[i]],
                [queryContext.constants[i]]
            ]
            parts.push(newPart)
        }
    })

    // @ts-ignore
    const variableParts = parts.map(([variables, remapKeys, constants]) => {
        const outVar = new Variable()
        variableJoinHelper((join) => { outVar.assert(join) }, variables, remapKeys, constants)
        return outVar
    })
    console.warn("Variale:", variableParts)

    const outVar = newTable()
    // @ts-ignore
    const partRemapKeys = variableParts.map(v => fromEntries(v.keys().map(k => [k, k])))
    // @ts-ignore
    variableJoinHelper((join) => { outVar.assert(join) }, variableParts, partRemapKeys, variableParts.map(() => { }))
    variableParts

    // Remove the ability to assert
    // @ts-ignore
    outVar.assert = undefined

    // while (outVar.changed()) { }
    // console.log("Variable Parts", variableParts.map(p => p.stable.relations[0].elements))
    // console.log("Remap keys", partRemapKeys)
    // console.log("Final join", outVar.stable.relations[0])

    // @ts-ignore
    // const iterator = variableJoinHelperGen(queryContext.variables, queryContext.remapKeys, queryContext.constants)
    // queryContext.clear()
    // return iterator
    return outVar
}

// Transform those into two lists [[[A, {a: 'a', b: 'b'}]], [[B, {c: 'c'}]]]
type ThingToJoin<R = any, KeyMap = { [key: string]: string }> = [R, KeyMap]
type Part = Array<ThingToJoin>
type Parts = Array<Part>
export function* recursiveForLoopJoin<Out = any>(parts: Parts, joinResultSoFar: any, remapKeysFn: (rel: any, keyMap: { [key: string]: string }) => any, joiner: (...relations: Array<any>) => Generator<any>): Generator<Out> {
    const [head, ...tail] = parts
    if (head !== undefined) {
        // TODO figure out if we need to remapKeys
        for (let out of joiner(...head.map(([r, keyMap]) => {
            if (isIdentityKeyMap(keyMap)) {
                return r
            }
            return remapKeysFn(r, keyMap)
        }))) {
            let nextJoinResultSoFar = { ...out, ...joinResultSoFar }
            if (tail.length > 0) {
                yield* recursiveForLoopJoin(tail, nextJoinResultSoFar, remapKeysFn, joiner)
            } else {
                yield nextJoinResultSoFar
            }
        }
    } else {
        throw new Error("recursiveForLoopJoin Errored. Shouldn't happen!")
    }
}