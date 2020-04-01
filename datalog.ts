// @ts-ignore
import * as DataFrog from 'datafrog-js'

type ValueOf<T> = T[keyof T];

type Tupleized<T> = Array<ValueOf<T>>
type TupleizedUnconstrained<T> = Array<ValueOf<T> | typeof Unconstrained>

// type Tupleized<K, Val> = [K, ...Array<ValueOf<Val>>]

interface Leaper<P, V> {
    count: (prefix: P) => number
    propose: (prefix: P) => Array<V>
    // Could be faster if we mutate vals
    intersect: (prefix: P, vals: Array<V>) => Array<V>
}

// type ExtendWith = {
//     keyFunc: (P: P) => K
//     relation: RelationIndex<KName, K, Val>
// }

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
        this.endIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === 0, this.startIdx + 1)
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
    keyFunc: (P: P) => K
    outputKeys: OutputKeys
    relation: RelationIndex<KName, K, Val>
    outputTupleFunc: (relationVals: Tupleized<Val>) => TupleizedUnconstrained<Val>

    startIdx: number = 0
    endIdx: number = 0

    constructor(keyFunc: (P: P) => K, outputKeys: OutputKeys, relation: RelationIndex<KName, K, Val>) {
        this.keyFunc = keyFunc
        this.outputKeys = outputKeys
        this.relation = relation
        const myKs = this.relation.keyOrdering.slice(1)
        const unconstrainedIndices = []
        const mapping = myKs.reduce((acc: { [key: number]: number }, k, i) => {
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
        this.startIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === -1
        )
        this.endIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === 0, this.startIdx + 1)
        return this.endIdx - this.startIdx
    }

    propose(prefix: P): Array<TupleizedUnconstrained<Val>> {
        return this.relation.elements.slice(this.startIdx, this.endIdx).map(([_, ...rest]) => this.outputTupleFunc(rest))
    }

    // Could be faster if we mutate vals
    intersect(prefix: P, vals: Array<TupleizedUnconstrained<Val>>): Array<TupleizedUnconstrained<Val>> {
        const key = this.keyFunc(prefix)
        let startIdx = this.startIdx - 1;
        const out: Array<TupleizedUnconstrained<Val>> = []

        let valIndex = 0
        while (valIndex < vals.length) {
            const val = vals[valIndex]
            startIdx = DataFrog.gallop(this.relation.elements, ([_, ...rest]: any) => {
                const output = this.outputTupleFunc(rest)
                DataFrog.sortTuple(output[0], val[0]) === -1
            }, startIdx + 1)

            if (startIdx >= this.relation.elements.length) {
                break
            }

            // @ts-ignore
            const output = this.outputTupleFunc(this.relation.elements[startIdx]?.slice(1))
            const hasMatch = DataFrog.sortTuple(output, val) === 0

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

// Like extend but supports output tuples with rest of keys
export class ExtendWithAndCarry<P, KName extends string | number | symbol, K, Val> implements Leaper<P, [Tupleized<Val>, Partial<Val>]> {
    keyFunc: (P: P) => K
    outputTupleFunc: (val: Tupleized<Val>) => [Tupleized<Val>, Partial<Val>]
    relation: RelationIndex<KName, K, Val>

    startIdx: number = 0
    endIdx: number = 0

    /**
     * outputTupleFunc should return first common tuples, then an object of the rest of the row
     * i.e. if the relation is {a: number, c: number, d: number}, but the other leaper is {b: number: c:number}, the common tuple would be [c], and the rest would be {d: number}
     */
    constructor(keyFunc: (P: P) => K, outputTupleFunc: (val: Tupleized<Val>) => [Tupleized<Val>, Partial<Val>], relation: RelationIndex<KName, K, Val>) {
        this.keyFunc = keyFunc
        this.outputTupleFunc = outputTupleFunc
        this.relation = relation
    }

    count(prefix: P): number {
        const key = this.keyFunc(prefix)
        this.startIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === -1
        )
        this.endIdx = DataFrog.gallop(this.relation.elements, (row: any) => DataFrog.sortTuple(row[0], key) === 0, this.startIdx + 1)
        return this.endIdx - this.startIdx
    }

    propose(prefix: P): Array<[Tupleized<Val>, Partial<Val>]> {
        return this.relation.elements.slice(this.startIdx, this.endIdx).map(([_, ...rest]) => this.outputTupleFunc(rest))
    }

    // Could be faster if we mutate vals
    intersect(prefix: P, vals: Array<[Tupleized<Val>, Partial<Val>]>): Array<[Tupleized<Val>, Partial<Val>]> {
        const key = this.keyFunc(prefix)
        let startIdx = this.startIdx;
        return vals.filter(val => {
            startIdx = DataFrog.gallop(this.relation.elements, ([_, ...rest]: any) => {
                const output = this.outputTupleFunc(rest)
                DataFrog.sortTuple(output[0], val[0]) === -1
            })
            if (startIdx >= this.relation.elements.length) {
                return false
            }

            // @ts-ignore
            const output = this.outputTupleFunc(this.relation.elements[startIdx]?.slice(1))
            const hasMatch = DataFrog.sortTuple(output[0], val[0]) === 0
            if (hasMatch) {
                // @ts-ignore
                val[1] = { ...val[1], ...output[1] }
            }
            return hasMatch
        })
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

    let focusedKeyOrdering = 0
    let indicesInKeys = keyOrderings.map(_ => 0)
    const out: Array<string> = []
    while (focusedKeyOrdering < keyOrderings.length) {
        const focusedKeyOrder = keyOrderings[focusedKeyOrdering]
        const focusedKey = focusedKeyOrder[indicesInKeys[focusedKeyOrdering]]
        // Add the focused key to our output
        out.push(focusedKey)

        // Increment the position of any matching key orderings
        keyOrderings.slice(focusedKeyOrdering + 1).forEach((keyOrdering, j) => {
            const i = j + focusedKeyOrdering + 1
            if (keyOrdering[indicesInKeys[i]] === focusedKey) {
                indicesInKeys[i] = indicesInKeys[i] + 1
            }
        })

        indicesInKeys[focusedKeyOrdering] = indicesInKeys[focusedKeyOrdering] + 1

        while (focusedKeyOrdering < keyOrderings.length && indicesInKeys[focusedKeyOrdering] >= keyOrderings[focusedKeyOrdering].length) {
            focusedKeyOrdering++
        }
    }

    return out
}

export function filterKeys(keysToKeep: Array<string>, keyOrder: Array<string>) {
    const set = new Set(keysToKeep)
    return keyOrder.filter(k => set.has(k))
}

type LeapJoinLogicFn<KVal, SourceVal, Extension> = (sourceRow: [KVal, ...Array<ValueOf<SourceVal>>], extension: Extension) => void

export function leapJoinHelper<KName extends string | number | symbol, KVal, SourceVal, Extension>(source: RelationIndex<KName, KVal, SourceVal>, leapers: Array<Leaper<[KVal, ...Array<ValueOf<SourceVal>>], Extension>>, logic: LeapJoinLogicFn<KVal, SourceVal, Extension>) {
    for (let rowAndExtension of leapJoinHelperGen(source, leapers)) {
        logic(...rowAndExtension)
    }
}
export function* leapJoinHelperGen<KName extends string | number | symbol, KVal, SourceVal, Extension>(source: RelationIndex<KName, KVal, SourceVal>, leapers: Array<Leaper<[KVal, ...Array<ValueOf<SourceVal>>], Extension>>): Generator<[[KVal, ...Array<ValueOf<SourceVal>>], Extension], void, undefined> {
    if (leapers.length === 0) {
        // @ts-ignore
        yield* source.elements.map(row => [row, []])
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
            if (count < minCount) {
                minCount = count
                minIndex = index
            }
        }

        // 2. Have the least-proposing leaper propose their values.
        if (minCount > 0) {
            let vals = leapers[minIndex].propose(row)
            // 3. Have the other leapers restrict the proposals.

            for (let index = 0; index < leapers.length; index++) {
                if (index !== minIndex) {
                    const leaper = leapers[index];
                    vals = leaper.intersect(row, vals)
                }
            }

            // 4. Yield the val
            for (const val of vals) {
                yield [row, val]
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

    indexBy<NewKName extends keyof Val | KName, NewK extends ValueOf<Val> | K, NewVal extends { [NewKeyName in KName | keyof Val]: ValueOf<Val> | K }>(newkeyOrdering: [NewKName, ...Array<keyof NewVal>]): RelationIndex<NewKName, NewK, NewVal> {
        const keyMapping = this.keyOrdering.reduce((acc: { [key: string]: number }, k, idx) => {
            acc[k as string] = idx
            return acc
        }, {})

        const newData = this.elements.map(row => newkeyOrdering.map(k => row[keyMapping[k as string]])) as Array<[NewK, ...Array<ValueOf<NewVal>>]>
        return new RelationIndex(newData, newkeyOrdering)
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


type FindExpression = (<A>(a: A) => {}) | (<A, B>(a: A, b: B) => {}) | (<A, B, C>(a: A, b: B, c: C) => {}) | (<A, B, C, D>(a: A, b: B, c: C, d: D) => {})

function find(findExpression: FindExpression): any {
}

type FreeVariableObj<Val extends {}> = { [key: string]: FreeVariable<Val[keyof Val]> | Val[keyof Val] }

// For each query there is a collection of relations and free variableObjs on them
class DatalogContext<Val> {
    context: Array<[MultiIndexRelation<Val>, FreeVariableObj<Val>]> = []
    queryPlan() {
        // TODO speed this up
        // Hacky for now. join everything, then filter

        // Build our join groups
        let joinsByKey: {
            [key: string]: Array<MultiIndexRelation<Val>>
        } = {}
        for (let index = 0; index < this.context.length; index++) {
            const [currentRelation] = this.context[index]
            const ks = currentRelation.keys()
            const keyToJoinBy = ks.find(k => !!joinsByKey[k as string])
            // No key in our join set. let's add a new one
            if (keyToJoinBy === undefined) {
                joinsByKey[ks[0] as string] = [currentRelation]
            }
        }

        // Now that we have the groups we are going to join by, let's join each group. Then try the above again until we end up with a single group.
        // TODO



    }
}

class DatalogContextManager<Val> {
    ctxs: Array<DatalogContext<Val>> = []
    add(part: [MultiIndexRelation<Val>, FreeVariableObj<Val>]) {
        if (this.ctxs.length === 0) {
            throw new Error("Ctx not initialized!")
        }

        this.ctxs[this.ctxs.length - 1].context.push(part)
    }


    pushCtx() {
        this.ctxs.push(new DatalogContext())
    }

    popCtx(): DatalogContext<Val> {
        const ctx = this.ctxs.pop(); if (ctx === undefined) {
            throw new Error("No context to pop")
        } return ctx
    }
}

const datalogContextManager = new DatalogContextManager()

// Represents any possible value of T, can be constrained.
export class FreeVariable<T> {
    // Null means it is unconstrained(!)
    availableValues: Array<T> | null = null
    isUnconstrained(): boolean {
        return this.availableValues === null
    }
    constrain(values: Array<T>) {
        if (this.availableValues === null) {
            this.availableValues = values
        }

        let valuesIdx = 0;
        this.availableValues.filter((availVals) => {
        })

        const output: Array<T> = []
        // TODO speed this puppy up!
        this.availableValues.map(availValue => {
            values.map(constrainValue => {
                if (constrainValue === availValue) {
                    output.push(constrainValue)
                }
            })
        })

        this.availableValues = output
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


    assert(v: T) {
        if (this.toAdd.length === 0) {
            this.toAdd.push(new Relation<T>())
        }
        this.toAdd[0].assert(v)
    }

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

export function variableJoinHelperGen<V1>(...variables: [Variable<V1>]): Generator<V1>;
export function variableJoinHelperGen<V1, V2>(...variables: [Variable<V1>, Variable<V2>]): Generator<V1 & V2>;
export function variableJoinHelperGen<V1, V2, V3>(...variables: [Variable<V1>, Variable<V2>, Variable<V3>]): Generator<V1 & V2 & V3>;
export function variableJoinHelperGen<V1, V2, V3, V4>(...variables: [Variable<V1>, Variable<V2>, Variable<V3>, Variable<V4>]): Generator<V1 & V2 & V3 & V4>;

export function* variableJoinHelperGen(...variables: Array<any>): Generator<any> {
    while (variables.some(v => v.changed())) {
        yield* innerVariableJoinHelperGen(variables)
    }
}
export function* innerVariableJoinHelperGen(variables: Array<any>): Generator<any> {
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

    const srckeyOrder = variables[0].keys()
    const fullOutputKeyOrder = joinKeyOrdering(variables.map(v => v.keys()) as any)
    const outputKeyOrder = fullOutputKeyOrder.slice(srckeyOrder.length)
    const restKeyOrders = variables.slice(1).map(variable => {
        // @ts-ignore
        const indexByKeyOrder = filterKeys(variable.keys(), fullOutputKeyOrder)
        return indexByKeyOrder
    })

    const totalIterations = (2 ** variables.length) - 1 // minus 1 since we don't need to check the final state of all stable
    // const totalIterations = (2 ** variables.length)
    let currentIteration = 0
    // let currentIteration = totalIterations - 1
    while (currentIteration < totalIterations) {
        const indexedRelations = variables.map((variable, index) => {
            // check if we should return a recent or stable for this relation
            const relation = ((currentIteration >> index) & 1) ? variable.stable : variable.recent
            if (index !== 0) {
                const indexedRelation = relation.indexBy(restKeyOrders[index - 1] as any)
                // @ts-ignore
                return new ExtendWithUnconstrained(
                    (src: any) => {
                        // @ts-ignore
                        return src[srckeyOrder.indexOf(indexedRelation.keyOrdering[0])]
                    },
                    outputKeyOrder,
                    // @ts-ignore
                    indexedRelation)
                // return indexedRelation.extendWith((src) => {
                //     // @ts-ignore
                //     return src[srckeyOrder.indexOf(indexedRelation.keyOrdering[0])]
                // })
            }
            // @ts-ignore
            return relation.indexBy(srckeyOrder)
        })
        for (let [sourceRow, extension] of leapJoinHelperGen(indexedRelations[0] as any, indexedRelations.slice(1) as any)) {
            const out: any = {}
            srckeyOrder.reduce((acc, k, i) => {
                acc[k] = sourceRow[i]
                return acc
            }, out)
            outputKeyOrder.reduce((acc, k, i) => {
                // @ts-ignore
                acc[k] = extension[i]
                return acc
            }, out);
            yield out
        }

        currentIteration++
    }

}